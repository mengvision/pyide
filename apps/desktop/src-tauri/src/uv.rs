use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

/// Find the full path to the `uv` executable.
fn find_uv_path() -> Option<PathBuf> {
    // Try direct command first (relies on PATH)
    if let Ok(out) = Command::new("uv").arg("--version").output() {
        if out.status.success() {
            return Some(PathBuf::from("uv"));
        }
    }
    
    // Fallback: try common installation paths on Windows
    #[cfg(windows)]
    {
        use std::env;
        if let Some(home) = env::var_os("USERPROFILE") {
            let home_path = PathBuf::from(home);
            
            // Check Anaconda/Miniconda Scripts directory
            let conda_uv = home_path.join("anaconda3").join("Scripts").join("uv.exe");
            if conda_uv.exists() {
                return Some(conda_uv);
            }
            
            let miniconda_uv = home_path.join("miniconda3").join("Scripts").join("uv.exe");
            if miniconda_uv.exists() {
                return Some(miniconda_uv);
            }
            
            // Check .local/bin (pip install --user)
            let local_uv = home_path.join(".local").join("bin").join("uv.exe");
            if local_uv.exists() {
                return Some(local_uv);
            }
        }
        
        // Check ProgramData (system-wide pip install)
        if let Some(program_data) = env::var_os("PROGRAMDATA") {
            let program_data_path = PathBuf::from(program_data);
            let global_uv = program_data_path.join("Python").join("Scripts").join("uv.exe");
            if global_uv.exists() {
                return Some(global_uv);
            }
        }
    }
    
    None
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VenvInfo {
    pub name: String,
    pub path: String,
    pub python_version: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PackageInfo {
    pub name: String,
    pub version: String,
}

/// Returns the path to the Python executable inside a venv.
fn python_exe_in_venv(venv_path: &str) -> String {
    #[cfg(windows)]
    {
        format!("{}\\Scripts\\python.exe", venv_path)
    }
    #[cfg(not(windows))]
    {
        format!("{}/bin/python", venv_path)
    }
}

/// Detect the Python version installed in a venv by running `python --version`.
fn detect_python_version(venv_path: &str) -> String {
    let python = python_exe_in_venv(venv_path);
    let output = Command::new(&python)
        .arg("--version")
        .output();

    match output {
        Ok(out) => {
            // `python --version` writes to stdout on 3.x
            let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if raw.is_empty() {
                // Some older builds write to stderr
                String::from_utf8_lossy(&out.stderr).trim().to_string()
            } else {
                raw
            }
        }
        Err(_) => "unknown".to_string(),
    }
}

/// Create a Command for running uv, using the detected path.
fn uv_command() -> Result<Command, String> {
    let uv_path = find_uv_path().ok_or_else(|| "uv is not installed".to_string())?;
    Ok(Command::new(uv_path))
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Check whether `uv` is available on PATH.
#[tauri::command]
pub fn uv_check_installed() -> Result<bool, String> {
    Ok(find_uv_path().is_some())
}

/// Create a new virtual environment using `uv venv`.
///
/// The venv is created at `{project_path}/.venv/{name}`.
/// If `python_version` is provided, `--python {version}` is passed to uv.
#[tauri::command]
pub fn uv_create_venv(
    name: String,
    python_version: Option<String>,
    project_path: String,
) -> Result<VenvInfo, String> {
    let venv_root = PathBuf::from(&project_path).join(".venv");
    let venv_path = venv_root.join(&name);
    let venv_path_str = venv_path
        .to_str()
        .ok_or_else(|| "Invalid venv path".to_string())?
        .to_string();

    let mut cmd = uv_command()?;
    cmd.arg("venv").arg(&venv_path_str);

    if let Some(ref version) = python_version {
        if !version.is_empty() {
            cmd.arg("--python").arg(version);
        }
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run uv: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("uv venv failed: {}", stderr));
    }

    let python_ver = detect_python_version(&venv_path_str);

    Ok(VenvInfo {
        name,
        path: venv_path_str,
        python_version: python_ver,
    })
}

/// Delete an existing virtual environment directory.
#[tauri::command]
pub fn uv_delete_venv(name: String, project_path: String) -> Result<(), String> {
    let venv_path = PathBuf::from(&project_path).join(".venv").join(&name);
    if venv_path.exists() {
        fs::remove_dir_all(&venv_path)
            .map_err(|e| format!("Failed to delete venv '{}': {}", name, e))?;
    }
    Ok(())
}

/// List all virtual environments found under `{project_path}/.venv/`.
///
/// Supports two layouts:
/// 1. `{project_path}/.venv/<name>/` – multiple named envs (this task's layout).
/// 2. `{project_path}/.venv/` itself is a venv (single default env, recognised
///    by the presence of a `pyvenv.cfg` file directly inside `.venv/`).
#[tauri::command]
pub fn uv_list_venvs(project_path: String) -> Result<Vec<VenvInfo>, String> {
    let venv_root = PathBuf::from(&project_path).join(".venv");

    if !venv_root.exists() {
        return Ok(vec![]);
    }

    // If `.venv` itself is a venv (single-env layout), return it directly.
    if venv_root.join("pyvenv.cfg").exists() {
        let path_str = venv_root
            .to_str()
            .unwrap_or_default()
            .to_string();
        let python_version = detect_python_version(&path_str);
        return Ok(vec![VenvInfo {
            name: ".venv".to_string(),
            path: path_str,
            python_version,
        }]);
    }

    // Otherwise scan subdirectories.
    let entries = fs::read_dir(&venv_root)
        .map_err(|e| format!("Failed to read .venv directory: {}", e))?;

    let mut venvs = Vec::new();

    for entry in entries.flatten() {
        let meta = entry.metadata();
        if let Ok(m) = meta {
            if m.is_dir() {
                let venv_path = entry.path();
                // Verify it looks like a venv (has pyvenv.cfg)
                if venv_path.join("pyvenv.cfg").exists() {
                    let path_str = venv_path.to_str().unwrap_or_default().to_string();
                    let name = entry
                        .file_name()
                        .to_str()
                        .unwrap_or_default()
                        .to_string();
                    let python_version = detect_python_version(&path_str);
                    venvs.push(VenvInfo {
                        name,
                        path: path_str,
                        python_version,
                    });
                }
            }
        }
    }

    Ok(venvs)
}

/// Install a package into the specified venv using `uv pip install`.
#[tauri::command]
pub fn uv_install_package(package: String, venv_path: String) -> Result<String, String> {
    let output = Command::new("uv")
        .arg("pip")
        .arg("install")
        .arg(&package)
        .env("VIRTUAL_ENV", &venv_path)
        .output()
        .map_err(|e| format!("Failed to run uv: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("uv pip install failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Uninstall a package from the specified venv using `uv pip uninstall`.
#[tauri::command]
pub fn uv_uninstall_package(package: String, venv_path: String) -> Result<String, String> {
    let output = Command::new("uv")
        .arg("pip")
        .arg("uninstall")
        .arg(&package)
        .arg("--yes")
        .env("VIRTUAL_ENV", &venv_path)
        .output()
        .map_err(|e| format!("Failed to run uv: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("uv pip uninstall failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Raw JSON item returned by `uv pip list --format json`.
#[derive(Deserialize)]
struct UvPipListEntry {
    name: String,
    version: String,
}

/// List all installed packages in the specified venv.
#[tauri::command]
pub fn uv_list_packages(venv_path: String) -> Result<Vec<PackageInfo>, String> {
    let output = Command::new("uv")
        .arg("pip")
        .arg("list")
        .arg("--format")
        .arg("json")
        .env("VIRTUAL_ENV", &venv_path)
        .output()
        .map_err(|e| format!("Failed to run uv: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("uv pip list failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let entries: Vec<UvPipListEntry> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse uv pip list output: {}", e))?;

    Ok(entries
        .into_iter()
        .map(|e| PackageInfo {
            name: e.name,
            version: e.version,
        })
        .collect())
}

/// Return the path to the Python executable inside the venv.
#[tauri::command]
pub fn uv_get_python_path(venv_path: String) -> Result<String, String> {
    let python = python_exe_in_venv(&venv_path);
    if std::path::Path::new(&python).exists() {
        Ok(python)
    } else {
        Err(format!(
            "Python executable not found in venv at '{}'",
            python
        ))
    }
}
