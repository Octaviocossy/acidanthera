import { HomeRow } from '@/components/layout/HomeRow';
import { CalendarDays, FilePlus, FolderOpen } from '@/components/ui/icon';
import { Kbd } from '@/components/ui/kbd';
import { AcidantheraMarkGlyph } from '@/components/vault/glyphs';
import { useCommandChord } from '@/hooks/use-chord-title';
import { executeAppCommand } from '@/lib/app-command';
import { displayPath } from '@/lib/vault/display-path';
import { countNotes } from '@/lib/vault/note-count';
import { pickAndPersistVault } from '@/lib/vault/pick-vault';
import { useAppStore } from '@/stores/app-store';
import { useSidebarStore } from '@/stores/sidebar-store';

/**
 * The total height, in px, of the *agent dock*'s slot — the composer's box (≈100px: `ChatInput`'s
 * card, its 12px padding and its top hairline) plus the 24px bottom gutter the slot draws around
 * it.
 *
 * It is reserved **now**, while the slot is still empty, because everything above it is centered
 * in the space the slot leaves: a slot that collapsed to nothing would let the mark, the greeting
 * and the rows all jump the moment #154 mounted the dock, which is the one thing the slot exists
 * to prevent. The figure is therefore normative rather than measured — **#154 must fit `ChatInput`
 * into this box**, not resize the box around it.
 */
const AGENT_DOCK_SLOT_HEIGHT = 124;

/**
 * The *home surface*: what the editor card shows whenever no buffer is open (invariant 33).
 *
 * **One component, three states** — no vault, empty vault, vault with notes — differing only in
 * greeting and row set (spec decision 3). It supersedes the old *empty editor state*, whose only
 * affordance was a chord that, in an empty vault, opened a finder saying `no matching notes.`
 *
 * Not onboarding and not a fourth *focus region* (spec decisions 1, 23): the app has one user, and
 * the rows are reached by their global chords and by click, exactly as the *primary nav* rows are.
 * DOM focus is left alone here — the *agent dock* is the only focusable thing in the card, and it
 * arrives with #154.
 */
export function HomeSurface() {
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const tree = useSidebarStore((state) => state.tree);
  const newNoteChord = useCommandChord('global.new-note');
  const dailyNoteChord = useCommandChord('global.daily-note');

  const hasVault = vaultRoot !== null;
  const isEmptyVault = hasVault && countNotes(tree) === 0;
  const greeting = !hasVault ? 'No vault open.' : isEmptyVault ? 'Your vault is empty.' : 'No note open.';

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex flex-col items-center gap-3">
          {/* The mark sits above the wordmark (spec decision 6), carrying its ember ring as it does
              wherever it renders — identity rather than signal, so this is not an accent use
              (ADR 0036, invariant 21). */}
          <AcidantheraMarkGlyph className="text-text-secondary" />
          <span className="font-sans text-display font-medium text-text-primary tracking-display">acidanthera</span>
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-sans text-h1 text-text-primary">{greeting}</span>
            {/* The path is inlined in the sentence rather than given a line of its own, and is
                always `displayPath` — never a literal `~/acidanthera` (spec decision 8). There is
                no path to name without a vault, so the whole subtitle goes. */}
            {hasVault && (
              <span className="font-sans text-ui text-text-secondary">
                Everything stays local — plain markdown in <span className="font-mono">{displayPath(vaultRoot)}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex w-full max-w-[400px] flex-col gap-2">
          {hasVault && (
            <>
              {/* The label varies with the state, the command never does — one `global.new-note`
                  dispatch either way, which starts the same sidebar draft the `a` chord starts. */}
              <HomeRow
                icon={FilePlus}
                label={isEmptyVault ? 'Write your first note' : 'New note'}
                trailing={newNoteChord === undefined ? undefined : <Kbd boxed={false}>{newNoteChord}</Kbd>}
                onSelect={() => executeAppCommand('global.new-note')}
              />
              <HomeRow
                icon={CalendarDays}
                label="Start today's daily note"
                trailing={dailyNoteChord === undefined ? undefined : <Kbd boxed={false}>{dailyNoteChord}</Kbd>}
                onSelect={() => executeAppCommand('global.daily-note')}
              />
            </>
          )}
          {/* `Import notes` from the mockup, reframed onto behavior that already exists rather than
              shipped as a placeholder (spec decision 12): the app opens an existing Obsidian vault
              in place, so "import" is solved by pointing the vault at that folder. */}
          <HomeRow
            icon={FolderOpen}
            label="Open an existing vault"
            trailing={<span className="font-mono text-meta text-text-muted">Obsidian-compatible · plain markdown</span>}
            onSelect={() => void pickAndPersistVault()}
          />
        </div>
      </div>
      {/* The *agent dock*'s slot, pinned to the card's bottom edge in its own gutter (spec decision
          5) — the gap above is what will make the dock read as a persistent way in rather than a
          fourth action row. Empty until #154 mounts `ChatInput` into it, but holding its full
          height from today so that mount re-lays-out nothing.

          Absent without a vault, because the no-vault state drops the dock along with every row
          but the open-vault one (glossary, *home surface*) — reserving space for a composer that
          will never appear there is the same layout lie as reserving none where it will. */}
      {hasVault && <div className="shrink-0 px-6 pb-6" style={{ height: AGENT_DOCK_SLOT_HEIGHT }} />}
    </div>
  );
}
