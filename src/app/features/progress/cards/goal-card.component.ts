import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { shortDateLabel } from '../../../shared/date-label';
import { formatNumber, signed } from '../../../shared/progress/progress-format';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { SectionCardComponent } from '../../../shared/progress/section-card.component';
import { SummaryLinesComponent } from '../../../shared/progress/summary-lines.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { goalSummaryContext, goalSummaryLines, goalTitle, hasWeight } from '../goal/goal-figures';
import { GoalWeightChartComponent } from '../goal/goal-weight-chart.component';
import { GoalProgress } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';

/**
 * The Goal card on Progress (board 19c): the latest weigh-in, the weight chart with the goal and the
 * pace carried forward, and three lines. The whole card opens the Goal page.
 */
@Component({
  selector: 'app-goal-card',
  imports: [GoalWeightChartComponent, RouterLink, SectionCardComponent, StatePanelComponent, SummaryLinesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-section-card title="Goal" [sub]="sub()" link="/progress/goal" [context]="context()" [factNumber]="factNumber()" [ringed]="ringed()">
      @if (loading()) {
        <div class="skeleton" aria-busy="true" aria-label="Loading your goal"></div>
      } @else if (failed()) {
        <app-state-panel title="Your goal could not be loaded" message="Nothing is lost. Try again in a moment." actionLabel="Try again" [error]="true" (action)="load()" />
      } @else if (data(); as goal) {
        @if (hasWeight(goal)) {
          <div class="headline">
            <div class="row">
              <strong class="big">{{ nowText(goal) }}</strong>
              @if (goal.hero.changeKg !== null) {
                <span class="change">{{ signedKg(goal.hero.changeKg) }} kg in 4 weeks</span>
              }
            </div>
            @if (lastWeighIn(goal); as day) {
              <span class="quiet">Your weigh-in on {{ day }}</span>
            }
          </div>
          <app-goal-weight-chart [weight]="goal.weight" [goal]="goal.goal" [today]="period().to" [height]="190" [cardView]="true" />
          <app-summary-lines [lines]="lines()" [context]="summaryContext()" />
        } @else {
          <p class="empty">Not enough data yet. Log a weigh-in and your weight shows here against your goal.</p>
        }
        @if (!goal.goal) {
          <a class="set" routerLink="/me" fragment="goal-lifecycle">Set a weight goal in Me ›</a>
        }
      }
    </app-section-card>
  `,
  styles: `
    :host { display: block; }
    .skeleton { height: 260px; border-radius: 16px; }
    .headline { display: flex; flex-direction: column; gap: 2px; }
    .row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .big { font: 600 34px/1.05 var(--font-display); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .change { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
    .quiet, .empty { margin: 0; font-size: var(--text-xs); color: var(--text-secondary); }
    .empty { font-size: 13px; }
    .set { font-size: 13px; font-weight: 700; color: var(--accent-text); text-decoration: none; width: fit-content; }
  `
})
export class GoalCardComponent implements OnInit {
  private readonly api = inject(ProgressApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** The days the chart reads, about three months to today. */
  readonly period = input.required<{ from: string; to: string }>();
  /** The four weeks the Ask button sends, the period the summary describes. */
  readonly askPeriod = input.required<{ from: string; to: string }>();
  readonly factNumber = input<number | null>(null);
  readonly ringed = input(false);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly data = signal<GoalProgress | null>(null);

  protected readonly context = computed<ProgressCardContext>(() => ({ kind: 'GOAL', ...this.askPeriod() }));
  protected readonly lines = computed(() => {
    const data = this.data();
    return data ? goalSummaryLines(data) : [];
  });
  protected readonly summaryContext = computed(() => {
    const data = this.data();
    return data ? goalSummaryContext(data) : '';
  });
  protected readonly sub = computed(() => {
    const data = this.data();
    if (!data?.goal) {
      return '';
    }
    const left = data.hero.daysLeft;
    return left === null ? goalTitle(data) : `${goalTitle(data)} · ${left} days left`;
  });
  protected readonly hasWeight = hasWeight;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const { from, to } = this.period();
    this.loading.set(true);
    this.failed.set(false);
    this.api
      .getGoal(from, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (goal) => {
          this.data.set(goal);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        }
      });
  }

  protected nowText(goal: GoalProgress): string {
    const now = goal.hero.nowKg ?? goal.weight.daily.at(-1)?.kg ?? goal.weight.weekly.at(-1)?.avgKg ?? null;
    return now === null ? '–' : `${formatNumber(now, 1)} kg`;
  }

  protected signedKg(value: number): string {
    return signed(value);
  }

  protected lastWeighIn(goal: GoalProgress): string {
    const last = goal.weight.daily.at(-1)?.date;
    return last ? shortDateLabel(last) : '';
  }
}
