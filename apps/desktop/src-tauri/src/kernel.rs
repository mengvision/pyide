use std::net::{TcpListener, TcpStream};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use serde::Serialize;
use tauri::State;

pub struct KernelState {
    pub process: Mutex<Option<Child>>,
    pub port: Mutex<Option<u16>>,
}

impl KernelState {
    pub fn new() -> Self {
        KernelState {
            process: Mutex::new(None),
            port: Mutex::new(None),
        }
    }
}

#[derive(Serialize)]
pub struct KernelInfo {
    pub port: u16,
    pub status: String,
}

/// Find an available TCP port. Tries 8765 first, then a random range.
fn find_available_port() -> Result<u16, String> {
    // Try preferred port first
    if TcpListener::bind(("127.0.0.1", 8765u16)).is_ok() {
        return Ok(8765);
    }
    // Try ports in range 8766-9999
    for port in 8766u16..9999 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }
    Err("No available port found in range 8765-9999".to_string())
}

/// Find python executable path
fn find_python(python_path: Option<String>) -> Result<String, String> {
    if let Some(path) = python_path {
        if !path.is_empty() {
            return Ok(path);
        }
    }

    // Check VIRTUAL_ENV environment variable first
    if let Ok(venv) = std::env::var("VIRTUAL_ENV") {
        #[cfg(windows)]
        let candidate = format!("{}\\Scripts\\python.exe", venv);
        #[cfg(not(windows))]
        let candidate = format!("{}/bin/python", venv);

        if std::path::Path::new(&candidate).exists() {
            return Ok(candidate);
        }
    }

    // Try "python" in PATH (Windows typically uses "python")
    #[cfg(windows)]
    {
        if Command::new("python").arg("--version").output().is_ok() {
            return Ok("python".to_string());
        }
    }

    // Try "python3" on Unix
    #[cfg(not(windows))]
    {
        if Command::new("python3").arg("--version").output().is_ok() {
            return Ok("python3".to_string());
        }
        if Command::new("python").arg("--version").output().is_ok() {
            return Ok("python".to_string());
        }
    }

    Err("Python executable not found. Please ensure Python is installed and in PATH.".to_string())
}

/// Wait for the kernel to be ready by polling the TCP port
fn wait_for_kernel(port: u16) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    for _ in 0..50 {
        if TcpStream::connect_timeout(
            &addr.parse().unwrap(),
            Duration::from_millis(200),
        )
        .is_ok()
        {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

#[tauri::command]
pub fn start_kernel(
    state: State<KernelState>,
    python_path: Option<String>,
    pykernel_path: String,
) -> Result<KernelInfo, String> {
    // Check if already running
    {
        let port_guard = state.port.lock().map_err(|e| e.to_string())?;
        if let Some(port) = *port_guard {
            // Check if process is still alive
            let mut proc_guard = state.process.lock().map_err(|e| e.to_string())?;
            if let Some(child) = proc_guard.as_mut() {
                match child.try_wait() {
                    Ok(None) => {
                        // Process still running
                        return Ok(KernelInfo {
                            port,
                            status: "running".to_string(),
                        });
                    }
                    _ => {
                        // Process exited, fall through to restart
                    }
                }
            }
        }
    }

    let port = find_available_port()?;
    let python = find_python(python_path)?;

    let mut cmd = Command::new(&python);
    cmd.arg("-m")
        .arg("pykernel")
        .arg("--port")
        .arg(port.to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Try to resolve pykernel_path to a valid absolute directory
    let resolved = std::path::Path::new(&pykernel_path);
    if resolved.is_absolute() && resolved.is_dir() {
        cmd.current_dir(resolved);
    } else if let Ok(abs) = std::fs::canonicalize(&pykernel_path) {
        if abs.is_dir() {
            cmd.current_dir(abs);
        }
    } else {
        // Try resolving relative to the executable's location, walking up to find workspace root
        if let Ok(exe) = std::env::current_exe() {
            let mut search = exe.parent().map(|p| p.to_path_buf());
            loop {
                match search {
                    Some(ref dir) => {
                        let candidate = dir.join("packages").join("pykernel");
                        if candidate.is_dir() {
                            cmd.current_dir(candidate);
                            break;
                        }
                        search = dir.parent().map(|p| p.to_path_buf());
                    }
                    None => break,
                }
            }
        }
        // If still no current_dir set, that's OK — pykernel is pip-installed
        // so `python -m pykernel` works from the default CWD
    }

    // Hide console window on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn kernel process: {}", e))?;

    // Wait for the kernel to be ready
    let ready = wait_for_kernel(port);
    if !ready {
        return Err(format!(
            "Kernel did not start within 10 seconds on port {}",
            port
        ));
    }

    // Store state
    *state.process.lock().map_err(|e| e.to_string())? = Some(child);
    *state.port.lock().map_err(|e| e.to_string())? = Some(port);

    Ok(KernelInfo {
        port,
        status: "running".to_string(),
    })
}

#[tauri::command]
pub fn stop_kernel(state: State<KernelState>) -> Result<(), String> {
    let mut proc_guard = state.process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = proc_guard.take() {
        child.kill().map_err(|e| format!("Failed to kill kernel: {}", e))?;
        let _ = child.wait(); // Reap the zombie
    }

    *state.port.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

#[tauri::command]
pub fn interrupt_kernel(state: State<KernelState>) -> Result<(), String> {
    // On Windows: the simplest MVP approach is to send a WebSocket interrupt
    // message from the frontend. If the process needs to be forcefully
    // interrupted, we kill it here and the frontend will reconnect.
    // For a proper SIGINT on Windows we would need GenerateConsoleCtrlEvent,
    // which requires the child to share our console group—not the case when
    // CREATE_NO_WINDOW is set. So kill-and-mark-stopped is the safest path.
    #[cfg(windows)]
    {
        let killed = {
            let mut proc_guard = state.process.lock().map_err(|e| e.to_string())?;
            if let Some(child) = proc_guard.as_mut() {
                match child.try_wait() {
                    Ok(None) => {
                        // Still running — kill it; frontend will restart via startKernel
                        child.kill().map_err(|e| format!("Failed to interrupt kernel: {}", e))?;
                        let _ = child.wait();
                        true
                    }
                    _ => false,
                }
            } else {
                false
            }
        }; // proc_guard dropped here
        if killed {
            *state.port.lock().map_err(|e| e.to_string())? = None;
        }
    }

    #[cfg(not(windows))]
    {
        use std::process::Command as Cmd;
        let proc_guard = state.process.lock().map_err(|e| e.to_string())?;
        if let Some(child) = proc_guard.as_ref() {
            // Send SIGINT via kill(1) shell utility — no libc crate needed
            let _ = Cmd::new("kill")
                .arg("-INT")
                .arg(child.id().to_string())
                .output();
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_kernel_status(state: State<KernelState>) -> Result<KernelInfo, String> {
    let port_guard = state.port.lock().map_err(|e| e.to_string())?;

    if let Some(port) = *port_guard {
        let mut proc_guard = state.process.lock().map_err(|e| e.to_string())?;
        let alive = if let Some(child) = proc_guard.as_mut() {
            matches!(child.try_wait(), Ok(None))
        } else {
            false
        };

        Ok(KernelInfo {
            port,
            status: if alive {
                "running".to_string()
            } else {
                "stopped".to_string()
            },
        })
    } else {
        Ok(KernelInfo {
            port: 0,
            status: "stopped".to_string(),
        })
    }
}
