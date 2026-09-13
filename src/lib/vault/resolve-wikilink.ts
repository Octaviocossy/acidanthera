import type { VaultEntry } from '@/services/vault.service';

/**
 * What a `[[target]]` points at. Three outcomes, and the third is the load-bearing one: two notes
 * sharing a basename means the link model cannot express which was meant, so it is **marked, never
 * guessed** (ADR 0114's stance, extended from renames to navigation — invariant 38).
 */
export type WikilinkTarget = { status: 'resolved'; path: string } | { status: 'missing' } | { status: 'ambiguous' };

/** The `[[…]]` brackets, when a caller passes the whole source span rather than its content. */
const BRACKETS = /^\[\[([\s\S]*)\]\]$/;

interface WikilinkParts {
  /** The link target — a note *stem*, carrying no path and no extension. */
  target: string;
  /** What the reader sees: the alias when one is present, else the target (spec decision 26). */
  display: string;
}

/**
 * Splits a wikilink into its target and its display text.
 *
 * The grammar **mirrors `src-tauri/src/wikilink.rs`'s `find_wikilinks`** and deliberately invents
 * nothing: the target is everything before the first `|`, an anchor (`#…`, `^…`) ends it earlier
 * when one appears before that alias, and both sides are trimmed. A second, subtly different
 * TypeScript grammar would let a *wikilink rewrite* and a click disagree about which note a link
 * names.
 */
function splitWikilink(raw: string): WikilinkParts {
  const content = BRACKETS.exec(raw)?.[1] ?? raw;
  const aliasStart = content.indexOf('|');
  const beforeAlias = aliasStart === -1 ? content : content.slice(0, aliasStart);
  const anchorStart = beforeAlias.search(/[#^]/);
  const target = (anchorStart === -1 ? beforeAlias : beforeAlias.slice(0, anchorStart)).trim();
  const alias = aliasStart === -1 ? '' : content.slice(aliasStart + 1).trim();
  return { target, display: alias === '' ? target : alias };
}

/** The note stem a `[[…]]` names, with its alias and anchor stripped. */
export function parseWikilinkTarget(raw: string): string {
  return splitWikilink(raw).target;
}

/** The text a `[[…]]` renders as — its alias when it has one, else its target. Never the brackets. */
export function parseWikilinkDisplay(raw: string): string {
  return splitWikilink(raw).display;
}

/** The stem of a note's filename, compared case-insensitively because the macOS filesystem is. */
function noteStem(name: string): string {
  return name.replace(/\.md$/i, '').toLowerCase();
}

function collectMatches(entries: readonly VaultEntry[], stem: string, found: string[]): void {
  for (const entry of entries) {
    if (entry.isDir) {
      collectMatches(entry.children ?? [], stem, found);
      continue;
    }
    if (noteStem(entry.name) === stem) found.push(entry.path);
    // Two is already ambiguous, but the walk is over a tree that is in memory anyway, so there is
    // nothing to gain from stopping early and a short-circuit would only be one more branch.
  }
}

/**
 * Resolves a `[[target]]` against the **cached sidebar tree** — a scan of what is already in
 * memory, never an index (ADR 0114), and distinct from the backend *wikilink rewrite*, which walks
 * files on disk for a rename.
 *
 * This is the single resolver both the *read view* and the editor's `wikilink` decoration read, so
 * one link cannot look different in the two views (ADR 0126).
 */
export function resolveWikilink(raw: string, tree: readonly VaultEntry[]): WikilinkTarget {
  const stem = parseWikilinkTarget(raw).toLowerCase();
  if (stem === '') return { status: 'missing' };

  const found: string[] = [];
  collectMatches(tree, stem, found);

  if (found.length === 0) return { status: 'missing' };
  if (found.length > 1) return { status: 'ambiguous' };
  return { status: 'resolved', path: found[0] };
}

/** Why a link is not navigable — the hover reveal both views give a broken target. */
export function wikilinkBrokenReason(status: 'missing' | 'ambiguous'): string {
  return status === 'missing' ? 'no note with this name' : 'two notes share this name';
}
