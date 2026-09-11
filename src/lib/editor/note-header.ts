import type { VaultEntry } from '@/services/vault.service';

/**
 * The same shape `src/lib/editor/wikilink.ts` decorates in the edit view, so the header's count and
 * the editor's highlighting can never disagree about what a link is. Rebuilt per call rather than
 * shared at module scope: a `/g` regex carries `lastIndex` between uses, and a count that depends
 * on who counted last is the one bug this function cannot afford.
 */
function wikilinkPattern(): RegExp {
  return /\[\[[^[\]]+\]\]/g;
}

/**
 * A note's title: the basename with its extension removed.
 *
 * `EditorBuffer.title` is the basename *with* `.md`, and stays that way — the tabs and the
 * *read view*'s accessible name both show a filename, so the stem is derived here rather than by
 * changing that field out from under them.
 *
 * A leading dot is never an extension separator (`.gitignore` keeps its whole name), and a basename
 * with no dot at all is already its own stem.
 */
export function noteTitle(filePath: string): string {
  const basename = filePath.split('/').pop() ?? filePath;
  const dot = basename.lastIndexOf('.');
  return dot > 0 ? basename.slice(0, dot) : basename;
}

/**
 * The header's first line: the note's vault-relative directory followed by its **full** basename,
 * joined with ` / ` — `engineering / Repository Pattern.md`. The extension appears here and nowhere
 * else in the block, which is what lets the title beneath it be the bare stem.
 *
 * A note at the vault root, a note outside the open vault, and a vault that is not open all yield
 * the basename alone: there is no directory to name in any of the three, and inventing one would
 * state something untrue rather than merely less.
 */
export function noteBreadcrumb(filePath: string, vaultRoot: string | null): string {
  const basename = filePath.split('/').pop() ?? filePath;
  if (vaultRoot === null) return basename;

  const root = vaultRoot.endsWith('/') ? vaultRoot.slice(0, -1) : vaultRoot;
  if (!filePath.startsWith(`${root}/`)) return basename;

  const segments = filePath.slice(root.length + 1).split('/');
  // The last segment is the basename, which the join below re-adds in full.
  return segments.join(' / ');
}

/**
 * Counts the `[[wikilinks]]` in a note's source.
 *
 * **Wikilinks only** (spec decision 24): a markdown link navigates nowhere inside the vault, so
 * counting it would inflate a number the reader takes to mean "notes this one reaches". Counting
 * the open buffer's own content is not what ADR 0016 refused either — that was a count for every
 * row in the sidebar, which costs a full read of the vault.
 */
export function countWikilinks(content: string): number {
  return content.match(wikilinkPattern())?.length ?? 0;
}

/**
 * Removes a note's leading `# H1` so the *note header block*'s title is not immediately repeated by
 * the body (spec decision 23).
 *
 * Applied to the **source** rather than inside the *markdown walker*: a string transform keeps the
 * suppression a property of this one surface, and leaves the walker — which the editor's own view
 * shares — rendering exactly what it is given.
 *
 * Up to three leading spaces still make an ATX heading in CommonMark, so they are tolerated here
 * too; anything the parser would not call a heading (`#Title`, `## Title`, a fence) is left alone.
 * Setext headings (`Title` over `=====`) are deliberately **not** handled: recognising one means
 * looking ahead a line, and the app writes ATX.
 */
export function stripLeadingH1(source: string): string {
  const lines = source.split('\n');
  const index = lines.findIndex((line) => line.trim().length > 0);
  if (index === -1 || !/^ {0,3}#\s+/.test(lines[index])) return source;

  lines.splice(index, 1);
  return lines.join('\n');
}

/**
 * Finds a note's mtime in the cached vault tree, or `null` when the path is not in it — a note
 * outside the visible tree, a tree not yet loaded, or a timestamp the backend could not read.
 *
 * The tree is already in memory and watcher-refreshed, so the header's edited time costs no IPC.
 * `null` is the header's cue to omit the segment rather than print a placeholder, the same rule a
 * *note row* follows.
 */
export function findNoteModified(entries: readonly VaultEntry[], filePath: string): number | null {
  for (const entry of entries) {
    if (entry.path === filePath) return entry.isDir ? null : entry.modified;
    const found = findNoteModified(entry.children ?? [], filePath);
    if (found !== null) return found;
  }
  return null;
}
