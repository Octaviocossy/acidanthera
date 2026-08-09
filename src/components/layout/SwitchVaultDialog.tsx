import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
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
  const titleId = useId();

  if (pending === null) return null;

  return (
    <div role="presentation" className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--scrim)]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-[420px] rounded-modal border border-border-strong bg-surface p-4 shadow-[var(--shadow-overlay-dark)]"
      >
        <h2 id={titleId}>
          <SectionLabel>Switch vault?</SectionLabel>
        </h2>
        <p className="mt-2 font-sans text-ui text-text-body">
          <span className="break-all font-mono text-meta text-text-primary">{pending.newPath}</span> was set in settings.toml, but open buffers have unsaved changes. Save or
          discard them to continue.
        </p>
        <p className="mt-2 font-sans text-caption text-text-secondary">
          Cancel leaves the vault open and this path un-applied — settings.toml keeps the new value on disk until you retry.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => pending.resolve('cancel')}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => pending.resolve('discard')}>
            Discard all
          </Button>
          <Button variant="secondary" size="sm" onClick={() => pending.resolve('save')}>
            Save all
          </Button>
        </div>
      </div>
    </div>
  );
}
