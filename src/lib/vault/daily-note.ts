import { joinVaultPath } from '@/lib/vault/create-entry';
import { openVaultFile } from '@/lib/vault/open-file';
import { vaultService } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useToastStore } from '@/stores/toast-store';

/** Used when `settings.toml` has no usable `dailyNoteFolder` — the settings store is `null` until
 *  its boot-time load resolves, and `Ctrl-w d` can be pressed before that. Mirrors
 *  `default_daily_note_folder()` in `src-tauri/src/settings.rs`, which owns the same default for
 *  the file on disk. */
export const DEFAULT_DAILY_NOTE_FOLDER = 'daily';

/** `VaultError` serializes as its `Display` string (`src-tauri/src/vault.rs`), so a collision
 *  arrives over IPC as this text and not as a variant tag. Matching it is what lets find-or-create
 *  swallow "it was already there" without also swallowing a permission error or an escaped path. */
const ALREADY_EXISTS_MESSAGE = 'an entry already exists at that path';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAlreadyExists(error: unknown): boolean {
  return errorMessage(error).includes(ALREADY_EXISTS_MESSAGE);
}

/**
 * Today's daily-note basename. ISO 8601 so the sidebar's lexicographic order is chronological for
 * free, and **hardcoded** rather than configurable: the command has to parse the name back to find
 * today's note before deciding to create it, so a user-supplied format would be a parser plus a
 * round-trip guarantee rather than a setting.
 *
 * Built from **local** date parts, never `toISOString()` — that is UTC, so a user in UTC−5 would
 * be handed tomorrow's note from 19:00 onwards.
 */
export function dailyNoteFileName(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.md`;
}

/** The folder daily notes are filed in, resolved against the vault root. */
export function dailyNoteFolderPath(vaultRoot: string, folder: string): string {
  return joinVaultPath(vaultRoot, folder);
}

/** Today's daily note, resolved against the vault root. */
export function dailyNotePath(vaultRoot: string, folder: string, now: Date = new Date()): string {
  return joinVaultPath(dailyNoteFolderPath(vaultRoot, folder), dailyNoteFileName(now));
}

/** The configured folder, falling back whenever settings are unloaded or hold a blank value —
 *  which would otherwise resolve to the vault root itself and scatter daily notes across its top. */
function resolveFolder(): string {
  const configured = useSettingsStore.getState().settings?.dailyNoteFolder.trim();
  return configured === undefined || configured === '' ? DEFAULT_DAILY_NOTE_FOLDER : configured;
}

/**
 * Opens today's *daily note*, creating the folder and the file on first use — the single
 * implementation behind `global.daily-note`, wherever it is invoked from.
 *
 * Find-or-create works by **swallowing `AlreadyExists`** rather than by reading the tree first:
 * the cached tree is watcher-refreshed and may lag a create from a moment ago, while the Rust side
 * is already the authority on collision. Anything that is *not* a collision surfaces as a toast and
 * stops — a folder the app cannot write into must not read as a note that failed to open.
 *
 * The note is created **empty**, exactly what *vault entry creation* produces, so the app keeps no
 * opinion about the inside of a note — which is why the branch that actually creates it opens in
 * the *edit view* while the branch that merely found it takes the `'read'` default (spec decision
 * 4). The distinction is *creation*, not emptiness. The tree is never touched: the create trips the `notify`
 * watcher, whose `vault-changed` drives the sidebar's own refetch (invariant 5).
 */
export async function openDailyNote(now: Date = new Date()): Promise<void> {
  const { vaultRoot } = useAppStore.getState();
  if (vaultRoot === null) return;

  const { showToast } = useToastStore.getState();
  const folder = resolveFolder();
  const notePath = dailyNotePath(vaultRoot, folder, now);

  try {
    await vaultService.createDirectory(dailyNoteFolderPath(vaultRoot, folder));
  } catch (error: unknown) {
    if (!isAlreadyExists(error)) {
      showToast(`Daily note failed: ${errorMessage(error)}`, 'error');
      return;
    }
  }

  let created = true;
  try {
    await vaultService.createNote(notePath);
  } catch (error: unknown) {
    if (!isAlreadyExists(error)) {
      showToast(`Daily note failed: ${errorMessage(error)}`, 'error');
      return;
    }
    created = false;
  }

  await openVaultFile(notePath, created ? 'edit' : undefined).catch((error: unknown) => {
    showToast(`Open failed: ${errorMessage(error)}`, 'error');
  });
}
