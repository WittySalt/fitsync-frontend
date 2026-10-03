import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { dateRangeLabel } from '../../../shared/date-label';
import { WeeklyReview } from '../progress-api.models';

/** True for the week still under way, whose review is written "so far". */
export function isSoFar(review: WeeklyReview, today: string): boolean {
  return review.current || review.weekEnd >= today;
}

/** One weekly review: its week, a "so far" badge on the current week, its headline and body. */
@Component({
  selector: 'app-review-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="review" [class.current]="soFar()">
      <span class="dot" aria-hidden="true"></span>
      <div class="text">
        <span class="week">
          {{ week() }}
          @if (soFar()) {
            <span class="badge">so far</span>
          }
        </span>
        @if (review().status === 'READY') {
          @if (review().headline) {
            <strong>{{ review().headline }}</strong>
          }
          @if (review().body) {
            <p>{{ review().body }}</p>
          }
        } @else if (review().status === 'WRITING') {
          <p class="quiet" aria-live="polite">The review is being written.</p>
        } @else {
          <p class="quiet">Not enough happened this week for a review.</p>
        }
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .review { display: flex; gap: 12px; padding: 12px 0; }
    .dot { flex: none; width: 10px; height: 10px; margin-top: 5px; box-sizing: border-box; border-radius: 50%; border: 2px solid var(--accent-subtle); }
    .current .dot { background: var(--accent); border-color: var(--accent); }
    .text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .week { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-xs); color: var(--text-secondary); }
    .badge { padding: 1px 7px; border-radius: var(--radius-full); background: var(--accent-subtle); color: var(--accent-text); font-size: 11px; font-weight: 700; }
    strong { font-size: var(--text-sm); color: var(--text-primary); }
    p { margin: 0; font-size: var(--text-sm); line-height: 1.5; color: var(--text-primary); }
    .quiet { color: var(--text-secondary); }
  `
})
export class ReviewItemComponent {
  readonly review = input.required<WeeklyReview>();
  readonly today = input.required<string>();

  protected readonly soFar = computed(() => isSoFar(this.review(), this.today()));
  protected readonly week = computed(() => dateRangeLabel(this.review().weekStart, this.review().weekEnd));
}
