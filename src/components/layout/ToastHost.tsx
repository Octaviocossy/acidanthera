import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/toast-store';

/**
 * Bottom-center overlay rendering the toast stack (save feedback, #27). Monochrome per the
 * accent discipline (doc/v0-spec.md §5.6): tones differ only by border weight + a tracked-caps
 * tag — no color. Fades only (motion tokens); click a toast to dismiss it early.
 */
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-md border bg-surface px-3 py-1.5 font-mono text-sm text-text',
            'animate-[toast-in_var(--dur)_var(--ease)] transition-opacity duration-[var(--dur)] ease-orbit',
            toast.tone === 'error' ? 'border-border-active' : 'border-border-hairline',
            toast.leaving && 'opacity-0'
          )}
        >
          {toast.tone === 'error' && <span className="text-text-dim text-xs uppercase tracking-caps">error</span>}
          {toast.message}
        </button>
      ))}
    </div>
  );
}
