import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { defer } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { DayMeal, NutritionSummary, UsualMeal } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { BRIEF_NOW } from '../brief/brief-time';
import { TodayFoodComponent, UsualMealLog } from './today-food.component';

type MealsState = 'loading' | 'ready' | 'failed';

/**
 * Today on Home: the day's food. Body and goals answer "a period", so they live on the Goal page of
 * Progress, and the card links there.
 */
@Component({
  selector: 'app-today-card',
  imports: [RouterLink, TodayFoodComponent],
  templateUrl: './today-card.component.html',
  styleUrl: './today-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayCardComponent implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly clock = inject(BRIEF_NOW);
  private readonly toast = inject(ToastService);

  /** Today's nutrition summary, or null while it loads or when it failed. */
  readonly nutrition = input<NutritionSummary | null>(null);
  readonly loading = input(false);
  readonly nutritionFailed = input(false);
  readonly retryNutrition = output<void>();

  readonly now = signal(this.clock());

  private readonly meals = signal<DayMeal[]>([]);
  readonly mealsState = signal<MealsState>('loading');
  readonly usualMeals = signal<UsualMeal[]>([]);
  /** True while a copy of a usual meal is being saved. */
  readonly logging = signal(false);
  readonly foodMeals = this.meals.asReadonly();
  readonly foodLoading = computed(
    () => this.mealsState() === 'loading' || (this.nutrition() === null && !this.nutritionFailed())
  );
  readonly foodFailed = computed(() => this.mealsState() === 'failed' || this.nutritionFailed());

  ngOnInit(): void {
    this.loadMeals();
    this.loadUsualMeals();
  }

  loadMeals(): void {
    this.mealsState.set('loading');
    this.dataService
      .getMealsForDay(this.now())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meals) => {
          this.meals.set(meals);
          this.mealsState.set('ready');
        },
        error: () => this.mealsState.set('failed')
      });
  }

  // The usual meals only add suggestions, so a failure leaves the card as it is without them.
  private loadUsualMeals(): void {
    // The call is deferred so that any failure, even one thrown before a request exists, is caught.
    defer(() => this.dataService.getUsualMeals())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meals) => this.usualMeals.set(meals),
        error: () => this.usualMeals.set([])
      });
  }

  logUsual(request: UsualMealLog): void {
    if (this.logging()) {
      return;
    }
    this.logging.set(true);
    this.dataService
      .copyMeal(request.mealId, request.mealType, (request.consumedAt ?? this.clock()).toISOString())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.logging.set(false);
          this.refreshAfterLogging();
        },
        error: () => {
          this.logging.set(false);
          this.toast.error('Unable to log the meal. Please retry.');
        }
      });
  }

  // The meals are read again without the loading state, so the slot the person is looking at stays
  // on screen, and the budget is asked for again through the page.
  private refreshAfterLogging(): void {
    this.now.set(this.clock());
    this.dataService
      .getMealsForDay(this.now())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meals) => this.meals.set(meals),
        error: () => this.toast.error('The meal was logged, but today could not be refreshed.')
      });
    this.retryNutrition.emit();
  }

  retryFood(): void {
    if (this.mealsState() === 'failed') {
      this.loadMeals();
    }
    if (this.nutritionFailed()) {
      this.retryNutrition.emit();
    }
  }
}
