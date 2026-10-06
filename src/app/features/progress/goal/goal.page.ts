import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { UserTimezoneService } from '../../../core/user-timezone.service';
import { shortDateLabel } from '../../../shared/date-label';
import { ContentsRailComponent } from '../../../shared/progress/contents-rail.component';
import { DetailHeadComponent } from '../../../shared/progress/detail-head.component';
import { DetailLayoutComponent } from '../../../shared/progress/detail-layout.component';
import { DetailSectionComponent } from '../../../shared/progress/detail-section.component';
import { HighlightsComponent } from '../../../shared/progress/highlights.component';
import { InkSwitchComponent } from '../../../shared/progress/ink-switch.component';
import { daysBetween, formatNumber, lastDays, periodEyebrow } from '../../../shared/progress/progress-format';
import { JumpItem, ProgressCardContext } from '../../../shared/progress/progress.models';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { GoalProgress } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';
import { shownData, useLoad, usePeriod } from '../training/training-load';
import { PERIODS } from '../training/training-period';
import { GoalBodySectionComponent } from './goal-body-section.component';
import { PACE_ASK, bodySentence, goalHeroStats, goalSentence, goalVerdict, paceSentence, weightAsk, weightSentence } from './goal-figures';
import { GoalOtherGoalsComponent } from './goal-other-goals.component';
import { GoalWeightChartComponent } from './goal-weight-chart.component';
import { PaceChartComponent } from './pace-chart.component';
import { markVisit } from '../../../core/guide/guide.service';

/** The weight chart's ranges. "All" asks for the longest period the server allows. */
export const WEIGHT_RANGES = [
  { key: '3m', label: '3 months', days: 91 },
  { key: '6m', label: '6 months', days: 182 },
  { key: '1y', label: '1 year', days: 365 },
  { key: 'all', label: 'All', days: 370 }
] as const;

type RangeKey = (typeof WEIGHT_RANGES)[number]['key'];

/** The sections of the page, in order, as the contents rail lists them. */
export const GOAL_SECTIONS: readonly JumpItem[] = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'weight', label: 'Weight' },
  { id: 'body', label: 'Body' },
  { id: 'pace', label: 'Pace' },
  { id: 'other-goals', label: 'Other goals' }
];

/**
 * The Goal page (board 20c): the verdict and the four figures, then Highlights, the weight chart
 * with the date worked out from the pace, body measurements, the food log against the scale, and the
 * other goals. Goals are shown here and changed on Me.
 */
@Component({
  selector: 'app-goal-page',
  imports: [
    ContentsRailComponent,
    DetailHeadComponent,
    DetailLayoutComponent,
    DetailSectionComponent,
    GoalBodySectionComponent,
    GoalOtherGoalsComponent,
    GoalWeightChartComponent,
    HighlightsComponent,
    InkSwitchComponent,
    PaceChartComponent,
    StatePanelComponent
  ],
  templateUrl: './goal.page.html',
  styleUrl: './goal.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GoalPage {
  private readonly visit = markVisit('progress-goal');
  private readonly api = inject(ProgressApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  protected readonly periodOptions = PERIODS.map((option) => ({ value: option.code, label: option.label }));
  protected readonly rangeOptions = WEIGHT_RANGES.map((range) => ({ value: range.key, label: range.label }));
  protected readonly sections = GOAL_SECTIONS;
  readonly today = inject(UserTimezoneService).dateKey();
  /** The page's period: the head's figures, highlights, body, pace and other goals all read this window. */
  readonly period = usePeriod();
  private readonly read = useLoad(this.period.range, (range) => this.api.getGoal(range.from, range.to), 'The goal could not load.');
  /** The weight chart's own range; it never changes the figures above it. */
  readonly range = signal<RangeKey>('3m');
  private readonly weightRead = signal<GoalProgress['weight'] | null>(null);
  readonly loading = computed(() => this.read.state().status === 'loading');
  readonly failed = computed(() => this.read.state().status === 'error');
  readonly data = computed(() => shownData(this.read.state()));
  private scrolledToFragment = false;

  /** The weight series for the chart: the chart range's own read, else the page read's. */
  readonly weight = computed(() => this.weightRead() ?? this.data()?.weight ?? null);
  readonly weightWindow = computed(() => lastDays(WEIGHT_RANGES.find((r) => r.key === this.range())!.days, this.today));
  readonly context = computed<ProgressCardContext>(() => ({ kind: 'GOAL', ...this.period.range() }));
  readonly eyebrow = computed(() => periodEyebrow('Goal', this.period.code(), this.period.range().from, this.period.range().to));
  private readonly span = computed(() => ({ '4w': ['4 weeks', 'four weeks'], '3m': ['3 months', 'three months'], '1y': ['the year', 'the year'] })[this.period.code()]);
  readonly verdict = computed(() => {
    const data = this.data();
    return data ? goalVerdict(data, this.today) : { text: '', tone: 'ink' as const };
  });
  readonly sentence = computed(() => {
    const data = this.data();
    return data ? goalSentence(data, this.span()[1]) : '';
  });
  readonly stats = computed(() => {
    const data = this.data();
    return data ? goalHeroStats(data, this.span()[0]) : [];
  });
  readonly weightLine = computed(() => {
    const data = this.data();
    return data ? weightSentence(data) : '';
  });
  readonly bodyLine = computed(() => {
    const data = this.data();
    return data ? bodySentence(data.body) : '';
  });
  readonly paceLine = computed(() => {
    const data = this.data();
    return data ? paceSentence(data) : '';
  });
  protected readonly paceAsk = PACE_ASK;
  /** The window the Other goals section names, which its strips cover exactly. */
  readonly otherWindow = computed(() => this.period.range());

  /** "How the date is worked out", from the figures the page shows; Ask puts it in the composer. */
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
  protected readonly weightPrompt = computed(() => weightAsk(this.method()));

  constructor() {
    // The chart's range is its own read; only its weight series is used.
    effect((onCleanup) => {
      const { from, to } = this.weightWindow();
      const sub = this.api.getGoal(from, to).subscribe({
        next: (goal) => untracked(() => this.weightRead.set(goal.weight)),
        error: () => untracked(() => this.weightRead.set(null))
      });
      onCleanup(() => sub.unsubscribe());
    });
    effect(() => {
      if (this.data()) {
        untracked(() => this.scrollToFragment());
      }
    });
  }

  chooseRange(key: string): void {
    const next = WEIGHT_RANGES.find((range) => range.key === key)?.key;
    if (next) {
      this.range.set(next);
    }
  }

  choosePeriod(code: string): void {
    const option = PERIODS.find((period) => period.code === code);
    if (option) {
      this.period.select(option.code);
    }
  }

  load(): void {
    this.read.retry();
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
