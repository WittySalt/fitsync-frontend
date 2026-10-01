import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

/** A button on a toast, such as Undo. Running it also dismisses the toast. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

/**
 * App-wide transient feedback. Pages call success()/error()/info() after a mutation;
 * the single <app-toast-outlet> in the app shell renders the stack.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  success(message: string, durationMs = 4000, action?: ToastAction): void {
    this.show(message, 'success', durationMs, action);
  }

  error(message: string, durationMs = 6000): void {
    this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs = 4000): void {
    this.show(message, 'info', durationMs);
  }

  show(message: string, type: ToastType = 'info', durationMs = 4000, action?: ToastAction): void {
    if (!message) {
      return;
    }
    const id = ++this.nextId;
    this.toasts.update((list) => [...list, { id, message, type, ...(action ? { action } : {}) }]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
  }

  /** Runs a toast's action and takes the toast away. */
  runAction(id: number): void {
    const action = this.toasts().find((toast) => toast.id === id)?.action;
    this.dismiss(id);
    action?.run();
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}
