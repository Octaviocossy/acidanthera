mod agent;
mod logging;
mod settings;
mod vault;

use agent::AgentProcessState;
use vault::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(logging::plugin())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(VaultState::default())
        .manage(AgentProcessState::default())
        .setup(|_app| {
            log::info!("orbit-111 backend started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault::pick_vault,
            vault::open_vault,
            vault::read_vault_tree,
            vault::read_note,
            vault::write_note,
            settings::read_settings,
            settings::write_settings,
            agent::agent_spawn,
            agent::agent_send,
            agent::agent_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
