import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { StatePanelComponent } from '../../../shared/state-panel.component';
import { WeeklyReview } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';
import { ReviewItemComponent } from '../reviews/review-item.component';

/** The Reviews card on Progress: the latest weekly review and "Earlier ›" to the list of them. */
@Component({
  selector: 'app-reviews-card',
  imports: [ReviewItemComponent, RouterLink, StatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <header class="head">
        <h2>Weekly reviews</h2>
        <a routerLink="/progress/reviews">Earlier ›</a>
      </header>
      @if (loading()) {
        <div class="skeleton" aria-busy="true" aria-label="Loading your weekly review"></div>
      } @else if (failed()) {
        <app-state-panel title="The reviews could not be loaded" message="Try again in a moment." actionLabel="Try again" [error]="true" (action)="load()" />
      } @else if (latest(); as review) {
        <app-review-item [review]="review" [today]="today()" />
      } @else {
        <p class="empty">Not enough data yet. The first review is written once a week has enough to say.</p>
      }
    </article>
  `,
  styles: `
    :host { display: block; scroll-margin-top: 64px; }
    .card { display: flex; flex-direction: column; gap: 6px; padding: 22px; border-radius: 22px; background: var(--surface); border: 1px solid var(--border); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h2 { margin: 0; font-size: 17px; color: var(--text-primary); }
    a { font-size: 13px; font-weight: 600; color: var(--accent-text); text-decoration: none; }
    a:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; }
    .skeleton { height: 72px; border-radius: 14px; }
    .empty { margin: 0; font-size: 13px; color: var(--text-secondary); }
    @media (max-width: 640px) { .card { padding: 18px; } }
  `
})
export class ReviewsCardComponent implements OnInit {
  private readonly api = inject(ProgressApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly today = input.required<string>();

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly reviews = signal<WeeklyReview[]>([]);

  /** The newest week that has something to show; a week with nothing to say is passed over. */
  protected readonly latest = computed(() => this.reviews().find((review) => review.status !== 'NONE') ?? null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api
      .getReviews(3)
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
