import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useVaultSwitchPrompt } from '@/lib/vault/switch-vault';

/**
 * The consolidated Save all / Discard all / Cancel prompt `switchVault` (`#98`, spec decision
 * 21) shows when a live `vaultPath` change would close dirty buffers. One prompt for every dirty
 * buffer, never a chain of per-buffer dialogs — mirrors `CloseBufferDialog`'s shape. Cancel is
 * the safety valve: `settings.toml` already holds `newPath` on disk, but the running app keeps
 * ignoring it until the buffers are resolved, so the copy below says so explicitly.
 */
export function SwitchVaultDialog() {
  const pending = useVaultSwitchPrompt();
  const modalId = useId();

  if (pending === null) return null;

  return (
    <Modal
      id={modalId}
      title="Switch vault?"
      onCancel={() => pending.resolve('cancel')}
      width={420}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => pending.resolve('cancel')}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => pending.resolve('discard')}>
            Discard all
          </Button>
          <Button variant="secondary" size="sm" onClick={() => pending.resolve('save')}>
            Save all
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="font-sans text-ui text-text-body">
          <span className="break-all font-mono text-meta text-text-primary">{pending.newPath}</span> was set in settings.toml, but open buffers have unsaved changes. Save or
          discard them to continue.
        </p>
        <p className="font-sans text-caption text-text-secondary">
          Cancel leaves the vault open and this path un-applied — settings.toml keeps the new value on disk until you retry.
        </p>
      </div>
    </Modal>
  );
}
