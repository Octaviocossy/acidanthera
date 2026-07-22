import { useDeferredValue, useEffect, useId, useRef } from 'react';
import { collectVaultFiles, rankVaultFiles } from '@/lib/vault/file-search';
import { openVaultFile } from '@/lib/vault/open-file';
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
  const candidates = vaultRoot === null ? [] : collectVaultFiles(tree, vaultRoot);
  const results = rankVaultFiles(candidates, deferredQuery);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const select = async (index: number) => {
    const candidate = results[index];
    if (candidate === undefined) return;
    try {
      await openVaultFile(candidate.path);
      hide();
    } catch (error) {
      showToast(error instanceof Error ? `Could not open ${candidate.name}: ${error.message}` : `Could not open ${candidate.name}.`, 'error');
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: scrim click-to-close; the dialog receives keyboard input.
    <div role="presentation" className="absolute inset-0 z-10 flex items-start justify-center bg-bg/70 pt-[12vh]" onMouseDown={hide}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find file"
        className="w-[min(640px,calc(100%-2rem))] overflow-hidden rounded-lg border border-border-hairline bg-surface"
        onMouseDown={(event) => event.stopPropagation()}
      >
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
              hide();
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
          className="w-full border-b border-border-hairline bg-transparent px-4 py-3 font-sans text-sm text-text outline-none placeholder:text-text-faint"
          placeholder="Find a note..."
          spellCheck={false}
        />
        <div id={resultListId} role="listbox" aria-label="Matching files" className="flex max-h-80 flex-col overflow-y-auto py-1">
          {results.map((candidate, index) => (
            <button
              key={candidate.path}
              id={`${resultListId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === cursor}
              className={`w-full min-w-0 cursor-pointer truncate px-4 py-2 text-left font-mono text-sm ${index === cursor ? 'bg-surface-2 text-text' : 'text-text-dim'}`}
              title={candidate.relativePath}
              onMouseMove={() => moveCursor(index - cursor, results.length)}
              onClick={() => void select(index)}
            >
              {candidate.relativePath}
            </button>
          ))}
          {results.length === 0 && <div className="px-4 py-5 font-sans text-sm text-text-dim">No matching notes.</div>}
        </div>
      </div>
    </div>
  );
}
