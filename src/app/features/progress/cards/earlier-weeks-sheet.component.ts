import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, input, output, viewChild } from '@angular/core';

import { UserTimezoneService } from '../../../core/user-timezone.service';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { WeeklyReview } from '../progress-api.models';
import { ReviewItemComponent } from '../reviews/review-item.component';
import { reviewChips } from './page-head';

/**
 * The earlier weeks (spec 1.2): the last eight reviews, each with its facts as chips. A dialog on
 * computers and a bottom sheet on phones; Escape and the scrim close it.
 */
@Component({
  selector: 'app-earlier-weeks-sheet',
  imports: [ReviewItemComponent, StatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <button type="button" class="scrim" tabindex="-1" aria-hidden="true" (click)="closed.emit()"></button>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="earlier-weeks-title">
      <header class="top">
        <h2 id="earlier-weeks-title">Earlier weeks</h2>
        <button #close type="button" class="close" (click)="closed.emit()">Close</button>
      </header>
      <div class="scroll">
        @if (loading()) {
          <div class="skeleton" aria-busy="true" aria-label="Loading your weekly reviews"></div>
        } @else if (failed()) {
          <app-state-panel title="The reviews could not be loaded" message="Nothing is lost. Try again in a moment." actionLabel="Try again" [error]="true" (action)="retry.emit()" />
        } @else if (reviews().length) {
          <ol>
            @for (review of reviews(); track review.weekStart) {
              <li>
                <app-review-item [review]="review" [today]="today" />
                @if (chipsOf(review).length) {
                  <ul class="chips">
                    @for (chip of chipsOf(review); track chip.key) {
                      <li>{{ chip.label }} <strong>{{ chip.figure }}</strong></li>
                    }
                  </ul>
                }
              </li>
            }
          </ol>
        } @else {
          <p class="none">Not enough data yet. The first review is written once a week has enough to say.</p>
        }
      </div>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center; }
    .scrim { position: absolute; inset: 0; padding: 0; border: 0; background: rgba(15, 23, 42, 0.45); cursor: default; }
    .sheet { position: relative; box-sizing: border-box; width: 100%; max-height: 85vh; display: flex; flex-direction: column; border-radius: var(--pg-card-radius) var(--pg-card-radius) 0 0; background: var(--surface); border: 1px solid var(--border); }
    .top { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 12px; }
    h2 { margin: 0; font-size: var(--pg-name); font-weight: 600; color: var(--text-primary); }
    .close { padding: 0; border: 0; background: none; font: inherit; font-size: var(--pg-control); font-weight: 500; color: var(--text-primary); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
    .close:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 3px; border-radius: 4px; }
    .scroll { overflow-y: auto; padding: 0 24px 24px; }
    ol { list-style: none; margin: 0; padding: 0; }
    ol > li + li { border-top: 1px solid var(--border); }
    ol > li { padding: 4px 0 12px; }
    .chips { list-style: none; display: flex; flex-wrap: wrap; gap: 6px 8px; margin: 0 0 0 22px; padding: 0; }
    .chips li { padding: 3px 10px; border: 1px solid var(--border); border-radius: var(--radius-full); font-size: var(--pg-chart); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .chips strong { font-weight: 600; color: var(--text-primary); }
    .none { margin: 0; font-size: var(--pg-text); color: var(--text-secondary); }
    .skeleton { height: 260px; border-radius: 12px; }
    @media (min-width: 768px) {
      :host { align-items: center; }
      .sheet { width: 640px; border-radius: var(--pg-card-radius); }
    }
  `
})
export class EarlierWeeksSheetComponent {
  readonly reviews = input.required<readonly WeeklyReview[]>();
  readonly loading = input(false);
  readonly failed = input(false);
  readonly closed = output<void>();
  readonly retry = output<void>();

  protected readonly today = inject(UserTimezoneService).dateKey();
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('close');

  constructor() {
    afterNextRender(() => this.closeButton()?.nativeElement.focus());
  }

  protected chipsOf(review: WeeklyReview) {
    return reviewChips(review);
  }
}
