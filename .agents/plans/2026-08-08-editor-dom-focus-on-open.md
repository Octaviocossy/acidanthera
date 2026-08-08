# Plan: Editor takes real DOM focus when a file is opened

> Status: **completed**
> Created: 2026-08-08
> Updated: 2026-08-08

## Context

**Problem.** Opening a note from the fuzzy file finder (`Ctrl-w f`) leaves the keyboard dead. The user
has to click into the editor before they can type.

**Why.** `openVaultFile` / `openConfigFile` already call `useAppStore.getState().focusRegion('viewer')`
— but `activeRegion` is a *logical* flag only. It drives border styling, the StatusBar label, and
dispatcher layer `isActive()` guards. **Nothing in `src/` ever calls `.focus()` on a CodeMirror view**
(verified: the only `.focus()` calls are FileFinder's input, SettingsDialog's panel, CommandBar's
input, EntryDraftRow's input). Meanwhile `FileFinder` unmounts wholesale on `hide()`, so the focused
`<input>` disappears and `document.activeElement` falls back to `<body>`. Nobody claims it.

`doc/keybindings.md:49` already documents the intended contract — *"File: open it and move focus to
the editor"* — so this is closing a gap, not adding a feature.

**Coupled latent bug that must be fixed in the same change.** `dispatcher.ts:153` bails on any
`isEditableTarget` — which CodeMirror's `contentDOM` is (`isContentEditable`). So once the editor
holds DOM focus, `Ctrl-w h` (handled inside CM by `region-exit.ts`) sets `activeRegion: 'sidebar'`
while DOM focus stays in CodeMirror → the window dispatcher keeps bailing → sidebar `j`/`k` are dead
and get typed into the buffer instead. This is broken today for anyone who clicks into the editor;
auto-focusing would make it the common path. **The blur half is therefore not optional.**

**Outcome.** Region focus and real DOM focus stay in agreement: when `activeRegion === 'viewer'` and a
buffer is open, that buffer's CodeMirror owns DOM focus; when focus leaves the viewer, it gives DOM
focus up.

**Decided with the user:**
- Escape / scrim-dismiss of the file finder also returns focus to the editor. SettingsDialog and
  command mode keep today's behavior (pre-existing, out of scope).
- Accepted consequence: with the editor focused, `:` now opens CodeMirror-vim's ex prompt (where
  `:w` already lives) instead of orbit's app-level `CommandBar`. This is the documented
  "inside the editor, CodeMirror is in charge" rule (`region-exit.ts:53`). The `CommandBar` stays
  reachable from every other region.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `.agents/plans/2026-08-08-editor-dom-focus-on-open.md` | Project-canonical copy of this plan (step 0) |
| MODIFY | `src/stores/app-store.ts` | Add `editorFocusRequest` nonce + `focusEditor()` / `requestEditorFocus()` |
| MODIFY | `src/lib/vault/open-file.ts` | `focusRegion('viewer')` → `focusEditor()` (2 sites) |
| MODIFY | `src/lib/config/open-config-file.ts` | `focusRegion('viewer')` → `focusEditor()` (2 sites) |
| MODIFY | `src/components/editor/BufferEditor.tsx` | Hold the `EditorView`; focus/blur it to follow the focused region |
| MODIFY | `src/components/layout/FileFinder.tsx` | Escape / scrim dismiss returns focus to the editor |
| MODIFY | `src/lib/dom/is-editable-target.ts` | Also read the raw `contenteditable` attribute (jsdom parity; no prod change) |
| MODIFY | `src/stores/app-store.test.ts` | Cover the nonce |
| MODIFY | `src/lib/vault/open-file.test.ts` | Assert the focus request on both branches |
| MODIFY | `src/lib/config/open-config-file.test.ts` | Same, for config buffers |
| CREATE | `src/components/editor/BufferEditor.test.tsx` | The real regression guard (focus / re-focus / blur) |
| MODIFY | `.agents/ubiquitous-language.md` | New term + invariant + changelog (required by `AGENTS.md`) |

## Step-by-Step Implementation

### Step 0 — Persist this plan in the repo

Copy this file verbatim to `.agents/plans/2026-08-08-editor-dom-focus-on-open.md`, status `approved`,
per `.agents/rules/plan-creation.md`. (Plan mode could only write to the harness path.)

### Step 1 — `src/stores/app-store.ts`: a focus-request nonce

`activeRegion` alone cannot express "put the caret in the editor": re-opening the file that is
*already* the active buffer changes no state at all, yet the overlay that just unmounted took DOM
focus to `<body>` with it. A monotonic counter makes every open a distinguishable event.

Add to `interface AppState`:

```ts
  /**
   * Monotonic "put real DOM focus in the editor" request, consumed by `BufferEditor`'s focus
   * effect. Distinct from `activeRegion` because an open that changes no state (re-opening the
   * already-active buffer from the file finder) must still re-claim DOM focus from the overlay
   * that just unmounted.
   */
  editorFocusRequest: number;

  /** Focuses the viewer region *and* asks the mounted editor for real DOM focus. */
  focusEditor: () => void;
  /** Asks the mounted editor for real DOM focus *without* changing the focused region — the
   *  editor claims it only if the viewer is already the active region. */
  requestEditorFocus: () => void;
```

Implementation (single `set` per action so each is one render; `'viewer'` is unconditionally
reachable per `reachableRegions`, so `focusEditor` needs no guard):

```ts
  editorFocusRequest: 0,

  focusEditor: () => set((state) => ({ activeRegion: 'viewer', editorFocusRequest: state.editorFocusRequest + 1 })),

  requestEditorFocus: () => set((state) => ({ editorFocusRequest: state.editorFocusRequest + 1 })),
```

`app-store.test.ts` snapshots `useAppStore.getState()` at module load and resets with
`setState(initialState, true)`, so existing tests keep passing untouched.

### Step 2 — Route the open helpers through `focusEditor()`

- `src/lib/vault/open-file.ts` lines 10 and 16
- `src/lib/config/open-config-file.ts` lines 14 and 20

Replace each `useAppStore.getState().focusRegion('viewer');` with
`useAppStore.getState().focusEditor();`. Update `openVaultFile`'s doc comment: *"…and moves focus to
the viewer"* → *"…and moves both region focus and real DOM focus into the editor"*.

### Step 3 — `src/components/editor/BufferEditor.tsx`: own the view, follow the region

**Why the view must live in `useState` and not `useRef`:** `@uiw/react-codemirror` installs its
container through a **ref callback** (`setContainer`), and builds the `EditorView` in a
`useLayoutEffect` keyed on `[container, state]`. On the first commit `container` is still
`undefined`, so the view is constructed in a *second* commit — after this component's first passive
effect has already flushed. A ref filled by `onCreateEditor` would read `null`. State re-runs the
effect at exactly the moment the view exists.

The extra render is free: `useCodeMirror`'s reconfigure effect already lists `onChange` in its deps
and `BufferEditor` passes an inline arrow, so every render already dispatches a
`StateEffect.reconfigure` — which preserves doc, selection, and history. It is **not** the
`EditorState.create` rebuild the `useMemo` comment at lines 29–33 guards against, and `extensions`
gains no new dependency.

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/stores/app-store';
// EditorView is already imported from '@codemirror/view'

  const viewerActive = useAppStore((state) => state.activeRegion === 'viewer');
  const focusRequest = useAppStore((state) => state.editorFocusRequest);
  const [view, setView] = useState<EditorView | null>(null);
```

Pass `onCreateEditor={setView}` to `<CodeMirror>` (its signature is `(view, state)`; a 1-arity
setter is assignable, and React only treats a *function* argument as an updater — an `EditorView`
instance is an object, so there is no ambiguity).

Add the effect, after the existing `applyEditorKeymap` one:

```tsx
  // Real DOM focus follows the focused region. The window dispatcher bails on any `contenteditable`
  // target (`isEditableTarget`), so region focus without DOM focus leaves the sidebar's `j`/`k` dead
  // while keystrokes land in the buffer — and the mirror image after `Ctrl-w h`. `focusRequest`
  // re-triggers this for an open that changes nothing else: re-opening the already-active buffer
  // from the file finder, whose input just unmounted and took DOM focus to `<body>` with it.
  useEffect(() => {
    if (view === null) return;
    // `view.dom`, not `contentDOM`: vim's `:`/`/` prompt is a CodeMirror panel mounted inside
    // `view.dom` that closes itself on blur, so focus sitting there counts as already owned.
    // `view.hasFocus` is deliberately not used — it ANDs in `document.hasFocus()`, so a backgrounded
    // window would report false and skip the blur.
    const holdsFocus = view.dom.contains(view.root.activeElement);
    if (active && viewerActive) {
      if (!holdsFocus) view.focus();
    } else if (holdsFocus) {
      view.contentDOM.blur();
    }
  }, [view, active, viewerActive, focusRequest]);
```

The per-view `holdsFocus` check makes the N-mounted-buffers case order-independent: on a buffer
switch, whichever effect runs second sees the other editor already owns focus and does nothing.

### Step 4 — `src/components/layout/FileFinder.tsx`: dismiss returns focus

Add above `select`:

```tsx
  const dismiss = () => {
    hide();
    // Nonce only, never `focusEditor()` — Escaping the finder from the sidebar region must not
    // yank the region to the viewer. `BufferEditor` claims focus only if the viewer is already active.
    useAppStore.getState().requestEditorFocus();
  };
```

Use `dismiss` for the two dismissal paths only — the scrim's `onMouseDown={hide}` (line 52) and the
`Escape` branch (line 70). Leave `select()`'s `hide()` alone: `openVaultFile`/`openConfigFile`
already fired `focusEditor()`, and on a *throw* neither runs, so the finder correctly stays open
with its input focused.

### Step 5 — `src/lib/dom/is-editable-target.ts`: jsdom parity

jsdom implements neither `isContentEditable` nor the `contentEditable` property, so in tests
CodeMirror's content DOM looks like a plain non-editable target and the dispatcher's real behavior
cannot be reproduced. In a real browser `isContentEditable` is already `true` there, so the added
check is redundant at runtime — **no production behavior change**.

```ts
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // jsdom implements neither `isContentEditable` nor the `contentEditable` property, so the raw
  // attribute is read too — otherwise a test would see CodeMirror's content DOM as non-editable and
  // silently diverge from the real app.
  return target.isContentEditable || target.getAttribute('contenteditable') === 'true' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}
```

### Step 6 — Tests (`.agents/rules/testing.md`: co-located, explicit `vitest` imports, no globals)

**6a. `src/stores/app-store.test.ts`** — new `describe('focusEditor / requestEditorFocus')`:
- `focusEditor()` sets `activeRegion` to `'viewer'` and increments `editorFocusRequest`.
- `focusEditor()` increments **again when the viewer is already active** — the whole point of the nonce.
- `requestEditorFocus()` increments the nonce and leaves `activeRegion` unchanged (start from `'sidebar'`).

**6b. `src/lib/vault/open-file.test.ts`** — extend `beforeEach`'s `setState` to
`{ activeRegion: 'sidebar', editorFocusRequest: 0 }`, then assert
`expect(useAppStore.getState().editorFocusRequest).toBe(1)` in **both** existing cases. The
existing-buffer case is the exact FileFinder regression.

**6c. `src/lib/config/open-config-file.test.ts`** — the same two additions.

**6d. `src/components/editor/BufferEditor.test.tsx`** — CREATE. A real CodeMirror view *does* take
focus under jsdom, and `.cm-content` carries `role="textbox"`, so `screen.getByRole('textbox')`
finds it (satisfies the "prefer roles over `querySelector`" rule). RTL's `render` is `act`-wrapped,
so the `container → view → setView` cascade has flushed by the time it returns.

Follow `Viewer.test.tsx` for shape: `afterEach(cleanup)` plus a `beforeEach` resetting
`useAppStore` (`{ activeRegion: 'viewer', editorFocusRequest: 0 }`), `useEditorStore`, and
`useSettingsStore`. Build the buffer via `useEditorStore.getState().openFile(...)` and read it back,
so the `EditorBuffer` shape stays in sync with the store.

```tsx
it('takes DOM focus when its buffer is active and the viewer is the focused region', () => {
  render(<BufferEditor buffer={buffer} active />);
  expect(screen.getByRole('textbox')).toHaveFocus();
});

it('re-takes DOM focus for a repeat request that changes nothing else', () => {
  render(<BufferEditor buffer={buffer} active />);
  const content = screen.getByRole('textbox');
  act(() => content.blur());                    // what FileFinder's unmounting input leaves behind
  act(() => useAppStore.getState().focusEditor());
  expect(content).toHaveFocus();
});

it('gives up DOM focus when the focused region leaves the viewer', () => {
  render(<BufferEditor buffer={buffer} active />);
  act(() => useAppStore.getState().focusRegion('sidebar'));
  expect(screen.getByRole('textbox')).not.toHaveFocus();
});

it('does not take DOM focus while its buffer is inactive', () => {
  render(<BufferEditor buffer={buffer} active={false} />);
  expect(screen.getByRole('textbox')).not.toHaveFocus();
});
```

**6e. `src/hooks/use-global-keymap.test.tsx`** — mirror the existing `<input>` case (line ~34) with a
`contenteditable="true"` target, asserting the dispatcher ignores it. This is what step 5 buys.

### Step 7 — `.agents/ubiquitous-language.md`

Required by `AGENTS.md` — this change alters an invariant.

- **Amend** the *Focus region* row: it currently reads "the app-level focus target, **not editor DOM
  focus**", which becomes wrong. New wording: the app-level focus target; while it is `'viewer'` and a
  buffer is open, the active buffer's CodeMirror also holds real DOM focus.
- **Add** an *Editor focus request* row (Application shell and commands):
  `editorFocusRequest` / `focusEditor` / `requestEditorFocus` (`src/stores/app-store.ts`) — a
  monotonic nonce that lets an open which changes no other state still re-claim DOM focus.
  Aliases to avoid: "focus flag".
- **Amend** the *Open vault file* and *Open config file* rows to say they move region **and** DOM focus.
- **Add invariant 20:** while `activeRegion === 'viewer'` and a buffer is active, that buffer's
  CodeMirror view holds real DOM focus; when the region leaves the viewer, the view releases it —
  otherwise the window dispatcher's `isEditableTarget` bail leaves every other region's keys dead.
- Set `Last updated: 2026-08-08` and add a Changelog row.

## Architecture Decisions

- **Nonce over booleans.** `autoFocus={active && viewerActive}` is tempting (`useCodeMirror`
  re-fires it on a false→true flip) and covers new buffers, buffer switches, and `Ctrl-w l` — but it
  cannot cover re-opening the *already-active* buffer (no boolean changes), which is the stated ask,
  and it cannot blur.
- **Focus lives in `BufferEditor`, not in the open helpers.** The helpers run before React has
  committed a brand-new buffer's view; the component is the only place that knows when the view
  exists.
- **Blur is in scope.** Without it, auto-focusing regresses `Ctrl-w h` into a dead keyboard.
- **Two store actions, not one.** `focusEditor()` (region + nonce) for opens; `requestEditorFocus()`
  (nonce only) for the finder's Escape, so dismissing from the sidebar region does not drag focus
  into the viewer.
- **Ordering hazard to preserve:** `src/lib/vault/create-entry.ts:80-83` calls `cancelDraft()`
  *before* `await openVaultFile(path)`. `EntryDraftRow`'s input has `onBlur={onCancel}`. Do not
  reorder those two lines.

## Validation Criteria

- [ ] `pnpm test` passes, including the new `BufferEditor.test.tsx`
- [ ] `pnpm lint` and `pnpm check` pass
- [ ] `pnpm build` passes (this is the only `tsc` invocation)
- [ ] Manual smoke via `pnpm dev`:
  - [ ] `Ctrl-w f`, pick a note, Enter → caret is in the editor; typing edits the note immediately
  - [ ] Repeat for a note that is **already the active tab** → caret still lands in the editor
  - [ ] `Ctrl-w f`, then Escape → caret returns to the editor (and, when started from the sidebar,
        the sidebar stays active and `j`/`k` still work)
  - [ ] Click a note in the sidebar → caret lands in the editor
  - [ ] From the focused editor, `Ctrl-w h` → sidebar `j`/`k` move the cursor and are **not** typed
        into the buffer
  - [ ] `Ctrl-w l` back → caret returns to the editor
  - [ ] Click a different editor tab → caret lands in that buffer
  - [ ] `:w` still saves (vim ex prompt) and `Mod-s` still saves
  - [ ] Sidebar `a` (new note) → the draft input keeps focus while naming; on commit the caret moves
        to the editor
  - [ ] Chat: click the chat input and type → the editor does not steal focus

## Open Questions

None.
