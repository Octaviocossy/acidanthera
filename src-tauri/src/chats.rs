//! Chat persistence store (epic #66, child #68): durable CRUD over saved conversations. Each
//! conversation is one *chat file* — the plain-markdown format owned by
//! `src/lib/chat/chat-file.ts` (#67) — stored under the hidden `.acidanthera/chats/` directory inside
//! the open vault, keyed by a chat `id`.
//!
//! The store is deliberately **format-agnostic**: it moves the serialized chat-file bytes to and
//! from disk but never parses the chat-file *shape* — that contract lives in TS
//! (`serializeChatFile`/`parseChatFile`). Rust owns *where* and *when* a chat is stored, exactly
//! as `vault.rs` reads/writes note strings without interpreting their markdown.
//!
//! Because `.acidanthera` is dot-prefixed, `vault.rs`'s `build_tree` already skips it (like `.git`,
//! `.obsidian`, …), so saved chats never appear in the sidebar — they stay readable by path.

use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

use serde::Serialize;
use tauri::State;
use thiserror::Error;

use crate::logging::LogResult;
use crate::vault::VaultState;

/// Hidden vault subdirectory (relative to the vault root) holding saved chat files. Dot-prefixed
/// so `vault.rs`'s `build_tree` skips it — chats stay out of the sidebar.
const CHATS_DIR: [&str; 2] = [".acidanthera", "chats"];

/// The on-disk suffix of a chat file. Mirrors `CHAT_FILE_EXTENSION` in `src/lib/chat/chat-file.ts`
/// — an unavoidable cross-language duplication (like `settings.rs`'s mirrored TS defaults), pinned
/// by a test so the two never drift.
const CHAT_FILE_EXTENSION: &str = ".chat.md";

/// One saved conversation as returned by `list_chats`. `contents` is the raw chat-file markdown —
/// it is parsed on the TS side (`parseChatFile`); this store never interprets it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRecord {
    /// Stable id — the file name with the `.chat.md` suffix stripped.
    pub id: String,
    /// Absolute path of the chat file on disk.
    pub path: String,
    /// Last-modified time, milliseconds since the Unix epoch (filesystem mtime); `0` if unknown.
    pub updated_ms: u64,
    /// The raw serialized chat-file markdown, parsed on the TS side.
    pub contents: String,
}

#[derive(Debug, Error)]
pub enum ChatStoreError {
    #[error("no vault is open")]
    NoVaultOpen,
    #[error("invalid chat id")]
    InvalidId,
    #[error("no chat exists with that id")]
    NotFound,
    #[error("chat storage escapes the vault root")]
    PathEscapesRoot,
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl Serialize for ChatStoreError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type ChatStoreResult<T> = Result<T, ChatStoreError>;

/// `<vault_root>/.acidanthera/chats`.
#[cfg(test)]
fn chats_root(vault_root: &Path) -> PathBuf {
    CHATS_DIR
        .iter()
        .fold(vault_root.to_path_buf(), |acc, segment| acc.join(segment))
}

/// A chat id is used verbatim as a file-name stem, so it must be a bare *name* — never a path.
/// Rejects separators and traversal tokens, mirroring `createVaultEntry`'s "a name, never a path"
/// rule, so a stored chat can never escape `.acidanthera/chats/`.
fn is_safe_id(id: &str) -> bool {
    !id.is_empty()
        && id != "."
        && id != ".."
        && !id.contains('/')
        && !id.contains('\\')
        && !id.contains('\0')
}

/// Resolves the on-disk path for `id` under an already-validated chats dir, rejecting an unsafe id.
fn chat_path(chats_root: &Path, id: &str) -> ChatStoreResult<PathBuf> {
    if !is_safe_id(id) {
        return Err(ChatStoreError::InvalidId);
    }
    Ok(chats_root.join(format!("{id}{CHAT_FILE_EXTENSION}")))
}

fn storage_directory(
    path: &Path,
    vault_root: &Path,
    create: bool,
) -> ChatStoreResult<Option<PathBuf>> {
    match fs::symlink_metadata(path) {
        Err(err) if err.kind() == std::io::ErrorKind::NotFound && !create => return Ok(None),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => fs::create_dir(path)?,
        Err(err) => return Err(err.into()),
        Ok(_) => {}
    }

    let metadata = fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() {
        return Err(ChatStoreError::PathEscapesRoot);
    }
    if !metadata.is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotADirectory,
            "chat storage is not a directory",
        )
        .into());
    }

    let path = path.canonicalize()?;
    path.starts_with(vault_root)
        .then_some(path)
        .ok_or(ChatStoreError::PathEscapesRoot)
        .map(Some)
}

/// Returns the real `<vault_root>/.acidanthera/chats` directory. The two storage components are checked
/// independently so neither can redirect chat operations through a symlink.
fn storage_root(vault_root: &Path, create: bool) -> ChatStoreResult<Option<PathBuf>> {
    let vault_root = vault_root.canonicalize()?;
    let Some(acidanthera) = storage_directory(&vault_root.join(CHATS_DIR[0]), &vault_root, create)?
    else {
        return Ok(None);
    };
    storage_directory(&acidanthera.join(CHATS_DIR[1]), &vault_root, create)
}

fn reject_symlink(path: &Path) -> ChatStoreResult<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(ChatStoreError::PathEscapesRoot),
        Ok(_) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err.into()),
    }
}

fn current_root(vault: &VaultState) -> ChatStoreResult<PathBuf> {
    vault.root().ok_or(ChatStoreError::NoVaultOpen)
}

/// The file's mtime as milliseconds since the Unix epoch, or `0` when it can't be read.
fn mtime_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|dur| dur.as_millis() as u64)
        .unwrap_or(0)
}

/// Writes `contents` to `<root>/.acidanthera/chats/<id>.chat.md`, creating the chats dir on demand.
/// Overwrites an existing chat with the same id (a re-save of the same conversation). Returns the
/// path so the caller can reveal/reference it.
fn save_chat_in(vault_root: &Path, id: &str, contents: &str) -> ChatStoreResult<PathBuf> {
    let Some(chats_root) = storage_root(vault_root, true)? else {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "chat storage was not created",
        )
        .into());
    };
    let path = chat_path(&chats_root, id)?;
    reject_symlink(&path)?;
    fs::write(&path, contents)?;
    Ok(path)
}

/// Reads a chat's raw markdown by id. A missing chat is a domain `NotFound`, not a raw io error.
fn read_chat_in(vault_root: &Path, id: &str) -> ChatStoreResult<String> {
    let Some(chats_root) = storage_root(vault_root, false)? else {
        return Err(ChatStoreError::NotFound);
    };
    let path = chat_path(&chats_root, id)?;
    reject_symlink(&path)?;
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(contents),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Err(ChatStoreError::NotFound),
        Err(err) => Err(err.into()),
    }
}

/// Deletes a chat by id. A missing chat is a domain `NotFound`.
fn delete_chat_in(vault_root: &Path, id: &str) -> ChatStoreResult<()> {
    let Some(chats_root) = storage_root(vault_root, false)? else {
        return Err(ChatStoreError::NotFound);
    };
    let path = chat_path(&chats_root, id)?;
    reject_symlink(&path)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Err(ChatStoreError::NotFound),
        Err(err) => Err(err.into()),
    }
}

/// Lists every saved chat, newest first. A not-yet-created chats dir is simply empty (not an
/// error). Only `*.chat.md` files are considered; each one's raw contents are returned so the TS
/// side can parse title/model in a single IPC round-trip rather than `1 + N` reads.
fn list_chats_in(vault_root: &Path) -> ChatStoreResult<Vec<ChatRecord>> {
    let Some(dir) = storage_root(vault_root, false)? else {
        return Ok(Vec::new());
    };
    let read_dir = fs::read_dir(&dir)?;

    let mut records = Vec::new();
    for entry in read_dir {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some(id) = name.strip_suffix(CHAT_FILE_EXTENSION) else {
            continue;
        };
        if !is_safe_id(id) {
            continue; // a bare `.chat.md` with no id stem — not a real chat
        }
        let path = entry.path();
        if !entry.file_type()?.is_file() {
            continue; // ignore a directory that happens to end in `.chat.md`
        }
        let contents = fs::read_to_string(&path)?;
        records.push(ChatRecord {
            id: id.to_string(),
            path: path.to_string_lossy().into_owned(),
            updated_ms: mtime_ms(&path),
            contents,
        });
    }

    // Newest conversation on top; tie-break by id so the order is deterministic.
    records.sort_by(|a, b| {
        b.updated_ms
            .cmp(&a.updated_ms)
            .then_with(|| a.id.cmp(&b.id))
    });
    Ok(records)
}

/// Saves a conversation's serialized chat-file markdown under `<vault>/.acidanthera/chats/<id>.chat.md`,
/// creating the directory on first save. Overwrites the existing file when the id already exists.
/// Returns the written path.
#[tauri::command]
pub fn save_chat(
    id: String,
    contents: String,
    vault: State<'_, VaultState>,
) -> ChatStoreResult<String> {
    log::info!("save_chat: id={id} bytes={}", contents.len());
    (|| {
        let path = save_chat_in(&current_root(&vault)?, &id, &contents)?;
        log::info!("save_chat: wrote {}", path.display());
        Ok(path.to_string_lossy().into_owned())
    })()
    .log_err("save_chat")
}

/// Reads one saved conversation's raw chat-file markdown by id (parsed on the TS side).
#[tauri::command]
pub fn read_chat(id: String, vault: State<'_, VaultState>) -> ChatStoreResult<String> {
    log::info!("read_chat: id={id}");
    (|| read_chat_in(&current_root(&vault)?, &id))().log_err("read_chat")
}

/// Lists every saved conversation (newest first), each with its raw markdown for the TS parser.
#[tauri::command]
pub fn list_chats(vault: State<'_, VaultState>) -> ChatStoreResult<Vec<ChatRecord>> {
    log::info!("list_chats");
    (|| list_chats_in(&current_root(&vault)?))().log_err("list_chats")
}

/// Deletes one saved conversation by id.
#[tauri::command]
pub fn delete_chat(id: String, vault: State<'_, VaultState>) -> ChatStoreResult<()> {
    log::info!("delete_chat: id={id}");
    (|| {
        delete_chat_in(&current_root(&vault)?, &id)?;
        log::info!("delete_chat: removed {id}");
        Ok(())
    })()
    .log_err("delete_chat")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A unique temp vault root per test. No canonicalization needed — this store never
    /// canonicalizes (the id is a validated bare name, so traversal is impossible by construction).
    fn temp_root(label: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("acidanthera-chats-{}-{label}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("creates temp root");
        dir.canonicalize().expect("canonicalizes temp root")
    }

    #[test]
    fn chat_file_extension_should_match_the_ts_contract() {
        // Mirrors `CHAT_FILE_EXTENSION` in src/lib/chat/chat-file.ts — must not drift.
        assert_eq!(CHAT_FILE_EXTENSION, ".chat.md");
    }

    #[test]
    fn is_safe_id_should_reject_paths_and_traversal() {
        assert!(is_safe_id("2026-07-10-abc123"));
        assert!(is_safe_id("a chat with spaces"));
        assert!(!is_safe_id(""));
        assert!(!is_safe_id("."));
        assert!(!is_safe_id(".."));
        assert!(!is_safe_id("nested/id"));
        assert!(!is_safe_id("back\\slash"));
        assert!(!is_safe_id("../escape"));
    }

    #[test]
    fn save_chat_in_should_create_the_acidanthera_chats_dir_and_write_the_file() {
        let root = temp_root("save-creates-dir");

        let path = save_chat_in(&root, "hello", "---\nschema: 1\n---\n").expect("saves");

        assert_eq!(
            path,
            root.join(".acidanthera")
                .join("chats")
                .join("hello.chat.md")
        );
        assert!(root.join(".acidanthera").join("chats").is_dir());
        assert_eq!(
            fs::read_to_string(&path).expect("reads back"),
            "---\nschema: 1\n---\n"
        );

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn save_then_read_should_round_trip_contents_verbatim() {
        let root = temp_root("round-trip");
        let raw = "---\nschema: 1\nid: \"x\"\n---\n\n<!-- acidanthera:chat kind=\"user_message\" id=\"user-1\" -->\n\n> **You**\n\nhi";

        save_chat_in(&root, "x", raw).expect("saves");
        let read_back = read_chat_in(&root, "x").expect("reads");

        // Format-agnostic: the store returns exactly the bytes it was given.
        assert_eq!(read_back, raw);

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn save_should_overwrite_an_existing_chat_with_the_same_id() {
        let root = temp_root("overwrite");

        save_chat_in(&root, "same", "first").expect("saves first");
        save_chat_in(&root, "same", "second").expect("saves second");

        assert_eq!(read_chat_in(&root, "same").expect("reads"), "second");

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn list_chats_in_should_be_empty_when_the_dir_does_not_exist_yet() {
        let root = temp_root("list-empty");

        let records = list_chats_in(&root).expect("lists");

        assert!(records.is_empty());

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn list_chats_in_should_return_saved_chats_newest_first_and_ignore_other_files() {
        let root = temp_root("list-order");
        let chats = chats_root(&root);
        fs::create_dir_all(&chats).expect("creates chats dir");

        // Two chats + a stray non-chat file that must be ignored.
        fs::write(chats.join("older.chat.md"), "old").expect("writes older");
        fs::write(chats.join("newer.chat.md"), "new").expect("writes newer");
        fs::write(chats.join("notes.md"), "not a chat").expect("writes stray");

        // Make `newer` genuinely newer so the mtime sort is exercised deterministically.
        let later = std::time::SystemTime::now() + std::time::Duration::from_secs(5);
        filetime_set(&chats.join("newer.chat.md"), later);

        let records = list_chats_in(&root).expect("lists");

        let ids: Vec<&str> = records.iter().map(|r| r.id.as_str()).collect();
        assert_eq!(ids, ["newer", "older"]);
        assert_eq!(records[0].contents, "new");
        assert_eq!(records[1].contents, "old");

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn read_chat_in_should_report_not_found_for_a_missing_chat() {
        let root = temp_root("read-missing");

        let error = read_chat_in(&root, "ghost").expect_err("rejects");

        assert!(matches!(error, ChatStoreError::NotFound));

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn delete_chat_in_should_remove_the_file_then_report_not_found() {
        let root = temp_root("delete");
        save_chat_in(&root, "doomed", "bye").expect("saves");

        delete_chat_in(&root, "doomed").expect("deletes");
        assert!(!chats_root(&root).join("doomed.chat.md").exists());

        // A second delete is a domain NotFound, not a raw io error.
        let error = delete_chat_in(&root, "doomed").expect_err("rejects");
        assert!(matches!(error, ChatStoreError::NotFound));

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn an_unsafe_id_should_be_rejected_before_touching_the_filesystem() {
        let root = temp_root("unsafe-id");

        for bad in ["", "..", "nested/id", "..\\escape"] {
            assert!(matches!(
                save_chat_in(&root, bad, "x"),
                Err(ChatStoreError::InvalidId)
            ));
            assert!(matches!(
                read_chat_in(&root, bad),
                Err(ChatStoreError::InvalidId)
            ));
            assert!(matches!(
                delete_chat_in(&root, bad),
                Err(ChatStoreError::InvalidId)
            ));
        }

        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[cfg(unix)]
    #[test]
    fn save_chat_in_should_reject_a_chats_directory_symlinked_outside_the_vault() {
        let root = temp_root("storage-symlink");
        let outside = temp_root("storage-symlink-outside");
        fs::create_dir(root.join(".acidanthera")).expect("creates acidanthera directory");
        std::os::unix::fs::symlink(&outside, root.join(".acidanthera").join("chats"))
            .expect("links chats directory");

        let error = save_chat_in(&root, "chat", "contents").expect_err("rejects symlink");

        assert!(matches!(error, ChatStoreError::PathEscapesRoot));
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[cfg(unix)]
    #[test]
    fn save_chat_in_should_leave_an_outside_leaf_symlink_target_unchanged() {
        let root = temp_root("leaf-symlink");
        let outside = temp_root("leaf-symlink-outside");
        let outside_chat = outside.join("chat.chat.md");
        fs::write(&outside_chat, "original").expect("writes outside chat");
        let chats = chats_root(&root);
        fs::create_dir_all(&chats).expect("creates chats directory");
        std::os::unix::fs::symlink(&outside_chat, chats.join("chat.chat.md")).expect("links chat");

        let error = save_chat_in(&root, "chat", "changed").expect_err("rejects symlink");

        assert!(matches!(error, ChatStoreError::PathEscapesRoot));
        assert_eq!(
            fs::read_to_string(&outside_chat).expect("reads outside chat"),
            "original"
        );
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[cfg(unix)]
    #[test]
    fn read_chat_in_should_reject_a_leaf_symlink_that_escapes_the_vault() {
        let root = temp_root("read-leaf-symlink");
        let outside = temp_root("read-leaf-symlink-outside");
        let outside_chat = outside.join("chat.chat.md");
        fs::write(&outside_chat, "secret").expect("writes outside chat");
        let chats = chats_root(&root);
        fs::create_dir_all(&chats).expect("creates chats directory");
        std::os::unix::fs::symlink(&outside_chat, chats.join("chat.chat.md")).expect("links chat");

        let error = read_chat_in(&root, "chat").expect_err("rejects symlink");

        assert!(matches!(error, ChatStoreError::PathEscapesRoot));
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[cfg(unix)]
    #[test]
    fn list_chats_in_should_ignore_symlinked_chat_files() {
        let root = temp_root("list-symlink");
        let outside = temp_root("list-symlink-outside");
        let chats = chats_root(&root);
        fs::create_dir_all(&chats).expect("creates chats directory");
        fs::write(outside.join("outside.chat.md"), "outside").expect("writes outside chat");
        std::os::unix::fs::symlink(
            outside.join("outside.chat.md"),
            chats.join("linked.chat.md"),
        )
        .expect("links chat");

        let records = list_chats_in(&root).expect("lists chats");

        assert!(records.is_empty());
        fs::remove_dir_all(&root).expect("cleans up");
        fs::remove_dir_all(&outside).expect("cleans up outside");
    }

    #[test]
    fn list_chats_in_should_ignore_an_unsafe_id_found_on_disk() {
        let root = temp_root("list-unsafe-id");
        let chats = chats_root(&root);
        fs::create_dir_all(&chats).expect("creates chats directory");
        fs::write(chats.join("..chat.md"), "invalid").expect("writes invalid chat");

        let records = list_chats_in(&root).expect("lists chats");

        assert!(records.is_empty());
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn list_chats_in_should_ignore_a_directory_ending_in_chat_md() {
        let root = temp_root("list-directory");
        let chats = chats_root(&root);
        fs::create_dir_all(chats.join("folder.chat.md")).expect("creates matching directory");

        let records = list_chats_in(&root).expect("lists chats");

        assert!(records.is_empty());
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn list_chats_in_should_break_equal_mtime_ties_by_id() {
        let root = temp_root("list-ties");
        let chats = chats_root(&root);
        fs::create_dir_all(&chats).expect("creates chats directory");
        let alpha = chats.join("alpha.chat.md");
        let beta = chats.join("beta.chat.md");
        fs::write(&alpha, "alpha").expect("writes alpha");
        fs::write(&beta, "beta").expect("writes beta");
        let time = std::time::SystemTime::now();
        filetime_set(&alpha, time);
        filetime_set(&beta, time);

        let records = list_chats_in(&root).expect("lists chats");

        assert_eq!(
            records
                .iter()
                .map(|record| record.id.as_str())
                .collect::<Vec<_>>(),
            ["alpha", "beta"]
        );
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn save_chat_in_should_return_io_when_acidanthera_is_a_regular_file() {
        let root = temp_root("acidanthera-file");
        fs::write(root.join(".acidanthera"), "not a directory").expect("writes acidanthera file");

        let error = save_chat_in(&root, "chat", "contents").expect_err("rejects file");

        assert!(matches!(error, ChatStoreError::Io(_)));
        fs::remove_dir_all(&root).expect("cleans up");
    }

    #[test]
    fn chat_record_should_serialize_to_the_frontend_contract() {
        let record = ChatRecord {
            id: "chat-1".into(),
            path: "/vault/.acidanthera/chats/chat-1.chat.md".into(),
            updated_ms: 42,
            contents: "# Chat".into(),
        };

        let value = serde_json::to_value(record).expect("serializes");

        assert_eq!(
            value,
            serde_json::json!({ "id": "chat-1", "path": "/vault/.acidanthera/chats/chat-1.chat.md", "updatedMs": 42, "contents": "# Chat" })
        );
    }

    #[test]
    fn chat_store_error_should_serialize_as_a_plain_string() {
        let value = serde_json::to_string(&ChatStoreError::PathEscapesRoot).expect("serializes");

        assert_eq!(value, "\"chat storage escapes the vault root\"");
    }

    /// Sets a file's mtime, so the newest-first list order can be asserted deterministically rather
    /// than relying on the two writes landing in different clock ticks.
    fn filetime_set(path: &Path, time: std::time::SystemTime) {
        let file = fs::OpenOptions::new()
            .write(true)
            .open(path)
            .expect("opens for mtime set");
        file.set_modified(time).expect("sets mtime");
    }
}
