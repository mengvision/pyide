use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[tauri::command]
pub async fn get_memory_base_dir(home_dir: String) -> Result<String, String> {
    let memory_dir = PathBuf::from(&home_dir)
        .join(".pyide")
        .join("memory");
    
    // Create directory structure
    std::fs::create_dir_all(&memory_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(memory_dir.join("projects")).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(memory_dir.join("sessions")).map_err(|e| e.to_string())?;
    
    Ok(memory_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_user_memory_path(home_dir: String) -> Result<String, String> {
    let memory_dir = PathBuf::from(&home_dir)
        .join(".pyide")
        .join("memory");
    
    std::fs::create_dir_all(&memory_dir).map_err(|e| e.to_string())?;
    
    let user_mem_path = memory_dir.join("user.md");
    Ok(user_mem_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_project_memory_path(home_dir: String, project_id: String) -> Result<String, String> {
    let memory_dir = PathBuf::from(&home_dir)
        .join(".pyide")
        .join("memory")
        .join("projects")
        .join(&project_id);
    
    std::fs::create_dir_all(&memory_dir).map_err(|e| e.to_string())?;
    
    let project_mem_path = memory_dir.join("project.md");
    Ok(project_mem_path.to_string_lossy().to_string())
}
