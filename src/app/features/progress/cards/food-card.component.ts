import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { formatNumber, lastDays } from '../../../shared/progress/progress-format';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { NutrientPetalsComponent } from '../../nutrition/nutrients/nutrient-petals.component';
import { reachSummary } from '../../nutrition/nutrients/nutrients-figures';
import { NutrientsOverview } from '../../nutrition/nutrients/nutrients.models';
import { NutrientsService } from '../../nutrition/nutrients/nutrients.service';
import { hasFood } from '../food/food-figures';
import { FoodProgress } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';
import { foodCoachLine } from './card-lines';
import { foodReadingLines } from './card-readings';
import { EnergyPairComponent } from './energy-pair.component';
import { ProgressCardComponent } from './progress-card.component';
import { SummaryListComponent } from './summary-list.component';

/** The headline of the Food card: "279 kcal" and "A day under what you used this week". */
export function foodHeadline(balance: number | null): { figure: string; caption: string } | null {
  if (balance === null) {
    return null;
  }
  const rounded = Math.round(balance);
  return {
    figure: `${formatNumber(Math.abs(rounded))} kcal`,
    caption: rounded === 0 ? 'A day matching what you used this week' : `A day ${rounded < 0 ? 'under' : 'over'} what you used this week`
  };
}

/** How long ago the first week of the period is, for "down from 150 g a month ago". */
export function earlierWords(days: number): string {
  if (days <= 31) {
    return 'a month ago';
  }
  return days >= 360 ? 'a year ago' : `${Math.round(days / 30)} months ago`;
}

type FoodState = { status: 'loading' } | { status: 'ready'; food: FoodProgress } | { status: 'error' };

/**
 * The Food card (board 21a): the day's energy balance as the headline, three lines, the two energy
 * bars on one scale and the nutrient petals. The petals are an addition; without them the card reads.
 */
@Component({
  selector: 'app-food-card',
  imports: [EnergyPairComponent, NutrientPetalsComponent, ProgressCardComponent, StatePanelComponent, SummaryListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './food-card.component.html',
  styleUrl: './food-card.component.scss'
})
export class FoodCardComponent {
  private readonly api = inject(ProgressApiService);
  private readonly nutrientsApi = inject(NutrientsService);

  /** The days the card describes and Ask sends. */
  readonly period = input.required<{ from: string; to: string }>();
  readonly days = input(30);
  /** The calorie goal's target, when the person has one. */
  readonly calorieTarget = input<number | null>(null);

  private readonly attempt = signal(0);
  private readonly key = computed(() => ({ ...this.period(), attempt: this.attempt() }));
  protected readonly state = toSignal(
    toObservable(this.key).pipe(
      switchMap(({ from, to }) =>
        this.api.getFood(from, to).pipe(
          map((food): FoodState => ({ status: 'ready', food })),
          catchError(() => of<FoodState>({ status: 'error' })),
          startWith<FoodState>({ status: 'loading' })
        )
      )
    ),
    { initialValue: { status: 'loading' } as FoodState }
  );
  protected readonly nutrients = toSignal(
    // Nutrition sums nutrients over 31 days at most, so the petals always read the last 30 days.
    toObservable(computed(() => lastDays(30, this.period().to))).pipe(
      switchMap(({ from, to }) =>
        this.nutrientsApi.getAll(from, to).pipe(catchError(() => of(null)))
      )
    ),
    { initialValue: null as NutrientsOverview | null }
  );

  protected readonly context = computed<ProgressCardContext>(() => ({ kind: 'FOOD', ...this.period() }));
  protected readonly food = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.food : null;
  });
  protected readonly headline = computed(() => foodHeadline(this.food()?.hero.balancePerDay.value ?? null));
  protected readonly coachLine = computed(() => {
    const food = this.food();
    return food && hasFood(food) ? foodCoachLine(food) : '';
  });
  protected readonly lines = computed(() => {
    const food = this.food();
    return food ? foodReadingLines({ food, nutrients: this.nutrients()?.nutrients ?? null, calorieTarget: this.calorieTarget(), days: this.days(), earlierWords: earlierWords(this.days()) }) : [];
  });
  protected readonly enough = computed(() => {
    const food = this.food();
    return food ? hasFood(food) : false;
  });
  protected readonly week = computed(() => {
    const week = this.food()?.energy.thisWeek;
    return week && week.status === 'OK' ? week : null;
  });
  protected readonly overview = computed(() => {
    const overview = this.nutrients();
    return overview && overview.daysLogged > 0 && reachSummary(overview.nutrients).total > 0 ? overview : null;
  });
  /** The petals cover 30 days whatever the period; the caption says so when the period is longer. */
  protected readonly longPeriod = computed(() => this.days() > 30);
  protected readonly reach = computed(() => {
    const overview = this.overview();
    return overview ? reachSummary(overview.nutrients) : null;
  });

  protected retry(): void {
    this.attempt.update((value) => value + 1);
  }
}
