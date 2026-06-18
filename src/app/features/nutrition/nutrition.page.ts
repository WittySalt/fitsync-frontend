import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';
import { FoodSearchResult } from '../../core/fitsync.models';
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

  readonly data = signal<DashboardData | null>(null);
  readonly foods = signal<FoodSearchResult[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly saveMessage = this.dataService.lastSavedMessage;
  readonly selectedFood = signal<FoodSearchResult | null>(null);

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

  readonly mealTimeline = computed(() => {
    const latestMeal = this.data()?.latestMeal;

    return [
      {
        type: 'Breakfast',
        time: '07:30',
        title: latestMeal?.mealType === 'BREAKFAST' ? latestMeal.name : 'Plan a high-protein start',
        calories: latestMeal?.mealType === 'BREAKFAST' ? latestMeal.totalCalories : 0,
        status: latestMeal?.mealType === 'BREAKFAST' ? 'Logged' : 'Open'
      },
      {
        type: 'Lunch',
        time: '12:30',
        title: latestMeal?.mealType === 'LUNCH' ? latestMeal.name : 'Keep lunch balanced',
        calories: latestMeal?.mealType === 'LUNCH' ? latestMeal.totalCalories : 0,
        status: latestMeal?.mealType === 'LUNCH' ? 'Logged' : 'Open'
      },
      {
        type: 'Dinner',
        time: '19:00',
        title: latestMeal?.mealType === 'DINNER' ? latestMeal.name : 'Reserve calories for dinner',
        calories: latestMeal?.mealType === 'DINNER' ? latestMeal.totalCalories : 0,
        status: latestMeal?.mealType === 'DINNER' ? 'Logged' : 'Open'
      },
      {
        type: 'Snack',
        time: 'Flexible',
        title: latestMeal?.mealType === 'SNACK' ? latestMeal.name : 'Use snacks to close macro gaps',
        calories: latestMeal?.mealType === 'SNACK' ? latestMeal.totalCalories : 0,
        status: latestMeal?.mealType === 'SNACK' ? 'Logged' : 'Open'
      }
    ];
  });

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

    this.dataService.getFoods().subscribe((foods) => this.foods.set(foods));
  }

  applyFood(food: FoodSearchResult): void {
    this.selectedFood.set(food);
    this.mealForm.patchValue({
      foodName: food.displayName,
      calories: food.calories,
      proteinGrams: food.proteinGrams,
      carbsGrams: this.estimateCarbs(food),
      fatGrams: this.estimateFat(food)
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
        this.load();
      },
      error: () => {
        this.dataService.lastSavedMessage.set('Unable to save meal. Check authentication and backend availability.');
        this.submitting.set(false);
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

  private estimateCarbs(food: FoodSearchResult): number {
    return Math.max(Math.round((food.calories - food.proteinGrams * 4) / 6), 0);
  }

  private estimateFat(food: FoodSearchResult): number {
    return Math.max(Math.round((food.calories - food.proteinGrams * 4) / 18), 0);
  }
}
