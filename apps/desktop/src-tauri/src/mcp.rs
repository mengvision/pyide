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
    // Remove from HashMap and extract child — release global lock before killing
    let child_arc = {
        let mut servers = MCP_SERVERS.lock().await;
        match servers.remove(&name) {
            Some(server) => server.child,
            None => return Err(format!("Server {} not found", name)),
        }
    }; // Global lock released here

    if let Some(child_arc) = child_arc {
        let mut child = child_arc.lock().await;
        let _ = child.kill();
    }
    Ok(())
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
    // Quickly clone the stdin Arc while holding locks, then release all locks before I/O
    let stdin_arc = {
        let servers = MCP_SERVERS.lock().await;
        match servers.get(&server_name) {
            Some(server) => {
                let channels_arc = server.channels.clone();
                drop(servers); // Release global lock (L1) before acquiring per-server lock
                let channels = channels_arc
                    .as_ref()
                    .ok_or_else(|| format!("Server {} channels not initialized", server_name))?
                    .lock().await;
                channels.stdin.clone() // Clone Arc (cheap), will release L2 after this block
            }
            None => return Err(format!("Server {} not found", server_name)),
        }
    }; // L1 + L2 locks released here — read_mcp_message can proceed freely

    if let Some(stdin_arc) = stdin_arc {
        let mut stdin = stdin_arc.lock().await; // Only lock L3a (stdin)

        stdin.write_all(message.as_bytes())
            .map_err(|e| format!("Failed to write to {}: {}", server_name, e))?;
        stdin.flush()
            .map_err(|e| format!("Failed to flush {}: {}", server_name, e))?;

        Ok(())
    } else {
        Err(format!("No stdin channel for server {}", server_name))
    }
}

/// Read a line from an MCP server's stdout
#[tauri::command]
pub async fn read_mcp_message(server_name: String) -> Result<String, String> {
    // Quickly clone the stdout Arc while holding locks, then release all locks before blocking I/O
    let stdout_arc = {
        let servers = MCP_SERVERS.lock().await;
        match servers.get(&server_name) {
            Some(server) => {
                let channels_arc = server.channels.clone();
                drop(servers); // Release global lock (L1) before acquiring per-server lock
                let channels = channels_arc
                    .as_ref()
                    .ok_or_else(|| format!("Server {} channels not initialized", server_name))?
                    .lock().await;
                channels.stdout.clone() // Clone Arc (cheap), will release L2 after this block
            }
            None => return Err(format!("Server {} not found", server_name)),
        }
    }; // L1 + L2 locks released here — send_mcp_message can proceed freely

    if let Some(stdout_arc) = stdout_arc {
        let mut stdout = stdout_arc.lock().await; // Only lock L3b (stdout)

        let mut line = String::new();
        stdout.read_line(&mut line)
            .map_err(|e| format!("Failed to read from {}: {}", server_name, e))?;

        Ok(line)
    } else {
        Err(format!("No stdout channel for server {}", server_name))
    }
}
