import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The quiet line between two cards: the spark and one sentence from the coach's reading. */
@Component({
  selector: 'app-coach-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="spark" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="currentColor"></path></svg>
    <p>{{ text() }}</p>
  `,
  styles: `
    :host { display: flex; align-items: flex-start; gap: 10px; padding: 0 4px; }
    .spark { flex: none; margin-top: 3px; color: var(--accent); }
    p { margin: 0; font-size: var(--pg-text); line-height: 1.5; color: var(--text-primary); max-width: 72ch; }
  `
})
export class CoachLineComponent {
  readonly text = input.required<string>();
}
