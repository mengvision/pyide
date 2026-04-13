use std::fs;
use std::path::PathBuf;

fn get_auth_token_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())?;
    let dir = home.join(".pyide");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir.join(".auth_token"))
}

#[tauri::command]
pub fn save_auth_token(token: String) -> Result<(), String> {
    let path = get_auth_token_path()?;
    fs::write(&path, token).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_auth_token() -> Result<Option<String>, String> {
    let path = get_auth_token_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let trimmed = content.trim().to_string();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed))
    }
}

#[tauri::command]
pub fn clear_auth_token() -> Result<(), String> {
    let path = get_auth_token_path()?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
