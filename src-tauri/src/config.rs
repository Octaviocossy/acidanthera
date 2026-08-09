//! User-editable config-file backend (epic #94, child #95): raw read/write/parse commands over
//! an explicit two-file allowlist in the platform app-config dir, plus a dedicated `notify`
//! watcher and first-run scaffolding. Per spec decision 25, Rust owns *syntax* — it parses TOML
//! and hands back a plain value or a line-numbered parse diagnostic — while TypeScript owns
//! *meaning* (command-id/chord validation, conflicts, semantic degradation). This module adds no
//! consumers of its own; the settings and keymap slices build on it.

use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};

use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use thiserror::Error;

use crate::logging::LogResult;

/// The only two file names these commands operate on. Directory containment alone would still
/// leave an arbitrary-write primitive over the whole app-config dir, so every command checks
/// membership in this allowlist before touching disk.
const CONFIG_FILES: [&str; 2] = ["settings.toml", "keymaps.toml"];

/// Minimal first-run `settings.toml` seed. The real settings schema is owned by a sibling slice;
/// this is just enough for the file to exist and parse.
const DEFAULT_SETTINGS_TOML: &str = "# orbit-111 settings\n";

/// First-run `keymaps.toml` seed (#97 step 6): every resolvable command, commented out, grouped
/// by layer, showing its current default — uncommenting a line and editing its chord array is
/// the whole rebinding UX (spec ADR 0005: command-keyed, not chord-keyed). Must be kept in sync
/// with `generateKeymapsToml()` in `src/lib/keymap/seed.ts`, which is the source of truth this
/// constant was generated from.
const DEFAULT_KEYMAPS_TOML: &str = r#"# orbit-111 keymaps
#
# Every line below is commented out and shows that command's current default. Uncomment a
# line and edit its chord array to rebind it — a chord array is always replaced wholesale,
# never merged with the default. Set a command's array to [] to unbind it entirely.
#
# `:w` (save) is not rebindable here — it's owned by the editor slice, not this catalog.

# [global] — every command, with its default chords.
# Uncomment a line and edit it to change it.
#
# "global.find-file"       = ["ctrl-w f"]
# "global.focus-next"      = ["ctrl-w l"]
# "global.focus-previous"  = ["ctrl-w h"]
# "global.toggle-sidebar"  = ["ctrl-w b"]
# "global.toggle-chat"     = ["ctrl-w c"]
# "global.toggle-settings" = ["ctrl-w s"]
# "global.command-mode"    = [":"]

# [sidebar] — every command, with its default chords.
# Uncomment a line and edit it to change it.
#
# "sidebar.cursor-down"   = ["j"]
# "sidebar.cursor-up"     = ["k"]
# "sidebar.open"          = ["l", "enter"]
# "sidebar.collapse"      = ["h"]
# "sidebar.new-note"      = ["a"]
# "sidebar.new-directory" = ["shift-a"]
# "sidebar.delete"        = ["d d"]

# [chat.history] — every command, with its default chords.
# Uncomment a line and edit it to change it.
#
# "chat.history.cursor-down" = ["j"]
# "chat.history.cursor-up"   = ["k"]
# "chat.history.open"        = ["l", "enter"]

# [modal] — every command, with its default chords.
# Uncomment a line and edit it to change it.
#
# "modal.confirm" = ["enter"]
# "modal.cancel"  = ["escape"]
"#;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("could not resolve the app config directory: {0}")]
    Path(#[from] tauri::Error),
    #[error("\"{0}\" is not an allowed config file name")]
    DisallowedName(String),
    #[error("config file path is a symlink and cannot be used")]
    SymlinkRejected,
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Watch(#[from] notify::Error),
}

impl Serialize for ConfigError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type ConfigResult<T> = Result<T, ConfigError>;

/// A syntax-error diagnostic surfaced when a config file fails to parse as TOML. `line` is
/// `None` only when the underlying parser could not attribute the error to a span.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigParseDiagnostic {
    pub message: String,
    pub line: Option<usize>,
}

/// The result of parsing a config file: its value as a plain JSON-compatible structure, or a
/// syntax diagnostic. TypeScript decides what to do with either — this module only reports.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum ConfigParseResult {
    Parsed { value: serde_json::Value },
    Invalid { diagnostic: ConfigParseDiagnostic },
}

/// Holds the config-dir watcher, kept separate from `VaultState`'s watcher slot — reusing that
/// slot would silently stop vault watching every time a config file is saved.
#[derive(Default)]
pub struct ConfigWatcherState(Mutex<Option<notify::RecommendedWatcher>>);

fn config_dir(app: &AppHandle) -> ConfigResult<PathBuf> {
    Ok(app.path().app_config_dir()?)
}

fn is_allowed_name(name: &str) -> bool {
    CONFIG_FILES.contains(&name)
}

/// Resolves `name` to a path inside the config dir, rejecting anything outside the allowlist and
/// any leaf that turns out to be a symlink (the same discipline `vault.rs`'s `guarded_path`
/// applies to leaf targets) — a hand-edited or malicious symlink in the config dir must not let
/// these commands read or write somewhere else entirely.
fn guarded_config_path(dir: &Path, name: &str) -> ConfigResult<PathBuf> {
    if !is_allowed_name(name) {
        return Err(ConfigError::DisallowedName(name.to_string()));
    }
    let target = dir.join(name);
    match fs::symlink_metadata(&target) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(ConfigError::SymlinkRejected),
        Ok(_) => Ok(target),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(target),
        Err(err) => Err(err.into()),
    }
}

/// Writes `contents` to `path` via a temp file plus atomic rename, so a reader never observes a
/// partially written file.
fn write_atomic(path: &Path, contents: &str) -> ConfigResult<()> {
    let dir = path.parent().ok_or(ConfigError::SymlinkRejected)?;
    fs::create_dir_all(dir)?;
    let file_name = path.file_name().ok_or(ConfigError::SymlinkRejected)?;
    let mut tmp_name = std::ffi::OsString::from(".");
    tmp_name.push(file_name);
    tmp_name.push(".tmp");
    let tmp_path = dir.join(tmp_name);
    fs::write(&tmp_path, contents)?;
    fs::rename(&tmp_path, path)?;
    Ok(())
}

/// Parses `contents` as TOML, returning either the value (as plain JSON so the IPC boundary
/// carries no TOML-specific types) or a diagnostic naming the 1-based line the error starts on.
fn parse_toml(contents: &str) -> ConfigParseResult {
    match toml::from_str::<serde_json::Value>(contents) {
        Ok(value) => ConfigParseResult::Parsed { value },
        Err(err) => {
            let line = err
                .span()
                .map(|span| contents[..span.start].matches('\n').count() + 1);
            ConfigParseResult::Invalid {
                diagnostic: ConfigParseDiagnostic {
                    message: err.message().to_string(),
                    line,
                },
            }
        }
    }
}

/// Writes `contents` to `path` only when nothing sits there yet, reporting whether it created the
/// file. Mirrors `vault.rs`'s `scaffold_file` — first-run seeding must never clobber a file the
/// user (or a prior boot) has already written.
fn scaffold_file(path: &Path, contents: &str) -> ConfigResult<bool> {
    match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
    {
        Ok(mut file) => {
            file.write_all(contents.as_bytes())?;
            Ok(true)
        }
        Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => Ok(false),
        Err(err) => Err(err.into()),
    }
}

/// Seeds `settings.toml`/`keymaps.toml` under `dir` on first run, creating `dir` itself if it
/// doesn't exist yet (it may not, at first boot). Returns the names it actually created.
fn scaffold_config_files(dir: &Path) -> ConfigResult<Vec<&'static str>> {
    fs::create_dir_all(dir)?;
    let seeds: [(&str, &str); 2] = [
        ("settings.toml", DEFAULT_SETTINGS_TOML),
        ("keymaps.toml", DEFAULT_KEYMAPS_TOML),
    ];
    seeds
        .iter()
        .filter_map(
            |(name, contents)| match scaffold_file(&dir.join(name), contents) {
                Ok(true) => Some(Ok(*name)),
                Ok(false) => None,
                Err(err) => Some(Err(err)),
            },
        )
        .collect()
}

/// (Re)starts the config-dir watcher — replacing, and thus stopping, any prior one — filtered to
/// the allowlisted file names and emitting `config-changed` with the touched paths. Non-recursive:
/// the config dir holds only these two flat files.
fn watch_config_dir(app: &AppHandle, state: &ConfigWatcherState, dir: &Path) -> ConfigResult<()> {
    fs::create_dir_all(dir)?;
    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else { return };
        let paths: Vec<String> = event
            .paths
            .iter()
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(is_allowed_name)
            })
            .map(|path| path.to_string_lossy().into_owned())
            .collect();
        if !paths.is_empty() {
            let _ = app_handle.emit("config-changed", paths);
        }
    })?;
    watcher.watch(dir, RecursiveMode::NonRecursive)?;

    let mut slot = state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    *slot = Some(watcher);
    Ok(())
}

/// Boot-time setup: seeds any missing config file and starts the watcher. Best-effort — a config
/// dir the app cannot write into (permissions, read-only mount) must not stop the app from
/// starting, mirroring `vault.rs`'s `scaffold_agent_context_or_warn`.
pub fn init(app: &AppHandle, state: &ConfigWatcherState) {
    let dir = match config_dir(app) {
        Ok(dir) => dir,
        Err(err) => {
            log::warn!("config::init: could not resolve config dir ({err})");
            return;
        }
    };
    match scaffold_config_files(&dir) {
        Ok(created) if !created.is_empty() => {
            log::info!("config::init: created {}", created.join(", "))
        }
        Ok(_) => {}
        Err(err) => log::warn!("config::init: scaffold failed ({err})"),
    }
    if let Err(err) = watch_config_dir(app, state, &dir) {
        log::warn!("config::init: watch failed ({err})");
    }
}

/// Reads a config file's raw text. `name` must be an allowlisted file name.
#[tauri::command]
pub fn read_config_file(name: String, app: AppHandle) -> ConfigResult<String> {
    log::info!("read_config_file: name={name}");
    (|| {
        let dir = config_dir(&app)?;
        let path = guarded_config_path(&dir, &name)?;
        Ok(fs::read_to_string(path)?)
    })()
    .log_err("read_config_file")
}

/// Persists a config file's raw text via an atomic temp-file-plus-rename write. `name` must be an
/// allowlisted file name.
#[tauri::command]
pub fn write_config_file(name: String, contents: String, app: AppHandle) -> ConfigResult<()> {
    log::info!("write_config_file: name={name} bytes={}", contents.len());
    (|| {
        let dir = config_dir(&app)?;
        let path = guarded_config_path(&dir, &name)?;
        write_atomic(&path, &contents)
    })()
    .log_err("write_config_file")
}

/// Reads and parses an allowlisted config file as TOML, returning either its value or a
/// line-numbered syntax diagnostic (spec decision 10: the toast on a syntax error names the line).
#[tauri::command]
pub fn parse_config_file(name: String, app: AppHandle) -> ConfigResult<ConfigParseResult> {
    log::info!("parse_config_file: name={name}");
    (|| {
        let dir = config_dir(&app)?;
        let path = guarded_config_path(&dir, &name)?;
        let contents = fs::read_to_string(path)?;
        Ok(parse_toml(&contents))
    })()
    .log_err("parse_config_file")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("orbit-config-{}-{label}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("creates temp directory");
        dir.canonicalize().expect("canonicalizes temp directory")
    }

    #[test]
    fn guarded_config_path_should_accept_an_allowlisted_name() {
        let dir = temp_dir("allowed");

        let path = guarded_config_path(&dir, "settings.toml").expect("accepts allowlisted name");

        assert_eq!(path, dir.join("settings.toml"));
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn guarded_config_path_should_reject_a_name_outside_the_allowlist() {
        let dir = temp_dir("disallowed");

        let error = guarded_config_path(&dir, "../evil.toml").expect_err("rejects the name");

        assert!(matches!(error, ConfigError::DisallowedName(name) if name == "../evil.toml"));
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn guarded_config_path_should_reject_an_arbitrary_file_name_even_inside_the_dir() {
        let dir = temp_dir("arbitrary");

        let error = guarded_config_path(&dir, "notes.md").expect_err("rejects the name");

        assert!(matches!(error, ConfigError::DisallowedName(_)));
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[cfg(unix)]
    #[test]
    fn guarded_config_path_should_reject_a_symlinked_target() {
        let dir = temp_dir("symlink");
        let outside = temp_dir("symlink-outside");
        let outside_file = outside.join("secret.toml");
        fs::write(&outside_file, "secret = true").expect("writes outside file");
        std::os::unix::fs::symlink(&outside_file, dir.join("settings.toml"))
            .expect("creates symlink");

        let error = guarded_config_path(&dir, "settings.toml").expect_err("rejects symlink");

        assert!(matches!(error, ConfigError::SymlinkRejected));
        fs::remove_dir_all(&dir).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[test]
    fn write_atomic_should_create_the_file_with_the_given_contents() {
        let dir = temp_dir("write-create");
        let file = dir.join("settings.toml");

        write_atomic(&file, "model = \"sonnet-5\"").expect("writes file");

        assert_eq!(
            fs::read_to_string(&file).expect("reads back"),
            "model = \"sonnet-5\""
        );
        // The temp file used for the atomic rename must not linger.
        assert_eq!(fs::read_dir(&dir).expect("reads dir").count(), 1);
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn write_atomic_should_overwrite_existing_contents() {
        let dir = temp_dir("write-overwrite");
        let file = dir.join("settings.toml");
        fs::write(&file, "old = true").expect("writes old contents");

        write_atomic(&file, "new = true").expect("overwrites file");

        assert_eq!(fs::read_to_string(&file).expect("reads back"), "new = true");
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn write_atomic_should_create_a_missing_parent_directory() {
        let dir = temp_dir("write-missing-parent");
        let nested_dir = dir.join("nested");
        let file = nested_dir.join("settings.toml");

        write_atomic(&file, "a = 1").expect("creates parent and writes file");

        assert_eq!(fs::read_to_string(&file).expect("reads back"), "a = 1");
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn scaffold_config_files_should_create_the_config_dir_when_absent() {
        let parent = temp_dir("scaffold-dir-absent");
        let dir = parent.join("app-config");
        assert!(!dir.exists());

        let created = scaffold_config_files(&dir).expect("scaffolds");

        assert!(dir.is_dir());
        assert_eq!(created, ["settings.toml", "keymaps.toml"]);
        fs::remove_dir_all(&parent).expect("cleans up");
    }

    #[test]
    fn scaffold_config_files_should_not_clobber_an_existing_file() {
        let dir = temp_dir("scaffold-existing");
        fs::write(dir.join("settings.toml"), "model = \"custom\"").expect("writes existing file");

        let created = scaffold_config_files(&dir).expect("scaffolds");

        assert_eq!(created, ["keymaps.toml"]);
        assert_eq!(
            fs::read_to_string(dir.join("settings.toml")).expect("reads back"),
            "model = \"custom\""
        );
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn scaffold_config_files_should_be_idempotent_across_reopens() {
        let dir = temp_dir("scaffold-idempotent");
        scaffold_config_files(&dir).expect("scaffolds");
        fs::write(dir.join("keymaps.toml"), "edited by the user").expect("edits file");

        let created = scaffold_config_files(&dir).expect("scaffolds again");

        assert!(created.is_empty());
        assert_eq!(
            fs::read_to_string(dir.join("keymaps.toml")).expect("reads back"),
            "edited by the user"
        );
        fs::remove_dir_all(&dir).expect("cleans up");
    }

    #[test]
    fn parse_toml_should_parse_valid_toml_into_a_json_value() {
        let result = parse_toml("model = \"sonnet-5\"\ntheme = \"dark\"\n");

        match result {
            ConfigParseResult::Parsed { value } => {
                assert_eq!(value["model"], "sonnet-5");
                assert_eq!(value["theme"], "dark");
            }
            ConfigParseResult::Invalid { .. } => panic!("expected a parsed value"),
        }
    }

    #[test]
    fn parse_toml_should_report_the_line_of_a_syntax_error() {
        let result = parse_toml("model = \"sonnet-5\"\ntheme = \n");

        match result {
            ConfigParseResult::Invalid { diagnostic } => {
                assert_eq!(diagnostic.line, Some(2));
                assert!(!diagnostic.message.is_empty());
            }
            ConfigParseResult::Parsed { .. } => panic!("expected a parse error"),
        }
    }

    #[test]
    fn parse_toml_should_report_line_one_for_an_error_on_the_first_line() {
        let result = parse_toml("this is not toml at all {{{");

        match result {
            ConfigParseResult::Invalid { diagnostic } => {
                assert_eq!(diagnostic.line, Some(1));
            }
            ConfigParseResult::Parsed { .. } => panic!("expected a parse error"),
        }
    }

    #[test]
    fn config_error_should_serialize_as_a_plain_string() {
        let value = serde_json::to_value(ConfigError::DisallowedName("evil.toml".into()))
            .expect("serializes");

        assert_eq!(
            value,
            serde_json::json!("\"evil.toml\" is not an allowed config file name")
        );
    }

    #[test]
    fn config_parse_result_should_serialize_with_a_kind_tag() {
        let value = serde_json::to_value(ConfigParseResult::Invalid {
            diagnostic: ConfigParseDiagnostic {
                message: "bad".into(),
                line: Some(3),
            },
        })
        .expect("serializes");

        assert_eq!(
            value,
            serde_json::json!({ "kind": "invalid", "diagnostic": { "message": "bad", "line": 3 } })
        );
    }
}
