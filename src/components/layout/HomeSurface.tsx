import { useCallback, useEffect, useState } from 'react';
import { ChatInput } from '@/components/ai/ChatInput';
import { HomeRow } from '@/components/layout/HomeRow';
import { CalendarDays, FilePlus, FolderOpen } from '@/components/ui/icon';
import { Kbd } from '@/components/ui/kbd';
import { AcidantheraMarkGlyph } from '@/components/vault/glyphs';
import { useCommandChord } from '@/hooks/use-chord-title';
import { submitFromDock } from '@/lib/agent/submit-from-dock';
import { executeAppCommand } from '@/lib/app-command';
import { createRegionExitGesture } from '@/lib/keymap/region-exit-gesture';
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
 * It is reserved unconditionally (given a vault) because everything above it is centered in the
 * space the slot leaves: a slot that collapsed whenever the dock is hidden would make the mark, the
 * greeting and the rows all jump every time the *agent panel* is toggled, which is the one thing
 * the slot exists to prevent. The figure is normative rather than measured — `ChatInput` is fitted
 * into this box, never the box resized around it.
 */
const AGENT_DOCK_SLOT_HEIGHT = 124;

/** The dock's cold-start invitation — the single thing that differs from the *agent panel*'s own
 *  input (spec decision 26). Phrased as a continuation of the rows above it: the dock is a fourth
 *  way in, not a fourth action row. */
const AGENT_DOCK_PLACEHOLDER = 'Or ask — "set up a structure for PKM + work notes"';

/**
 * The *home surface*: what the editor card shows whenever no buffer is open (invariant 33).
 *
 * **One component, three states** — no vault, empty vault, vault with notes — differing only in
 * greeting and row set (spec decision 3). It supersedes the old *empty editor state*, whose only
 * affordance was a chord that, in an empty vault, opened a finder saying `no matching notes.`
 *
 * Not onboarding and not a fourth *focus region* (spec decisions 1, 23): the app has one user, and
 * the rows are reached by their global chords and by click, exactly as the *primary nav* rows are.
 * DOM focus still lands in the *agent dock* while the viewer region is active, because the dock is
 * the only focusable thing in the card — invariant 20 holding rather than bending.
 */
export function HomeSurface() {
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const agentOpen = useAppStore((state) => state.agentOpen);
  const viewerActive = useAppStore((state) => state.activeRegion === 'viewer');
  const focusRequest = useAppStore((state) => state.editorFocusRequest);
  const tree = useSidebarStore((state) => state.tree);
  const newNoteChord = useCommandChord('global.new-note');
  const dailyNoteChord = useCommandChord('global.daily-note');

  const hasVault = vaultRoot !== null;
  const isEmptyVault = hasVault && countNotes(tree) === 0;
  // A vault with notes gets no greeting: `No note open.` only restates the surface you are already
  // looking at. The other two states name a condition you can act on, so they keep theirs.
  const greeting = !hasVault ? 'No vault open.' : isEmptyVault ? 'Your vault is empty.' : null;

  // The dock is absent without a vault, where `sendMessage` could only produce an error item
  // (spec decision 4), and hidden while the panel is open, because two composers addressing one
  // transcript is the confusion ADR 0124 exists to prevent (decision 25).
  const showDock = hasVault && !agentOpen;

  // Held in state rather than a ref for the reason `BufferEditor` holds its `EditorView` in state:
  // the focus effect below has to re-run at the moment the element appears, and a ref filled during
  // commit would still read null on the pass that matters. The input is reached through the slot's
  // node rather than a ref threaded into `ChatInput`, so the two mounts keep the identical props.
  const [dockInput, setDockInput] = useState<HTMLInputElement | null>(null);
  const captureDockInput = useCallback((node: HTMLDivElement | null) => {
    setDockInput(node?.querySelector('input') ?? null);
  }, []);

  // Real DOM focus follows the focused region (invariant 20). With no buffer open the dock is the
  // only focusable thing in the card, so it plays the part `BufferEditor` plays otherwise — the
  // same two halves, for the same reason: region focus without DOM focus leaves `Ctrl-w l` landing
  // the keyboard on `<body>`, and DOM focus without region focus leaves the sidebar's `j`/`k` dead
  // while those keystrokes are typed into the composer. `focusRequest` re-triggers it for a request
  // that changes nothing else — an overlay dismissed rather than used, which took focus with it.
  useEffect(() => {
    if (dockInput === null) return;
    const holdsFocus = document.activeElement === dockInput;
    if (viewerActive) {
      if (!holdsFocus) dockInput.focus();
    } else if (holdsFocus) {
      dockInput.blur();
    }
  }, [dockInput, viewerActive, focusRequest]);

  // The dock owns its keystrokes, so the window dispatcher bails on it (`isEditableTarget` is true
  // for an `INPUT`) — exactly as it bails on the editor's `contenteditable`. Without the same
  // escape hatch the editor gets from `regionExit`, claiming focus above would leave *every* global
  // chord dead in the app's default boot state, including the `Ctrl-w n`/`Ctrl-w d` the rows right
  // above advertise as the ones that fire from the viewer (invariant 35) and the `Ctrl-w l` that
  // put the caret here. Lazy `useState` initializer, so the prefix state machine survives re-renders.
  const [regionExit] = useState(createRegionExitGesture);
  useEffect(() => () => regionExit.reset(), [regionExit]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex flex-col items-center gap-3">
          {/* The mark sits above the wordmark (spec decision 6), carrying its ember ring as it does
              wherever it renders — identity rather than signal, so this is not an accent use
              (ADR 0122, invariant 21). */}
          <AcidantheraMarkGlyph className="h-[65px] w-[56px] text-text-secondary" />
          <span className="font-sans text-hero font-medium text-text-primary tracking-display">acidanthera</span>
          <div className="flex flex-col items-center gap-1.5">
            {greeting !== null && <span className="font-sans text-h1 text-text-primary">{greeting}</span>}
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
      {/* The *agent dock*, pinned to the card's bottom edge in its own gutter (spec decision 5) —
          the gap above is what makes it read as a persistent way in rather than a fourth action
          row. `ChatInput` brings its own `border-t border-hairline p-3` band, so the slot adds only
          the gutter and bottom-aligns the composer inside its reserved height.

          Absent without a vault, because the no-vault state drops the dock along with every row but
          the open-vault one (glossary, *home surface*) — reserving space for a composer that will
          never appear there is the same layout lie as reserving none where it will. */}
      {hasVault && (
        <div className="flex shrink-0 flex-col justify-end px-6 pb-6" style={{ height: AGENT_DOCK_SLOT_HEIGHT }}>
          {showDock && (
            // The wrapper is not an affordance of its own: it exists to hold the slot's ref and to
            // catch the region-exit chord on the way down to the composer, before the field it
            // would otherwise be typed into.
            <div ref={captureDockInput} onKeyDownCapture={(event) => regionExit.handleKeyDown(event)}>
              <ChatInput placeholder={AGENT_DOCK_PLACEHOLDER} onSubmit={submitFromDock} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
