use rfd::FileDialog;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}

fn read_dir_entries(path: &Path, recursive: bool, depth: u32, max_depth: u32) -> Result<Vec<FileEntry>, String> {
    // CRITICAL: Prevent infinite recursion from symlinks/junctions
    if depth > max_depth {
        return Ok(vec![]);
    }
    
    let read = fs::read_dir(path).map_err(|e| e.to_string())?;

    let mut dirs: Vec<FileEntry> = Vec::new();
    let mut files: Vec<FileEntry> = Vec::new();
    let mut entry_count = 0;
    const MAX_ENTRIES: usize = 100; // Ultra-conservative limit for Windows
    const MAX_DIRS: usize = 30;     // Strict directory limit

    for entry in read {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs
        if name.starts_with('.') {
            continue;
        }

        let entry_path = entry.path();
        let path_str = entry_path.to_string_lossy().to_string();
        
        // ULTRA-FAST: Use file_type() which is cached, NOT metadata() which reads from disk
        // This is 10-100x faster on Windows with many files
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let is_symlink = file_type.is_symlink();
        let is_dir = file_type.is_dir();
        
        // Skip known problematic directories
        let name_lower = name.to_lowercase();
        if name_lower == "node_modules" || name_lower == ".git" || name_lower == "venv" {
            if is_dir {
                dirs.push(FileEntry {
                    name,
                    path: path_str,
                    is_dir: true,
                    children: None,
                });
                entry_count += 1;
                continue;
            }
        }
        
        // NEVER recurse into symlinks
        if is_symlink {
            if is_dir {
                dirs.push(FileEntry {
                    name: format!("{} 🔗", name),
                    path: path_str,
                    is_dir: true,
                    children: None,
                });
                entry_count += 1;
            }
            continue;
        }

        // Build entry
        let fe = FileEntry {
            name,
            path: path_str,
            is_dir,
            children: None, // Always None for initial load (lazy loading)
        };

        if is_dir {
            if dirs.len() < MAX_DIRS {
                dirs.push(fe);
            }
        } else {
            files.push(fe);
        }
        
        entry_count += 1;
        if entry_count >= MAX_ENTRIES {
            break;
        }
    }

    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    dirs.extend(files);
    Ok(dirs)
}

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    eprintln!("[DEBUG] read_directory called: {}", path);
    let start = std::time::Instant::now();
    
    // Direct synchronous call - already optimized to be extremely fast (< 2ms)
    let result = read_dir_entries(Path::new(&path), false, 0, 0);
    
    eprintln!("[DEBUG] read_directory returning {} entries in {:?}", 
              result.as_ref().map(|v| v.len()).unwrap_or(0),
              start.elapsed());
    result
}

#[tauri::command]
pub fn read_directory_recursive(path: String, max_depth: u32) -> Result<Vec<FileEntry>, String> {
    let depth = if max_depth == 0 { 3 } else { max_depth };
    read_dir_entries(Path::new(&path), true, 0, depth)
}

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    // Run blocking filesystem operation on background thread pool
    tokio::task::spawn_blocking(move || {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
}

#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> Result<(), String> {
    // Run blocking filesystem operation on background thread pool
    tokio::task::spawn_blocking(move || {
        // Ensure parent directory exists
        if let Some(parent) = Path::new(&path).parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }
        fs::write(&path, content).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
}

#[tauri::command]
pub async fn create_file(path: String) -> Result<(), String> {
    // Run blocking filesystem operation on background thread pool
    tokio::task::spawn_blocking(move || {
        if let Some(parent) = Path::new(&path).parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }
        fs::File::create(&path).map(|_| ()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
}

#[tauri::command]
pub async fn create_directory(path: String) -> Result<(), String> {
    // Run blocking filesystem operation on background thread pool
    tokio::task::spawn_blocking(move || {
        fs::create_dir_all(&path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
}

#[tauri::command]
pub async fn rename_item(old_path: String, new_path: String) -> Result<(), String> {
    // Run blocking filesystem operation on background thread pool
    tokio::task::spawn_blocking(move || {
        fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
}

#[tauri::command]
pub async fn delete_item(path: String) -> Result<(), String> {
    // Run blocking filesystem operation on background thread pool
    tokio::task::spawn_blocking(move || {
        let p = Path::new(&path);
        if p.is_dir() {
            fs::remove_dir_all(p).map_err(|e| e.to_string())
        } else {
            fs::remove_file(p).map_err(|e| e.to_string())
        }
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
}

#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    // Run blocking file dialog on background thread pool
    tokio::task::spawn_blocking(move || {
        let result = FileDialog::new().pick_folder();
        Ok(result.map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
}

#[tauri::command]
pub async fn get_home_dir() -> Result<String, String> {
    // Run blocking directory lookup on background thread pool
    tokio::task::spawn_blocking(move || {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .ok_or_else(|| "Could not determine home directory".to_string())
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
}
