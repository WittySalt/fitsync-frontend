import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';
import { FoodSearchResult, LoggedFood, Meal } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';

@Component({
  selector: 'app-nutrition-page',
  imports: [ReactiveFormsModule, StatePanelComponent],
  templateUrl: './nutrition.page.html',
  styleUrl: './nutrition.page.scss'
})
export class NutritionPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly data = signal<DashboardData | null>(null);
  readonly foods = signal<FoodSearchResult[]>([]);
  readonly recentFoods = signal<LoggedFood[]>([]);
  readonly todayMeals = signal<Meal[]>([]);
  readonly searching = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly selectedFood = signal<FoodSearchResult | null>(null);
  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly today = new Intl.DateTimeFormat('en-SG', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(new Date());

  readonly nutrition = computed(() => this.data()?.nutrition ?? null);

  readonly caloriesRemaining = computed(() => {
    const nutrition = this.nutrition();
    return nutrition ? Math.max(nutrition.targetCalories - nutrition.totalCalories, 0) : 0;
  });

  readonly macroCards = computed(() => {
    const nutrition = this.nutrition();

    return [
      {
        label: 'Protein',
        value: nutrition?.totalProteinGrams ?? 0,
        target: nutrition?.targetProteinGrams ?? 0,
        unit: 'g',
        tone: 'protein'
      },
      {
        label: 'Carbs',
        value: nutrition?.totalCarbsGrams ?? 0,
        target: nutrition?.targetCarbsGrams ?? 0,
        unit: 'g',
        tone: 'carbs'
      },
      {
        label: 'Fat',
        value: nutrition?.totalFatGrams ?? 0,
        target: nutrition?.targetFatGrams ?? 0,
        unit: 'g',
        tone: 'fat'
      }
    ];
  });

  readonly mealTimeline = computed(() =>
    this.todayMeals().map((meal) => ({
      type: this.label(meal.mealType),
      time: this.formatTime(meal.consumedAt),
      title: meal.name,
      calories: meal.totalCalories,
      protein: Math.round(meal.totalProteinGrams)
    }))
  );

  readonly nutritionNotes = [
    { label: 'Fiber', value: '25g+', detail: 'Aim for vegetables, fruit, oats, and legumes.' },
    { label: 'Sodium', value: '< 2,300mg', detail: 'Watch sauces, soups, processed meals, and snacks.' },
    { label: 'Hydration', value: '2.5L', detail: 'Spread water through the day, especially around workouts.' }
  ];

  readonly mealForm = this.fb.nonNullable.group({
    mealType: ['LUNCH', Validators.required],
    foodName: ['', [Validators.required, Validators.maxLength(120)]],
    calories: [420, [Validators.required, Validators.min(0)]],
    proteinGrams: [32, [Validators.required, Validators.min(0)]],
    carbsGrams: [45, [Validators.required, Validators.min(0)]],
    fatGrams: [14, [Validators.required, Validators.min(0)]],
    note: ['', Validators.maxLength(300)]
  });

  ngOnInit(): void {
    this.load();

    this.searchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          this.searching.set(true);
          return this.dataService.searchFoods(query);
        })
      )
      .subscribe((foods) => {
        this.foods.set(foods);
        this.searching.set(false);
      });
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

    this.dataService.searchFoods(this.searchControl.value).subscribe((foods) => this.foods.set(foods));
    this.dataService.getRecentFoods().subscribe((foods) => this.recentFoods.set(foods));
    this.dataService.getTodayMeals().subscribe((meals) => this.todayMeals.set(meals));
  }

  applyFood(food: FoodSearchResult): void {
    this.selectedFood.set(food);
    // Search results carry calories + basis only; the user confirms macros.
    this.mealForm.patchValue({
      foodName: food.displayName,
      calories: food.calories
    });
  }

  applyRecentFood(food: LoggedFood): void {
    this.selectedFood.set(null);
    this.mealForm.patchValue({
      foodName: food.foodName,
      calories: food.calories,
      proteinGrams: Math.round(food.proteinGrams),
      carbsGrams: Math.round(food.carbsGrams),
      fatGrams: Math.round(food.fatGrams)
    });
  }

  saveMeal(): void {
    this.mealForm.markAllAsTouched();

    if (this.mealForm.invalid) {
      return;
    }

    this.submitting.set(true);
    this.dataService.saveMeal(this.mealForm.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Meal saved to your day.');
        this.load();
      },
      error: () => {
        this.submitting.set(false);
        this.toast.error('Unable to save meal. Check your connection and try again.');
      }
    });
  }

  calorieProgress(): number {
    const nutrition = this.nutrition();
    return this.progress(nutrition?.totalCalories ?? 0, nutrition?.targetCalories ?? 0);
  }

  progress(value: number, target: number): number {
    return target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0;
  }

  remaining(value: number, target: number): number {
    return Math.max(Math.round(target - value), 0);
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
}
