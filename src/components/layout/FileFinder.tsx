import { useDeferredValue, useEffect, useId, useRef } from 'react';
import { Chip } from '@/components/ui/chip';
import { Kbd } from '@/components/ui/kbd';
import { SectionLabel } from '@/components/ui/section-label';
import { openConfigFile } from '@/lib/config/open-config-file';
import { collectConfigCandidates, collectVaultFiles, rankVaultFiles } from '@/lib/vault/file-search';
import { openVaultFile } from '@/lib/vault/open-file';
import type { ConfigFileName } from '@/services/config.service';
import { useAppStore } from '@/stores/app-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useToastStore } from '@/stores/toast-store';

/** Spotlight-like overlay for opening a Markdown note from the current vault. */
export function FileFinder() {
  const open = useFileFinderStore((state) => state.open);
  const query = useFileFinderStore((state) => state.query);
  const cursor = useFileFinderStore((state) => state.cursor);
  const hide = useFileFinderStore((state) => state.hide);
  const setQuery = useFileFinderStore((state) => state.setQuery);
  const moveCursor = useFileFinderStore((state) => state.moveCursor);
  const tree = useSidebarStore((state) => state.tree);
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const showToast = useToastStore((state) => state.showToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultListId = useId();
  const deferredQuery = useDeferredValue(query);
  const candidates = [...(vaultRoot === null ? [] : collectVaultFiles(tree, vaultRoot)), ...collectConfigCandidates()];
  const results = rankVaultFiles(candidates, deferredQuery);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  /** Closes the finder without opening anything, handing DOM focus back to the editor so the
   *  keyboard isn't left on `<body>` once this overlay's input unmounts. Deliberately the nonce-only
   *  `requestEditorFocus`, never `focusEditor` — Escaping the finder from the sidebar must not drag
   *  the focused region into the viewer, and `BufferEditor` claims focus only if it is already there. */
  const dismiss = () => {
    hide();
    useAppStore.getState().requestEditorFocus();
  };

  const select = async (index: number) => {
    const candidate = results[index];
    if (candidate === undefined) return;
    try {
      if (candidate.source === 'config') {
        await openConfigFile(candidate.path as ConfigFileName);
      } else {
        await openVaultFile(candidate.path);
      }
      hide();
    } catch (error) {
      showToast(error instanceof Error ? `Could not open ${candidate.name}: ${error.message}` : `Could not open ${candidate.name}.`, 'error');
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: scrim click-to-close; the dialog receives keyboard input.
    <div role="presentation" className="absolute inset-0 z-10 flex items-start justify-center bg-[var(--scrim)] pt-[12vh]" onMouseDown={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find file"
        className="w-[min(600px,calc(100%-2rem))] overflow-hidden rounded-panel border border-border-strong bg-surface shadow-[var(--shadow-overlay-dark)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
          <span aria-hidden="true" className="font-mono text-input text-text-muted">
            ⌕
          </span>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={resultListId}
            aria-activedescendant={results[cursor] === undefined ? undefined : `${resultListId}-${cursor}`}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                dismiss();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                moveCursor(1, results.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveCursor(-1, results.length);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                void select(cursor);
              }
            }}
            className="min-w-0 flex-1 bg-transparent font-sans text-input text-text-primary outline-none placeholder:text-text-muted"
            placeholder="Find a note..."
            spellCheck={false}
          />
        </div>
        <div className="px-3 pt-3">
          <SectionLabel>Notes</SectionLabel>
        </div>
        <div id={resultListId} role="listbox" aria-label="Matching files" className="flex max-h-80 flex-col overflow-y-auto p-2">
          {results.map((candidate, index) => (
            <button
              key={candidate.path}
              id={`${resultListId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === cursor}
              aria-label={candidate.relativePath}
              className={`flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-item px-[10px] py-2 text-left ${index === cursor ? 'bg-hover text-text-primary' : 'text-text-secondary'}`}
              title={candidate.relativePath}
              onMouseMove={() => moveCursor(index - cursor, results.length)}
              onClick={() => void select(index)}
            >
              <span className="min-w-0 flex-1 truncate font-sans text-body">{candidate.name}</span>
              <span className="shrink-0 truncate font-mono text-meta text-text-muted">{candidate.relativePath}</span>
              {candidate.source === 'config' && <Chip variant="plain">config</Chip>}
            </button>
          ))}
          {results.length === 0 && <div className="px-[10px] py-5 font-sans text-ui text-text-secondary">no matching notes.</div>}
        </div>
        <div className="flex items-center gap-2 border-t border-hairline px-4 py-2">
          <Kbd boxed={false}>↑↓ navigate</Kbd>
          <span className="font-mono text-micro text-text-muted">·</span>
          <Kbd boxed={false}>⏎ open</Kbd>
          <span className="font-mono text-micro text-text-muted">·</span>
          <Kbd boxed={false}>esc dismiss</Kbd>
        </div>
      </div>
    </div>
  );
}
