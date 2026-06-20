import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';
import { FoodCategory, FoodSearchResult, LoggedFood, Meal, MealTemplate } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';

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
  readonly categories = signal<FoodCategory[]>([]);
  readonly recentFoods = signal<LoggedFood[]>([]);
  readonly favoriteFoods = signal<FoodSearchResult[]>([]);
  readonly favoriteUpdating = signal<Set<string>>(new Set());
  readonly frequentFoods = signal<LoggedFood[]>([]);
  readonly mealTemplates = signal<MealTemplate[]>([]);
  readonly todayMeals = signal<Meal[]>([]);
  readonly searching = signal(false);
  readonly categoriesLoading = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly selectedFood = signal<FoodSearchResult | null>(null);
  readonly selectedCategory = signal<FoodCategory | null>(null);
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly barcodeControl = new FormControl('', { nonNullable: true });
  readonly barcodeLooking = signal(false);
  readonly verifiedOnly = signal(false);
  readonly hasMoreFoods = signal(false);
  readonly loadingMore = signal(false);
  private searchPage = 0;
  private readonly searchPageSize = 20;

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
      mealId: meal.mealId,
      mealType: meal.mealType,
      type: this.label(meal.mealType),
      time: this.formatTime(meal.consumedAt),
      title: meal.name,
      calories: meal.totalCalories,
      protein: Math.round(meal.totalProteinGrams)
    }))
  );

  readonly favoriteIds = computed(
    () => new Set(this.favoriteFoods().map((food) => food.foodId).filter((foodId): foodId is string => Boolean(foodId)))
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

  readonly categoryOptions = computed(() => this.flattenCategories(this.categories()));

  readonly categoryLabel = computed(() => this.selectedCategory()?.displayName ?? 'All foods');

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
          this.searchPage = 0;
          this.searching.set(true);
          return this.searchFoods(query);
        })
      )
      .subscribe((foods) => {
        this.foods.set(foods);
        this.hasMoreFoods.set(foods.length === this.searchPageSize);
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

    this.runSearch();
    this.categoriesLoading.set(true);
    this.dataService.getFoodCategories().subscribe((categories) => {
      this.categories.set(categories);
      this.categoriesLoading.set(false);
    });
    this.dataService.getRecentFoods().subscribe((foods) => this.recentFoods.set(foods));
    this.dataService.getFavoriteFoods().subscribe((foods) => this.favoriteFoods.set(foods));
    this.dataService.getFrequentFoods().subscribe((foods) => this.frequentFoods.set(foods));
    this.dataService.getMealTemplates().subscribe((templates) => this.mealTemplates.set(templates));
    this.dataService.getTodayMeals().subscribe((meals) => this.todayMeals.set(meals));
  }

  useMealTemplate(template: MealTemplate): void {
    this.dataService.logMealFromTemplate(template.templateId).subscribe({
      next: () => {
        this.toast.success(`Logged "${template.name}".`);
        this.dataService.getTodayMeals().subscribe((meals) => this.todayMeals.set(meals));
      },
      error: () => this.toast.error('Unable to log from template. Please retry.')
    });
  }

  copyMeal(mealId: string, mealType: string): void {
    if (!mealId) {
      return;
    }
    this.dataService.copyMeal(mealId, mealType).subscribe({
      next: () => {
        this.toast.success('Meal copied to now.');
        this.dataService.getTodayMeals().subscribe((meals) => this.todayMeals.set(meals));
      },
      error: () => this.toast.error('Unable to copy meal. Please retry.')
    });
  }

  lookupBarcode(): void {
    const barcode = this.barcodeControl.value.trim();
    if (!barcode || this.barcodeLooking()) {
      return;
    }
    this.barcodeLooking.set(true);
    this.dataService.getFoodByBarcode(barcode).subscribe({
      next: (food) => {
        this.barcodeLooking.set(false);
        if (!food) {
          this.toast.error('No food found for that barcode.');
          return;
        }
        this.applyLoggedFood(food);
        this.toast.success(`Found "${food.foodName}".`);
      },
      error: () => {
        this.barcodeLooking.set(false);
        this.toast.error('Barcode lookup failed. Please retry.');
      }
    });
  }

  selectCategory(category: FoodCategory | null): void {
    this.selectedCategory.set(category);
    this.runSearch();
  }

  toggleVerifiedOnly(): void {
    this.verifiedOnly.update((value) => !value);
    this.runSearch();
  }

  loadMoreFoods(): void {
    if (this.loadingMore() || !this.hasMoreFoods()) {
      return;
    }
    this.searchPage += 1;
    this.loadingMore.set(true);
    this.searchFoods(this.searchControl.value).subscribe((foods) => {
      this.foods.update((current) => [...current, ...foods]);
      this.hasMoreFoods.set(foods.length === this.searchPageSize);
      this.loadingMore.set(false);
    });
  }

  private runSearch(): void {
    this.searchPage = 0;
    this.searching.set(true);
    this.searchFoods(this.searchControl.value).subscribe((foods) => {
      this.foods.set(foods);
      this.hasMoreFoods.set(foods.length === this.searchPageSize);
      this.searching.set(false);
    });
  }

  applyFood(food: FoodSearchResult): void {
    this.selectedFood.set(food);
    // Search results carry calories + basis only; the user confirms macros.
    this.mealForm.patchValue({
      foodName: food.displayName,
      calories: food.calories,
      proteinGrams: Math.round(food.proteinGrams),
      carbsGrams: 0,
      fatGrams: 0
    });
  }

  applyFavoriteFood(food: FoodSearchResult): void {
    this.applyFood(food);
  }

  applyLoggedFood(food: LoggedFood): void {
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

  formatAmount(value: number | null, unit: 'g' | 'mg'): string {
    if (value == null) {
      return 'No data';
    }
    const rounded = unit === 'mg' ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded}${unit}`;
  }

  isFavorite(food: FoodSearchResult): boolean {
    return Boolean(food.foodId && this.favoriteIds().has(food.foodId));
  }

  isFavoriteUpdating(food: FoodSearchResult): boolean {
    return Boolean(food.foodId && this.favoriteUpdating().has(food.foodId));
  }

  toggleFavorite(food: FoodSearchResult): void {
    const foodId = food.foodId;
    if (!foodId || this.isFavoriteUpdating(food)) {
      return;
    }

    const wasFavorite = this.isFavorite(food);
    const previous = this.favoriteFoods();
    this.setFavoriteUpdating(foodId, true);
    this.favoriteFoods.set(
      wasFavorite ? previous.filter((favorite) => favorite.foodId !== foodId) : [food, ...previous.filter((favorite) => favorite.foodId !== foodId)]
    );

    const request = wasFavorite ? this.dataService.removeFavoriteFood(foodId) : this.dataService.addFavoriteFood(foodId);
    request.subscribe({
      next: () => this.toast.success(wasFavorite ? 'Removed from favorites.' : 'Added to favorites.'),
      error: () => {
        this.favoriteFoods.set(previous);
        this.setFavoriteUpdating(foodId, false);
        this.toast.error('Unable to update favorites. Please retry.');
      },
      complete: () => this.setFavoriteUpdating(foodId, false)
    });
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

  private setFavoriteUpdating(foodId: string, updating: boolean): void {
    const next = new Set(this.favoriteUpdating());
    if (updating) {
      next.add(foodId);
    } else {
      next.delete(foodId);
    }
    this.favoriteUpdating.set(next);
  }

  private searchFoods(query: string) {
    const category = this.selectedCategory();
    return this.dataService.searchFoods(query, {
      categoryId: category?.categoryId ?? null,
      includeSubcategories: category ? category.children.length > 0 : false,
      verified: this.verifiedOnly(),
      page: this.searchPage,
      size: this.searchPageSize
    });
  }

  private flattenCategories(categories: FoodCategory[]): FoodCategory[] {
    return categories.flatMap((category) => [category, ...this.flattenCategories(category.children)]);
  }
}
