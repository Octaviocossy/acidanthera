import { create } from 'zustand';

/** Visual tone of a toast — monochrome per the accent discipline (doc/v0-spec.md §5.6). */
export type ToastTone = 'info' | 'error';

/** A transient feedback line rendered by `ToastHost` (#27). */
export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

/** How long a toast stays before it leaves. */
const INFO_DURATION_MS = 2000;
const ERROR_DURATION_MS = 6000;

let nextToastId = 1;

interface ToastState {
  toasts: Toast[];

  /** Shows an auto-dismissing toast. Errors linger longer than info so they can be read. */
  showToast: (message: string, tone?: ToastTone) => void;
  /** Removes the toast at once. `ToastHost` keeps it on screen, inert, through its exit phase
   *  (invariant 60), so the store never waits on an animation. Idempotent. */
  dismissToast: (id: number) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (message, tone = 'info') => {
    const id = nextToastId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    window.setTimeout(() => get().dismissToast(id), tone === 'error' ? ERROR_DURATION_MS : INFO_DURATION_MS);
  },

  dismissToast: (id) => {
    if (!get().toasts.some((toast) => toast.id === id)) return;
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
