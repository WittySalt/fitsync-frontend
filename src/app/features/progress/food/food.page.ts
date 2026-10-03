import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { shortDateLabel } from '../../../shared/date-label';
import { ContentsRailComponent } from '../../../shared/progress/contents-rail.component';
import { DetailHeadComponent } from '../../../shared/progress/detail-head.component';
import { DetailLayoutComponent } from '../../../shared/progress/detail-layout.component';
import { DetailSectionComponent } from '../../../shared/progress/detail-section.component';
import { HighlightsComponent } from '../../../shared/progress/highlights.component';
import { InkSwitchComponent } from '../../../shared/progress/ink-switch.component';
import { lastDays, periodEyebrow } from '../../../shared/progress/progress-format';
import { JumpItem, ProgressCardContext, SeriesPoint, WeekBar } from '../../../shared/progress/progress.models';
import { SmallTrendComponent } from '../../../shared/progress/small-trend.component';
import { WeekBarsComponent } from '../../../shared/progress/week-bars.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { NutrientsOverview } from '../../nutrition/nutrients/nutrients.models';
import { NutrientsService } from '../../nutrition/nutrients/nutrients.service';
import { EnergyBarsComponent } from '../energy/energy-bars.component';
import { EnergyDaysComponent } from '../energy/energy-days.component';
import { MacroTrend } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';
import { PERIODS } from '../training/training-period';
import { shownData, useLoad, usePeriod } from '../training/training-load';
import { ENERGY_ASK, balanceHeadline, foodHeroStats, foodSentence, foodVerdict, macroAsk, macroSentence } from './food-figures';
import { FoodMealsSectionComponent } from './food-meals-section.component';
import { FoodNutrientsSectionComponent } from './food-nutrients-section.component';
import { FoodPlateSectionComponent } from './food-plate-section.component';

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
  private readonly api = inject(ProgressApiService);
  private readonly nutrientsApi = inject(NutrientsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly periodOptions = PERIODS.map((option) => ({ value: option.code, label: option.label }));
  protected readonly sections = FOOD_SECTIONS;
  protected readonly energyAsk = ENERGY_ASK;
  readonly period = usePeriod();
  readonly today = this.period.today();
  readonly nutrients = signal<NutrientsOverview | null>(null);
  private readonly read = useLoad(this.period.range, (range) => this.api.getFood(range.from, range.to), 'Food progress could not load.');
  protected readonly state = this.read.state;

  readonly loading = computed(() => this.state().status === 'loading');
  readonly failed = computed(() => this.state().status === 'error');
  readonly data = computed(() => shownData(this.state()));

  readonly days = computed(() => {
    const { from, to } = this.period.range();
    return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  });
  readonly context = computed<ProgressCardContext>(() => ({ kind: 'FOOD', ...this.period.range() }));
  readonly eyebrow = computed(() => periodEyebrow('Food', this.period.code(), this.period.range().from, this.period.range().to));
  readonly verdict = computed(() => {
    const data = this.data();
    return data ? foodVerdict(data, this.days()) : { text: '', tone: 'ink' as const };
  });
  readonly sentence = computed(() => {
    const data = this.data();
    return data ? foodSentence(data, this.days()) : '';
  });
  readonly stats = computed(() => {
    const data = this.data();
    return data ? foodHeroStats(data, this.days(), this.period.option().before) : [];
  });
  readonly headline = computed(() => balanceHeadline(this.data()?.hero.balancePerDay.value ?? null));
  readonly balanceBars = computed<WeekBar[]>(() =>
    (this.data()?.energy.weeklyBalance ?? []).map((week) => ({
      label: shortDateLabel(week.weekStart),
      weekStart: week.weekStart,
      value: week.balance === null ? null : Math.round(week.balance),
      current: week.current
    }))
  );
  readonly energyLine = computed(() => {
    const weeks = (this.data()?.energy.weeklyBalance ?? []).filter((week) => week.balance !== null);
    if (!weeks.length) {
      return 'Eaten against what you used, once a few days are logged.';
    }
    const under = weeks.filter((week) => (week.balance ?? 0) < 0).length;
    return `Under what you used on ${under} of ${weeks.length} weeks, logged days only.`;
  });
  readonly macroTiles = computed<MacroTile[]>(() => {
    const macros = this.data()?.macros;
    const tile = (name: string, macro: MacroTrend | null): MacroTile => ({
      name,
      points: (macro?.series ?? []).map((point) => ({ label: point.weekStart, value: point.value })),
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
    return data ? macroAsk(data.macros) : '';
  });
  /** What the plate section calls the two periods it compares. */
  protected readonly nowTitle = computed(() => `The last ${this.period.option().label}`);
  protected readonly beforeTitle = computed(() => this.period.option().before.replace(/^the/, 'The'));

  constructor() {
    // The nutrient summary keeps 31 days at most, so the petals always show the last 30.
    const petals = lastDays(30, this.today);
    this.nutrientsApi
      .getAll(petals.from, petals.to)
      .pipe(
        catchError(() => of(null)),
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
