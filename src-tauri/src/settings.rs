//! Persisted user settings (epic #24, child #25; migrated to TOML for #96/epic #94): a
//! `settings.toml` file in the platform app-config dir holding the agent model, editor font,
//! theme, and vault path. Read once at boot by the frontend settings store; the dialog edits it
//! in place through `toml_edit`, preserving the user's comments and key order (ADR 0003). A
//! legacy `settings.json` (the pre-#96 format) is migrated once at boot, before `config::init`'s
//! first-run scaffold — see `lib.rs`.

use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use thiserror::Error;
use toml_edit::{DocumentMut, Item, Value};

use crate::logging::LogResult;

/// File name inside `app_config_dir()` (e.g. `~/Library/Application Support/com.ovct.acidanthera`).
const SETTINGS_FILE: &str = "settings.toml";

/// The pre-#96 JSON file name, migrated to `SETTINGS_FILE` once at boot and then deleted.
const LEGACY_SETTINGS_FILE: &str = "settings.json";

/// Directory name of the default vault, created under the user's documents dir on first boot.
const DEFAULT_VAULT_DIR: &str = "acidanthera-brain";

/// Valid `theme` values (spec decision 10 — a bad value degrades to the default instead of
/// flowing through unchecked; mirrors TS's `ThemeName`).
const VALID_THEMES: [&str; 2] = ["dark", "light"];

/// Mirrors `AgentModelId` in `src/lib/agent/model-catalog.ts:16`. Kept in sync by hand, like
/// `default_model()` already mirrors that file's `DEFAULT_MODEL_ID`.
const KNOWN_MODELS: [&str; 4] = ["gpt-5.4-mini", "haiku-4.5", "sonnet-5", "gpt-5.5-fast"];

fn default_model() -> String {
    "gpt-5.4-mini".into()
}

fn default_editor_font() -> String {
    "JetBrains Mono".into()
}

fn default_theme() -> String {
    "dark".into()
}

/// The persisted user settings. Every field carries a `serde` default so a file written by an
/// older version (or hand-edited with fields removed) still deserializes. `vault_path` defaults
/// to the empty string as a sentinel — it needs an `AppHandle` to resolve, so `read_settings`
/// fills it with `<documents>/acidanthera-brain` before returning.
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
    #[error("settings file is not valid TOML: {0}")]
    Toml(#[from] toml_edit::TomlError),
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

/// A single degradation, surfaced to the frontend so the dialog can explain why a value isn't
/// what the user expects (spec decision 10). `Syntax` means the whole document was rejected and
/// `settings` fell back to defaults; `Field` means one key was missing or invalid and only that
/// key fell back — the rest of the document parsed fine.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum SettingsDiagnostic {
    Syntax {
        message: String,
        line: Option<usize>,
    },
    Field {
        key: String,
        message: String,
    },
}

/// Return shape of `read_settings`: settings are always populated (falling back to defaults
/// wherever the file was missing, unreadable, or invalid), and `diagnostics` names anything that
/// degraded. An empty `diagnostics` means the file parsed clean.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsReadResult {
    pub settings: Settings,
    pub diagnostics: Vec<SettingsDiagnostic>,
}

fn settings_file(app: &AppHandle) -> SettingsResult<PathBuf> {
    Ok(app.path().app_config_dir()?.join(SETTINGS_FILE))
}

fn legacy_settings_file(app: &AppHandle) -> SettingsResult<PathBuf> {
    Ok(app.path().app_config_dir()?.join(LEGACY_SETTINGS_FILE))
}

fn default_vault_path(app: &AppHandle) -> SettingsResult<String> {
    let path = app.path().document_dir()?.join(DEFAULT_VAULT_DIR);
    Ok(path.to_string_lossy().into_owned())
}

/// Resolves a `[settings]`-wrapped document to its inner table so the loader tolerates that
/// shape for forward compatibility, even though the writer never emits it — everything else
/// reads flat top-level keys.
fn settings_table(table: &toml::Table) -> &toml::Table {
    table
        .get("settings")
        .and_then(|value| value.as_table())
        .unwrap_or(table)
}

fn missing_diagnostic(key: &str) -> SettingsDiagnostic {
    SettingsDiagnostic::Field {
        key: key.to_string(),
        message: format!("\"{key}\" is missing; using the default"),
    }
}

fn wrong_type_diagnostic(key: &str) -> SettingsDiagnostic {
    SettingsDiagnostic::Field {
        key: key.to_string(),
        message: format!("\"{key}\" must be a string; using the default"),
    }
}

fn extract_string(
    table: &toml::Table,
    key: &str,
    default: &str,
    diagnostics: &mut Vec<SettingsDiagnostic>,
) -> String {
    match table.get(key) {
        Some(toml::Value::String(value)) => value.clone(),
        Some(_) => {
            diagnostics.push(wrong_type_diagnostic(key));
            default.to_string()
        }
        None => {
            diagnostics.push(missing_diagnostic(key));
            default.to_string()
        }
    }
}

fn extract_theme(table: &toml::Table, diagnostics: &mut Vec<SettingsDiagnostic>) -> String {
    match table.get("theme") {
        Some(toml::Value::String(value)) if VALID_THEMES.contains(&value.as_str()) => value.clone(),
        Some(toml::Value::String(value)) => {
            diagnostics.push(SettingsDiagnostic::Field {
                key: "theme".to_string(),
                message: format!("\"{value}\" is not a valid theme (expected \"dark\" or \"light\"); using the default"),
            });
            default_theme()
        }
        Some(_) => {
            diagnostics.push(wrong_type_diagnostic("theme"));
            default_theme()
        }
        None => {
            diagnostics.push(missing_diagnostic("theme"));
            default_theme()
        }
    }
}

fn extract_model(table: &toml::Table, diagnostics: &mut Vec<SettingsDiagnostic>) -> String {
    match table.get("model") {
        Some(toml::Value::String(value)) if KNOWN_MODELS.contains(&value.as_str()) => value.clone(),
        Some(toml::Value::String(value)) => {
            diagnostics.push(SettingsDiagnostic::Field {
                key: "model".to_string(),
                message: format!("\"{value}\" is not a known model; using the default"),
            });
            default_model()
        }
        Some(_) => {
            diagnostics.push(wrong_type_diagnostic("model"));
            default_model()
        }
        None => {
            diagnostics.push(missing_diagnostic("model"));
            default_model()
        }
    }
}

/// Parses `contents` as TOML, degrading per key rather than rejecting the whole document on a
/// single bad value (spec decision 10). Only a genuine syntax error — the document doesn't parse
/// as TOML at all — rejects everything and reports the line it starts on.
fn parse_settings(contents: &str) -> (Settings, Vec<SettingsDiagnostic>) {
    let table: toml::Table = match toml::from_str(contents) {
        Ok(table) => table,
        Err(err) => {
            let line = err
                .span()
                .map(|span| contents[..span.start].matches('\n').count() + 1);
            return (
                Settings::default(),
                vec![SettingsDiagnostic::Syntax {
                    message: err.message().to_string(),
                    line,
                }],
            );
        }
    };
    let table = settings_table(&table);
    let mut diagnostics = Vec::new();
    let settings = Settings {
        model: extract_model(table, &mut diagnostics),
        editor_font: extract_string(
            table,
            "editorFont",
            &default_editor_font(),
            &mut diagnostics,
        ),
        theme: extract_theme(table, &mut diagnostics),
        vault_path: extract_string(table, "vaultPath", "", &mut diagnostics),
    };
    (settings, diagnostics)
}

fn read_settings_from(file: &Path) -> SettingsResult<SettingsReadResult> {
    match fs::read_to_string(file) {
        Ok(contents) => {
            let (settings, diagnostics) = parse_settings(&contents);
            Ok(SettingsReadResult {
                settings,
                diagnostics,
            })
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(SettingsReadResult {
            settings: Settings::default(),
            diagnostics: Vec::new(),
        }),
        Err(err) => Err(err.into()),
    }
}

fn resolve_default_vault_path(settings: &mut Settings, default_path: &str) {
    if settings.vault_path.is_empty() {
        settings.vault_path = default_path.into();
    }
}

/// Writes `contents` to `path` via a temp file plus atomic rename, so a reader (or a crash)
/// never observes a partially written file.
fn write_atomic(path: &Path, contents: &str) -> SettingsResult<()> {
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(dir)?;
    let mut tmp_name = std::ffi::OsString::from(".");
    tmp_name.push(path.file_name().unwrap_or_default());
    tmp_name.push(".tmp");
    let tmp_path = dir.join(tmp_name);
    fs::write(&tmp_path, contents)?;
    fs::rename(&tmp_path, path)?;
    Ok(())
}

/// Sets `key` to `new_value` in place, reusing the existing value's decor (its same-line leading
/// whitespace and trailing comment) when the key is already present. Assigning a fresh `Value`
/// instead would drop a trailing comment such as `theme = "dark" # my favorite`. The key's own
/// decor (any comment lines above it) is untouched either way, since the entry is mutated rather
/// than removed and reinserted.
fn set_field(doc: &mut DocumentMut, key: &str, new_value: Value) {
    match doc.get_mut(key) {
        Some(Item::Value(existing)) => {
            let decor = existing.decor().clone();
            let mut new_value = new_value;
            *new_value.decor_mut() = decor;
            *existing = new_value;
        }
        _ => {
            doc.insert(key, Item::Value(new_value));
        }
    }
}

/// Loads the existing document (if any) and updates only the four settings keys in place,
/// preserving every comment and the existing key order (spec decision 10 / ADR 0003). Returns
/// `SettingsError::Toml` if the existing file is not valid TOML — never regenerates a broken file
/// from `settings`, since that would silently discard whatever the user was mid-edit on.
fn write_settings_to(file: &Path, settings: &Settings) -> SettingsResult<()> {
    let existing = match fs::read_to_string(file) {
        Ok(contents) => contents,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(err) => return Err(err.into()),
    };
    let mut doc = if existing.trim().is_empty() {
        DocumentMut::new()
    } else {
        existing.parse::<DocumentMut>()?
    };
    set_field(&mut doc, "model", Value::from(settings.model.clone()));
    set_field(
        &mut doc,
        "editorFont",
        Value::from(settings.editor_font.clone()),
    );
    set_field(&mut doc, "theme", Value::from(settings.theme.clone()));
    set_field(
        &mut doc,
        "vaultPath",
        Value::from(settings.vault_path.clone()),
    );
    write_atomic(file, &doc.to_string())
}

/// Writes a fresh `settings.toml` documenting each key's valid values, in the fixed
/// model/editorFont/theme/vaultPath order. Used only for first-run scaffolding/migration — the
/// dialog's writes go through `write_settings_to`, which never regenerates the file.
fn write_documented_toml(file: &Path, settings: &Settings) -> SettingsResult<()> {
    let contents = format!(
        "# acidanthera settings\n\
         #\n\
         # model: {model_ids}\n\
         model = {model}\n\
         \n\
         # editorFont: any installed font family name\n\
         editorFont = {editor_font}\n\
         \n\
         # theme: \"dark\" or \"light\"\n\
         theme = {theme}\n\
         \n\
         # vaultPath: absolute path to the vault directory\n\
         vaultPath = {vault_path}\n",
        model_ids = KNOWN_MODELS.join(", "),
        model = Value::from(settings.model.clone()),
        editor_font = Value::from(settings.editor_font.clone()),
        theme = Value::from(settings.theme.clone()),
        vault_path = Value::from(settings.vault_path.clone()),
    );
    write_atomic(file, &contents)
}

fn read_legacy_json_settings(file: &Path) -> Settings {
    match fs::read_to_string(file) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_else(|err| {
            log::warn!(
                "settings::migrate: legacy settings.json is invalid JSON ({err}); using defaults"
            );
            Settings::default()
        }),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Settings::default(),
        Err(err) => {
            log::warn!(
                "settings::migrate: could not read legacy settings.json ({err}); using defaults"
            );
            Settings::default()
        }
    }
}

/// Migrates `json_file` (if present) to a documented `toml_file`, deleting the JSON only after
/// the TOML write has succeeded (spec decision 16) — a crash between the write and the delete
/// must never leave neither file. Idempotent: if `toml_file` already exists, this only cleans up
/// a `json_file` left over from such a crash, without touching the TOML's contents — re-running
/// must never clobber a TOML the user (or a prior run) already wrote with stale JSON values.
fn migrate_settings_file(toml_file: &Path, json_file: &Path) -> SettingsResult<()> {
    if toml_file.exists() {
        let _ = fs::remove_file(json_file);
        return Ok(());
    }
    let settings = read_legacy_json_settings(json_file);
    write_documented_toml(toml_file, &settings)?;
    let _ = fs::remove_file(json_file);
    Ok(())
}

/// Boot-time migration entry point, called from `lib.rs` before `config::init`'s first-run
/// scaffold so migration always wins the race to create `settings.toml`. Best-effort: a config
/// dir the app cannot write into must not stop the app from starting.
pub fn init(app: &AppHandle) {
    let paths = (|| -> SettingsResult<(PathBuf, PathBuf)> {
        Ok((settings_file(app)?, legacy_settings_file(app)?))
    })();
    let (toml_file, json_file) = match paths {
        Ok(paths) => paths,
        Err(err) => {
            log::warn!("settings::init: could not resolve app config dir ({err})");
            return;
        }
    };
    if let Err(err) = migrate_settings_file(&toml_file, &json_file) {
        log::warn!("settings::init: migration failed ({err})");
    }
}

/// Reads the persisted settings, falling back to defaults per key when the file is missing,
/// unreadable, or invalid (see `parse_settings`). An empty `vault_path` (fresh install or
/// hand-cleared) is resolved to the default vault location.
#[tauri::command]
pub fn read_settings(app: AppHandle) -> SettingsResult<SettingsReadResult> {
    log::info!("read_settings");
    (|| {
        let file = settings_file(&app)?;
        let mut result = read_settings_from(&file)?;
        resolve_default_vault_path(&mut result.settings, &default_vault_path(&app)?);
        Ok(result)
    })()
    .log_err("read_settings")
}

/// Persists the given settings into the existing `settings.toml`, preserving comments and key
/// order. Fails with `SettingsError::Toml` if the existing file has a syntax error — the frontend
/// is expected to block this call in that case (spec decision 10), but the backend refuses too
/// rather than silently regenerating the user's broken file.
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
        let dir = std::env::temp_dir().join(format!(
            "acidanthera-settings-{}-{label}",
            std::process::id()
        ));
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
    fn settings_should_default_every_missing_field() {
        let settings: Settings = serde_json::from_str("{}").expect("parses empty object");

        assert_eq!(
            (
                settings.model.as_str(),
                settings.editor_font.as_str(),
                settings.theme.as_str(),
                settings.vault_path.as_str()
            ),
            ("gpt-5.4-mini", "JetBrains Mono", "dark", "")
        );
    }

    #[test]
    fn resolve_default_vault_path_should_fill_an_empty_path() {
        let mut settings = Settings::default();

        resolve_default_vault_path(&mut settings, "/Users/tester/Documents/acidanthera-brain");

        assert_eq!(
            settings.vault_path,
            "/Users/tester/Documents/acidanthera-brain"
        );
    }

    #[test]
    fn resolve_default_vault_path_should_preserve_a_nonempty_path() {
        let mut settings = Settings {
            vault_path: "/custom/vault".into(),
            ..Settings::default()
        };

        resolve_default_vault_path(&mut settings, "/Users/tester/Documents/acidanthera-brain");

        assert_eq!(settings.vault_path, "/custom/vault");
    }

    #[test]
    fn settings_error_should_serialize_as_a_plain_string() {
        let error = "not toml {{{"
            .parse::<DocumentMut>()
            .expect_err("creates a toml error");

        let value = serde_json::to_value(SettingsError::Toml(error)).expect("serializes");

        assert!(value.is_string());
    }

    // --- read_settings_from / parse_settings -------------------------------------------------

    #[test]
    fn read_settings_from_should_return_defaults_when_the_file_is_missing() {
        let dir = temp_dir("missing");

        let result = read_settings_from(&dir.join("settings.toml")).expect("returns defaults");

        assert_eq!(result.settings.model, "gpt-5.4-mini");
        assert!(result.diagnostics.is_empty());
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn read_settings_from_should_parse_a_well_formed_document() {
        let dir = temp_dir("well-formed");
        let file = dir.join("settings.toml");
        fs::write(&file, "model = \"sonnet-5\"\neditorFont = \"Menlo\"\ntheme = \"light\"\nvaultPath = \"/vault\"\n").expect("writes file");

        let result = read_settings_from(&file).expect("parses");

        assert_eq!(result.settings.model, "sonnet-5");
        assert_eq!(result.settings.editor_font, "Menlo");
        assert_eq!(result.settings.theme, "light");
        assert_eq!(result.settings.vault_path, "/vault");
        assert!(result.diagnostics.is_empty());
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn read_settings_from_should_report_a_syntax_error_with_its_line() {
        let dir = temp_dir("syntax-error");
        let file = dir.join("settings.toml");
        fs::write(&file, "model = \"sonnet-5\"\ntheme = \n").expect("writes invalid toml");

        let result = read_settings_from(&file).expect("returns defaults with a diagnostic");

        assert_eq!(result.settings.model, "gpt-5.4-mini");
        assert_eq!(result.diagnostics.len(), 1);
        assert!(matches!(
            &result.diagnostics[0],
            SettingsDiagnostic::Syntax { line: Some(2), .. }
        ));
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn read_settings_from_should_degrade_a_single_bad_value_without_rejecting_the_document() {
        let dir = temp_dir("bad-value");
        let file = dir.join("settings.toml");
        fs::write(
            &file,
            "model = \"sonnet-5\"\ntheme = 3\nvaultPath = \"/vault\"\n",
        )
        .expect("writes file");

        let result = read_settings_from(&file).expect("degrades per key");

        assert_eq!(result.settings.model, "sonnet-5");
        assert_eq!(result.settings.theme, "dark");
        assert_eq!(result.settings.vault_path, "/vault");
        assert_eq!(
            result.diagnostics.len(),
            2,
            "theme wrong-type + editorFont missing: {:?}",
            result.diagnostics
        );
        assert!(result
            .diagnostics
            .iter()
            .any(|d| matches!(d, SettingsDiagnostic::Field { key, .. } if key == "theme")));
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn read_settings_from_should_reject_an_unknown_theme_value() {
        let dir = temp_dir("bad-theme-value");
        let file = dir.join("settings.toml");
        fs::write(&file, "theme = \"solarized\"\n").expect("writes file");

        let result = read_settings_from(&file).expect("degrades theme");

        assert_eq!(result.settings.theme, "dark");
        assert!(result
            .diagnostics
            .iter()
            .any(|d| matches!(d, SettingsDiagnostic::Field { key, .. } if key == "theme")));
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn read_settings_from_should_reject_an_unknown_model_value() {
        let dir = temp_dir("bad-model-value");
        let file = dir.join("settings.toml");
        fs::write(&file, "model = \"not-a-real-model\"\n").expect("writes file");

        let result = read_settings_from(&file).expect("degrades model");

        assert_eq!(result.settings.model, "gpt-5.4-mini");
        assert!(result
            .diagnostics
            .iter()
            .any(|d| matches!(d, SettingsDiagnostic::Field { key, .. } if key == "model")));
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn read_settings_from_should_tolerate_a_settings_table_header() {
        let dir = temp_dir("settings-header");
        let file = dir.join("settings.toml");
        fs::write(
            &file,
            "[settings]\nmodel = \"sonnet-5\"\ntheme = \"light\"\n",
        )
        .expect("writes file");

        let result = read_settings_from(&file).expect("tolerates the header");

        assert_eq!(result.settings.model, "sonnet-5");
        assert_eq!(result.settings.theme, "light");
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    // --- write_settings_to --------------------------------------------------------------------

    #[test]
    fn write_settings_to_should_create_the_parent_directory_and_persist_toml_in_field_order() {
        let dir = temp_dir("write");
        let file = dir.join("nested").join("settings.toml");
        let settings = Settings {
            model: "sonnet-5".into(),
            editor_font: "Menlo".into(),
            theme: "light".into(),
            vault_path: "/vault".into(),
        };

        write_settings_to(&file, &settings).expect("writes settings");
        let contents = fs::read_to_string(&file).expect("reads settings");

        assert_eq!(
            contents,
            "model = \"sonnet-5\"\neditorFont = \"Menlo\"\ntheme = \"light\"\nvaultPath = \"/vault\"\n"
        );
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn write_settings_to_should_overwrite_an_existing_value() {
        let dir = temp_dir("overwrite");
        let file = dir.join("settings.toml");
        fs::write(&file, "theme = \"dark\"\n").expect("writes old contents");
        let settings = Settings {
            theme: "light".into(),
            ..Settings::default()
        };

        write_settings_to(&file, &settings).expect("overwrites settings");
        let result = read_settings_from(&file).expect("reads settings");

        assert_eq!(result.settings.theme, "light");
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn write_settings_to_should_preserve_a_trailing_comment_on_the_changed_key() {
        let dir = temp_dir("trailing-comment");
        let file = dir.join("settings.toml");
        fs::write(&file, "theme = \"dark\" # my favorite\n").expect("writes commented contents");
        let settings = Settings {
            theme: "light".into(),
            ..Settings::default()
        };

        write_settings_to(&file, &settings).expect("writes settings");
        let contents = fs::read_to_string(&file).expect("reads back");

        assert!(
            contents.starts_with("theme = \"light\" # my favorite\n"),
            "trailing comment on the changed key survives: {contents:?}"
        );
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn write_settings_to_should_preserve_untouched_keys_and_their_comments() {
        let dir = temp_dir("preserve-untouched");
        let file = dir.join("settings.toml");
        fs::write(
            &file,
            "# my model of choice\nmodel = \"sonnet-5\"\ntheme = \"dark\"\n",
        )
        .expect("writes file");
        let settings = Settings {
            model: "sonnet-5".into(),
            theme: "light".into(),
            ..Settings::default()
        };

        write_settings_to(&file, &settings).expect("writes settings");
        let contents = fs::read_to_string(&file).expect("reads back");

        assert!(contents.contains("# my model of choice\nmodel = \"sonnet-5\""));
        assert!(contents.contains("theme = \"light\""));
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn write_settings_to_should_preserve_key_order_when_updating_a_middle_key() {
        let dir = temp_dir("preserve-order");
        let file = dir.join("settings.toml");
        fs::write(
            &file,
            "vaultPath = \"/vault\"\nmodel = \"sonnet-5\"\ntheme = \"dark\"\neditorFont = \"Menlo\"\n",
        )
        .expect("writes file");
        let settings = Settings {
            model: "sonnet-5".into(),
            editor_font: "Menlo".into(),
            theme: "light".into(),
            vault_path: "/vault".into(),
        };

        write_settings_to(&file, &settings).expect("writes settings");
        let contents = fs::read_to_string(&file).expect("reads back");

        assert_eq!(
            contents,
            "vaultPath = \"/vault\"\nmodel = \"sonnet-5\"\ntheme = \"light\"\neditorFont = \"Menlo\"\n"
        );
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn write_settings_to_should_reject_an_existing_file_with_a_syntax_error() {
        let dir = temp_dir("write-syntax-error");
        let file = dir.join("settings.toml");
        fs::write(&file, "theme = \n").expect("writes invalid toml");

        let error = write_settings_to(&file, &Settings::default()).expect_err("rejects the write");

        assert!(matches!(error, SettingsError::Toml(_)));
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    // --- migration -----------------------------------------------------------------------------

    #[test]
    fn migrate_settings_file_should_carry_json_values_into_a_documented_toml() {
        let dir = temp_dir("migrate-happy-path");
        let toml_file = dir.join("settings.toml");
        let json_file = dir.join("settings.json");
        fs::write(
            &json_file,
            r#"{ "model": "haiku-4.5", "editorFont": "Hack Nerd Font", "theme": "dark", "vaultPath": "/Users/tester/Documents/acidanthera-brain" }"#,
        )
        .expect("writes legacy json");

        migrate_settings_file(&toml_file, &json_file).expect("migrates");

        assert!(
            !json_file.exists(),
            "legacy json is deleted after migration"
        );
        let result = read_settings_from(&toml_file).expect("reads migrated toml");
        assert_eq!(result.settings.model, "haiku-4.5");
        assert_eq!(result.settings.editor_font, "Hack Nerd Font");
        assert_eq!(result.settings.theme, "dark");
        assert_eq!(
            result.settings.vault_path,
            "/Users/tester/Documents/acidanthera-brain"
        );
        assert!(result.diagnostics.is_empty());
        let contents = fs::read_to_string(&toml_file).expect("reads raw toml");
        assert!(
            contents.contains("# model:"),
            "documents valid model values"
        );
        assert!(
            contents.contains("gpt-5.4-mini")
                && contents.contains("haiku-4.5")
                && contents.contains("sonnet-5")
                && contents.contains("gpt-5.5-fast")
        );
        assert!(
            contents.contains("# theme:"),
            "documents valid theme values"
        );
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn migrate_settings_file_should_use_defaults_when_no_json_exists() {
        let dir = temp_dir("migrate-no-json");
        let toml_file = dir.join("settings.toml");
        let json_file = dir.join("settings.json");

        migrate_settings_file(&toml_file, &json_file).expect("migrates from defaults");

        assert!(toml_file.exists());
        let result = read_settings_from(&toml_file).expect("reads toml");
        assert_eq!(result.settings.model, "gpt-5.4-mini");
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn migrate_settings_file_should_be_idempotent_after_a_crash_between_write_and_delete() {
        let dir = temp_dir("migrate-crash-recovery");
        let toml_file = dir.join("settings.toml");
        let json_file = dir.join("settings.json");
        // Simulate a completed toml write whose subsequent json delete never ran.
        fs::write(&toml_file, "model = \"sonnet-5\"\ntheme = \"light\"\n").expect("writes toml");
        fs::write(&json_file, r#"{ "model": "haiku-4.5" }"#).expect("writes stale legacy json");

        migrate_settings_file(&toml_file, &json_file).expect("re-runs safely");

        assert!(!json_file.exists(), "stale legacy json is cleaned up");
        let result = read_settings_from(&toml_file).expect("reads toml");
        assert_eq!(
            result.settings.model, "sonnet-5",
            "the toml is not clobbered by the stale json"
        );
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn migrate_settings_file_should_default_when_the_legacy_json_is_invalid() {
        let dir = temp_dir("migrate-invalid-json");
        let toml_file = dir.join("settings.toml");
        let json_file = dir.join("settings.json");
        fs::write(&json_file, "not json").expect("writes invalid json");

        migrate_settings_file(&toml_file, &json_file).expect("migrates with defaults");

        let result = read_settings_from(&toml_file).expect("reads toml");
        assert_eq!(result.settings.model, "gpt-5.4-mini");
        fs::remove_dir_all(&dir).expect("cleans up");
    }
}
