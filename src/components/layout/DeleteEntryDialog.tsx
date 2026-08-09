import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Icon, Trash2 } from '@/components/ui/icon';
import { Modal } from '@/components/ui/modal';
import { truncatePathStart } from '@/lib/chat/tool-path';
import { formatChord } from '@/lib/keymap/format-chord';
import { useDeletePrompt } from '@/lib/vault/confirm-delete';
import { displayPath } from '@/lib/vault/display-path';
import { useKeymapStore } from '@/stores/keymap-store';

/** Roughly what fits the 460px panel's mono field before eliding. */
const MAX_DELETE_PATH_CHARS = 56;

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Produces a count sentence whose verb agrees with its subject. */
function movesSentence(counts: { files: number; directories: number }): string {
  const parts = [counts.directories > 0 && countLabel(counts.directories, 'directory', 'directories'), counts.files > 0 && countLabel(counts.files, 'note', 'notes')].filter(
    Boolean
  ) as string[];
  if (parts.length === 0) return 'This entry moves to Trash.';
  const plural = parts.length > 1 || counts.directories > 1 || counts.files > 1;
  return `${parts.join(' and ')} ${plural ? 'move' : 'moves'} to Trash.`;
}

/** Confirmation gate for vault deletion, including the cached contents and discarded dirty buffers. */
export function DeleteEntryDialog() {
  const pending = useDeletePrompt();
  const modalBindings = useKeymapStore((state) => state.resolved.layers.modal);
  const modalId = useId();

  if (pending === null) return null;

  const shownPath = truncatePathStart(displayPath(pending.path), MAX_DELETE_PATH_CHARS);
  const { dirtyBuffers, openBuffers } = pending.summary;

  return (
    <Modal
      id={modalId}
      title="Move to Trash?"
      icon={
        <span className="flex h-7 w-7 items-center justify-center rounded-item bg-danger-soft text-danger">
          <Icon icon={Trash2} size={15} />
        </span>
      }
      note="recoverable from Trash"
      onConfirm={() => pending.resolve('confirm')}
      onCancel={() => pending.resolve('cancel')}
      width={460}
      actions={
        <>
          <Button variant="ghost" size="sm" kbd={formatChord(modalBindings.get('modal.cancel'))} onClick={() => pending.resolve('cancel')}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" kbd={formatChord(modalBindings.get('modal.confirm'))} onClick={() => pending.resolve('confirm')}>
            Move to Trash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <span className="truncate rounded-item border border-border bg-elevated px-3 py-2 font-mono text-meta text-text-primary" title={pending.path}>
          {shownPath}
        </span>
        <p className="font-sans text-ui text-text-body">{movesSentence(pending.summary.counts)}</p>
        {openBuffers > 0 && <p className="font-sans text-caption text-text-secondary">Any open buffers in this entry will close.</p>}
        {dirtyBuffers.length > 0 && (
          <div className="mt-1 border-t border-hairline pt-3">
            <p className="font-sans text-caption text-text-secondary">Unsaved changes will be discarded:</p>
            <ul className="mt-1 space-y-1 font-mono text-meta text-text-primary">
              {dirtyBuffers.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
