import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
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
    <div role="presentation" className="absolute inset-0 z-10 flex items-center justify-center bg-bg/70">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-[360px] rounded-lg border border-border-hairline bg-surface p-4">
        <h2 id={titleId} className="font-mono text-sm text-text">
          Close {buffer.title}?
        </h2>
        <p className="mt-2 font-sans text-sm text-text-dim">You have unsaved changes.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
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
