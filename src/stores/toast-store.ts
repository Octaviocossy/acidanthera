import { create } from 'zustand';

/** Visual tone of a toast — monochrome per the accent discipline (doc/v0-spec.md §5.6). */
export type ToastTone = 'info' | 'error';

/** A transient feedback line rendered by `ToastHost` (#27). */
export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** True while the exit fade runs — the toast is removed once the fade completes. */
  leaving: boolean;
}

/** How long a toast stays fully visible before its exit fade starts. */
const INFO_DURATION_MS = 2000;
const ERROR_DURATION_MS = 6000;
/** Exit-fade length — mirrors the motion token `--dur` (160ms, fades only). */
const FADE_MS = 160;

let nextToastId = 1;

interface ToastState {
  toasts: Toast[];

  /** Shows an auto-dismissing toast. Errors linger longer than info so they can be read. */
  showToast: (message: string, tone?: ToastTone) => void;
  /** Starts the exit fade and removes the toast once it completes. Idempotent. */
  dismissToast: (id: number) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (message, tone = 'info') => {
    const id = nextToastId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone, leaving: false }] }));
    window.setTimeout(() => get().dismissToast(id), tone === 'error' ? ERROR_DURATION_MS : INFO_DURATION_MS);
  },

  dismissToast: (id) => {
    if (!get().toasts.some((toast) => toast.id === id && !toast.leaving)) return;
    set((state) => ({ toasts: state.toasts.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)) }));
    window.setTimeout(() => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })), FADE_MS);
  },
}));
