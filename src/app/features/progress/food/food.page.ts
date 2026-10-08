import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { nutrientsDays } from './food-nutrients-range';

import { shortDateLabel } from '../../../shared/date-label';
import { ContentsRailComponent } from '../../../shared/progress/contents-rail.component';
import { DetailHeadComponent } from '../../../shared/progress/detail-head.component';
import { DetailLayoutComponent } from '../../../shared/progress/detail-layout.component';
import { DetailSectionComponent } from '../../../shared/progress/detail-section.component';
import { HighlightsComponent } from '../../../shared/progress/highlights.component';
import { useFragmentScroll } from '../../../shared/progress/fragment-scroll';
import { InkSwitchComponent } from '../../../shared/progress/ink-switch.component';
import { lastDays, periodEyebrow } from '../../../shared/progress/progress-format';
import { monthName } from '../../../shared/progress/chart-axis';
import { JumpItem, ProgressCardContext, SeriesPoint, WeekBar } from '../../../shared/progress/progress.models';
import { SmallTrendComponent } from '../../../shared/progress/small-trend.component';
import { WeekBarsComponent } from '../../../shared/progress/week-bars.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { NutrientsOverview } from '../../nutrition/nutrients/nutrients.models';
import { NutrientsService } from '../../nutrition/nutrients/nutrients.service';
import { EnergyBarsComponent } from '../energy/energy-bars.component';
import { EnergyDaysComponent } from '../energy/energy-days.component';
import { FoodGranularity, MacroTrend } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';
import { PERIODS } from '../training/training-period';
import { shownData, useLoad, usePeriod } from '../training/training-load';
import { useBarsWeek } from '../cards/bars-week';
import { ENERGY_ASK, barsHeadline, monthSlots, foodHeroStats, foodSentence, foodVerdict, macroAsk, macroSentence, highlightsWithOverview } from './food-figures';
import { FoodMealsSectionComponent } from './food-meals-section.component';
import { FoodNutrientsSectionComponent } from './food-nutrients-section.component';
import { FoodPlateSectionComponent } from './food-plate-section.component';
import { markVisit } from '../../../core/guide/guide.service';

/** The sections of the page, in order, as the contents rail lists them. */
export const FOOD_SECTIONS: readonly JumpItem[] = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'energy', label: 'Energy' },
  { id: 'macros', label: 'Macros' },
  { id: 'plate', label: 'Plate' },
  { id: 'meals', label: 'Meals' },
  { id: 'nutrients', label: 'Nutrients' },
  { id: 'habits', label: 'Habits' }
];

interface MacroTile {
  name: string;
  points: SeriesPoint[];
  target: number | null;
}

/**
 * The Food page (board 20c's system): the verdict and four figures against the period before,
 * Highlights, this week's energy and the balance week by week, macros against their goals, the
 * plate, meals, and nutrients with habits. Analytics carries the page; nutrition's part fills Meals
 * and Nutrients. The period lives in the address as ?period=.
 */
@Component({
  selector: 'app-food-page',
  imports: [
    RouterLink,
    ContentsRailComponent,
    DetailHeadComponent,
    DetailLayoutComponent,
    DetailSectionComponent,
    EnergyBarsComponent,
    EnergyDaysComponent,
    FoodMealsSectionComponent,
    FoodNutrientsSectionComponent,
    FoodPlateSectionComponent,
    HighlightsComponent,
    InkSwitchComponent,
    SmallTrendComponent,
    StatePanelComponent,
    WeekBarsComponent
  ],
  templateUrl: './food.page.html',
  styleUrl: './food.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FoodPage {
  // Kept for its side effect: marks the page visited for the guide.
  private readonly visit = markVisit('progress-food');
  private readonly api = inject(ProgressApiService);
  private readonly nutrientsApi = inject(NutrientsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  /** The nutrient a door on a nutrient page asked for (?nutrient=), shown first in Nutrients. */
  protected readonly focus = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('nutrient'))), { initialValue: this.route.snapshot.queryParamMap.get('nutrient') });

  protected readonly periodOptions = PERIODS.map((option) => ({ value: option.code, label: option.label }));
  protected readonly sections = FOOD_SECTIONS;
  protected readonly energyAsk = ENERGY_ASK;
  readonly period = usePeriod();
  readonly today = this.period.today();
  readonly nutrients = signal<NutrientsOverview | null>(null);
  /** The days the Nutrients section covers: 30 for four weeks, 90 for three months and for a year. */
  protected readonly nutrientRange = computed(() => nutrientsDays(this.period.code()));
  /** The calorie goal's target, which the head judges the period against; null while unknown or unset. */
  protected readonly calorieTarget = toSignal(
    toObservable(this.period.range).pipe(
      switchMap(({ from, to }) =>
        this.api.getGoal(from, to).pipe(
          map((goal) => goal.otherGoals.find((item) => item.type === 'CALORIES')?.target ?? null),
          catchError(() => of(null))
        )
      )
    ),
    { initialValue: null }
  );
  /** Four weeks reads weeks; three months and a year read calendar months. */
  readonly granularity = computed<FoodGranularity>(() => (this.period.code() === '4w' ? 'week' : 'month'));
  protected readonly monthly = computed(() => this.granularity() === 'month');
  private readonly request = computed(() => ({ ...this.period.range(), granularity: this.granularity() }));
  private readonly read = useLoad(this.request, (request) => this.api.getFood(request.from, request.to, request.granularity), 'Food progress could not load.');
  protected readonly state = this.read.state;

  readonly loading = computed(() => this.state().status === 'loading');
  readonly failed = computed(() => this.state().status === 'error');
  readonly data = computed(() => shownData(this.state()));
  /** The highlights with the lowest-nutrient card read from the same data as the petals. */
  protected readonly highlights = computed(() => {
    const data = this.data();
    return data ? highlightsWithOverview(data.highlights, this.nutrients(), this.nutrientRange().days) : [];
  });
  // Kept for its side effect: scrolls to the address's #fragment once the data is in.
  private readonly scrollToSection = useFragmentScroll(computed(() => this.data() !== null));

  readonly days = computed(() => {
    const { from, to } = this.period.range();
    // Date-only strings parse as UTC midnight, so no daylight-saving shift creeps into the count.
    return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  });
  readonly context = computed<ProgressCardContext>(() => ({ kind: 'FOOD', ...this.period.range() }));
  readonly eyebrow = computed(() => periodEyebrow('Food', this.period.code(), this.period.range().from, this.period.range().to));
  readonly verdict = computed(() => {
    const data = this.data();
    return data ? foodVerdict(data, this.days(), this.calorieTarget()) : { text: '', tone: 'ink' as const };
  });
  readonly sentence = computed(() => {
    const data = this.data();
    return data ? foodSentence(data, this.days()) : '';
  });
  readonly stats = computed(() => {
    const data = this.data();
    return data ? foodHeroStats(data, this.days(), this.period.option().before, this.barsWeek()) : [];
  });
  /** The week the energy headline reads, the same one the Food card's bars draw. */
  protected readonly barsWeek = useBarsWeek(this.data, computed(() => this.period.range().to));
  readonly headline = computed(() => barsHeadline(this.barsWeek()));
  /** Every month of the period in month mode, so the charts agree about the year; empty in week mode. */
  protected readonly slots = computed(() => (this.monthly() ? monthSlots(this.period.range().from, this.period.range().to) : []));
  readonly balanceBars = computed<WeekBar[]>(() => {
    const weeks = this.data()?.energy.weeklyBalance ?? [];
    const bar = (week: (typeof weeks)[number]): WeekBar => ({
      label: this.monthly() ? monthName(week.weekStart) : shortDateLabel(week.weekStart),
      weekStart: week.weekStart,
      value: week.balance === null ? null : Math.round(week.balance),
      current: week.current
    });
    if (!this.monthly()) {
      return weeks.map(bar);
    }
    const byMonth = new Map(weeks.map((week) => [week.weekStart, week]));
    return this.slots().map((key) => (byMonth.has(key) ? bar(byMonth.get(key) as (typeof weeks)[number]) : { label: monthName(key), weekStart: key, value: null }));
  });
  readonly energyLine = computed(() => {
    const weeks = (this.data()?.energy.weeklyBalance ?? []).filter((week) => week.balance !== null);
    if (!weeks.length) {
      return 'Eaten against what you used, once a few days are logged.';
    }
    const under = weeks.filter((week) => (week.balance ?? 0) < 0).length;
    return this.granularity() === 'month'
      ? `Under what you used in ${under} of ${weeks.length} months, logged days only.`
      : `Under what you used on ${under} of ${weeks.length} weeks, logged days only.`;
  });
  readonly macroTiles = computed<MacroTile[]>(() => {
    const macros = this.data()?.macros;
    const tile = (name: string, macro: MacroTrend | null): MacroTile => ({
      name,
      points: (macro?.series ?? []).filter((point) => !this.monthly() || this.slots().includes(point.weekStart)).map((point) => ({ label: point.weekStart, value: point.value })),
      target: macro?.target ?? null
    });
    return macros ? [tile('Protein', macros.protein), tile('Carbs', macros.carbs), tile('Fat', macros.fat)] : [];
  });
  protected readonly macroLine = computed(() => {
    const data = this.data();
    return data ? macroSentence(data.macros) : '';
  });
  protected readonly macroPrompt = computed(() => {
    const data = this.data();
    return data ? macroAsk(data.macros, this.granularity()) : '';
  });
  /** What the plate section calls the two periods it compares. */
  protected readonly nowTitle = computed(() => `The last ${this.period.option().label}`);
  protected readonly beforeTitle = computed(() => this.period.option().before.replace(/^the/, 'The'));

  constructor() {
    // The petals follow the page's period; the server keeps at most 90 days.
    toObservable(this.nutrientRange)
      .pipe(
        switchMap(({ days }) =>
          this.nutrientsApi.getAll(lastDays(days, this.today).from, this.today).pipe(catchError(() => of(null)))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((overview) => this.nutrients.set(overview && overview.daysLogged > 0 ? overview : null));
  }

  retry(): void {
    this.read.retry();
  }

  choosePeriod(code: string): void {
    const option = PERIODS.find((period) => period.code === code);
    if (option) {
      this.period.select(option.code);
    }
  }
}
