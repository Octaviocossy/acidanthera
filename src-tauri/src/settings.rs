//! Persisted user settings (epic #24, child #25): a JSON file in the platform app-config dir
//! holding the agent model, editor font, theme, and vault path. Read once at boot by the
//! frontend settings store; written through on every settings change.

use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use thiserror::Error;

use crate::logging::LogResult;

/// File name inside `app_config_dir()` (e.g. `~/Library/Application Support/com.ovct.orbit-111`).
const SETTINGS_FILE: &str = "settings.json";

/// Directory name of the default vault, created under the user's documents dir on first boot.
const DEFAULT_VAULT_DIR: &str = "orbit-brain";

fn default_model() -> String {
    "gpt-5.4-mini".into()
}

fn default_editor_font() -> String {
    "Geist Mono".into()
}

fn default_theme() -> String {
    "dark".into()
}

/// The persisted user settings. Every field carries a `serde` default so a file written by an
/// older version (or hand-edited with fields removed) still deserializes. `vault_path` defaults
/// to the empty string as a sentinel — it needs an `AppHandle` to resolve, so `read_settings`
/// fills it with `<documents>/orbit-brain` before returning.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub model: String,
    pub editor_font: String,
    pub theme: String,
    pub vault_path: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            model: default_model(),
            editor_font: default_editor_font(),
            theme: default_theme(),
            vault_path: String::new(),
        }
    }
}

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("could not resolve an app directory: {0}")]
    Path(#[from] tauri::Error),
    #[error("settings file is not valid JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl Serialize for SettingsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type SettingsResult<T> = Result<T, SettingsError>;

fn settings_file(app: &AppHandle) -> SettingsResult<PathBuf> {
    Ok(app.path().app_config_dir()?.join(SETTINGS_FILE))
}

fn default_vault_path(app: &AppHandle) -> SettingsResult<String> {
    let path = app.path().document_dir()?.join(DEFAULT_VAULT_DIR);
    Ok(path.to_string_lossy().into_owned())
}

fn read_settings_from(file: &Path) -> SettingsResult<Settings> {
    match fs::read_to_string(file) {
        Ok(contents) => Ok(serde_json::from_str(&contents)?),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(Settings::default()),
        Err(err) => Err(err.into()),
    }
}

fn resolve_default_vault_path(settings: &mut Settings, default_path: &str) {
    if settings.vault_path.is_empty() {
        settings.vault_path = default_path.into();
    }
}

fn write_settings_to(file: &Path, settings: &Settings) -> SettingsResult<()> {
    if let Some(dir) = file.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(file, serde_json::to_string_pretty(settings)?)?;
    Ok(())
}

/// Reads the persisted settings, falling back to defaults when no file exists yet. An empty
/// `vault_path` (fresh install or hand-cleared) is resolved to the default vault location.
#[tauri::command]
pub fn read_settings(app: AppHandle) -> SettingsResult<Settings> {
    log::info!("read_settings");
    (|| {
        let file = settings_file(&app)?;
        let mut settings = read_settings_from(&file)?;
        resolve_default_vault_path(&mut settings, &default_vault_path(&app)?);
        Ok(settings)
    })()
    .log_err("read_settings")
}

/// Persists the given settings as pretty-printed JSON, creating the config dir if needed.
#[tauri::command]
pub fn write_settings(app: AppHandle, settings: Settings) -> SettingsResult<()> {
    log::info!(
        "write_settings: model={} theme={} vault_path={}",
        settings.model,
        settings.theme,
        settings.vault_path
    );
    (|| {
        let file = settings_file(&app)?;
        write_settings_to(&file, &settings)
    })()
    .log_err("write_settings")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(label: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("orbit-settings-{}-{label}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("creates temp directory");
        dir
    }

    #[test]
    fn settings_should_serialize_with_camel_case_field_names() {
        let json = serde_json::to_string(&Settings::default()).expect("serializes");
        assert!(json.contains("\"editorFont\"") && json.contains("\"vaultPath\""));
    }

    #[test]
    fn settings_should_fill_missing_fields_with_defaults_when_deserializing() {
        let settings: Settings = serde_json::from_str(r#"{ "theme": "light" }"#).expect("parses");
        assert_eq!(
            (
                settings.theme.as_str(),
                settings.model.as_str(),
                settings.vault_path.as_str()
            ),
            ("light", "gpt-5.4-mini", "")
        );
    }

    #[test]
    fn settings_should_round_trip_through_json() {
        let settings = Settings {
            model: "sonnet-5".into(),
            editor_font: "Menlo".into(),
            theme: "light".into(),
            vault_path: "/tmp/vault".into(),
        };
        let json = serde_json::to_string(&settings).expect("serializes");
        let parsed: Settings = serde_json::from_str(&json).expect("parses");
        assert_eq!(json, serde_json::to_string(&parsed).expect("re-serializes"));
    }

    #[test]
    fn read_settings_from_should_return_defaults_when_the_file_is_missing() {
        let dir = temp_dir("missing");

        let settings = read_settings_from(&dir.join("settings.json")).expect("returns defaults");

        assert_eq!(settings.model, "gpt-5.4-mini");
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn read_settings_from_should_report_invalid_json() {
        let dir = temp_dir("invalid-json");
        let file = dir.join("settings.json");
        fs::write(&file, "{").expect("writes invalid json");

        let error = read_settings_from(&file).expect_err("rejects invalid json");

        assert!(matches!(error, SettingsError::Json(_)));
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn resolve_default_vault_path_should_fill_an_empty_path() {
        let mut settings = Settings::default();

        resolve_default_vault_path(&mut settings, "/Users/tester/Documents/orbit-brain");

        assert_eq!(settings.vault_path, "/Users/tester/Documents/orbit-brain");
    }

    #[test]
    fn resolve_default_vault_path_should_preserve_a_nonempty_path() {
        let mut settings = Settings {
            vault_path: "/custom/vault".into(),
            ..Settings::default()
        };

        resolve_default_vault_path(&mut settings, "/Users/tester/Documents/orbit-brain");

        assert_eq!(settings.vault_path, "/custom/vault");
    }

    #[test]
    fn write_settings_to_should_create_the_parent_directory_and_persist_pretty_camel_case_json() {
        let dir = temp_dir("write");
        let file = dir.join("nested").join("settings.json");
        let settings = Settings {
            model: "sonnet-5".into(),
            editor_font: "Menlo".into(),
            theme: "light".into(),
            vault_path: "/vault".into(),
        };

        write_settings_to(&file, &settings).expect("writes settings");
        let contents = fs::read_to_string(&file).expect("reads settings");

        assert_eq!(contents, "{\n  \"model\": \"sonnet-5\",\n  \"editorFont\": \"Menlo\",\n  \"theme\": \"light\",\n  \"vaultPath\": \"/vault\"\n}");
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn write_settings_to_should_overwrite_an_existing_file() {
        let dir = temp_dir("overwrite");
        let file = dir.join("settings.json");
        fs::write(&file, "old").expect("writes old contents");
        let settings = Settings {
            theme: "light".into(),
            ..Settings::default()
        };

        write_settings_to(&file, &settings).expect("overwrites settings");
        let read_back = read_settings_from(&file).expect("reads settings");

        assert_eq!(read_back.theme, "light");
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn settings_should_default_every_missing_field() {
        let settings: Settings = serde_json::from_str("{}").expect("parses empty object");

        assert_eq!(
            (
                settings.model.as_str(),
                settings.editor_font.as_str(),
                settings.theme.as_str(),
                settings.vault_path.as_str()
            ),
            ("gpt-5.4-mini", "Geist Mono", "dark", "")
        );
    }

    #[test]
    fn settings_should_ignore_the_legacy_engine_field_and_default_model() {
        let settings: Settings =
            serde_json::from_str(r#"{ "engine": "claude-code" }"#).expect("parses legacy settings");

        assert_eq!(settings.model, "gpt-5.4-mini");
    }

    #[test]
    fn settings_should_serialize_to_the_frontend_contract() {
        let settings = Settings {
            model: "gpt-5.4-mini".into(),
            editor_font: "Geist Mono".into(),
            theme: "dark".into(),
            vault_path: "/vault".into(),
        };

        let value = serde_json::to_value(settings).expect("serializes");

        assert_eq!(
            value,
            serde_json::json!({ "model": "gpt-5.4-mini", "editorFont": "Geist Mono", "theme": "dark", "vaultPath": "/vault" })
        );
    }

    #[test]
    fn settings_error_should_serialize_as_a_plain_string() {
        let error = serde_json::from_str::<Settings>("{").expect_err("creates json error");

        let value = serde_json::to_value(SettingsError::Json(error)).expect("serializes");

        assert!(value.is_string());
    }
}
