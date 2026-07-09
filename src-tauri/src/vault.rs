//! Vault filesystem backend (doc/v0-spec.md §3.1, §3.2): opening a vault folder, reading its
//! `.md` tree, guarded reads/writes, and a `notify` watcher that emits `vault-changed`.

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

/// Recursively lists `dir`, keeping only `.md` files and directories that (transitively)
/// contain at least one — hidden entries (`.git`, `.obsidian`, …) are skipped.
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
            let children = build_tree(&path)?;
            if !children.is_empty() {
                entries.push(VaultEntry {
                    name,
                    path: path.to_string_lossy().into_owned(),
                    is_dir: true,
                    children: Some(children),
                });
            }
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
