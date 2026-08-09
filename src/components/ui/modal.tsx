import { type ReactNode, useEffect, useId, useRef } from 'react';
import { pushModalOverlay } from '@/lib/keymap/modal-overlay';
import { cn } from '@/lib/utils';

export interface ModalProps {
  /** Stable overlay id, for debugging only — resolution is by stack position. */
  id: string;
  title: ReactNode;
  /** Rendered left of the title, e.g. a tinted icon tile. */
  icon?: ReactNode;
  /** Left-aligned footer note, opposite the actions. */
  note?: ReactNode;
  /** Action buttons, right-aligned in the footer. */
  actions: ReactNode;
  /** Wired to `modal.confirm`. Omit unless the dialog has one unambiguous confirm action. */
  onConfirm?: () => void;
  /** Wired to `modal.cancel`. Every modal must be escapable. */
  onCancel: () => void;
  width: number;
  children?: ReactNode;
  className?: string;
}

/** Shared scrim, panel, title, and footer for dialogs that own the modal keymap layer. */
export function Modal({ id, title, icon, note, actions, onConfirm, onCancel, width, children, className }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<(() => void) | undefined>(onConfirm);
  const cancelRef = useRef(onCancel);
  confirmRef.current = onConfirm;
  cancelRef.current = onCancel;

  // Register once per mount so re-renders do not silently reorder the overlay stack.
  useEffect(() => pushModalOverlay({ id, onConfirm: () => confirmRef.current?.(), onCancel: () => cancelRef.current() }), [id]);

  // The panel, rather than a button, owns focus to avoid an Enter double-action.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div role="presentation" className="absolute inset-0 z-20 flex items-center justify-center bg-scrim">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ width }}
        className={cn('overflow-hidden rounded-modal border border-hairline bg-surface shadow-modal outline-none', className)}
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
          {icon}
          <h2 id={titleId} className="font-sans text-h2 font-medium text-text-primary">
            {title}
          </h2>
        </div>
        {children && <div className="p-4">{children}</div>}
        <div className="flex items-center justify-between gap-4 border-t border-hairline bg-panel px-4 py-3">
          <span className="font-mono text-meta text-text-muted">{note}</span>
          <div className="ml-auto flex shrink-0 justify-end gap-2">{actions}</div>
        </div>
      </div>
    </div>
  );
}
