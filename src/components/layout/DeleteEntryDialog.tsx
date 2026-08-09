import { useEffect, useId } from 'react';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { pushModalOverlay } from '@/lib/keymap/modal-overlay';
import { useDeletePrompt } from '@/lib/vault/confirm-delete';

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Confirmation gate for vault deletion, including the cached contents and discarded dirty buffers. */
export function DeleteEntryDialog() {
  const pending = useDeletePrompt();
  const titleId = useId();

  useEffect(() => {
    if (pending === null) return;
    return pushModalOverlay({ id: 'delete-entry', onConfirm: () => pending.resolve('confirm'), onCancel: () => pending.resolve('cancel') });
  }, [pending]);

  if (pending === null) return null;

  const { directories, files } = pending.summary.counts;
  const contents = [directories > 0 && countLabel(directories, 'directory', 'directories'), files > 0 && countLabel(files, 'note', 'notes')].filter(Boolean).join(' and ');

  return (
    <div role="presentation" className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--scrim)]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-[420px] rounded-modal border border-border-strong bg-surface p-4 shadow-[var(--shadow-overlay-dark)]"
      >
        <h2 id={titleId}>
          <SectionLabel>Move to Trash?</SectionLabel>
        </h2>
        <p className="mt-2 font-sans text-ui text-text-body">
          <span className="break-all font-mono text-meta text-text-primary">{pending.path}</span> will move to Trash{contents === '' ? '' : `, including ${contents}`}.
        </p>
        <p className="mt-2 font-sans text-caption text-text-secondary">Any open buffers in this entry will close.</p>
        {pending.summary.dirtyBuffers.length > 0 && (
          <div className="mt-3 border-t border-hairline pt-3">
            <p className="font-sans text-caption text-text-secondary">Unsaved changes will be discarded:</p>
            <ul className="mt-1 space-y-1 font-mono text-meta text-text-primary">
              {pending.summary.dirtyBuffers.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => pending.resolve('cancel')}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => pending.resolve('confirm')}>
            Move to Trash
          </Button>
        </div>
      </div>
    </div>
  );
}
