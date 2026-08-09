import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import type { EditorBuffer } from '@/stores/editor-store';

interface CloseBufferDialogProps {
  buffer: EditorBuffer | null;
  onSave: () => Promise<boolean>;
  onDiscard: () => void;
  onCancel: () => void;
}

/** Guards closing a dirty editor buffer without losing unsaved changes. */
export function CloseBufferDialog({ buffer, onSave, onDiscard, onCancel }: CloseBufferDialogProps) {
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  if (buffer === null) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="presentation" className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--scrim)]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-[360px] rounded-modal border border-border-strong bg-surface p-4 shadow-[var(--shadow-overlay-dark)]"
      >
        <h2 id={titleId}>
          <SectionLabel>Close {buffer.title}?</SectionLabel>
        </h2>
        <p className="mt-2 font-sans text-ui text-text-body">You have unsaved changes.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
