import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { formatChord } from '@/lib/keymap/format-chord';
import { useRenamePrompt } from '@/lib/vault/confirm-rename';
import { useAppStore } from '@/stores/app-store';
import { useKeymapStore } from '@/stores/keymap-store';

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function vaultRelativePath(path: string, vaultRoot: string | null): string {
  if (vaultRoot === null) return path;
  const root = vaultRoot.replace(/[\\/]+$/, '');
  if (path.startsWith(`${root}/`) || path.startsWith(`${root}\\`)) return path.slice(root.length + 1);
  return path;
}

/** Confirmation gate before a rename updates unambiguous wikilinks. */
export function RenameEntryDialog() {
  const pending = useRenamePrompt();
  const modalBindings = useKeymapStore((state) => state.resolved.layers.modal);
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const modalId = useId();

  if (pending === null) return null;

  return (
    <Modal
      id={modalId}
      title="Update wikilinks?"
      onConfirm={() => pending.resolve('confirm')}
      onCancel={() => pending.resolve('cancel')}
      width={460}
      actions={
        <>
          <Button variant="ghost" size="sm" kbd={formatChord(modalBindings.get('modal.cancel'))} onClick={() => pending.resolve('cancel')}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" kbd={formatChord(modalBindings.get('modal.confirm'))} onClick={() => pending.resolve('confirm')}>
            Update links
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="font-sans text-ui text-text-body">
          {countLabel(pending.scan.links, 'link', 'links')} in {countLabel(pending.scan.notes.length, 'note', 'notes')} will update from [[{pending.oldStem}]] to [[
          {pending.newStem}]].
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-item border border-border bg-elevated px-3 py-2 font-mono text-meta text-text-primary">
          {pending.scan.notes.map((path) => (
            <li key={path}>{vaultRelativePath(path, vaultRoot)}</li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
