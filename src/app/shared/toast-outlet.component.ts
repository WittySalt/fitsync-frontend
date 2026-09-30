import { Component, inject } from '@angular/core';

import { ToastService } from '../core/toast/toast.service';

@Component({
  selector: 'app-toast-outlet',
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast"
          [class.success]="toast.type === 'success'"
          [class.error]="toast.type === 'error'"
          [attr.role]="toast.type === 'error' ? 'alert' : 'status'"
        >
          <span class="toast-dot" aria-hidden="true"></span>
          <span class="toast-msg">{{ toast.message }}</span>
          <button type="button" class="toast-close" aria-label="Dismiss notification" (click)="toastService.dismiss(toast.id)">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="m12 10.6 5-5 1.4 1.4-5 5 5 5L17 18.4l-5-5-5 5L5.6 17l5-5-5-5L7 5.6l5 5Z" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: var(--z-toast, 1400);
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: min(360px, calc(100vw - 32px));
        pointer-events: none;
      }

      /* Below the sidebar breakpoint the bottom navigation and the floating coach button are on
         screen, so the stack sits above them. */
      @media (max-width: 860px) {
        .toast-stack {
          bottom: 144px;
        }
      }

      .toast {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 12px 12px 14px;
        border-radius: var(--radius-md);
        background: var(--surface-raised, var(--surface));
        border: 1px solid var(--border);
        box-shadow: var(--shadow-lg);
        color: var(--text-primary);
        pointer-events: auto;
        animation: toast-in var(--dur-base, 200ms) var(--ease-out, ease) both;
      }

      .toast-dot {
        flex: 0 0 auto;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--text-muted);
      }

      .toast.success .toast-dot {
        background: var(--accent);
      }

      .toast.error .toast-dot {
        background: var(--danger);
      }

      .toast-msg {
        flex: 1;
        min-width: 0;
        font-size: 14px;
        line-height: 1.4;
      }

      .toast-close {
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 0;
        border-radius: var(--radius-sm, 6px);
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
      }

      .toast-close:hover {
        background: var(--surface-sunken);
        color: var(--text-primary);
      }

      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .toast {
          animation: none;
        }
      }
    `
  ]
})
export class ToastOutletComponent {
  protected readonly toastService = inject(ToastService);
}
