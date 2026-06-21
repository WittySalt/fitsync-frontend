import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';
import { Meal } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { MealBuilderComponent } from './meal-builder.component';

interface NutritionCheck {
  label: string;
  value: number | null;
  target: number | null;
  unit: 'g' | 'mg';
  status: 'success' | 'warning' | 'neutral';
  statusLabel: string;
  detail: string;
}

@Component({
  selector: 'app-nutrition-page',
  imports: [RouterLink, StatePanelComponent, MealBuilderComponent],
  templateUrl: './nutrition.page.html',
  styleUrl: './nutrition.page.scss'
})
export class NutritionPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);

  readonly data = signal<DashboardData | null>(null);
  readonly todayMeals = signal<Meal[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedTab = signal<'today' | 'log'>('today');

  readonly today = new Intl.DateTimeFormat('en-SG', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(new Date());

  readonly nutrition = computed(() => this.data()?.nutrition ?? null);

  readonly hasCalorieTarget = computed(() => this.nutrition()?.targetCalories != null);

  readonly caloriesRemaining = computed(() => {
    const nutrition = this.nutrition();
    return nutrition?.targetCalories != null ? Math.max(nutrition.targetCalories - nutrition.totalCalories, 0) : null;
  });

  readonly macroCards = computed(() => {
    const nutrition = this.nutrition();

    return [
      {
        label: 'Protein',
        value: nutrition?.totalProteinGrams ?? 0,
        target: nutrition?.targetProteinGrams ?? null,
        targetSet: nutrition?.targetProteinGrams != null,
        unit: 'g',
        tone: 'protein'
      },
      {
        label: 'Carbs',
        value: nutrition?.totalCarbsGrams ?? 0,
        target: nutrition?.targetCarbsGrams ?? null,
        targetSet: nutrition?.targetCarbsGrams != null,
        unit: 'g',
        tone: 'carbs'
      },
      {
        label: 'Fat',
        value: nutrition?.totalFatGrams ?? 0,
        target: nutrition?.targetFatGrams ?? null,
        targetSet: nutrition?.targetFatGrams != null,
        unit: 'g',
        tone: 'fat'
      }
    ];
  });

  readonly mealTimeline = computed(() =>
    this.todayMeals().map((meal) => ({
      mealId: meal.mealId,
      mealType: meal.mealType,
      type: this.label(meal.mealType),
      time: this.formatTime(meal.consumedAt),
      title: meal.name,
      calories: meal.totalCalories,
      protein: Math.round(meal.totalProteinGrams)
    }))
  );

  readonly nutritionChecks = computed(() => {
    const nutrition = this.nutrition();
    if (!nutrition) {
      return [];
    }

    return [
      this.nutritionCheck('Fiber', nutrition.totalFiberGrams, nutrition.fiberTargetGrams, 'g', nutrition.fiberTargetMet, 'target'),
      this.nutritionCheck('Sugar', nutrition.totalSugarGrams, nutrition.sugarLimitGrams, 'g', nutrition.sugarWithinLimit, 'limit'),
      this.nutritionCheck('Sodium', nutrition.totalSodiumMg, nutrition.sodiumLimitMg, 'mg', nutrition.sodiumWithinLimit, 'limit')
    ].filter((check): check is NutritionCheck => check !== null);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.dataService.getDashboard().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      }
    });

    this.refreshMeals();
  }

  refreshAfterMealSave(): void {
    this.refreshDashboard();
    this.refreshMeals();
    this.selectedTab.set('today');
  }

  copyMeal(mealId: string, mealType: string): void {
    if (!mealId) {
      return;
    }
    this.dataService.copyMeal(mealId, mealType).subscribe({
      next: () => {
        this.toast.success('Meal copied to now.');
        this.refreshAfterMealSave();
      },
      error: () => this.toast.error('Unable to copy meal. Please retry.')
    });
  }

  calorieProgress(): number {
    const nutrition = this.nutrition();
    return this.progress(nutrition?.totalCalories ?? 0, nutrition?.targetCalories ?? null) ?? 0;
  }

  progress(value: number, target: number | null): number | null {
    return target != null && target > 0 ? Math.min(Math.round((value / target) * 100), 100) : null;
  }

  remaining(value: number, target: number | null): number | null {
    return target != null ? Math.max(Math.round(target - value), 0) : null;
  }

  label(value: string | null | undefined): string {
    return (value ?? '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatTime(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }

  formatAmount(value: number | null, unit: 'g' | 'mg'): string {
    if (value == null) {
      return 'No data';
    }
    const rounded = unit === 'mg' ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded}${unit}`;
  }

  private refreshDashboard(): void {
    this.dataService.getDashboard().subscribe({
      next: (data) => this.data.set(data),
      error: () => this.toast.error('Meal saved, but today summary could not refresh.')
    });
  }

  private refreshMeals(): void {
    this.dataService.getTodayMeals().subscribe((meals) => this.todayMeals.set(meals));
  }

  private nutritionCheck(
    label: string,
    value: number | null,
    target: number | null,
    unit: 'g' | 'mg',
    status: boolean | null,
    mode: 'target' | 'limit'
  ): NutritionCheck | null {
    if (value == null && target == null && status == null) {
      return null;
    }

    const isGood = status === true;
    const state = status == null ? 'neutral' : isGood ? 'success' : 'warning';
    const statusLabel =
      status == null
        ? 'Waiting for target'
        : isGood
          ? mode === 'target'
            ? 'Target met'
            : 'Within limit'
          : mode === 'target'
            ? 'Below target'
            : 'Over limit';
    let detail = 'Waiting for nutrition summary targets.';

    if (value != null && target != null) {
      const delta = Math.abs(target - value);
      if (mode === 'target') {
        detail = isGood ? `${label} target met.` : `${this.formatAmount(delta, unit)} left to target.`;
      } else {
        detail = isGood ? `${label} is within today's limit.` : `${this.formatAmount(delta, unit)} over today's limit.`;
      }
    }

    return { label, value, target, unit, status: state, statusLabel, detail };
  }
}
