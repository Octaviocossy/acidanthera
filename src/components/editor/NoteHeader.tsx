import { countWikilinks, noteBreadcrumb, noteTitle } from '@/lib/editor/note-header';
import { readingMinutes } from '@/lib/editor/note-stats';
import { relativeTime } from '@/lib/vault/relative-time';
import { useAppStore } from '@/stores/app-store';

interface NoteHeaderProps {
  filePath: string;
  /** The **in-memory** buffer, dirty edits included — the counts describe what is on screen. */
  content: string;
  /** The note's mtime in ms, or `null` when it could not be read — the edited segment is then omitted. */
  modified: number | null;
}

/**
 * The *note header block*: three lines and no more — an inert breadcrumb, the note's title, and a
 * meta line (spec decision 21).
 *
 * Everything it states is computed from data already in memory, which is why the link count here is
 * **not** what ADR 0016 refused: that was a count for every row in the sidebar, costing a full read
 * of the vault, and this is one open note.
 *
 * There is deliberately **no tags row** (spec decision 22): the app has no tag concept, and
 * `src-tauri/templates/vault-agents.md` promises a vault "no required frontmatter".
 */
export function NoteHeader({ filePath, content, modified }: NoteHeaderProps) {
  const vaultRoot = useAppStore((state) => state.vaultRoot);

  const links = countWikilinks(content);
  const meta: string[] = [];
  // Omitted rather than placeholdered when the mtime could not be read, the rule a *note row*
  // already follows: the block states one fewer thing instead of stating a false one.
  if (modified !== null) meta.push(`edited ${relativeTime(modified)}`);
  // `link` / `links` must agree with the number in front of it; `min read` never inflects.
  meta.push(`${links} ${links === 1 ? 'link' : 'links'}`);
  meta.push(`${readingMinutes(content)} min read`);

  return (
    <header className="mb-7 border-hairline border-b pb-5">
      {/* Inert metadata, not navigation (spec decision 25): a clickable folder segment would need a
          reveal-in-sidebar command the app does not have, with its own focus question attached. */}
      <p className="truncate font-mono text-meta text-text-muted">{noteBreadcrumb(filePath, vaultRoot)}</p>
      {/* The filename stem, never the body's own `# H1` — which `ReadView` strips off the source so
          a well-formed note does not show its name twice, six pixels apart (spec decision 23). */}
      <h1 className="mt-2.5 font-sans text-display font-medium text-text-primary tracking-display">{noteTitle(filePath)}</h1>
      {/* `edited <relative> · N links · N min read` — the wording the glossary and spec decision 24
          fix, and the same `edited <relative>` a note row shows, so `relativeTime`'s `now` bucket
          reads as a time rather than as "now ago". */}
      <p className="mt-2.5 font-mono text-meta text-text-muted">{meta.join(' · ')}</p>
    </header>
  );
}
