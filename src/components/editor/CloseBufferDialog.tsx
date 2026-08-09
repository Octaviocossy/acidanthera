import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
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
  const modalId = useId();
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
    <Modal
      id={modalId}
      title={`Close ${buffer.title}?`}
      onCancel={() => {
        if (!saving) onCancel();
      }}
      width={360}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <p className="font-sans text-ui text-text-body">You have unsaved changes.</p>
    </Modal>
  );
}
