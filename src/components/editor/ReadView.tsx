import { useEffect, useMemo, useState } from 'react';
import { renderMarkdown } from '@/lib/editor/markdown-walker';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import type { EditorBuffer } from '@/stores/editor-store';

/**
 * Prose measure and rhythm (spec decisions 12-13): proportional **sans**, not the editor's mono —
 * the documented rule sharpens to "mono is for source, sans is for rendered prose" — capped near
 * 680px and centred, over the editor's own `28px 36px` padding. `[&>*:first-child]:mt-0` keeps the
 * first block flush with that padding instead of adding its own heading margin on top of it.
 */
const PROSE = 'mx-auto max-w-[680px] px-9 py-7 font-sans text-body text-text-body leading-[var(--leading-prose)] [&>*:first-child]:mt-0';

interface ReadViewProps {
  buffer: EditorBuffer;
  active: boolean;
  hidden: boolean;
}

/**
 * The *read view*: the rendered counterpart to `BufferEditor`, mounted alongside it inside the
 * same `BufferPane` so a toggle hides one and reveals the other rather than swapping them
 * (spec decision 6).
 *
 * It renders the **in-memory buffer**, dirty edits included (decision 5), so toggling is an instant
 * preview of what was just typed rather than a second read from disk. That content goes through
 * the *markdown walker*, which parses with `markdownLanguage` — the very base `BufferEditor` hands
 * `markdown()` — so the two views can never disagree about what the source means (invariant 36).
 *
 * Deliberately **not** a fourth *focus region*: it is what the viewer is showing, so its scroll
 * container is simply the third claimant of viewer DOM focus (invariant 20).
 */
export function ReadView({ buffer, active, hidden }: ReadViewProps) {
  const viewerActive = useAppStore((state) => state.activeRegion === 'viewer');
  const focusRequest = useAppStore((state) => state.editorFocusRequest);
  const vaultRoot = useAppStore((state) => state.vaultRoot);

  // The walk is the expensive part of a keystroke in the edit view beside it, since both surfaces
  // stay mounted and this one re-renders on every `updateBufferContent`.
  const rendered = useMemo(() => renderMarkdown(buffer.content, { vaultRoot }), [buffer.content, vaultRoot]);

  // Held in state rather than a ref, for the reason `BufferEditor` holds its `EditorView` in state
  // and `HomeSurface` its dock input: the focus effect below has to re-run at the moment the
  // element appears, and a ref filled during commit would still read null on the pass that matters.
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // Real DOM focus follows the focused region (invariant 20). With the read view showing, this
  // container is what the viewer is showing, so it plays the part `BufferEditor` plays otherwise —
  // and gives up focus the moment the region leaves, or the buffer is toggled back to edit.
  // `focusRequest` re-triggers it for a request that changes nothing else, such as an overlay
  // dismissed rather than used, which took DOM focus with it.
  useEffect(() => {
    if (container === null) return;
    const holdsFocus = document.activeElement === container;
    if (active && viewerActive && !hidden) {
      if (!holdsFocus) container.focus();
    } else if (holdsFocus) {
      container.blur();
    }
  }, [container, active, viewerActive, hidden, focusRequest]);

  // No `createRegionExitGesture` here, and that absence is the decision rather than an omission
  // (spec decision 18): a focused container is not an editable target, so unlike the editor's
  // `contenteditable` and the *agent dock*'s `INPUT`, the window dispatcher does see this
  // container's keydowns and every global chord already works natively (invariant 20).
  return (
    // The native `hidden` attribute as well as the utility class: both surfaces stay mounted, so
    // the one that is not showing must leave the accessible tree too rather than merely stop being
    // painted — a screen reader would otherwise read the note twice.
    <article
      ref={setContainer}
      tabIndex={-1}
      hidden={hidden}
      aria-label={`${buffer.title}, read view`}
      className={cn('h-full min-h-0 overflow-y-auto outline-none', hidden && 'hidden')}
    >
      <div className={PROSE}>{rendered}</div>
    </article>
  );
}
