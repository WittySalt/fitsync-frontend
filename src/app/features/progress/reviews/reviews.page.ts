import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { UserTimezoneService } from '../../../core/user-timezone.service';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { WeeklyReview } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';
import { ReviewItemComponent } from './review-item.component';

/** Weekly reviews: the last eight weeks, newest first, with the current week marked "so far". */
@Component({
  selector: 'app-reviews-page',
  imports: [ReviewItemComponent, RouterLink, StatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="reviews-page">
      <a class="back" routerLink="/progress" [queryParams]="{ section: 'reviews' }">‹ Progress</a>
      <header>
        <span class="eyebrow">Progress</span>
        <h1>Weekly reviews</h1>
        <p>Your coach looks back at each week, Monday to Sunday.</p>
      </header>
      @if (loading()) {
        <div class="skeleton list-skeleton" aria-busy="true" aria-label="Loading your weekly reviews"></div>
      } @else if (failed()) {
        <app-state-panel title="The reviews could not be loaded" message="Nothing is lost. Try again in a moment." actionLabel="Try again" [error]="true" (action)="load()" />
      } @else if (reviews().length) {
        <ol class="list">
          @for (review of reviews(); track review.weekStart) {
            <li><app-review-item [review]="review" [today]="today" /></li>
          }
        </ol>
      } @else {
        <app-state-panel title="Not enough data yet" message="The first review is written once a week has enough to say." />
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .reviews-page { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-4); }
    .back { width: fit-content; font-size: var(--text-sm); font-weight: 600; color: var(--accent-text); text-decoration: none; }
    header { display: flex; flex-direction: column; gap: var(--space-1); }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-text); }
    h1 { margin: 0; font: 600 30px/1.2 var(--font-display); color: var(--text-primary); }
    p { margin: 0; font-size: 13px; color: var(--text-secondary); }
    .list { list-style: none; margin: 0; padding: 6px 22px; border-radius: 22px; background: var(--surface); border: 1px solid var(--border); }
    .list li + li { border-top: 1px solid var(--border); }
    .list-skeleton { height: 280px; border-radius: 22px; }
  `
})
export class ReviewsPage implements OnInit {
  private readonly api = inject(ProgressApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly today = inject(UserTimezoneService).dateKey();
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly reviews = signal<WeeklyReview[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api
      .getReviews(8)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reviews) => {
          this.reviews.set(reviews);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        }
      });
  }
}
