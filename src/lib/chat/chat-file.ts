/**
 * Chat-file format contract & serialization (epic #66 — chat management & history).
 *
 * A *chat file* is the on-disk representation of one saved conversation. This module is the
 * single source of truth for that format: the `ChatFile` shape, a schema version, and the pure
 * `serializeChatFile` / `parseChatFile` codec. It is UI-, store-, and filesystem-agnostic — later
 * epic-#66 slices own *where* a chat is written and *when*; this slice only owns the *shape*.
 * (Same "pure contract first" pattern as `agent-event.ts`, #13.)
 *
 * ## Format
 * A chat file is plain, human-readable markdown (v0-spec §3.1 — the vault's source of truth is
 * markdown, everything else is reconstructible):
 *
 *   ---
 *   schema: 1
 *   id: "<chat id>"
 *   title: "<title>"
 *   model: "<AgentModelId>"
 *   created: "<ISO 8601>"
 *   updated: "<ISO 8601>"
 *   ---
 *
 *   <!-- acidanthera:chat kind="user_message" id="user-1" -->
 *   > **You**
 *
 *   <verbatim message text>
 *
 *   <!-- acidanthera:chat kind="tool_call" id="call-1" -->
 *   ```json
 *   { "callId": "call-1", "toolName": "Read", "args": { … }, "status": "ok", "result": … }
 *   ```
 *
 * Each transcript item is introduced by a hidden HTML-comment marker (invisible when the note is
 * rendered in Obsidian) carrying its `kind` + `id`. Message/error text is stored **verbatim** so
 * a note still reads as prose; `tool_call` items carry their structured `ChatToolCall` in a JSON
 * fence. The frontmatter stores `model` only — the engine is **derived** from the model and is
 * never persisted separately (ubiquitous-language rule). Each frontmatter scalar is JSON-encoded
 * so an arbitrary title round-trips exactly.
 *
 * ## Round-trip guarantee & its one limit
 * `parseChatFile(serializeChatFile(f))` reproduces `f` for every item kind — including messages
 * that contain code fences and tool results whose JSON contains inner ``` fences (markers are
 * matched only as whole lines and the JSON fence is matched greedily to its true closer). The one
 * in-band limitation: a message whose text contains a line that is *exactly* an `<!-- acidanthera:chat
 * … -->` marker would be misread as an item boundary. Namespaced + full-line-anchored, this is
 * negligible for a single-user tool and is accepted rather than engineered away in v0.
 */

import type { AgentModelId } from '@/lib/agent/model-catalog';
import type { ChatItem, ChatToolCall } from '@/stores/chat-store';

/** Bumped on any breaking change to the on-disk shape; `parseChatFile` reads it back verbatim. */
export const CHAT_FILE_SCHEMA = 1;

/** A `.md` subtype so a saved chat stays readable in the vault and siblings can detect/hide it. */
export const CHAT_FILE_EXTENSION = '.chat.md';

/** Frontmatter metadata for one chat file. Timestamps are ISO-8601 strings supplied by the caller
 *  (this module stays pure — it never reads the clock). No `engine`: it is derived from `model`. */
export interface ChatFileMeta {
  /** On-disk schema version; see {@link CHAT_FILE_SCHEMA}. */
  schema: number;
  /** Stable id for this conversation (owned by whichever slice creates the file). */
  id: string;
  /** Human-readable title (see {@link deriveChatTitle} for a default). */
  title: string;
  /** The model the conversation ran on; its engine is derived via `getModel(model).engine`. May be
   *  an unknown string on a hand-edited/older file — consumers fall back like `Settings.model`. */
  model: AgentModelId;
  /** ISO-8601 timestamp the chat was first written. */
  created: string;
  /** ISO-8601 timestamp of the last write. */
  updated: string;
}

/** A parsed / serializable chat file: its metadata plus the transcript (`useChatStore.items`). */
export interface ChatFile {
  meta: ChatFileMeta;
  items: ChatItem[];
}

/** Result of {@link parseChatFile}. No exceptions — corrupt input yields `{ ok: false }` so the
 *  caller can surface a toast, mirroring the app's error-item / toast style. */
export type ChatFileParseResult = { ok: true; file: ChatFile } | { ok: false; error: string };

const FRONTMATTER_FENCE = '---';
const MARKER_PREFIX = '<!-- acidanthera:chat';
/** Full-line marker: `^…$` so a marker embedded inside indented JSON never triggers a false split. */
const MARKER_RE = /^<!-- acidanthera:chat kind=("(?:[^"\\]|\\.)*") id=("(?:[^"\\]|\\.)*") -->$/gm;
/** Greedy body so a tool result whose JSON contains inner ``` fences still closes at the real fence. */
const JSON_FENCE_RE = /```json\n([\s\S]*)\n```/;
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

const LABEL: Record<Exclude<ChatItem['kind'], 'tool_call'>, string> = {
  user_message: '> **You**',
  agent_message: '> **Assistant**',
  error: '> [!error]',
};

// ---------------------------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------------------------

function serializeFrontmatter(meta: ChatFileMeta): string {
  return [
    FRONTMATTER_FENCE,
    `schema: ${meta.schema}`,
    `id: ${JSON.stringify(meta.id)}`,
    `title: ${JSON.stringify(meta.title)}`,
    `model: ${JSON.stringify(meta.model)}`,
    `created: ${JSON.stringify(meta.created)}`,
    `updated: ${JSON.stringify(meta.updated)}`,
    FRONTMATTER_FENCE,
  ].join('\n');
}

function marker(kind: ChatItem['kind'], id: string): string {
  return `${MARKER_PREFIX} kind=${JSON.stringify(kind)} id=${JSON.stringify(id)} -->`;
}

function serializeItem(item: ChatItem): string {
  const head = marker(item.kind, item.id);
  switch (item.kind) {
    case 'user_message':
      return `${head}\n\n${LABEL.user_message}\n\n${item.text}`;
    case 'agent_message':
      return `${head}\n\n${LABEL.agent_message}\n\n${item.text}`;
    case 'error':
      return `${head}\n\n${LABEL.error}\n\n${item.message}`;
    case 'tool_call':
      return `${head}\n\n\`\`\`json\n${JSON.stringify(item.call, null, 2)}\n\`\`\``;
  }
}

/** Serialize a chat file to its on-disk markdown string. Pure — the caller supplies timestamps. */
export function serializeChatFile(file: ChatFile): string {
  const frontmatter = serializeFrontmatter(file.meta);
  if (file.items.length === 0) return `${frontmatter}\n`;
  const body = file.items.map(serializeItem).join('\n\n');
  return `${frontmatter}\n\n${body}\n`;
}

// ---------------------------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------------------------

/** JSON-decodes a frontmatter scalar, falling back to the raw (quote-stripped) text so a
 *  hand-written plain-YAML value like `title: Hello` still parses. */
function readString(value: string | undefined): string {
  if (value === undefined) return '';
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value.replace(/^["']|["']$/g, '');
  }
}

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseFrontmatter(raw: string): { meta: ChatFileMeta; body: string } | null {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return null;

  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }

  const meta: ChatFileMeta = {
    schema: readNumber(fields.schema, CHAT_FILE_SCHEMA),
    id: readString(fields.id),
    title: readString(fields.title),
    // May be an unknown string on a hand-edited file; consumers resolve it via `getModel`.
    model: readString(fields.model) as AgentModelId,
    created: readString(fields.created),
    updated: readString(fields.updated),
  };
  return { meta, body: raw.slice(match[0].length) };
}

/** Trim a block and strip its exact leading readable label (`> **You**`, …) if present. */
function stripLabel(block: string, label: string): string {
  const trimmed = block.trim();
  if (trimmed === label) return '';
  if (trimmed.startsWith(`${label}\n`)) return trimmed.slice(label.length).replace(/^\n+/, '');
  return trimmed;
}

/** Parse an on-disk chat-file string. Missing frontmatter or a corrupt `tool_call` fence fails;
 *  everything else is resilient (unknown item kinds are skipped, missing meta fields default). */
export function parseChatFile(raw: string): ChatFileParseResult {
  const front = parseFrontmatter(raw);
  if (!front) return { ok: false, error: 'Missing chat-file frontmatter (--- block).' };

  const items: ChatItem[] = [];
  const markers = [...front.body.matchAll(MARKER_RE)];

  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < markers.length ? (markers[i + 1].index ?? front.body.length) : front.body.length;
    const block = front.body.slice(start, end);

    let kind: string;
    let id: string;
    try {
      kind = JSON.parse(m[1]);
      id = JSON.parse(m[2]);
    } catch {
      continue; // malformed marker — skip rather than fail the whole file
    }

    switch (kind) {
      case 'user_message':
        items.push({ kind, id, text: stripLabel(block, LABEL.user_message) });
        break;
      case 'agent_message':
        items.push({ kind, id, text: stripLabel(block, LABEL.agent_message) });
        break;
      case 'error':
        items.push({ kind, id, message: stripLabel(block, LABEL.error) });
        break;
      case 'tool_call': {
        const fence = block.match(JSON_FENCE_RE);
        if (!fence) return { ok: false, error: `Chat file tool_call "${id}" is missing its JSON block.` };
        let call: ChatToolCall;
        try {
          call = JSON.parse(fence[1]) as ChatToolCall;
        } catch {
          return { ok: false, error: `Chat file tool_call "${id}" has invalid JSON.` };
        }
        items.push({ kind, id, call });
        break;
      }
      default:
        break; // forward-compat: unknown kind from a newer schema — skip it
    }
  }

  return { ok: true, file: { meta: front.meta, items } };
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** Whether a vault path is a chat file (by extension). */
export function isChatFilePath(path: string): boolean {
  return path.toLowerCase().endsWith(CHAT_FILE_EXTENSION);
}

/** A default title from the transcript: the first line of the first user message, ≤ 60 chars. */
export function deriveChatTitle(items: ChatItem[]): string {
  const firstUser = items.find((item): item is Extract<ChatItem, { kind: 'user_message' }> => item.kind === 'user_message');
  if (!firstUser) return 'Untitled chat';
  const firstLine = firstUser.text.trim().split('\n')[0]?.trim() ?? '';
  if (!firstLine) return 'Untitled chat';
  return firstLine.length > 60 ? `${firstLine.slice(0, 59)}…` : firstLine;
}
