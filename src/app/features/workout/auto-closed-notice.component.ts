import { Component, computed, input, output } from '@angular/core';

import { WorkoutSession } from '../../core/fitsync.models';

/** HH:mm in the browser's timezone, 24-hour. */
function clock(value: string | null | undefined): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * One quiet line on the Today tab about a workout the server closed by itself, with a way to open
 * it and a way to dismiss the line.
 */
@Component({
  selector: 'app-auto-closed-notice',
  template: `
    <p class="notice" role="status">
      <span class="text">{{ text() }}</span>
      <button class="edit" type="button" (click)="edit.emit()">Edit</button>
      <button class="dismiss" type="button" aria-label="Dismiss this note" (click)="dismissed.emit()">&times;</button>
    </p>
  `,
  styles: `
    :host {
      display: block;
      grid-column: 1 / -1;
      min-width: 0;
    }

    .notice {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      padding: 8px 8px 8px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }

    .text {
      flex: 1 1 auto;
      min-width: 0;
    }

    .edit,
    .dismiss {
      flex: none;
      min-height: 32px;
      border: 0;
      background: transparent;
      font: inherit;
      cursor: pointer;
    }

    .edit {
      padding: 0 6px;
      color: var(--accent-text);
      font-weight: var(--fw-bold);
    }

    .dismiss {
      width: 32px;
      border-radius: var(--radius-full);
      color: var(--text-secondary);
      font-size: 18px;
      line-height: 1;
    }

    .edit:hover,
    .dismiss:hover {
      background: var(--surface);
    }
  `
})
export class AutoClosedNoticeComponent {
  readonly session = input.required<WorkoutSession>();
  readonly edit = output<void>();
  readonly dismissed = output<void>();

  protected readonly text = computed(() => {
    const session = this.session();
    const started = clock(session.startedAt);
    if (session.status === 'COMPLETED') {
      return `Your workout from ${started} was saved at ${clock(session.completedAt)}.`;
    }
    return `Your workout from ${started} was closed with no set logged.`;
  });
}
