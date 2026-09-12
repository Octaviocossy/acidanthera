import { useMemo } from 'react';
import { openVaultFile } from '@/lib/vault/open-file';
import { parseWikilinkDisplay, resolveWikilink, wikilinkBrokenReason } from '@/lib/vault/resolve-wikilink';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useToastStore } from '@/stores/toast-store';

/* Ember, and that is ADR 0040 rather than a violation of invariant 21: the accent now means "the AI
   acted here, **or** this navigates into the vault". A rendered note whose links are
   indistinguishable from its prose loses the one affordance the read view exists to present. */
const RESOLVED = 'text-accent underline-offset-2 hover:underline';

/* Muted and struck through — never ember, never clickable (spec decision 28). This is what stops a
   broken link looking fine until you try it. */
const BROKEN = 'text-text-muted line-through';

interface WikilinkSpanProps {
  /** The `[[…]]` source span, brackets included, exactly as the walker matched it. */
  raw: string;
}

/**
 * A `[[wikilink]]` in the *read view*, in one of the three states *wikilink resolution* returns.
 *
 * It resolves against the cached sidebar tree through the same `resolveWikilink` the editor's
 * decoration uses, so the link cannot change appearance under a view toggle (invariant 38). The
 * tree comes from the store rather than a prop because it changes on its own — a watcher refresh
 * that creates the missing note re-renders this and the link stops reading broken, with no reload.
 */
export function WikilinkSpan({ raw }: WikilinkSpanProps) {
  const tree = useSidebarStore((state) => state.tree);
  const target = useMemo(() => resolveWikilink(raw, tree), [raw, tree]);
  const display = parseWikilinkDisplay(raw);

  if (target.status !== 'resolved') {
    return (
      <span className={BROKEN} title={wikilinkBrokenReason(target.status)}>
        {display}
      </span>
    );
  }

  return (
    <a
      href={target.path}
      className={RESOLVED}
      onClick={(event) => {
        // The path is not a URL the webview could follow; the click is always ours, exactly as it
        // is for an external link a few lines away in the walker.
        event.preventDefault();
        void openVaultFile(target.path).catch(() => useToastStore.getState().showToast('could not open the note', 'error'));
      }}
    >
      {display}
    </a>
  );
}
