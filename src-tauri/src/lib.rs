mod vault;

use vault::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(VaultState::default())
        .invoke_handler(tauri::generate_handler![
            vault::pick_vault,
            vault::read_vault_tree,
            vault::read_note,
            vault::write_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
