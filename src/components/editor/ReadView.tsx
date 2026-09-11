import { useCallback, useEffect, useMemo, useState } from 'react';
import { NoteHeader } from '@/components/editor/NoteHeader';
import { renderMarkdown } from '@/lib/editor/markdown-walker';
import { findNoteModified, stripLeadingH1 } from '@/lib/editor/note-header';
import { toggleTaskAt } from '@/lib/editor/toggle-task';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { type EditorBuffer, useEditorStore } from '@/stores/editor-store';
import { useSidebarStore } from '@/stores/sidebar-store';

/**
 * The measure the *note header block* and the body share, so the breadcrumb, the title and the
 * first paragraph all start on one left edge: capped near 680px and centred, over the editor's own
 * `28px 36px` padding.
 */
const MEASURE = 'mx-auto max-w-[680px] px-9 py-7';

/**
 * Prose rhythm (spec decisions 12-13): proportional **sans**, not the editor's mono — the documented
 * rule sharpens to "mono is for source, sans is for rendered prose". `[&>*:first-child]:mt-0` keeps
 * the first block flush against the header's divider instead of adding its own heading margin.
 */
const PROSE = 'font-sans text-body text-text-body leading-[var(--leading-prose)] [&>*:first-child]:mt-0';

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
 * Above that body sits the *note header block*, and the two share one measure so the breadcrumb,
 * the title and the first paragraph line up on a single left edge.
 *
 * Deliberately **not** a fourth *focus region*: it is what the viewer is showing, so its scroll
 * container is simply the third claimant of viewer DOM focus (invariant 20).
 */
export function ReadView({ buffer, active, hidden }: ReadViewProps) {
  const viewerActive = useAppStore((state) => state.activeRegion === 'viewer');
  const focusRequest = useAppStore((state) => state.editorFocusRequest);
  const vaultRoot = useAppStore((state) => state.vaultRoot);

  // The mtime comes from the cached vault tree, which is already in memory and watcher-refreshed,
  // so the header's edited time costs no IPC. `null` — a note outside the visible tree, a tree not
  // yet loaded, or a timestamp the backend could not read — omits the segment.
  const tree = useSidebarStore((state) => state.tree);
  const modified = useMemo(() => findNoteModified(tree, buffer.filePath), [tree, buffer.filePath]);

  // A leading `# H1` is taken off the **source** before the parse, so the *markdown walker* the
  // editor shares is untouched and the title above is not immediately repeated by the body (spec
  // decision 23). `offset` is what that removal cost the front of the string.
  const { source, offset } = useMemo(() => stripLeadingH1(buffer.content), [buffer.content]);

  // The read view's **only** write (invariant 37): ticking a checkbox rewrites that one marker in
  // the buffer, which marks it dirty and commits through the existing `EditorSaveRequest` lifecycle
  // on `:w` — no second save path, no autosave, no direct disk write.
  //
  // The walker's offsets are relative to the **stripped** source, while the buffer this rewrites is
  // the original, so `offset` is added back before the marker range is used. Without it a note that
  // opens with a title — most of them — would land the rewrite a heading's width to the left, and
  // `toggleTaskAt`'s marker check would reject it, leaving the checkbox silently inert.
  //
  // The content is read from the store at call time rather than closed over, so two quick clicks
  // cannot both write from the same stale snapshot and lose the first tick. Keyed on `buffer.id`
  // and `offset` alone, the callback stays referentially stable, so it costs the walk below no
  // extra runs.
  const bufferId = buffer.id;
  const onToggleTask = useCallback(
    (markerFrom: number, markerTo: number) => {
      const { buffers, updateBufferContent } = useEditorStore.getState();
      const current = buffers.find((candidate) => candidate.id === bufferId);
      if (current === undefined) return;
      const next = toggleTaskAt(current.content, markerFrom + offset, markerTo + offset);
      // A stale offset leaves the content untouched, and a note must not go dirty for a click that
      // changed nothing — `updateBufferContent` would bump the revision either way.
      if (next !== current.content) updateBufferContent(bufferId, next);
    },
    [bufferId, offset]
  );

  // The walk is the expensive part of a keystroke in the edit view beside it, since both surfaces
  // stay mounted and this one re-renders on every `updateBufferContent`.
  const rendered = useMemo(() => renderMarkdown(source, { vaultRoot, onToggleTask }), [source, vaultRoot, onToggleTask]);

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
      <div className={MEASURE}>
        <NoteHeader filePath={buffer.filePath} content={buffer.content} modified={modified} />
        <div className={PROSE}>{rendered}</div>
      </div>
    </article>
  );
}
