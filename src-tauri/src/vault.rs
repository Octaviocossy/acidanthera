//! Vault filesystem backend (doc/v0-spec.md §3.1, §3.2): opening a vault folder, reading its
//! `.md` tree, guarded reads/writes, guarded note/directory creation, and a `notify` watcher that
//! emits `vault-changed`.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;
use thiserror::Error;

use crate::logging::LogResult;

/// A file or directory inside the open vault, filtered to Markdown notes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<VaultEntry>>,
}

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("no vault is open")]
    NoVaultOpen,
    #[error("no folder was selected")]
    NoFolderSelected,
    #[error("path escapes the vault root")]
    PathEscapesRoot,
    #[error("invalid note path")]
    InvalidPath,
    #[error("an entry already exists at that path")]
    AlreadyExists,
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Watch(#[from] notify::Error),
}

impl Serialize for VaultError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type VaultResult<T> = Result<T, VaultError>;

#[derive(Default)]
struct VaultInner {
    root: Option<PathBuf>,
    // Held only for its lifetime — dropping it stops the filesystem watch.
    watcher: Option<notify::RecommendedWatcher>,
}

/// Tracks the currently open vault root and its live file-watcher.
#[derive(Default)]
pub struct VaultState(Mutex<VaultInner>);

fn lock(state: &VaultState) -> std::sync::MutexGuard<'_, VaultInner> {
    state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn current_root(state: &VaultState) -> VaultResult<PathBuf> {
    lock(state).root.clone().ok_or(VaultError::NoVaultOpen)
}

/// Resolves `target` to a canonical path guaranteed to live inside `root`, rejecting any
/// traversal outside it (`..` segments, symlinks, or an absolute path from elsewhere).
fn guarded_path(root: &Path, target: &str) -> VaultResult<PathBuf> {
    let root = root.canonicalize()?;
    let target = PathBuf::from(target);
    let parent = target
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or(VaultError::InvalidPath)?;
    let parent = parent.canonicalize().map_err(|_| VaultError::InvalidPath)?;
    if !parent.starts_with(&root) {
        return Err(VaultError::PathEscapesRoot);
    }
    let file_name = target.file_name().ok_or(VaultError::InvalidPath)?;
    Ok(parent.join(file_name))
}

/// Appends `.md` unless `path` already carries that extension. `build_tree` only surfaces Markdown
/// files, so a note created under any other name would be invisible in the sidebar.
fn with_md_extension(path: PathBuf) -> PathBuf {
    if path.extension().is_some_and(|ext| ext == "md") {
        return path;
    }
    let mut file_name = path.file_name().unwrap_or_default().to_os_string();
    file_name.push(".md");
    path.with_file_name(file_name)
}

/// Maps the OS's raw `AlreadyExists` io error onto the domain error, so a name collision surfaces
/// as "an entry already exists at that path" rather than "File exists (os error 17)".
fn creation_error(err: std::io::Error) -> VaultError {
    match err.kind() {
        std::io::ErrorKind::AlreadyExists => VaultError::AlreadyExists,
        _ => VaultError::Io(err),
    }
}

/// Creates an empty note under `root`, normalizing the extension. `File::create_new` is atomic:
/// it fails rather than truncating when something already sits at the resolved path.
fn create_note_in(root: &Path, target: &str) -> VaultResult<PathBuf> {
    let target = with_md_extension(guarded_path(root, target)?);
    fs::File::create_new(&target).map_err(creation_error)?;
    Ok(target)
}

/// Creates an empty directory under `root`. `create_dir` (not `create_dir_all`) so a typo in the
/// parent surfaces as an error instead of silently materializing an unintended folder chain.
fn create_directory_in(root: &Path, target: &str) -> VaultResult<PathBuf> {
    let target = guarded_path(root, target)?;
    fs::create_dir(&target).map_err(creation_error)?;
    Ok(target)
}

/// Recursively lists `dir`, keeping only `.md` files but **every** directory — including empty
/// ones, so a freshly created folder shows up in the sidebar before it holds any note. Hidden
/// entries (`.git`, `.obsidian`, …) are skipped.
fn build_tree(dir: &Path) -> VaultResult<Vec<VaultEntry>> {
    let mut entries = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }

        let path = entry.path();
        let file_type = entry.file_type()?;

        if file_type.is_dir() {
            entries.push(VaultEntry {
                name,
                path: path.to_string_lossy().into_owned(),
                is_dir: true,
                children: Some(build_tree(&path)?),
            });
        } else if path.extension().is_some_and(|ext| ext == "md") {
            entries.push(VaultEntry {
                name,
                path: path.to_string_lossy().into_owned(),
                is_dir: false,
                children: None,
            });
        }
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

/// (Re)starts the `notify` watcher over `root` — replacing, and thus stopping, any prior one —
/// emitting `vault-changed` with the touched paths on every subsequent filesystem event.
fn watch(app: &AppHandle, state: &VaultState, root: PathBuf) -> VaultResult<()> {
    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else { return };
        let paths: Vec<String> = event
            .paths
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect();
        if !paths.is_empty() {
            let _ = app_handle.emit("vault-changed", paths);
        }
    })?;
    watcher.watch(&root, RecursiveMode::Recursive)?;

    let mut inner = lock(state);
    inner.watcher = Some(watcher);
    inner.root = Some(root);
    Ok(())
}

/// Opens a native folder picker and adopts the chosen folder as the vault root, returning its
/// path so the frontend can seed `useAppStore.vaultRoot`.
#[tauri::command]
pub async fn pick_vault(app: AppHandle, state: State<'_, VaultState>) -> VaultResult<String> {
    log::info!("pick_vault: opening folder picker");
    async {
        let folder = app.dialog().file().blocking_pick_folder();
        let root = folder
            .ok_or(VaultError::NoFolderSelected)?
            .into_path()
            .map_err(|_| VaultError::InvalidPath)?;
        watch(&app, &state, root.clone())?;
        log::info!("pick_vault: adopted vault root {}", root.display());
        Ok(root.to_string_lossy().into_owned())
    }
    .await
    .log_err("pick_vault")
}

/// Adopts `path` as the vault root without a picker — creating the directory if it doesn't
/// exist yet (the default-vault bootstrap, doc/v0-spec.md §3.1) — and starts the watcher over
/// it. Returns the canonical path so the frontend can seed `useAppStore.vaultRoot`.
#[tauri::command]
pub fn open_vault(path: String, app: AppHandle, state: State<'_, VaultState>) -> VaultResult<String> {
    log::info!("open_vault: path={path}");
    (|| {
        fs::create_dir_all(&path)?;
        let root = PathBuf::from(&path).canonicalize()?;
        if !root.is_dir() {
            return Err(VaultError::InvalidPath);
        }
        watch(&app, &state, root.clone())?;
        log::info!("open_vault: adopted vault root {}", root.display());
        Ok(root.to_string_lossy().into_owned())
    })()
    .log_err("open_vault")
}

/// Reads the open vault's file tree, filtered to `.md` notes and their parent directories.
#[tauri::command]
pub fn read_vault_tree(state: State<'_, VaultState>) -> VaultResult<Vec<VaultEntry>> {
    log::info!("read_vault_tree");
    (|| build_tree(&current_root(&state)?))().log_err("read_vault_tree")
}

/// Reads a note's contents. `path` must resolve inside the open vault root.
#[tauri::command]
pub fn read_note(path: String, state: State<'_, VaultState>) -> VaultResult<String> {
    log::info!("read_note: path={path}");
    (|| {
        let root = current_root(&state)?;
        Ok(fs::read_to_string(guarded_path(&root, &path)?)?)
    })()
    .log_err("read_note")
}

/// Writes a note's contents. `path` must resolve inside the open vault root.
#[tauri::command]
pub fn write_note(path: String, contents: String, state: State<'_, VaultState>) -> VaultResult<()> {
    log::info!("write_note: path={path} bytes={}", contents.len());
    (|| {
        let root = current_root(&state)?;
        fs::write(guarded_path(&root, &path)?, contents)?;
        Ok(())
    })()
    .log_err("write_note")
}

/// Creates an empty note, appending `.md` when `path` lacks that extension. `path` must resolve
/// inside the open vault root and its parent directory must already exist. Never clobbers an
/// existing entry — the create is atomic, so a name collision fails with `AlreadyExists`. Returns
/// the created note's path so the caller can open it straight away.
#[tauri::command]
pub fn create_note(path: String, state: State<'_, VaultState>) -> VaultResult<String> {
    log::info!("create_note: path={path}");
    (|| {
        let target = create_note_in(&current_root(&state)?, &path)?;
        log::info!("create_note: created {}", target.display());
        Ok(target.to_string_lossy().into_owned())
    })()
    .log_err("create_note")
}

/// Creates an empty directory. `path` must resolve inside the open vault root and its parent
/// directory must already exist (nested creation is deliberately not implicit). Never clobbers an
/// existing entry. Returns the created directory's path; `read_vault_tree` surfaces empty
/// directories, so it appears in the sidebar as soon as the watcher fires.
#[tauri::command]
pub fn create_directory(path: String, state: State<'_, VaultState>) -> VaultResult<String> {
    log::info!("create_directory: path={path}");
    (|| {
        let target = create_directory_in(&current_root(&state)?, &path)?;
        log::info!("create_directory: created {}", target.display());
        Ok(target.to_string_lossy().into_owned())
    })()
    .log_err("create_directory")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A unique temp directory per test, canonicalized because macOS resolves `/tmp` to
    /// `/private/tmp` — `guarded_path` compares canonical paths, so the root must already be one.
    fn temp_root(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("orbit-vault-{}-{label}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("creates temp root");
        dir.canonicalize().expect("canonicalizes temp root")
    }

    fn path_str(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn build_tree_should_include_directories_that_hold_no_notes() {
        let root = temp_root("empty-dir");
        fs::create_dir(root.join("scratch")).expect("creates dir");

        let entries = build_tree(&root).expect("builds tree");

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "scratch");
        assert!(entries[0].is_dir);
        assert!(entries[0].children.as_ref().is_some_and(|c| c.is_empty()));

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn build_tree_should_skip_hidden_entries_and_non_markdown_files() {
        let root = temp_root("filtering");
        fs::create_dir(root.join(".obsidian")).expect("creates hidden dir");
        fs::write(root.join("image.png"), "").expect("writes non-note");
        fs::write(root.join("note.md"), "").expect("writes note");

        let entries = build_tree(&root).expect("builds tree");

        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["note.md"]);

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn build_tree_should_sort_directories_before_files() {
        let root = temp_root("sorting");
        fs::write(root.join("a-note.md"), "").expect("writes note");
        fs::create_dir(root.join("z-dir")).expect("creates dir");

        let entries = build_tree(&root).expect("builds tree");

        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["z-dir", "a-note.md"]);

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn guarded_path_should_accept_a_target_inside_the_root() {
        let root = temp_root("guard-inside");

        let resolved = guarded_path(&root, &path_str(&root.join("note.md"))).expect("resolves");

        assert_eq!(resolved, root.join("note.md"));

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn guarded_path_should_reject_a_target_that_escapes_the_root() {
        let root = temp_root("guard-escape");

        let error = guarded_path(&root, &path_str(&root.join("..").join("evil.md"))).expect_err("rejects");

        assert!(matches!(error, VaultError::PathEscapesRoot));

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn with_md_extension_should_append_only_when_the_extension_is_missing() {
        assert_eq!(with_md_extension(PathBuf::from("/vault/note")), PathBuf::from("/vault/note.md"));
        assert_eq!(with_md_extension(PathBuf::from("/vault/note.md")), PathBuf::from("/vault/note.md"));
        assert_eq!(with_md_extension(PathBuf::from("/vault/note.txt")), PathBuf::from("/vault/note.txt.md"));
    }

    #[test]
    fn creation_error_should_map_already_exists_onto_the_domain_error() {
        let already = std::io::Error::new(std::io::ErrorKind::AlreadyExists, "exists");
        let denied = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "denied");

        assert!(matches!(creation_error(already), VaultError::AlreadyExists));
        assert!(matches!(creation_error(denied), VaultError::Io(_)));
    }

    #[test]
    fn create_note_in_should_create_an_empty_note_and_append_the_md_extension() {
        let root = temp_root("create-note");

        let created = create_note_in(&root, &path_str(&root.join("ideas"))).expect("creates note");

        assert_eq!(created, root.join("ideas.md"));
        assert_eq!(fs::read_to_string(&created).expect("reads back"), "");
        // The new note is a real tree row, not just a file on disk.
        let entries = build_tree(&root).expect("builds tree");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "ideas.md");
        assert!(!entries[0].is_dir);

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn create_note_in_should_not_clobber_an_existing_note() {
        let root = temp_root("create-note-collision");
        fs::write(root.join("keep.md"), "precious").expect("writes note");

        let error = create_note_in(&root, &path_str(&root.join("keep.md"))).expect_err("rejects");

        assert!(matches!(error, VaultError::AlreadyExists));
        assert_eq!(fs::read_to_string(root.join("keep.md")).expect("reads back"), "precious");

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn create_note_in_should_reject_a_target_outside_the_root() {
        let root = temp_root("create-note-escape");
        let escapee = root.join("..").join("orbit-escapee.md");

        let error = create_note_in(&root, &path_str(&escapee)).expect_err("rejects");

        assert!(matches!(error, VaultError::PathEscapesRoot));
        assert!(!escapee.exists(), "nothing may be written outside the vault root");

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn create_directory_in_should_create_a_directory_visible_in_the_tree() {
        let root = temp_root("create-dir");

        let created = create_directory_in(&root, &path_str(&root.join("archive"))).expect("creates dir");

        assert_eq!(created, root.join("archive"));
        assert!(created.is_dir());
        // Empty directories are surfaced, so the new folder shows up right away (#36).
        let entries = build_tree(&root).expect("builds tree");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "archive");
        assert!(entries[0].is_dir);

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn create_directory_in_should_not_clobber_an_existing_entry() {
        let root = temp_root("create-dir-collision");
        fs::create_dir(root.join("archive")).expect("creates dir");

        let error = create_directory_in(&root, &path_str(&root.join("archive"))).expect_err("rejects");

        assert!(matches!(error, VaultError::AlreadyExists));

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn create_directory_in_should_reject_a_missing_parent_rather_than_creating_the_chain() {
        let root = temp_root("create-dir-nested");

        let error = create_directory_in(&root, &path_str(&root.join("missing").join("child"))).expect_err("rejects");

        assert!(matches!(error, VaultError::InvalidPath));
        assert!(!root.join("missing").exists(), "the parent chain must not be materialized");

        fs::remove_dir_all(&root).expect("cleans up");
    }
}
