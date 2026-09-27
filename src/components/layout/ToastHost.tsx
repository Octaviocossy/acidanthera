import { AnimatePresence, motion } from 'motion/react';
import { useExitPhase } from '@/lib/motion/use-exit-phase';
import { overlayPresence, risingPanelVariants } from '@/lib/motion/variants';
import { cn } from '@/lib/utils';
import { type Toast, useToastStore } from '@/stores/toast-store';

/**
 * Bottom-center overlay rendering the toast stack (save feedback, #27). Monochrome per the
 * accent discipline (doc/v0-spec.md §5.6): tones differ only by border weight + a tracked-caps
 * tag, never color. A toast rises in from below and fades out, and the stack reflows around it
 * (decisions 2 and 14). The store removes a toast at once; `AnimatePresence` keeps it on
 * screen, inert, through its exit phase (invariant 60). Click a toast to dismiss it early.
 *
 * `z-30` keeps toasts above every scrim: the modal shell's `z-20` and the finder's `z-10`. A toast
 * stays click-to-dismiss there, and it never takes keys.
 */
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);

  // Always mounted: a last toast needs it to finish its exit phase, and a live region should
  // exist before the first message lands in it.
  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 z-30 bottom-10 flex flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useToastStore((state) => state.dismissToast);
  const { exitPhaseProps } = useExitPhase();

  return (
    <motion.button
      type="button"
      onClick={() => dismissToast(toast.id)}
      layout="position"
      variants={risingPanelVariants}
      {...overlayPresence}
      className={cn(
        'pointer-events-auto flex items-center gap-2 rounded-card border bg-elevated px-3 py-1.5 font-sans text-ui text-text-primary',
        toast.tone === 'error' ? 'border-border-strong' : 'border-border'
      )}
      {...exitPhaseProps}
    >
      {toast.tone === 'error' && <span className="font-mono text-meta uppercase tracking-label text-text-muted">error</span>}
      {toast.message}
    </motion.button>
  );
}
