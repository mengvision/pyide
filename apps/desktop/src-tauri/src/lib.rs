mod auth;
mod fs_commands;
mod kernel;
mod uv;
mod skills;
mod mcp;
mod memory;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to PyIDE.", name)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(kernel::KernelState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            fs_commands::read_directory,
            fs_commands::read_directory_recursive,
            fs_commands::read_text_file,
            fs_commands::write_text_file,
            fs_commands::create_file,
            fs_commands::create_directory,
            fs_commands::rename_item,
            fs_commands::delete_item,
            fs_commands::pick_folder,
            fs_commands::get_home_dir,
            kernel::start_kernel,
            kernel::stop_kernel,
            kernel::interrupt_kernel,
            kernel::get_kernel_status,
            uv::uv_check_installed,
            uv::uv_create_venv,
            uv::uv_delete_venv,
            uv::uv_list_venvs,
            uv::uv_install_package,
            uv::uv_uninstall_package,
            uv::uv_list_packages,
            uv::uv_get_python_path,
            // Skill system commands
            skills::scan_skill_directories,
            skills::scan_clawhub_skills,
            skills::get_user_skills_directory,
            // MCP commands
            mcp::start_mcp_server,
            mcp::stop_mcp_server,
            mcp::list_mcp_servers,
            mcp::get_mcp_config_path,
            mcp::send_mcp_message,
            mcp::read_mcp_message,
            // Memory system commands
            memory::get_memory_base_dir,
            memory::get_user_memory_path,
            memory::get_project_memory_path,
            // Auth token commands
            auth::save_auth_token,
            auth::load_auth_token,
            auth::clear_auth_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
