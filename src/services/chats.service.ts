import { invoke } from '@tauri-apps/api/core';

/**
 * One saved conversation as returned by `list_chats`. Mirrors the Rust `ChatRecord`
 * (`src-tauri/src/chats.rs`). `contents` is the raw chat-file markdown — parse it with
 * `parseChatFile` (`@/lib/chat/chat-file`); this service never interprets the format.
 */
export interface ChatRecord {
  /** Stable id — the file name with the `.chat.md` suffix stripped. */
  id: string;
  /** Absolute path of the chat file on disk. */
  path: string;
  /** Last-modified time, milliseconds since the Unix epoch (filesystem mtime). */
  updatedMs: number;
  /** Raw serialized chat-file markdown; feed it to `parseChatFile`. */
  contents: string;
}

/**
 * Typed wrapper over the chat-persistence commands (epic #66, #68). Chats are stored as
 * `.chat.md` files under the hidden `.acidanthera/chats/` directory inside the open vault, keyed by a
 * bare `id`. The store is format-agnostic: it moves the serialized markdown from
 * `serializeChatFile` to/from disk — the shape lives in `@/lib/chat/chat-file`, and the vault
 * root is derived from the same open-vault state the note commands use.
 */
export const chatsService = {
  /** Writes a conversation's serialized markdown, creating `.acidanthera/chats/` on first save. Overwrites an existing chat with the same `id`. Resolves to the written path. */
  saveChat: (id: string, contents: string): Promise<string> => invoke('save_chat', { id, contents }),

  /** Reads one saved conversation's raw markdown by `id`. Rejects if no chat has that id. */
  readChat: (id: string): Promise<string> => invoke('read_chat', { id }),

  /** Lists every saved conversation, newest first, each with its raw markdown for `parseChatFile`. */
  listChats: (): Promise<ChatRecord[]> => invoke('list_chats'),

  /** Deletes one saved conversation by `id`. Rejects if no chat has that id. */
  deleteChat: (id: string): Promise<void> => invoke('delete_chat', { id }),
};
