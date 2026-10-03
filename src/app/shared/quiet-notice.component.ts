import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** A small line for a part of a page that could not be loaded, with a way to try again. It is
 *  quiet on purpose: the rest of the page is still true, and the line only says what is missing. */
@Component({
  selector: 'app-quiet-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="notice" role="status">
      <span>{{ message() }}</span>
      <button type="button" class="retry" (click)="retry.emit()">{{ actionLabel() }}</button>
    </p>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .notice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-sm);
      }

      .retry {
        padding: 0;
        border: 0;
        background: none;
        color: var(--accent-text);
        font: inherit;
        font-weight: var(--fw-semibold);
        text-decoration: underline;
        cursor: pointer;
      }

      .retry:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    `
  ]
})
export class QuietNoticeComponent {
  readonly message = input.required<string>();
  readonly actionLabel = input('Retry');
  readonly retry = output<void>();
}
