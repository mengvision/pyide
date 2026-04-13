use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
pub struct SkillInfo {
    pub name: String,
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub async fn scan_skill_directories(base_path: String) -> Result<Vec<SkillInfo>, String> {
    let mut skills = Vec::new();
    let skill_dir = PathBuf::from(&base_path).join(".pyide/skills/user");
    
    if !skill_dir.exists() {
        // Create directory if it doesn't exist
        fs::create_dir_all(&skill_dir).map_err(|e| e.to_string())?;
        return Ok(skills);
    }
    
    for entry in fs::read_dir(&skill_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let skill_file = entry.path().join("SKILL.md");
        
        if skill_file.exists() {
            let content = fs::read_to_string(&skill_file).map_err(|e| e.to_string())?;
            skills.push(SkillInfo {
                name: entry.file_name().to_string_lossy().to_string(),
                path: skill_file.to_string_lossy().to_string(),
                content,
            });
        }
    }
    
    Ok(skills)
}

/// Scan ~/.pyide/skills/ for flat .md files installed by ClawHub.
#[tauri::command]
pub async fn scan_clawhub_skills(base_path: String) -> Result<Vec<SkillInfo>, String> {
    let mut skills = Vec::new();
    let skill_dir = PathBuf::from(&base_path).join(".pyide/skills");

    if !skill_dir.exists() {
        // Directory doesn't exist yet — nothing installed
        return Ok(skills);
    }

    for entry in fs::read_dir(&skill_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        // Only process *.md files directly inside the directory (not subdirs)
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" {
                    let stem = path
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
                    skills.push(SkillInfo {
                        name: stem,
                        path: path.to_string_lossy().to_string(),
                        content,
                    });
                }
            }
        }
    }

    Ok(skills)
}

#[tauri::command]
pub async fn get_user_skills_directory(base_path: String) -> Result<String, String> {
    let skill_dir = PathBuf::from(&base_path).join(".pyide/skills/user");
    fs::create_dir_all(&skill_dir).map_err(|e| e.to_string())?;
    Ok(skill_dir.to_string_lossy().to_string())
}
