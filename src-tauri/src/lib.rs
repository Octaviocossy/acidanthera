mod agent;
mod chats;
mod config;
mod logging;
mod settings;
mod vault;
mod wikilink;

use agent::AgentProcessState;
use config::ConfigWatcherState;
use tauri::Manager;
use vault::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(logging::plugin())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(VaultState::default())
        .manage(AgentProcessState::default())
        .manage(ConfigWatcherState::default())
        .setup(|app| {
            log::info!("orbit-111 backend started");
            let handle = app.handle().clone();
            // Must run before `config::init`'s first-run scaffold: settings migration only
            // triggers while `settings.toml` is still absent, and `config::init` would otherwise
            // win that race and scaffold an empty placeholder first.
            settings::init(&handle);
            let config_watcher_state = app.state::<ConfigWatcherState>();
            config::init(&handle, &config_watcher_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault::pick_vault,
            vault::open_vault,
            vault::read_vault_tree,
            vault::read_note,
            vault::write_note,
            vault::create_note,
            vault::create_directory,
            vault::delete_entry,
            vault::rename_entry,
            vault::duplicate_entry,
            vault::scan_wikilink_targets,
            vault::rewrite_wikilinks,
            settings::read_settings,
            settings::write_settings,
            chats::save_chat,
            chats::read_chat,
            chats::list_chats,
            chats::delete_chat,
            agent::agent_spawn,
            agent::agent_send,
            agent::agent_stop,
            config::read_config_file,
            config::write_config_file,
            config::parse_config_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
