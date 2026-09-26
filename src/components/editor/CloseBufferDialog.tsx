import { AnimatePresence } from 'motion/react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { EditorBuffer } from '@/stores/editor-store';

interface CloseBufferDialogProps {
  buffer: EditorBuffer | null;
  /** Resolves `true` only once the caller has closed the dialog (`Viewer`'s `saveAndClose`). */
  onSave: () => Promise<boolean>;
  onDiscard: () => void;
  onCancel: () => void;
}

/**
 * Guards closing a dirty editor buffer without losing unsaved changes. `buffer` turning `null`
 * begins the dialog's *exit phase*; `AnimatePresence` keeps rendering the last element it was given —
 * the last buffer's title and handlers — until the panel has left, which is how the dialog holds its
 * last buffer without `Viewer` keeping it. Keyed by buffer id because `saving` belongs to one buffer.
 */
export function CloseBufferDialog({ buffer, ...handlers }: CloseBufferDialogProps) {
  return <AnimatePresence>{buffer !== null && <CloseBufferModal key={buffer.id} buffer={buffer} {...handlers} />}</AnimatePresence>;
}

function CloseBufferModal({ buffer, onSave, onDiscard, onCancel }: Omit<CloseBufferDialogProps, 'buffer'> & { buffer: EditorBuffer }) {
  const [saving, setSaving] = useState(false);
  const modalId = useId();

  // Reset only when the dialog stays open: after a successful save it is already leaving, and
  // flipping back to "Save" would flash re-enabled buttons on a panel that is fading out.
  const handleSave = async () => {
    setSaving(true);
    let closed = false;
    try {
      closed = await onSave();
    } finally {
      if (!closed) setSaving(false);
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
