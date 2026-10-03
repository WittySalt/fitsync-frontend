import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { UserTimezoneService } from '../../../core/user-timezone.service';
import { dateRangeLabel, shortDateLabel } from '../../../shared/date-label';
import { HighlightsComponent } from '../../../shared/progress/highlights.component';
import { ProgressHeroComponent } from '../../../shared/progress/progress-hero.component';
import { lastDays } from '../../../shared/progress/progress-format';
import { ProgressCardContext, SeriesPoint, WeekBar } from '../../../shared/progress/progress.models';
import { SectionCardComponent } from '../../../shared/progress/section-card.component';
import { SmallTrendComponent } from '../../../shared/progress/small-trend.component';
import { SummaryLinesComponent } from '../../../shared/progress/summary-lines.component';
import { WeekBarsComponent } from '../../../shared/progress/week-bars.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { NutrientsOverview } from '../../nutrition/nutrients/nutrients.models';
import { NutrientsService } from '../../nutrition/nutrients/nutrients.service';
import { EnergyBarsComponent } from '../energy/energy-bars.component';
import { EnergyDaysComponent } from '../energy/energy-days.component';
import { FoodProgress, MacroTrend } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';
import { balanceHeadline, foodHeroStats, macroWord } from './food-figures';
import { FoodMealsSectionComponent } from './food-meals-section.component';
import { FoodNutrientsSectionComponent } from './food-nutrients-section.component';
import { FoodPlateSectionComponent } from './food-plate-section.component';

/** The Food page's periods. Every change is compared with the same number of days before. */
export const FOOD_PERIODS = [
  { key: '30d', label: '30 days', days: 30 },
  { key: '3m', label: '3 months', days: 90 },
  { key: '1y', label: '1 year', days: 365 }
] as const;

type PeriodKey = (typeof FOOD_PERIODS)[number]['key'];

interface MacroTile {
  name: string;
  points: SeriesPoint[];
  target: number | null;
  word: string;
}

/**
 * The Food page (board 19b): the hero with four figures against the period before, Highlights, this
 * week's energy and the balance week by week, macros against their goals, the plate, meals, and
 * nutrients with habits. Analytics carries the page; nutrition's part fills Meals and Nutrients.
 */
@Component({
  selector: 'app-food-page',
  imports: [
    EnergyBarsComponent,
    EnergyDaysComponent,
    FoodMealsSectionComponent,
    FoodNutrientsSectionComponent,
    FoodPlateSectionComponent,
    HighlightsComponent,
    ProgressHeroComponent,
    SectionCardComponent,
    SmallTrendComponent,
    StatePanelComponent,
    SummaryLinesComponent,
    WeekBarsComponent
  ],
  templateUrl: './food.page.html',
  styleUrl: './food.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FoodPage implements OnInit {
  private readonly api = inject(ProgressApiService);
  private readonly nutrientsApi = inject(NutrientsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly periods = FOOD_PERIODS;
  readonly today = inject(UserTimezoneService).dateKey();
  readonly periodKey = signal<PeriodKey>('30d');
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly data = signal<FoodProgress | null>(null);
  readonly nutrients = signal<NutrientsOverview | null>(null);

  readonly days = computed(() => FOOD_PERIODS.find((p) => p.key === this.periodKey())!.days);
  readonly period = computed(() => lastDays(this.days(), this.today));
  readonly context = computed<ProgressCardContext>(() => ({ kind: 'FOOD', ...this.period() }));
  readonly title = computed(() => {
    const logged = this.data()?.hero.daysLogged;
    return logged?.value === null || logged?.value === undefined ? 'Your food' : `${logged.value} of ${logged.days ?? this.days()} days logged`;
  });
  readonly sub = computed(() => `${dateRangeLabel(this.period().from, this.period().to)}. Each change is compared with the ${this.days()} days before.`);
  readonly stats = computed(() => {
    const data = this.data();
    return data ? foodHeroStats(data, this.days()) : [];
  });
  readonly headline = computed(() => balanceHeadline(this.data()?.hero.balancePerDay.value ?? null));
  readonly balanceBars = computed<WeekBar[]>(() =>
    (this.data()?.energy.weeklyBalance ?? []).map((week) => ({
      label: shortDateLabel(week.weekStart),
      value: week.balance === null ? null : Math.round(week.balance),
      current: week.current
    }))
  );
  readonly balanceNote = computed(() => {
    const weeks = (this.data()?.energy.weeklyBalance ?? []).filter((week) => week.balance !== null);
    if (!weeks.length) {
      return '';
    }
    const under = weeks.filter((week) => (week.balance ?? 0) < 0).length;
    return `Under on ${under} of ${weeks.length} weeks. Logged days only.`;
  });
  readonly macroTiles = computed<MacroTile[]>(() => {
    const macros = this.data()?.macros;
    const tile = (name: string, macro: MacroTrend | null): MacroTile => ({
      name,
      points: (macro?.series ?? []).map((point) => ({ label: point.weekStart, value: point.value })),
      target: macro?.target ?? null,
      word: macroWord(macro)
    });
    return macros ? [tile('Protein', macros.protein), tile('Carbs', macros.carbs), tile('Fat', macros.fat)] : [];
  });
  readonly macroContext = computed(() => {
    const first = this.data()?.macros.protein?.series[0]?.weekStart;
    return first ? `The week of ${shortDateLabel(first)} → this week, logged days` : '';
  });

  ngOnInit(): void {
    this.load();
  }

  choosePeriod(key: PeriodKey): void {
    if (key !== this.periodKey()) {
      this.periodKey.set(key);
      this.load();
    }
  }

  load(): void {
    const { from, to } = this.period();
    this.loading.set(true);
    this.failed.set(false);
    this.api
      .getFood(from, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (food) => {
          this.data.set(food);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        }
      });
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
}
