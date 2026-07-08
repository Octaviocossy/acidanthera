mod agent;
mod vault;

use agent::AgentProcessState;
use vault::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(VaultState::default())
        .manage(AgentProcessState::default())
        .invoke_handler(tauri::generate_handler![
            vault::pick_vault,
            vault::read_vault_tree,
            vault::read_note,
            vault::write_note,
            agent::agent_spawn,
            agent::agent_send,
            agent::agent_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
