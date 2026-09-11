import { type Range, StateEffect } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { openVaultFile } from '@/lib/vault/open-file';
import { resolveWikilink, wikilinkBrokenReason } from '@/lib/vault/resolve-wikilink';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useToastStore } from '@/stores/toast-store';

const WIKILINK_RE = /\[\[[^[\]]+\]\]/g;

/** The resolved note a decorated span opens, read back by the click handler. */
const PATH_ATTRIBUTE = 'data-wikilink-path';

/**
 * Raised when the cached vault tree changes under a live editor.
 *
 * The decorations are derived from state the document knows nothing about, so a doc/viewport
 * rebuild is not enough: creating the missing note must make existing links to it stop reading
 * broken *without* a keystroke or a reload. A transaction is how a `ViewPlugin` is told to look
 * again.
 */
const vaultTreeChanged = StateEffect.define<null>();

function buildDecorations(view: EditorView): DecorationSet {
  const { tree } = useSidebarStore.getState();
  const ranges: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    WIKILINK_RE.lastIndex = 0;
    let match = WIKILINK_RE.exec(text);
    while (match !== null) {
      const start = from + match.index;
      const target = resolveWikilink(match[0], tree);
      const decoration =
        target.status === 'resolved'
          ? Decoration.mark({ class: 'cm-wikilink', attributes: { [PATH_ATTRIBUTE]: target.path } })
          : Decoration.mark({ class: 'cm-wikilink-broken', attributes: { title: wikilinkBrokenReason(target.status) } });
      ranges.push(decoration.range(start, start + match[0].length));
      match = WIKILINK_RE.exec(text);
    }
  }

  return Decoration.set(ranges);
}

const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private readonly unsubscribe: () => void;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
      this.unsubscribe = useSidebarStore.subscribe((state, previous) => {
        if (state.tree !== previous.tree) view.dispatch({ effects: vaultTreeChanged.of(null) });
      });
    }

    update(update: ViewUpdate) {
      const treeChanged = update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(vaultTreeChanged)));
      if (update.docChanged || update.viewportChanged || treeChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }

    destroy() {
      this.unsubscribe();
    }
  },
  {
    decorations: (instance) => instance.decorations,
  }
);

/**
 * Ember for a target that resolves, muted and struck through for one that does not — the same three
 * states the *read view* renders, because both surfaces read the same resolver (invariant 38).
 *
 * The ember is **ADR 0040**, which widens the accent from "the AI acted here" to "…**or** this is a
 * link into the vault". It reverses this file's former rule ("never accented") deliberately: a grey
 * link in edit beside an ember one in read is the same link changing colour under a toggle, which
 * is worse than either colour alone. A broken link gets `cursor: default` because there is nothing
 * to click — the old style promised a navigation the file could not perform at all.
 */
const wikilinkStyle = EditorView.baseTheme({
  '.cm-wikilink': {
    color: 'var(--accent)',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  '.cm-wikilink:hover': {
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  '.cm-wikilink-broken': {
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
    cursor: 'default',
  },
});

/** Opens the note a decorated span carries. A broken span carries no path, so it does nothing. */
const wikilinkClick = EditorView.domEventHandlers({
  click: (event) => {
    const clicked = event.target instanceof Element ? event.target.closest(`[${PATH_ATTRIBUTE}]`) : null;
    const path = clicked?.getAttribute(PATH_ATTRIBUTE) ?? '';
    if (path === '') return false;
    event.preventDefault();
    void openVaultFile(path).catch(() => useToastStore.getState().showToast('could not open the note', 'error'));
    return true;
  },
});

/**
 * Inline `[[wikilink]]` rendering (doc/v0-spec.md §5.1, §5.6 `Wikilink`) — a hand-built CM6
 * decoration over the raw markdown source (brackets stay visible), not a mounted React
 * component, since it renders inside editor text.
 *
 * No longer a bare regex: each match is resolved against the cached sidebar tree through the one
 * `resolveWikilink` the read view also reads, so the two views agree about which links are real,
 * and the `cursor: pointer` this file has always drawn now leads somewhere.
 */
export const wikilink = [wikilinkPlugin, wikilinkStyle, wikilinkClick];
