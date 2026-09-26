import { motion } from 'motion/react';
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { useReleaseFocusOnExit } from '@/hooks/use-release-focus-on-exit';
import { pushModalOverlay } from '@/lib/keymap/modal-overlay';
import { useExitPhase } from '@/lib/motion/use-exit-phase';
import { overlayPresence, risingPanelVariants, scrimVariants } from '@/lib/motion/variants';
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

/**
 * Shared scrim, panel, title, and footer for the promise-gate dialogs. It pushes a `modal-overlay`
 * entry that activates the `modal` keymap layer `Layout` registers once via `useModalKeymap`; it
 * never registers a layer itself. Render it as the keyed child of the caller's `AnimatePresence` to
 * animate out: the moment its *exit phase* begins the overlay is popped, focus leaves the panel and
 * pointer events stop (invariant 60) — only the pixels lag. Outside `AnimatePresence` it is always
 * present and simply unmounts.
 */
export function Modal({ id, title, icon, note, actions, onConfirm, onCancel, width, children, className }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<(() => void) | undefined>(onConfirm);
  const cancelRef = useRef(onCancel);
  confirmRef.current = onConfirm;
  cancelRef.current = onCancel;
  const { exiting, exitPhaseProps } = useExitPhase();

  // Pushed while present, popped on the commit that begins the exit phase — never at unmount, one
  // exit animation later (invariant 60). A layout effect so the pop lands in that very commit, before
  // any later keydown reaches the dispatcher. `exiting` is a dependency so a dialog re-entering
  // during its exit (a new prompt under the same presence key) pushes again.
  useLayoutEffect(() => {
    if (exiting) return;
    return pushModalOverlay({ id, onConfirm: () => confirmRef.current?.(), onCancel: () => cancelRef.current() });
  }, [id, exiting]);

  // The panel, rather than a button, owns focus to avoid an Enter double-action. Claimed on the first
  // frame of an entry (and of a re-entry), never after the animation: `renameVaultEntry` relies on
  // this steal to cancel the inline rename row.
  useEffect(() => {
    if (!exiting) panelRef.current?.focus();
  }, [exiting]);

  useReleaseFocusOnExit(panelRef, exiting);

  return (
    <div role="presentation" className="absolute inset-0 z-20 flex items-center justify-center" {...exitPhaseProps}>
      {/* A sibling layer, not the panel's parent, so the scrim's fade never multiplies into the panel's. */}
      <motion.div className="absolute inset-0 bg-scrim" variants={scrimVariants} {...overlayPresence} />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ width }}
        variants={risingPanelVariants}
        {...overlayPresence}
        className={cn('relative overflow-hidden rounded-modal border border-hairline bg-surface shadow-modal outline-none', className)}
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
      </motion.div>
    </div>
  );
}
