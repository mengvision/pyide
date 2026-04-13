use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Arc;
use tokio::sync::Mutex;
use lazy_static::lazy_static;

pub struct MCPStdioChannels {
    pub stdin: Option<Arc<Mutex<ChildStdin>>>,
    pub stdout: Option<Arc<Mutex<BufReader<std::process::ChildStdout>>>>,
}

#[derive(Serialize, Deserialize)]
pub struct MCPServerProcess {
    pub name: String,
    #[serde(skip)]
    pub child: Option<Arc<Mutex<Child>>>,
    #[serde(skip)]
    pub channels: Option<Arc<Mutex<MCPStdioChannels>>>,
}

lazy_static! {
    static ref MCP_SERVERS: Arc<Mutex<HashMap<String, MCPServerProcess>>> = 
        Arc::new(Mutex::new(HashMap::new()));
}

#[tauri::command]
pub async fn start_mcp_server(
    name: String,
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
) -> Result<(), String> {
    let mut servers = MCP_SERVERS.lock().await;
    
    if servers.contains_key(&name) {
        return Err(format!("Server {} already running", name));
    }
    
    let mut cmd = Command::new(&command);
    cmd.args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    for (key, value) in env {
        cmd.env(key, value);
    }
    
    let mut child = cmd.spawn().map_err(|e| format!("Failed to start MCP server {}: {}", name, e))?;
    
    // Extract stdin and stdout for JSON-RPC communication
    let stdin = child.stdin.take();
    let stdout = child.stdout.take();
    
    let channels = MCPStdioChannels {
        stdin: stdin.map(|s| Arc::new(Mutex::new(s))),
        stdout: stdout.map(|s| Arc::new(Mutex::new(BufReader::new(s)))),
    };
    
    servers.insert(name.clone(), MCPServerProcess {
        name: name.clone(),
        child: Some(Arc::new(Mutex::new(child))),
        channels: Some(Arc::new(Mutex::new(channels))),
    });
    
    Ok(())
}

#[tauri::command]
pub async fn stop_mcp_server(name: String) -> Result<(), String> {
    let mut servers = MCP_SERVERS.lock().await;
    
    if let Some(server) = servers.remove(&name) {
        if let Some(child_arc) = server.child {
            let mut child = child_arc.lock().await;
            // Try to kill the process
            let _ = child.kill();
        }
        Ok(())
    } else {
        Err(format!("Server {} not found", name))
    }
}

#[tauri::command]
pub async fn list_mcp_servers() -> Result<Vec<String>, String> {
    let servers = MCP_SERVERS.lock().await;
    Ok(servers.keys().cloned().collect())
}

#[tauri::command]
pub async fn get_mcp_config_path(home_dir: String) -> Result<String, String> {
    let config_path = std::path::PathBuf::from(&home_dir)
        .join(".pyide")
        .join("mcp_config.json");
    
    // Create parent directory if it doesn't exist
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    Ok(config_path.to_string_lossy().to_string())
}

/// Send a JSON-RPC message to an MCP server via stdin
#[tauri::command]
pub async fn send_mcp_message(
    server_name: String,
    message: String,
) -> Result<(), String> {
    let servers = MCP_SERVERS.lock().await;
    
    if let Some(server) = servers.get(&server_name) {
        if let Some(channels_arc) = &server.channels {
            let channels = channels_arc.lock().await;
            
            if let Some(stdin_arc) = &channels.stdin {
                let mut stdin = stdin_arc.lock().await;
                
                // Write message with newline delimiter
                stdin.write_all(message.as_bytes())
                    .map_err(|e| format!("Failed to write to {}: {}", server_name, e))?;
                stdin.flush()
                    .map_err(|e| format!("Failed to flush {}: {}", server_name, e))?;
                
                return Ok(());
            }
        }
        Err(format!("No stdin channel for server {}", server_name))
    } else {
        Err(format!("Server {} not found", server_name))
    }
}

/// Read a line from an MCP server's stdout
#[tauri::command]
pub async fn read_mcp_message(server_name: String) -> Result<String, String> {
    let servers = MCP_SERVERS.lock().await;
    
    if let Some(server) = servers.get(&server_name) {
        if let Some(channels_arc) = &server.channels {
            let channels = channels_arc.lock().await;
            
            if let Some(stdout_arc) = &channels.stdout {
                let mut stdout = stdout_arc.lock().await;
                
                let mut line = String::new();
                stdout.read_line(&mut line)
                    .map_err(|e| format!("Failed to read from {}: {}", server_name, e))?;
                
                return Ok(line);
            }
        }
        Err(format!("No stdout channel for server {}", server_name))
    } else {
        Err(format!("Server {} not found", server_name))
    }
}
