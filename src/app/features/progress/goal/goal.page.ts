import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnInit, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { UserTimezoneService } from '../../../core/user-timezone.service';
import { dateRangeLabel, shortDateLabel } from '../../../shared/date-label';
import { HighlightsComponent } from '../../../shared/progress/highlights.component';
import { ProgressHeroComponent } from '../../../shared/progress/progress-hero.component';
import { daysBetween, formatNumber, lastDays } from '../../../shared/progress/progress-format';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { SectionCardComponent } from '../../../shared/progress/section-card.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { GoalProgress } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';
import { GoalBodySectionComponent } from './goal-body-section.component';
import { goalHeroStats, goalTitle } from './goal-figures';
import { GoalOtherGoalsComponent } from './goal-other-goals.component';
import { GoalWeightChartComponent } from './goal-weight-chart.component';
import { PaceChartComponent } from './pace-chart.component';

/** The weight chart's ranges. "All" asks for the longest period the server allows. */
export const WEIGHT_RANGES = [
  { key: '3m', label: '3 months', days: 91 },
  { key: '6m', label: '6 months', days: 182 },
  { key: '1y', label: '1 year', days: 365 },
  { key: 'all', label: 'All', days: 370 }
] as const;

type RangeKey = (typeof WEIGHT_RANGES)[number]['key'];

/**
 * The Goal page (board 19a): the green hero with the weight goal, Highlights, the weight chart with
 * the date worked out from the pace, body measurements, the food log against the scale, and the
 * other goals. Goals are shown here and changed on Me.
 */
@Component({
  selector: 'app-goal-page',
  imports: [
    GoalBodySectionComponent,
    GoalOtherGoalsComponent,
    GoalWeightChartComponent,
    HighlightsComponent,
    PaceChartComponent,
    ProgressHeroComponent,
    SectionCardComponent,
    StatePanelComponent
  ],
  templateUrl: './goal.page.html',
  styleUrl: './goal.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GoalPage implements OnInit {
  private readonly api = inject(ProgressApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly ranges = WEIGHT_RANGES;
  readonly today = inject(UserTimezoneService).dateKey();
  readonly fourWeeks = lastDays(28, this.today);
  readonly range = signal<RangeKey>('3m');
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly data = signal<GoalProgress | null>(null);
  private scrolledToFragment = false;

  readonly period = computed(() => lastDays(WEIGHT_RANGES.find((r) => r.key === this.range())!.days, this.today));
  readonly context = computed<ProgressCardContext>(() => ({ kind: 'GOAL', ...this.fourWeeks }));
  readonly title = computed(() => {
    const data = this.data();
    return data ? goalTitle(data) : 'Your goal';
  });
  readonly stats = computed(() => {
    const data = this.data();
    return data ? goalHeroStats(data) : [];
  });
  readonly weightSub = computed(() => {
    const first = this.data()?.weight.weekly[0]?.weekStart ?? this.period().from;
    return `weekly average over each morning's weigh-in, ${dateRangeLabel(first, this.today)}`;
  });
  readonly paceSub = computed(() => {
    const first = this.data()?.pace.weeks[0]?.weekStart;
    return first ? `the last ${this.data()!.pace.weeks.length} weeks, ${dateRangeLabel(first, this.today)}, change since the start` : 'change since the start';
  });
  readonly otherSub = computed(() => `the last 30 days, ${dateRangeLabel(lastDays(30, this.today).from, this.today)}`);

  /** "How the date is worked out", from the figures the hero shows. */
  readonly method = computed(() => {
    const data = this.data();
    if (!data) {
      return '';
    }
    const rate = data.hero.weeklyRate.value;
    const now = data.hero.nowKg;
    const last = data.weight.daily.at(-1)?.date;
    const projected = data.hero.projectedDate.value;
    const target = data.goal?.targetKg ?? null;
    const lead = data.weight.method ? `${data.weight.method.charAt(0).toUpperCase()}${data.weight.method.slice(1)}.` : '';
    if (rate === null || now === null || !projected || target === null) {
      return lead || 'The date appears once there are four weeks of weigh-ins and a weight goal.';
    }
    const from = last ? ` on ${shortDateLabel(last)}` : '';
    const by = data.goal?.byDate;
    const gap = by ? daysBetween(projected, by) : null;
    const when = gap === null ? '' : gap >= 0 ? `, ${gap} days before your date` : `, ${-gap} days after your date`;
    return `${lead} The average change over the last 28 days, ${formatNumber(Math.abs(rate), 2)} kg a week, is carried forward from ${formatNumber(now, 1)} kg${from}. It reaches ${formatNumber(target, 1)} kg on ${shortDateLabel(projected)}${when}.`.trim();
  });

  ngOnInit(): void {
    this.load();
  }

  chooseRange(key: RangeKey): void {
    if (key !== this.range()) {
      this.range.set(key);
      this.load();
    }
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
          this.scrollToFragment();
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        }
      });
  }

  /** `/progress/goal#other-goals`, where the old Goals tab now leads, scrolls once the page is there. */
  private scrollToFragment(): void {
    const fragment = this.route.snapshot.fragment;
    if (!fragment || this.scrolledToFragment) {
      return;
    }
    this.scrolledToFragment = true;
    afterNextRender(() => document.getElementById(fragment)?.scrollIntoView({ block: 'start' }), { injector: this.injector });
  }
}
