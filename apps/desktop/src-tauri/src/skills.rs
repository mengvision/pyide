use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;
use zip::ZipArchive;

#[derive(Serialize, Deserialize, Clone)]
pub struct SkillInfo {
    pub name: String,
    pub path: String,
    pub content: String,
    /// List of supporting file paths relative to the skill directory
    #[serde(default)]
    pub support_files: Vec<String>,
}

/// Scan a skill directory for SKILL.md (directory structure) or .md (flat file).
/// Supports both `<name>/SKILL.md` and `<name>.md` formats.
fn scan_skill_dir(dir: &PathBuf) -> Vec<SkillInfo> {
    let mut skills = Vec::new();

    if !dir.exists() {
        return skills;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return skills,
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
            // Directory structure: <name>/SKILL.md
            let skill_file = path.join("SKILL.md");
            if skill_file.exists() {
                if let Ok(content) = fs::read_to_string(&skill_file) {
                    let name = entry.file_name().to_string_lossy().to_string();

                    // Scan for supporting files (scripts/, reference.md, etc.)
                    let support_files = scan_support_files(&path);

                    skills.push(SkillInfo {
                        name,
                        path: skill_file.to_string_lossy().to_string(),
                        content,
                        support_files,
                    });
                }
            }
        } else if path.is_file() {
            // Flat file: <name>.md
            if let Some(ext) = path.extension() {
                if ext == "md" {
                    if let Ok(content) = fs::read_to_string(&path) {
                        let stem = path
                            .file_stem()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default();

                        skills.push(SkillInfo {
                            name: stem,
                            path: path.to_string_lossy().to_string(),
                            content,
                            support_files: Vec::new(),
                        });
                    }
                }
            }
        }
    }

    skills
}

/// Scan a skill directory for supporting files (scripts/, reference.md, etc.)
fn scan_support_files(skill_dir: &PathBuf) -> Vec<String> {
    let mut files = Vec::new();

    let entries = match fs::read_dir(skill_dir) {
        Ok(e) => e,
        Err(_) => return files,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip SKILL.md itself and hidden files
        if file_name == "SKILL.md" || file_name.starts_with('.') {
            continue;
        }

        if path.is_file() {
            // Add relative path like "reference.md"
            files.push(file_name);
        } else if path.is_dir() {
            // Add relative directory entries like "scripts/setup.sh"
            if let Ok(sub_entries) = fs::read_dir(&path) {
                for sub_entry in sub_entries.flatten() {
                    let sub_path = sub_entry.path();
                    if sub_path.is_file() {
                        let sub_name = sub_entry.file_name().to_string_lossy().to_string();
                        if !sub_name.starts_with('.') {
                            files.push(format!("{}/{}", file_name, sub_name));
                        }
                    }
                }
            }
        }
    }

    files
}

/// Scan user skills from ~/.pyide/skills/user/
/// Supports both `<name>/SKILL.md` (directory) and `<name>.md` (flat) formats.
#[tauri::command]
pub async fn scan_skill_directories(base_path: String) -> Result<Vec<SkillInfo>, String> {
    let skill_dir = PathBuf::from(&base_path).join(".pyide/skills/user");

    if !skill_dir.exists() {
        // Create directory if it doesn't exist
        fs::create_dir_all(&skill_dir).map_err(|e| e.to_string())?;
        return Ok(Vec::new());
    }

    Ok(scan_skill_dir(&skill_dir))
}

/// Scan ClawHub-installed skills from ~/.pyide/skills/*.md
#[tauri::command]
pub async fn scan_clawhub_skills(base_path: String) -> Result<Vec<SkillInfo>, String> {
    let skill_dir = PathBuf::from(&base_path).join(".pyide/skills");

    if !skill_dir.exists() {
        return Ok(Vec::new());
    }

    let mut skills = Vec::new();

    if let Ok(entries) = fs::read_dir(&skill_dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            // Only process *.md files directly inside the directory (not subdirs)
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "md" {
                        let stem = path
                            .file_stem()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default();
                        if let Ok(content) = fs::read_to_string(&path) {
                            skills.push(SkillInfo {
                                name: stem,
                                path: path.to_string_lossy().to_string(),
                                content,
                                support_files: Vec::new(),
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(skills)
}

/// Scan project-level skills from [workspace]/.pyide/skills/
/// Supports both `<name>/SKILL.md` and `<name>.md` formats.
#[tauri::command]
pub async fn scan_project_skills(workspace_path: String) -> Result<Vec<SkillInfo>, String> {
    let skill_dir = PathBuf::from(&workspace_path).join(".pyide/skills");

    // Walk up from workspace_path to find .pyide/skills/ in parent dirs
    // (similar to Claude Code's project skill discovery)
    let mut skills = scan_skill_dir(&skill_dir);

    // Also check the workspace itself if it's not the same
    if !skill_dir.exists() {
        // Try walking up to 3 levels
        let mut current = PathBuf::from(&workspace_path);
        for _ in 0..3 {
            if let Some(parent) = current.parent() {
                current = parent.to_path_buf();
                let parent_skill_dir = current.join(".pyide/skills");
                if parent_skill_dir.exists() {
                    skills = scan_skill_dir(&parent_skill_dir);
                    break;
                }
            } else {
                break;
            }
        }
    }

    Ok(skills)
}

/// Return the absolute path to the user skills directory, creating it if needed.
#[tauri::command]
pub async fn get_user_skills_directory(base_path: String) -> Result<String, String> {
    let skill_dir = PathBuf::from(&base_path).join(".pyide/skills/user");
    fs::create_dir_all(&skill_dir).map_err(|e| e.to_string())?;
    Ok(skill_dir.to_string_lossy().to_string())
}

// ── Zip installation ──────────────────────────────────────────────

/// Result of installing a skill from a zip file.
#[derive(Serialize, Deserialize, Clone)]
pub struct InstallSkillResult {
    pub skill_name: String,
    pub install_path: String,
    pub support_files: Vec<String>,
}

/// Install a skill from a zip archive into ~/.pyide/skills/user/.
///
/// The zip must contain either:
///   - A single root directory with `SKILL.md` inside it, OR
///   - A root-level `<name>.md` file
///
/// The zip bytes are passed from the frontend (Tauri base64-encodes Vec<u8>).
#[tauri::command]
pub async fn install_skill_from_zip(
    base_path: String,
    zip_bytes: Vec<u8>,
    file_name: String,
) -> Result<InstallSkillResult, String> {
    // Ensure user skills directory exists
    let user_dir = PathBuf::from(&base_path).join(".pyide/skills/user");
    fs::create_dir_all(&user_dir).map_err(|e| format!("Failed to create skills directory: {}", e))?;

    // Derive skill name from file name (strip .zip extension)
    let stem = PathBuf::from(&file_name)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown-skill".to_string());

    let reader = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(reader)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    // Strategy 1: Check if there's a single root directory containing SKILL.md
    let mut skill_name = stem.clone();
    let mut target_dir = user_dir.join(&skill_name);
    let mut use_root_dir = false;

    // Collect top-level entries
    let mut top_entries: Vec<String> = archive.file_names()
        .filter_map(|name| {
            let parts: Vec<&str> = name.split('/').collect();
            if parts.is_empty() { return None; }
            Some(parts[0].to_string())
        })
        .collect();
    top_entries.sort();
    top_entries.dedup();

    // Check if zip has a single root directory
    if top_entries.len() == 1 {
        let root = &top_entries[0];
        let has_skill_md = archive.file_names().any(|name| {
            name == format!("{}/SKILL.md", root) || name == format!("{}/skill.md", root)
        });
        if has_skill_md {
            skill_name = root.clone();
            target_dir = user_dir.join(&skill_name);
            use_root_dir = true;
        }
    }

    // Strategy 2: Check for root-level .md file
    if !use_root_dir {
        let has_root_md = archive.file_names().any(|name| {
            let p = PathBuf::from(name);
            match p.file_name() {
                Some(fn_name) => {
                    let ext = fn_name.to_string_lossy();
                    ext.ends_with(".md") && !name.contains('/')
                }
                None => false,
            }
        });
        if !has_root_md {
            return Err("Invalid skill zip: must contain SKILL.md inside a directory or a root-level .md file".to_string());
        }
        target_dir = user_dir.join(&skill_name);
    }

    // Create target directory (remove existing if present)
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)
            .map_err(|e| format!("Failed to remove existing skill directory: {}", e))?;
    }
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create skill directory: {}", e))?;

    // Extract files
    let mut support_files = Vec::new();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        let outpath = if use_root_dir {
            // Strip the root directory prefix
            let name = file.enclosed_name()
                .ok_or_else(|| "Invalid file path in zip".to_string())?
                .to_path_buf();
            let parts: Vec<std::path::Component<'_>> = name.components().collect();
            if parts.is_empty() { continue; }
            // Skip the root dir component
            let rest = name.iter().skip(1).collect::<PathBuf>();
            if rest.as_os_str().is_empty() { continue; }
            target_dir.join(rest)
        } else {
            let name = file.enclosed_name()
                .ok_or_else(|| "Invalid file path in zip".to_string())?
                .to_path_buf();
            if name.as_os_str().is_empty() { continue; }
            target_dir.join(name.file_name().unwrap_or(name.as_os_str()))
        };

        // Create parent directories
        if let Some(parent) = outpath.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            }
        }

        if file.is_dir() {
            continue;
        }

        let mut outfile = fs::File::create(&outpath)
            .map_err(|e| format!("Failed to create file: {}", e))?;
        std::io::copy(&mut file, &mut outfile)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        // Track support files (relative to target_dir, excluding SKILL.md)
        let relative = outpath.strip_prefix(&target_dir)
            .unwrap_or(&outpath)
            .to_string_lossy()
            .to_string();
        if relative != "SKILL.md" && relative != "skill.md" {
            support_files.push(relative);
        }
    }

    Ok(InstallSkillResult {
        skill_name: skill_name.clone(),
        install_path: target_dir.to_string_lossy().to_string(),
        support_files,
    })
}
