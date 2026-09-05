//! Vault filesystem backend (doc/v0-spec.md §3.1, §3.2): opening a vault folder, reading its
//! `.md` tree, guarded reads/writes, guarded note/directory creation, the agent-context scaffold,
//! and a `notify` watcher that emits `vault-changed`.

use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};

use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;
use thiserror::Error;

use crate::{
    logging::LogResult,
    wikilink::{find_wikilinks, rewrite_targets},
};

/// A file or directory inside the open vault, filtered to Markdown notes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<VaultEntry>>,
}

/// Matching wikilinks found across the open vault.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WikilinkScan {
    pub notes: Vec<String>,
    pub links: usize,
    pub ambiguous: bool,
}

/// Outcome of rewriting matching wikilink targets across the open vault.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WikilinkRewrite {
    pub notes_changed: Vec<String>,
    pub links_changed: usize,
    pub failures: Vec<String>,
    pub skipped_ambiguous: bool,
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
    #[error("no entry exists at that path")]
    NotFound,
    #[error("could not move the entry to the trash: {0}")]
    Trash(String),
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

impl VaultState {
    /// The currently open vault root, if any. Lets sibling stores (e.g. the chat store,
    /// `chats.rs`) resolve paths against the *same* root the vault commands use, without
    /// exposing the private `VaultInner`/`lock`.
    pub fn root(&self) -> Option<PathBuf> {
        lock(self).root.clone()
    }
}

/// Resolves `target` to a canonical path guaranteed to live inside `root`, rejecting any
/// traversal outside it (`..` segments, symlinks, or an absolute path from elsewhere).
fn guarded_path(root: &Path, target: &str) -> VaultResult<PathBuf> {
    let root = root.canonicalize()?;
    let target = PathBuf::from(target);
    let file_name = target.file_name().ok_or(VaultError::InvalidPath)?;

    match fs::symlink_metadata(&target) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return Err(VaultError::PathEscapesRoot)
        }
        Ok(_) => {
            let target = target.canonicalize().map_err(|_| VaultError::InvalidPath)?;
            return target
                .starts_with(&root)
                .then_some(target)
                .ok_or(VaultError::PathEscapesRoot);
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => return Err(err.into()),
    }

    let parent = target
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or(VaultError::InvalidPath)?;
    let parent = parent.canonicalize().map_err(|_| VaultError::InvalidPath)?;
    if !parent.starts_with(&root) {
        return Err(VaultError::PathEscapesRoot);
    }
    Ok(parent.join(file_name))
}

/// Creates a missing vault directory and returns its canonical root. Existing non-directories are
/// invalid vaults rather than raw filesystem errors.
fn prepare_vault_root(path: &Path) -> VaultResult<PathBuf> {
    if path.exists() && !path.is_dir() {
        return Err(VaultError::InvalidPath);
    }
    fs::create_dir_all(path)?;
    Ok(path.canonicalize()?)
}

fn read_note_in(root: &Path, target: &str) -> VaultResult<String> {
    Ok(fs::read_to_string(guarded_path(root, target)?)?)
}

fn write_note_in(root: &Path, target: &str, contents: &str) -> VaultResult<()> {
    fs::write(guarded_path(root, target)?, contents)?;
    Ok(())
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

/// Renames an entry within its existing parent, preserving Markdown note extensions.
fn rename_entry_in(root: &Path, target: &str, new_name: &str) -> VaultResult<PathBuf> {
    let path = guarded_path(root, target)?;
    if path == root.canonicalize()? {
        return Err(VaultError::InvalidPath);
    }
    let metadata = match fs::symlink_metadata(&path) {
        Ok(metadata) => metadata,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Err(VaultError::NotFound),
        Err(err) => return Err(err.into()),
    };
    let new_name = new_name.trim();
    if new_name.is_empty() || new_name.contains('/') || new_name.contains('\\') {
        return Err(VaultError::InvalidPath);
    }
    let parent = path.parent().ok_or(VaultError::InvalidPath)?;
    let destination = if metadata.is_dir() {
        parent.join(new_name)
    } else {
        with_md_extension(parent.join(new_name))
    };

    match fs::symlink_metadata(&destination) {
        Ok(_) if destination.canonicalize().ok() != Some(path.clone()) => {
            return Err(VaultError::AlreadyExists)
        }
        Ok(_) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => return Err(err.into()),
    }

    fs::rename(&path, &destination)?;
    Ok(destination)
}

/// Returns the first available copy name in `parent`, preserving an existing extension.
fn derive_copy_name(
    parent: &Path,
    stem: &std::ffi::OsStr,
    extension: Option<&std::ffi::OsStr>,
) -> VaultResult<PathBuf> {
    for number in 1..=1000 {
        let suffix = if number == 1 {
            " copy".to_owned()
        } else {
            format!(" copy {number}")
        };
        let mut file_name = stem.to_os_string();
        file_name.push(suffix);
        if let Some(extension) = extension {
            file_name.push(".");
            file_name.push(extension);
        }
        let candidate = parent.join(file_name);
        match fs::symlink_metadata(&candidate) {
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(candidate),
            Ok(_) => {}
            Err(err) => return Err(err.into()),
        }
    }
    Err(VaultError::AlreadyExists)
}

/// Copies a directory and its ordinary-file descendants without following symlinks.
fn copy_dir_recursive(from: &Path, to: &Path) -> VaultResult<()> {
    fs::create_dir(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            continue;
        }
        let destination = to.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &destination)?;
        } else if file_type.is_file() {
            // Copy all data, unlike the sidebar tree which deliberately filters hidden/non-Markdown entries.
            fs::copy(entry.path(), destination)?;
        }
    }
    Ok(())
}

/// Duplicates a file or directory within its existing parent under an available copy name.
fn duplicate_entry_in(root: &Path, target: &str) -> VaultResult<PathBuf> {
    let path = guarded_path(root, target)?;
    if path == root.canonicalize()? {
        return Err(VaultError::InvalidPath);
    }
    let metadata = match fs::symlink_metadata(&path) {
        Ok(metadata) => metadata,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Err(VaultError::NotFound),
        Err(err) => return Err(err.into()),
    };
    let parent = path.parent().ok_or(VaultError::InvalidPath)?;
    let (stem, extension) = if metadata.is_dir() {
        (path.file_name().ok_or(VaultError::InvalidPath)?, None)
    } else if metadata.is_file() {
        (
            path.file_stem().ok_or(VaultError::InvalidPath)?,
            path.extension(),
        )
    } else {
        return Err(VaultError::InvalidPath);
    };
    let destination = derive_copy_name(parent, stem, extension)?;

    if metadata.is_dir() {
        copy_dir_recursive(&path, &destination)?;
    } else {
        fs::copy(&path, &destination)?;
    }
    Ok(destination)
}

fn delete_entry_in(root: &Path, target: &str) -> VaultResult<()> {
    let path = guarded_path(root, target)?;
    if path == root.canonicalize()? {
        return Err(VaultError::InvalidPath);
    }
    match fs::symlink_metadata(&path) {
        Ok(_) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Err(VaultError::NotFound),
        Err(err) => return Err(err.into()),
    }
    trash::delete(&path).map_err(|err| VaultError::Trash(err.to_string()))?;
    Ok(())
}

/// The agent-context pair scaffolded into every adopted vault root (#41). Both headless engines
/// run with `cwd` = the vault, so these are the project-instruction files they load
/// (doc/v0-spec.md §4.4): Codex reads `AGENTS.md`, Claude Code reads `CLAUDE.md`, which imports
/// `AGENTS.md` so one file stays the source of truth. Both are plain `.md` and remain directly
/// readable/writable, but `build_tree` hides them from the sidebar (#50) so they don't clutter
/// vault navigation with files meant for the agent, not the user.
const AGENT_CONTEXT_FILES: [(&str, &str); 2] = [
    ("AGENTS.md", include_str!("../templates/vault-agents.md")),
    ("CLAUDE.md", include_str!("../templates/vault-claude.md")),
];

/// Writes `contents` to `root/name` only when nothing sits there, reporting whether it created the
/// file. `create_new` is atomic, so a vault that already carries its own agent context — hand-edited
/// or belonging to another project — is never clobbered.
fn scaffold_file(root: &Path, name: &str, contents: &str) -> VaultResult<bool> {
    match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(root.join(name))
    {
        Ok(mut file) => {
            file.write_all(contents.as_bytes())?;
            Ok(true)
        }
        Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => Ok(false),
        Err(err) => Err(err.into()),
    }
}

/// Scaffolds the agent-context pair into a newly adopted vault root, returning the names it
/// actually created. Each file is handled independently, so deleting one restores just that one on
/// the next open. Callers run this *before* `watch`, so the frontend's first `read_vault_tree`
/// already sees both files and no `vault-changed` fires for the app's own boot-time writes.
fn scaffold_agent_context(root: &Path) -> VaultResult<Vec<&'static str>> {
    AGENT_CONTEXT_FILES
        .iter()
        .filter_map(
            |(name, contents)| match scaffold_file(root, name, contents) {
                Ok(true) => Some(Ok(*name)),
                Ok(false) => None,
                Err(err) => Some(Err(err)),
            },
        )
        .collect()
}

/// Best-effort wrapper for the two adopt paths: a vault we cannot write into (read-only mount,
/// missing permissions) must still open — the agent simply runs without project instructions
/// rather than the whole vault failing to load.
fn scaffold_agent_context_or_warn(root: &Path) {
    match scaffold_agent_context(root) {
        Ok(created) if !created.is_empty() => {
            log::info!("scaffold_agent_context: created {}", created.join(", "))
        }
        Ok(_) => {}
        Err(err) => log::warn!("scaffold_agent_context: skipped ({err})"),
    }
}

/// Recursively lists `dir`, keeping only `.md` files but **every** directory — including empty
/// ones, so a freshly created folder shows up in the sidebar before it holds any note. Hidden
/// entries (`.git`, `.obsidian`, …) are skipped, as are the `AGENT_CONTEXT_FILES` at the vault
/// root (#50) — they exist for the headless engines to read from `cwd`, not for the user to
/// browse to, so the sidebar hides them (they remain readable/writable by direct path).
fn build_tree(dir: &Path) -> VaultResult<Vec<VaultEntry>> {
    build_tree_at(dir, true)
}

fn build_tree_at(dir: &Path, is_root: bool) -> VaultResult<Vec<VaultEntry>> {
    let mut entries = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        if is_root
            && AGENT_CONTEXT_FILES
                .iter()
                .any(|(file_name, _)| *file_name == name)
        {
            continue;
        }

        let path = entry.path();
        let file_type = entry.file_type()?;

        if file_type.is_dir() {
            entries.push(VaultEntry {
                name,
                path: path.to_string_lossy().into_owned(),
                is_dir: true,
                children: Some(build_tree_at(&path, false)?),
            });
        } else if file_type.is_file() && path.extension().is_some_and(|ext| ext == "md") {
            let display_name = path
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or(name);
            entries.push(VaultEntry {
                name: display_name,
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

/// Recursively collects visible Markdown notes, skipping hidden and symlinked entries. The root's
/// agent context is excluded because its templates contain literal wikilink examples.
fn collect_markdown_files(root: &Path) -> VaultResult<Vec<PathBuf>> {
    let mut files = Vec::new();
    collect_markdown_files_at(root, true, &mut files)?;
    files.sort();
    Ok(files)
}

fn collect_markdown_files_at(
    dir: &Path,
    is_root: bool,
    files: &mut Vec<PathBuf>,
) -> VaultResult<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.')
            || (is_root
                && AGENT_CONTEXT_FILES
                    .iter()
                    .any(|(file_name, _)| *file_name == name))
        {
            continue;
        }

        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            continue;
        }

        let path = entry.path();
        if file_type.is_dir() {
            collect_markdown_files_at(&path, false, files)?;
        } else if file_type.is_file() && path.extension().is_some_and(|ext| ext == "md") {
            files.push(path);
        }
    }

    Ok(())
}

fn has_matching_stem(path: &Path, stem: &str) -> bool {
    path.file_stem()
        .is_some_and(|file_stem| file_stem.to_string_lossy().to_lowercase() == stem.to_lowercase())
}

fn scan_wikilink_targets_in(root: &Path, stem: &str) -> VaultResult<WikilinkScan> {
    let files = collect_markdown_files(root)?;
    let ambiguous = files
        .iter()
        .filter(|path| has_matching_stem(path, stem))
        .take(2)
        .count()
        > 1;
    let normalized_stem = stem.to_lowercase();
    let mut notes = Vec::new();
    let mut links = 0;

    for path in files {
        let path_string = path.to_string_lossy();
        let contents = read_note_in(root, &path_string)?;
        let matching_links = find_wikilinks(&contents)
            .iter()
            .filter(|wikilink| wikilink.target.trim().to_lowercase() == normalized_stem)
            .count();
        if matching_links > 0 {
            notes.push(path_string.into_owned());
            links += matching_links;
        }
    }

    Ok(WikilinkScan {
        notes,
        links,
        ambiguous,
    })
}

fn rewrite_wikilinks_in(
    root: &Path,
    old_stem: &str,
    new_stem: &str,
) -> VaultResult<WikilinkRewrite> {
    let files = collect_markdown_files(root)?;
    let ambiguous = files
        .iter()
        .filter(|path| has_matching_stem(path, old_stem))
        .take(2)
        .count()
        > 1;
    if ambiguous {
        return Ok(WikilinkRewrite {
            notes_changed: Vec::new(),
            links_changed: 0,
            failures: Vec::new(),
            skipped_ambiguous: true,
        });
    }

    let mut notes_changed = Vec::new();
    let mut links_changed = 0;
    let mut failures = Vec::new();

    for path in files {
        let path_string = path.to_string_lossy().into_owned();
        let contents = match read_note_in(root, &path_string) {
            Ok(contents) => contents,
            Err(err) => {
                failures.push(format!("{path_string}: {err}"));
                continue;
            }
        };
        let Some((rewritten, links)) = rewrite_targets(&contents, old_stem, new_stem) else {
            continue;
        };
        if let Err(err) = write_note_in(root, &path_string, &rewritten) {
            failures.push(format!("{path_string}: {err}"));
            continue;
        }

        notes_changed.push(path_string);
        links_changed += links;
    }

    Ok(WikilinkRewrite {
        notes_changed,
        links_changed,
        failures,
        skipped_ambiguous: false,
    })
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
        scaffold_agent_context_or_warn(&root);
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
pub fn open_vault(
    path: String,
    app: AppHandle,
    state: State<'_, VaultState>,
) -> VaultResult<String> {
    log::info!("open_vault: path={path}");
    (|| {
        let root = prepare_vault_root(Path::new(&path))?;
        scaffold_agent_context_or_warn(&root);
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
    (|| read_note_in(&current_root(&state)?, &path))().log_err("read_note")
}

/// Writes a note's contents. `path` must resolve inside the open vault root.
#[tauri::command]
pub fn write_note(path: String, contents: String, state: State<'_, VaultState>) -> VaultResult<()> {
    log::info!("write_note: path={path} bytes={}", contents.len());
    (|| write_note_in(&current_root(&state)?, &path, &contents))().log_err("write_note")
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

/// Renames a note or directory within its existing parent. Note names receive a `.md` extension
/// when omitted. Returns the entry's new path.
#[tauri::command]
pub fn rename_entry(
    path: String,
    new_name: String,
    state: State<'_, VaultState>,
) -> VaultResult<String> {
    log::info!("rename_entry: path={path} new_name={new_name}");
    (|| {
        let destination = rename_entry_in(&current_root(&state)?, &path, &new_name)?;
        log::info!("rename_entry: renamed to {}", destination.display());
        Ok(destination.to_string_lossy().into_owned())
    })()
    .log_err("rename_entry")
}

/// Duplicates a note or directory within its existing parent. Returns the copy's path.
#[tauri::command]
pub fn duplicate_entry(path: String, state: State<'_, VaultState>) -> VaultResult<String> {
    log::info!("duplicate_entry: path={path}");
    (|| {
        let destination = duplicate_entry_in(&current_root(&state)?, &path)?;
        log::info!("duplicate_entry: duplicated to {}", destination.display());
        Ok(destination.to_string_lossy().into_owned())
    })()
    .log_err("duplicate_entry")
}

/// Finds all links whose target matches `stem`, reporting duplicate note stems before a rewrite.
#[tauri::command]
pub fn scan_wikilink_targets(
    stem: String,
    state: State<'_, VaultState>,
) -> VaultResult<WikilinkScan> {
    log::info!("scan_wikilink_targets: stem={stem}");
    (|| scan_wikilink_targets_in(&current_root(&state)?, &stem))().log_err("scan_wikilink_targets")
}

/// Rewrites links targeting `old_stem`, refusing to write when more than one note owns that stem.
#[tauri::command]
pub fn rewrite_wikilinks(
    old_stem: String,
    new_stem: String,
    state: State<'_, VaultState>,
) -> VaultResult<WikilinkRewrite> {
    log::info!("rewrite_wikilinks: old_stem={old_stem} new_stem={new_stem}");
    (|| rewrite_wikilinks_in(&current_root(&state)?, &old_stem, &new_stem))()
        .log_err("rewrite_wikilinks")
}

#[tauri::command]
pub fn delete_entry(path: String, state: State<'_, VaultState>) -> VaultResult<()> {
    log::info!("delete_entry: path={path}");
    (|| delete_entry_in(&current_root(&state)?, &path))().log_err("delete_entry")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A unique temp directory per test, canonicalized because macOS resolves `/tmp` to
    /// `/private/tmp` — `guarded_path` compares canonical paths, so the root must already be one.
    fn temp_root(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("acidanthera-vault-{}-{label}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("creates temp root");
        dir.canonicalize().expect("canonicalizes temp root")
    }

    fn path_str(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn collect_markdown_files_should_skip_root_context_hidden_and_non_markdown_files() {
        let root = temp_root("wikilink-collector");
        fs::write(root.join("AGENTS.md"), "[[Old]]").expect("writes root agent context");
        fs::write(root.join("CLAUDE.md"), "[[Old]]").expect("writes root claude context");
        fs::write(root.join("visible.md"), "").expect("writes visible note");
        fs::write(root.join(".hidden.md"), "").expect("writes hidden note");
        fs::write(root.join("image.png"), "").expect("writes non-note");
        fs::create_dir(root.join("nested")).expect("creates nested directory");
        fs::write(root.join("nested").join("AGENTS.md"), "").expect("writes nested note");

        let files = collect_markdown_files(&root).expect("collects notes");
        let relative_paths: Vec<PathBuf> = files
            .iter()
            .map(|path| {
                path.strip_prefix(&root)
                    .expect("is inside root")
                    .to_path_buf()
            })
            .collect();

        assert_eq!(
            relative_paths,
            [
                PathBuf::from("nested/AGENTS.md"),
                PathBuf::from("visible.md")
            ]
        );
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[cfg(unix)]
    #[test]
    fn collect_markdown_files_should_skip_symlinked_notes() {
        let root = temp_root("wikilink-collector-symlink");
        let outside = temp_root("wikilink-collector-symlink-outside");
        fs::write(root.join("visible.md"), "").expect("writes visible note");
        fs::write(outside.join("outside.md"), "").expect("writes outside note");
        std::os::unix::fs::symlink(outside.join("outside.md"), root.join("linked.md"))
            .expect("links note");

        let files = collect_markdown_files(&root).expect("collects notes");

        assert_eq!(files, [root.join("visible.md")]);
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[test]
    fn scan_wikilink_targets_in_should_find_nested_matching_links() {
        let root = temp_root("wikilink-scan");
        fs::write(root.join("Old.md"), "").expect("writes target note");
        fs::write(root.join("AGENTS.md"), "[[Old]]").expect("writes root template");
        fs::create_dir(root.join("nested")).expect("creates nested directory");
        let source = root.join("nested").join("source.md");
        fs::write(&source, "[[ old ]] and [[Old|alias]]").expect("writes source note");

        let scan = scan_wikilink_targets_in(&root, "Old").expect("scans wikilinks");

        assert_eq!(scan.notes, [path_str(&source)]);
        assert_eq!(scan.links, 2);
        assert!(!scan.ambiguous);
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn scan_wikilink_targets_in_should_report_ambiguous_note_stems() {
        let root = temp_root("wikilink-ambiguity");
        fs::write(root.join("Old.md"), "").expect("writes target note");
        fs::create_dir(root.join("nested")).expect("creates nested directory");
        fs::write(root.join("nested").join("Old.md"), "").expect("writes duplicate target");
        fs::write(root.join("source.md"), "[[Old]]").expect("writes source note");

        let scan = scan_wikilink_targets_in(&root, "Old").expect("scans wikilinks");

        assert!(scan.ambiguous);
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn rewrite_wikilinks_in_should_skip_ambiguous_stems_without_writing() {
        let root = temp_root("wikilink-rewrite-ambiguous");
        fs::write(root.join("Old.md"), "").expect("writes target note");
        fs::create_dir(root.join("nested")).expect("creates nested directory");
        fs::write(root.join("nested").join("Old.md"), "").expect("writes duplicate target");
        let source = root.join("source.md");
        fs::write(&source, "[[Old]]").expect("writes source note");

        let rewritten = rewrite_wikilinks_in(&root, "Old", "New").expect("rewrites wikilinks");

        assert!(rewritten.notes_changed.is_empty());
        assert_eq!(rewritten.links_changed, 0);
        assert!(rewritten.failures.is_empty());
        assert!(rewritten.skipped_ambiguous);
        assert_eq!(
            fs::read_to_string(&source).expect("reads source note"),
            "[[Old]]"
        );
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn rewrite_wikilinks_in_should_change_only_matching_targets() {
        let root = temp_root("wikilink-rewrite");
        fs::write(root.join("Old.md"), "").expect("writes target note");
        let source = root.join("source.md");
        fs::write(
            &source,
            "[[Old]] [[ Old #heading|alias]] [[Old^block]] [[Old notes]] [[Other|Old]]",
        )
        .expect("writes source note");
        let untouched = root.join("untouched.md");
        fs::write(&untouched, "[[Old notes]]").expect("writes nonmatching note");

        let rewritten = rewrite_wikilinks_in(&root, "Old", "New").expect("rewrites wikilinks");

        assert_eq!(rewritten.notes_changed, [path_str(&source)]);
        assert_eq!(rewritten.links_changed, 3);
        assert!(rewritten.failures.is_empty());
        assert!(!rewritten.skipped_ambiguous);
        assert_eq!(
            fs::read_to_string(&source).expect("reads rewritten source"),
            "[[New]] [[ New #heading|alias]] [[New^block]] [[Old notes]] [[Other|Old]]"
        );
        assert_eq!(
            fs::read_to_string(&untouched).expect("reads untouched note"),
            "[[Old notes]]"
        );
        fs::remove_dir_all(&root).expect("cleans up");
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
        assert_eq!(names, ["note"]);

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn build_tree_should_sort_directories_before_files() {
        let root = temp_root("sorting");
        fs::write(root.join("a-note.md"), "").expect("writes note");
        fs::create_dir(root.join("z-dir")).expect("creates dir");

        let entries = build_tree(&root).expect("builds tree");

        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["z-dir", "a-note"]);

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

        let error =
            guarded_path(&root, &path_str(&root.join("..").join("evil.md"))).expect_err("rejects");

        assert!(matches!(error, VaultError::PathEscapesRoot));

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn with_md_extension_should_append_only_when_the_extension_is_missing() {
        assert_eq!(
            with_md_extension(PathBuf::from("/vault/note")),
            PathBuf::from("/vault/note.md")
        );
        assert_eq!(
            with_md_extension(PathBuf::from("/vault/note.md")),
            PathBuf::from("/vault/note.md")
        );
        assert_eq!(
            with_md_extension(PathBuf::from("/vault/note.txt")),
            PathBuf::from("/vault/note.txt.md")
        );
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
        assert_eq!(entries[0].name, "ideas");
        assert!(!entries[0].is_dir);

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn create_note_in_should_not_clobber_an_existing_note() {
        let root = temp_root("create-note-collision");
        fs::write(root.join("keep.md"), "precious").expect("writes note");

        let error = create_note_in(&root, &path_str(&root.join("keep.md"))).expect_err("rejects");

        assert!(matches!(error, VaultError::AlreadyExists));
        assert_eq!(
            fs::read_to_string(root.join("keep.md")).expect("reads back"),
            "precious"
        );

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn create_note_in_should_reject_a_target_outside_the_root() {
        let root = temp_root("create-note-escape");
        let escapee = root.join("..").join("acidanthera-escapee.md");

        let error = create_note_in(&root, &path_str(&escapee)).expect_err("rejects");

        assert!(matches!(error, VaultError::PathEscapesRoot));
        assert!(
            !escapee.exists(),
            "nothing may be written outside the vault root"
        );

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn create_directory_in_should_create_a_directory_visible_in_the_tree() {
        let root = temp_root("create-dir");

        let created =
            create_directory_in(&root, &path_str(&root.join("archive"))).expect("creates dir");

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

        let error =
            create_directory_in(&root, &path_str(&root.join("archive"))).expect_err("rejects");

        assert!(matches!(error, VaultError::AlreadyExists));

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn create_directory_in_should_reject_a_missing_parent_rather_than_creating_the_chain() {
        let root = temp_root("create-dir-nested");

        let error = create_directory_in(&root, &path_str(&root.join("missing").join("child")))
            .expect_err("rejects");

        assert!(matches!(error, VaultError::InvalidPath));
        assert!(
            !root.join("missing").exists(),
            "the parent chain must not be materialized"
        );

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn rename_entry_in_should_rename_a_note_and_retain_its_md_extension() {
        let root = temp_root("rename-note");
        let note = root.join("Old.md");
        fs::write(&note, "contents").expect("writes note");

        let renamed = rename_entry_in(&root, &path_str(&note), "New").expect("renames note");

        assert_eq!(renamed, root.join("New.md"));
        assert!(!note.exists());
        assert_eq!(
            fs::read_to_string(&renamed).expect("reads renamed note"),
            "contents"
        );
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn rename_entry_in_should_rename_a_directory_and_retain_its_children() {
        let root = temp_root("rename-directory");
        let directory = root.join("old");
        fs::create_dir(&directory).expect("creates directory");
        fs::write(directory.join("note.md"), "contents").expect("writes child note");

        let renamed = rename_entry_in(&root, &path_str(&directory), "new").expect("renames dir");

        assert_eq!(renamed, root.join("new"));
        assert_eq!(
            fs::read_to_string(renamed.join("note.md")).expect("reads child note"),
            "contents"
        );
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn rename_entry_in_should_reject_names_with_path_separators() {
        let root = temp_root("rename-separator");
        let note = root.join("note.md");
        fs::write(&note, "contents").expect("writes note");

        let slash_error =
            rename_entry_in(&root, &path_str(&note), "nested/name").expect_err("rejects slash");
        let backslash_error = rename_entry_in(&root, &path_str(&note), "nested\\name")
            .expect_err("rejects backslash");

        assert!(matches!(slash_error, VaultError::InvalidPath));
        assert!(matches!(backslash_error, VaultError::InvalidPath));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn rename_entry_in_should_reject_an_existing_destination() {
        let root = temp_root("rename-collision");
        let note = root.join("note.md");
        fs::write(&note, "source").expect("writes source note");
        fs::write(root.join("taken.md"), "destination").expect("writes destination note");

        let error =
            rename_entry_in(&root, &path_str(&note), "taken").expect_err("rejects collision");

        assert!(matches!(error, VaultError::AlreadyExists));
        assert_eq!(
            fs::read_to_string(&note).expect("keeps source note"),
            "source"
        );
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn rename_entry_in_should_reject_the_vault_root_itself() {
        let root = temp_root("rename-root");

        let error = rename_entry_in(&root, &path_str(&root), "new-root").expect_err("rejects root");

        assert!(matches!(error, VaultError::InvalidPath));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn rename_entry_in_should_report_not_found_for_a_missing_target() {
        let root = temp_root("rename-missing");

        let error = rename_entry_in(&root, &path_str(&root.join("missing.md")), "new")
            .expect_err("reports missing target");

        assert!(matches!(error, VaultError::NotFound));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn rename_entry_in_should_reject_a_target_outside_the_root() {
        let root = temp_root("rename-escape");
        let outside = root.join("..").join("outside.md");

        let error = rename_entry_in(&root, &path_str(&outside), "new").expect_err("rejects escape");

        assert!(matches!(error, VaultError::PathEscapesRoot));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn duplicate_entry_in_should_copy_a_note_under_the_copy_name() {
        let root = temp_root("duplicate-note");
        let note = root.join("X.md");
        fs::write(&note, "contents").expect("writes note");

        let duplicate = duplicate_entry_in(&root, &path_str(&note)).expect("duplicates note");

        assert_eq!(duplicate, root.join("X copy.md"));
        assert_eq!(
            fs::read_to_string(&duplicate).expect("reads duplicate"),
            "contents"
        );
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn duplicate_entry_in_should_escalate_the_copy_name_suffix() {
        let root = temp_root("duplicate-suffix");
        let note = root.join("X.md");
        fs::write(&note, "contents").expect("writes note");
        fs::write(root.join("X copy.md"), "first copy").expect("writes first copy");

        let duplicate = duplicate_entry_in(&root, &path_str(&note)).expect("duplicates note");

        assert_eq!(duplicate, root.join("X copy 2.md"));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn duplicate_entry_in_should_recursively_copy_all_directory_contents() {
        let root = temp_root("duplicate-directory");
        let directory = root.join("archive");
        fs::create_dir(&directory).expect("creates directory");
        fs::create_dir(directory.join("nested")).expect("creates nested directory");
        fs::write(directory.join(".hidden"), "hidden").expect("writes hidden file");
        fs::write(directory.join("image.png"), "image").expect("writes non-note file");
        fs::write(directory.join("nested").join("note.md"), "contents").expect("writes note");

        let duplicate = duplicate_entry_in(&root, &path_str(&directory)).expect("duplicates dir");

        assert_eq!(duplicate, root.join("archive copy"));
        assert_eq!(
            fs::read_to_string(duplicate.join(".hidden")).expect("reads hidden file"),
            "hidden"
        );
        assert_eq!(
            fs::read_to_string(duplicate.join("image.png")).expect("reads image"),
            "image"
        );
        assert_eq!(
            fs::read_to_string(duplicate.join("nested").join("note.md"))
                .expect("reads nested note"),
            "contents"
        );
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[cfg(unix)]
    #[test]
    fn duplicate_entry_in_should_skip_symlinks_within_a_directory() {
        let root = temp_root("duplicate-symlink");
        let outside = temp_root("duplicate-symlink-outside");
        let directory = root.join("archive");
        fs::create_dir(&directory).expect("creates directory");
        fs::write(outside.join("secret.md"), "secret").expect("writes outside note");
        std::os::unix::fs::symlink(outside.join("secret.md"), directory.join("linked.md"))
            .expect("creates symlink");

        let duplicate = duplicate_entry_in(&root, &path_str(&directory)).expect("duplicates dir");

        assert!(!duplicate.join("linked.md").exists());
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[test]
    fn duplicate_entry_in_should_reject_a_target_outside_the_root() {
        let root = temp_root("duplicate-escape");
        let outside = root.join("..").join("outside.md");

        let error = duplicate_entry_in(&root, &path_str(&outside)).expect_err("rejects escape");

        assert!(matches!(error, VaultError::PathEscapesRoot));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn delete_entry_in_should_remove_a_note_from_the_tree() {
        let root = temp_root("delete-note");
        let note = root.join("note.md");
        fs::write(&note, "delete me").expect("writes note");

        delete_entry_in(&root, &path_str(&note)).expect("moves note to trash");

        assert!(build_tree(&root).expect("builds tree").is_empty());
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn delete_entry_in_should_remove_a_directory_and_its_contents() {
        let root = temp_root("delete-directory");
        let directory = root.join("archive");
        fs::create_dir(&directory).expect("creates directory");
        fs::write(directory.join("note.md"), "delete me").expect("writes note");

        delete_entry_in(&root, &path_str(&directory)).expect("moves directory to trash");

        assert!(!directory.exists());
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn delete_entry_in_should_reject_the_vault_root_itself() {
        let root = temp_root("delete-root");

        let error = delete_entry_in(&root, &path_str(&root)).expect_err("rejects root");

        assert!(matches!(error, VaultError::InvalidPath));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn delete_entry_in_should_report_not_found_for_a_missing_target() {
        let root = temp_root("delete-missing");

        let error = delete_entry_in(&root, &path_str(&root.join("missing.md")))
            .expect_err("reports missing target");

        assert!(matches!(error, VaultError::NotFound));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn delete_entry_in_should_reject_a_target_outside_the_root() {
        let root = temp_root("delete-escape");
        let outside = root.join("..").join("outside.md");

        let error = delete_entry_in(&root, &path_str(&outside)).expect_err("rejects escape");

        assert!(matches!(error, VaultError::PathEscapesRoot));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[cfg(unix)]
    #[test]
    fn delete_entry_in_should_reject_a_leaf_symlink() {
        let root = temp_root("delete-leaf-symlink");
        let outside = temp_root("delete-leaf-symlink-outside");
        let outside_note = outside.join("secret.md");
        fs::write(&outside_note, "secret").expect("writes outside note");
        let link = root.join("link.md");
        std::os::unix::fs::symlink(&outside_note, &link).expect("creates symlink");

        let error = delete_entry_in(&root, &path_str(&link)).expect_err("rejects symlink");

        assert!(matches!(error, VaultError::PathEscapesRoot));
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[test]
    fn claude_context_template_should_import_the_agents_template() {
        let claude = AGENT_CONTEXT_FILES
            .iter()
            .find(|(name, _)| *name == "CLAUDE.md")
            .expect("ships a CLAUDE.md template")
            .1;

        // One source of truth: CLAUDE.md must pull AGENTS.md in rather than restate it.
        assert!(claude.contains("@AGENTS.md"));
    }

    #[test]
    fn scaffold_agent_context_should_create_both_files_in_a_fresh_vault() {
        let root = temp_root("scaffold-fresh");

        let created = scaffold_agent_context(&root).expect("scaffolds");

        assert_eq!(created, ["AGENTS.md", "CLAUDE.md"]);
        for (name, contents) in AGENT_CONTEXT_FILES {
            assert_eq!(
                fs::read_to_string(root.join(name)).expect("reads back"),
                contents
            );
        }

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn scaffold_agent_context_should_be_hidden_from_the_tree() {
        let root = temp_root("scaffold-tree");
        scaffold_agent_context(&root).expect("scaffolds");
        fs::write(root.join("note.md"), "").expect("writes a real note");

        let entries = build_tree(&root).expect("builds tree");

        // The agent-context pair is for the headless engines, not sidebar navigation (#50).
        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["note"]);

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn build_tree_should_only_hide_agent_context_files_at_the_root() {
        let root = temp_root("nested-agents-md");
        fs::create_dir(root.join("sub")).expect("creates dir");
        fs::write(
            root.join("sub").join("AGENTS.md"),
            "not the vault's own agent context",
        )
        .expect("writes nested note");

        let entries = build_tree(&root).expect("builds tree");

        let sub = entries
            .iter()
            .find(|e| e.name == "sub")
            .expect("keeps the subdirectory");
        let sub_names: Vec<&str> = sub
            .children
            .as_ref()
            .expect("has children")
            .iter()
            .map(|e| e.name.as_str())
            .collect();
        assert_eq!(sub_names, ["AGENTS"]);

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn scaffold_agent_context_should_not_clobber_an_existing_file() {
        let root = temp_root("scaffold-existing");
        fs::write(root.join("AGENTS.md"), "my own instructions").expect("writes agent context");

        let created = scaffold_agent_context(&root).expect("scaffolds");

        // Each file is independent: the hand-written one survives, the missing one is filled in.
        assert_eq!(created, ["CLAUDE.md"]);
        assert_eq!(
            fs::read_to_string(root.join("AGENTS.md")).expect("reads back"),
            "my own instructions"
        );
        assert!(root.join("CLAUDE.md").exists());

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn scaffold_agent_context_should_be_idempotent_across_reopens() {
        let root = temp_root("scaffold-idempotent");
        scaffold_agent_context(&root).expect("scaffolds");
        fs::write(root.join("AGENTS.md"), "edited by the user").expect("edits agent context");

        // Every boot re-opens the vault; a second scaffold must be a no-op over the user's edits.
        let created = scaffold_agent_context(&root).expect("scaffolds again");

        assert!(created.is_empty());
        assert_eq!(
            fs::read_to_string(root.join("AGENTS.md")).expect("reads back"),
            "edited by the user"
        );

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn prepare_vault_root_should_create_and_canonicalize_a_missing_directory() {
        let parent = temp_root("prepare-root");
        let root = parent.join("new-vault");

        let prepared = prepare_vault_root(&root).expect("prepares root");

        assert_eq!(prepared, root.canonicalize().expect("canonicalizes root"));
        fs::remove_dir_all(&parent).expect("cleans up");
    }

    #[test]
    fn prepare_vault_root_should_reject_an_existing_file() {
        let root = temp_root("prepare-file");
        let file = root.join("not-a-directory");
        fs::write(&file, "not a vault").expect("writes file");

        let error = prepare_vault_root(&file).expect_err("rejects file");

        assert!(matches!(error, VaultError::InvalidPath));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn current_root_should_report_no_vault_open_for_default_state() {
        let state = VaultState::default();

        let error = current_root(&state).expect_err("reports missing root");

        assert!(matches!(error, VaultError::NoVaultOpen));
    }

    #[test]
    fn read_note_in_and_write_note_in_should_round_trip_contents_inside_the_root() {
        let root = temp_root("read-write");
        let note = root.join("note.md");

        write_note_in(&root, &path_str(&note), "hello").expect("writes note");
        let contents = read_note_in(&root, &path_str(&note)).expect("reads note");

        assert_eq!(contents, "hello");
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn write_note_in_should_reject_a_target_outside_the_root() {
        let root = temp_root("write-escape");
        let target = root.join("..").join("outside.md");

        let error = write_note_in(&root, &path_str(&target), "nope").expect_err("rejects escape");

        assert!(matches!(error, VaultError::PathEscapesRoot));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[cfg(unix)]
    #[test]
    fn guarded_path_should_reject_a_parent_symlink_that_escapes_the_root() {
        let root = temp_root("parent-symlink");
        let outside = temp_root("parent-symlink-outside");
        let link = root.join("linked");
        std::os::unix::fs::symlink(&outside, &link).expect("creates symlink");

        let error =
            guarded_path(&root, &path_str(&link.join("note.md"))).expect_err("rejects escape");

        assert!(matches!(error, VaultError::PathEscapesRoot));
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[cfg(unix)]
    #[test]
    fn read_note_in_should_reject_a_leaf_symlink_that_escapes_the_root() {
        let root = temp_root("read-leaf-symlink");
        let outside = temp_root("read-leaf-symlink-outside");
        let outside_note = outside.join("secret.md");
        fs::write(&outside_note, "secret").expect("writes outside note");
        let link = root.join("link.md");
        std::os::unix::fs::symlink(&outside_note, &link).expect("creates symlink");

        let error = read_note_in(&root, &path_str(&link)).expect_err("rejects symlink");

        assert!(matches!(error, VaultError::PathEscapesRoot));
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[cfg(unix)]
    #[test]
    fn write_note_in_should_leave_an_outside_leaf_symlink_target_unchanged() {
        let root = temp_root("write-leaf-symlink");
        let outside = temp_root("write-leaf-symlink-outside");
        let outside_note = outside.join("secret.md");
        fs::write(&outside_note, "secret").expect("writes outside note");
        let link = root.join("link.md");
        std::os::unix::fs::symlink(&outside_note, &link).expect("creates symlink");

        let error = write_note_in(&root, &path_str(&link), "changed").expect_err("rejects symlink");

        assert!(matches!(error, VaultError::PathEscapesRoot));
        assert_eq!(
            fs::read_to_string(&outside_note).expect("reads outside note"),
            "secret"
        );
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[cfg(unix)]
    #[test]
    fn build_tree_should_skip_symlinked_entries() {
        let root = temp_root("tree-symlinks");
        let outside = temp_root("tree-symlinks-outside");
        let outside_note = outside.join("outside.md");
        fs::write(&outside_note, "outside").expect("writes outside note");
        fs::write(root.join("visible.md"), "visible").expect("writes visible note");
        std::os::unix::fs::symlink(&outside_note, root.join("linked.md")).expect("links note");
        std::os::unix::fs::symlink(&outside, root.join("linked-dir")).expect("links directory");

        let entries = build_tree(&root).expect("builds tree");

        assert_eq!(
            entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            ["visible"]
        );
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[test]
    fn build_tree_should_sort_entries_case_insensitively_within_each_kind() {
        let root = temp_root("tree-case-sort");
        fs::create_dir(root.join("zebra")).expect("creates directory");
        fs::create_dir(root.join("Alpha")).expect("creates directory");
        fs::write(root.join("zeta.md"), "").expect("writes note");
        fs::write(root.join("Beta.md"), "").expect("writes note");

        let entries = build_tree(&root).expect("builds tree");

        assert_eq!(
            entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            ["Alpha", "zebra", "Beta", "zeta"]
        );
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn vault_entry_should_serialize_to_the_frontend_contract() {
        let entry = VaultEntry {
            name: "notes".into(),
            path: "/vault/notes".into(),
            is_dir: true,
            children: Some(Vec::new()),
        };

        let value = serde_json::to_value(entry).expect("serializes");

        assert_eq!(
            value,
            serde_json::json!({ "name": "notes", "path": "/vault/notes", "isDir": true, "children": [] })
        );
    }

    #[test]
    fn wikilink_results_should_serialize_to_the_frontend_contract() {
        let scan = serde_json::to_value(WikilinkScan {
            notes: vec!["/vault/source.md".into()],
            links: 2,
            ambiguous: false,
        })
        .expect("serializes scan");
        let rewrite = serde_json::to_value(WikilinkRewrite {
            notes_changed: vec!["/vault/source.md".into()],
            links_changed: 2,
            failures: vec!["/vault/broken.md: permission denied".into()],
            skipped_ambiguous: false,
        })
        .expect("serializes rewrite");

        assert_eq!(
            scan,
            serde_json::json!({ "notes": ["/vault/source.md"], "links": 2, "ambiguous": false })
        );
        assert_eq!(
            rewrite,
            serde_json::json!({ "notesChanged": ["/vault/source.md"], "linksChanged": 2, "failures": ["/vault/broken.md: permission denied"], "skippedAmbiguous": false })
        );
    }

    #[test]
    fn vault_error_should_serialize_as_a_plain_string() {
        let value = serde_json::to_string(&VaultError::PathEscapesRoot).expect("serializes");

        assert_eq!(value, "\"path escapes the vault root\"");
    }
}
