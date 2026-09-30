import { Component, input } from '@angular/core';

import { ActionResult } from './admin-action';

/**
 * The line that says what an action did. The live region is always present so that a screen reader
 * announces the text when it appears.
 */
@Component({
  selector: 'app-admin-action-status',
  template: `
    <div class="status-region" role="status">
      @if (result(); as current) {
        <p class="status" [attr.data-kind]="current.kind">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            @if (current.kind === 'success') {
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            } @else {
              <path d="M12 7v6" />
              <path d="M12 17h.01" />
            }
          </svg>
          <span>{{ current.message }}</span>
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .status {
      box-sizing: border-box;
      min-height: 44px;
      margin: 0;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid var(--border-accent);
      border-radius: var(--radius-lg);
      color: var(--accent-text);
      background: var(--accent-subtle);
      font-size: 14px;
      overflow-wrap: anywhere;
    }

    .status[data-kind='error'] {
      border-color: var(--border-strong);
      color: var(--text-primary);
      background: var(--surface-sunken);
    }

    svg {
      width: 18px;
      height: 18px;
      flex: none;
    }
  `
})
export class AdminActionStatusComponent {
  readonly result = input<ActionResult | null>(null);
}
