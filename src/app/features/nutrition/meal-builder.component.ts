import { Component, HostListener, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  FoodCategory,
  FoodDetail,
  FoodSearchResult,
  FoodServing,
  LoggedFood,
  MealItemDraft,
  MealTemplate,
  MealTemplateItem,
  NutritionSummary,
  PagedFoods
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { BuilderDrinksComponent } from './builder-drinks.component';
import { DrinkDetail, FrequentDrink } from './diary/diary.models';
import { drinkItem } from './diary/diary-water';
import { NutritionDiaryService } from './diary/nutrition-diary.service';
import {
  CUSTOM_SERVING_KEY,
  calculateGramsItem,
  calculateMealItem,
  isCustomFoodScope,
  roundDecimal,
  scaleDraft,
  servingGrams
} from './meal-item-math';

export { calculateMealItem, isCustomFoodScope };

type FinderTab = 'results' | 'recent' | 'favorites' | 'templates';
type RecentSort = 'recent' | 'frequent';
type MacroKey = 'proteinGrams' | 'carbsGrams' | 'fatGrams';

interface BuilderMealItem extends MealItemDraft {
  id: string;
  detail?: FoodDetail;
  serving?: FoodServing;
  /** True while the row holds an amount typed in grams instead of a count of a serving. */
  custom?: boolean;
  grams?: number;
}

interface ServingOption {
  value: string;
  label: string;
}

interface RingMetric {
  label: string;
  unit: string;
  current: number;
  target: number | null;
  meal: number;
}

/** The meal type a meal logged at `now` most likely is. Read once when the builder opens. */
export function defaultMealType(now: Date): string {
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour >= 5 && hour < 10.5) {
    return 'BREAKFAST';
  }
  if (hour >= 10.5 && hour < 15) {
    return 'LUNCH';
  }
  if (hour >= 17 && hour < 22) {
    return 'DINNER';
  }
  return 'SNACK';
}

@Component({
  selector: 'app-meal-builder',
  imports: [FormsModule, ReactiveFormsModule, StatePanelComponent, BuilderDrinksComponent],
  templateUrl: './meal-builder.component.html',
  styleUrl: './meal-builder.component.scss'
})
export class MealBuilderComponent implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly diary = inject(NutritionDiaryService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly saved = output<void>();
  readonly isCustomFoodScope = isCustomFoodScope;
  readonly mealTypeOptions = [
    { value: 'BREAKFAST', label: 'Breakfast' },
    { value: 'LUNCH', label: 'Lunch' },
    { value: 'DINNER', label: 'Dinner' },
    { value: 'SNACK', label: 'Snack' },
    { value: 'OTHER', label: 'Other' }
  ] as const;
  readonly finderTabs: { value: FinderTab; label: string }[] = [
    { value: 'results', label: 'Results' },
    { value: 'recent', label: 'Recent' },
    { value: 'favorites', label: 'Favorites' },
    { value: 'templates', label: 'Saved meals' }
  ];

  /**
   * The chosen meal type as a signal, so the label that names the default meal follows the form
   * through change detection instead of changing under a view that was already checked.
   */
  readonly mealType = signal('');
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly barcodeControl = new FormControl('', { nonNullable: true });
  readonly categorySearchControl = new FormControl('', { nonNullable: true });
  readonly foods = signal<FoodSearchResult[]>([]);
  readonly categories = signal<FoodCategory[]>([]);
  readonly recentFoods = signal<LoggedFood[]>([]);
  readonly favoriteFoods = signal<FoodSearchResult[]>([]);
  readonly frequentFoods = signal<LoggedFood[]>([]);
  readonly mealTemplates = signal<MealTemplate[]>([]);
  /** The drinks the person has most often, the same ones the water card offers as chips. */
  readonly frequentDrinks = signal<FrequentDrink[]>([]);
  /** The catalogue's water, which a glass or a bottle of water is added from. */
  readonly waterFood = signal<DrinkDetail | null>(null);
  readonly favoriteUpdating = signal<Set<string>>(new Set());
  readonly selectedCategory = signal<FoodCategory | null>(null);
  readonly selectedDetail = signal<FoodDetail | null>(null);
  readonly selectedServingId = signal<string>('');
  readonly selectedQuantity = signal(1);
  readonly items = signal<BuilderMealItem[]>([]);
  readonly dailySummary = signal<NutritionSummary | null>(null);
  readonly searching = signal(false);
  readonly saving = signal(false);
  readonly templateSaving = signal(false);
  readonly templateLoading = signal<string | null>(null);
  readonly quickAddOpen = signal(false);
  readonly quickSaving = signal(false);
  readonly barcodeLooking = signal(false);
  readonly barcodeOpen = signal(false);
  readonly filtersOpen = signal(false);
  readonly labelNoteOpen = signal(false);
  readonly verifiedOnly = signal(false);
  readonly activeTab = signal<FinderTab>('results');
  readonly recentSort = signal<RecentSort>('recent');
  readonly page = signal(0);
  readonly pageSize = signal(20);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly pageSizeOptions = [10, 20, 50] as const;

  readonly mealForm = this.fb.nonNullable.group({
    mealType: [defaultMealType(new Date()), Validators.required],
    name: ['', Validators.maxLength(120)],
    note: ['', Validators.maxLength(300)]
  });

  readonly quickAddForm = this.fb.nonNullable.group({
    mealType: ['SNACK', Validators.required],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    calories: [100, [Validators.required, Validators.min(0)]],
    proteinGrams: [0, Validators.min(0)],
    carbsGrams: [0, Validators.min(0)],
    fatGrams: [0, Validators.min(0)]
  });

  readonly categoryOptions = computed(() => this.flattenCategories(this.categories()));
  readonly filteredCategoryOptions = computed(() => {
    const query = this.categorySearchControl.value.trim().toLowerCase();
    const options = this.categoryOptions();
    return query ? options.filter((category) => category.displayName.toLowerCase().includes(query)) : options;
  });
  readonly beveragesCategory = computed(() => this.categoryOptions().find((category) => category.code === 'BEVERAGES') ?? null);
  readonly categoryLabel = computed(() => this.selectedCategory()?.displayName ?? 'All foods');
  readonly favoriteIds = computed(
    () => new Set(this.favoriteFoods().map((food) => food.foodId).filter((foodId): foodId is string => Boolean(foodId)))
  );
  readonly recentIds = computed(
    () => new Set(this.recentFoods().map((food) => food.customFoodId ?? food.foodId).filter((foodId): foodId is string => Boolean(foodId)))
  );
  readonly selectedServing = computed(() => {
    const detail = this.selectedDetail();
    const selectedId = this.selectedServingId();
    return detail?.servings.find((serving) => this.servingKey(serving) === selectedId) ?? detail?.servings[0] ?? null;
  });
  readonly itemPreview = computed(() => {
    const detail = this.selectedDetail();
    const serving = this.selectedServing();
    return detail && serving ? calculateMealItem(detail, serving, this.selectedQuantity()) : null;
  });
  readonly totals = computed(() =>
    this.items().reduce(
      (total, item) => ({
        calories: total.calories + item.calories,
        proteinGrams: total.proteinGrams + item.proteinGrams,
        carbsGrams: total.carbsGrams + item.carbsGrams,
        fatGrams: total.fatGrams + item.fatGrams
      }),
      { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
    )
  );
  readonly activeFilters = computed(() => {
    const filters: string[] = [];
    if (this.verifiedOnly()) {
      filters.push('Verified');
    }
    const category = this.selectedCategory();
    if (category) {
      filters.push(category.displayName);
    }
    return filters;
  });
  readonly shownRecentFoods = computed(() => this.recentSort() === 'recent' ? this.recentFoods() : this.frequentFoods());
  readonly calorieRing = computed<RingMetric>(() => ({
    label: 'Calories',
    unit: 'kcal',
    current: this.dailySummary()?.totalCalories ?? 0,
    target: this.dailySummary()?.targetCalories ?? null,
    meal: this.totals().calories
  }));
  readonly macroRings = computed<RingMetric[]>(() => [
    this.macroRing('Protein', 'g', 'proteinGrams', this.dailySummary()?.totalProteinGrams ?? 0, this.dailySummary()?.targetProteinGrams ?? null),
    this.macroRing('Carbs', 'g', 'carbsGrams', this.dailySummary()?.totalCarbsGrams ?? 0, this.dailySummary()?.targetCarbsGrams ?? null),
    this.macroRing('Fat', 'g', 'fatGrams', this.dailySummary()?.totalFatGrams ?? 0, this.dailySummary()?.targetFatGrams ?? null)
  ]);

  @HostListener('document:keydown.escape')
  closeFloatingPanels(): void {
    this.filtersOpen.set(false);
    this.barcodeOpen.set(false);
  }

  ngOnInit(): void {
    this.loadReferenceData();
    this.loadDailySummary();
    this.runSearch();
    this.updateMealNameValidator(this.mealForm.controls.mealType.value);

    this.searchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          this.page.set(0);
          this.searching.set(true);
          this.activeTab.set('results');
          return this.searchFoodsPage(query);
        })
      )
      .subscribe((result) => this.applySearchResult(result));

    this.mealType.set(this.mealForm.controls.mealType.value);
    this.mealForm.controls.mealType.valueChanges.subscribe((mealType) => {
      this.mealType.set(mealType);
      this.updateMealNameValidator(mealType);
    });
  }

  setMealType(mealType: string): void {
    this.mealForm.controls.mealType.setValue(mealType);
    if (mealType === 'OTHER') {
      this.labelNoteOpen.set(true);
    }
  }

  toggleLabelNote(): void {
    this.labelNoteOpen.update((value) => !value);
  }

  setActiveTab(tab: FinderTab): void {
    this.activeTab.set(tab);
  }

  setRecentSort(sort: RecentSort): void {
    this.recentSort.set(sort);
  }

  selectCategory(category: FoodCategory | null): void {
    this.selectedCategory.set(category);
    this.runSearch();
  }

  toggleFilters(event?: Event): void {
    event?.stopPropagation();
    this.filtersOpen.update((value) => !value);
  }

  closeFilters(): void {
    this.filtersOpen.set(false);
  }

  resetFilters(): void {
    this.verifiedOnly.set(false);
    this.selectedCategory.set(null);
    this.categorySearchControl.setValue('');
    this.runSearch();
  }

  clearFilter(filter: string): void {
    if (filter === 'Verified') {
      this.verifiedOnly.set(false);
    } else {
      this.selectedCategory.set(null);
    }
    this.runSearch();
  }

  toggleVerifiedOnly(): void {
    this.verifiedOnly.update((value) => !value);
    this.runSearch();
  }

  toggleBarcode(event?: Event): void {
    event?.stopPropagation();
    this.barcodeOpen.update((value) => !value);
  }

  goToPage(nextPage: number): void {
    const boundedPage = Math.max(0, Math.min(nextPage, Math.max(this.totalPages() - 1, 0)));
    if (boundedPage === this.page() || this.searching()) {
      return;
    }
    this.page.set(boundedPage);
    this.loadFoods();
  }

  prevPage(): void {
    this.goToPage(this.page() - 1);
  }

  nextPage(): void {
    this.goToPage(this.page() + 1);
  }

  setPageSize(size: number): void {
    const nextSize = Number(size);
    if (!this.pageSizeOptions.includes(nextSize as (typeof this.pageSizeOptions)[number]) || nextSize === this.pageSize()) {
      return;
    }
    this.pageSize.set(nextSize);
    this.runSearch();
  }

  selectFood(food: FoodSearchResult): void {
    if (!food.foodId) {
      this.toast.error('Detailed nutrition is unavailable for this fallback food.');
      return;
    }
    this.dataService.getFoodDetail(food.foodId).subscribe((detail) => {
      if (!detail) {
        this.toast.error('Unable to load full nutrition for that food.');
        return;
      }
      this.setSelectedDetail(detail);
    });
  }

  addFoodResult(food: FoodSearchResult, event?: Event): void {
    event?.stopPropagation();
    if (!food.foodId) {
      return;
    }
    this.dataService.getFoodDetail(food.foodId).subscribe((detail) => {
      const serving = detail ? this.defaultServingOf(detail, food) : null;
      const item = detail && serving ? calculateMealItem(detail, serving, 1) : null;
      if (!detail || !serving || !item) {
        this.toast.error('Choose a serving with enough nutrition data first.');
        return;
      }
      this.mergeMealItem(item, detail, serving);
      this.toast.success(`Added "${detail.displayName}".`);
    });
  }

  addSelectedFood(): void {
    const detail = this.selectedDetail();
    const serving = this.selectedServing();
    const item = this.itemPreview();
    if (!detail || !serving || !item) {
      this.toast.error('Choose a serving with enough nutrition data first.');
      return;
    }

    this.mergeMealItem(item, detail, serving);
    this.selectedDetail.set(null);
    this.selectedServingId.set('');
    this.selectedQuantity.set(1);
  }

  selectLoggedFood(food: LoggedFood): void {
    const foodId = food.customFoodId ?? food.foodId;
    if (!foodId) {
      this.addLoggedFoodToMeal(food);
      return;
    }
    this.dataService.getFoodDetail(foodId).subscribe((detail) => {
      if (detail) {
        this.setSelectedDetail(detail);
        return;
      }
      this.addLoggedFoodToMeal(food);
    });
  }

  addLoggedFood(food: LoggedFood): void {
    this.selectLoggedFood(food);
  }

  addLoggedFoodToMeal(food: LoggedFood, event?: Event): void {
    event?.stopPropagation();
    const item = this.mealItemFromLoggedFood(food);
    this.mergeMealItem(item);
    this.toast.success(`Added "${food.foodName}" from recent nutrition.`);
  }

  updateItemQuantity(itemId: string, rawValue: string): void {
    const quantity = Number(rawValue);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }
    this.replaceItem(itemId, (item) => {
      if (item.custom) {
        return item;
      }
      const next = roundDecimal(quantity, 2);
      if (!item.detail || !item.serving) {
        return { ...item, ...scaleDraft(item, next, item.quantity > 0 ? next / item.quantity : 1) };
      }
      const draft = calculateMealItem(item.detail, item.serving, next);
      return draft ? { ...draft, id: item.id, detail: item.detail, serving: item.serving } : item;
    });
  }

  /** The serving choices of a row: the food's servings, then custom grams. */
  servingOptions(item: BuilderMealItem): ServingOption[] {
    if (!item.detail) {
      return [{ value: '', label: item.snapshotServingLabel || item.unit || 'serving' }];
    }
    const options = item.detail.servings.map((serving) => ({ value: this.servingKey(serving), label: serving.label }));
    if (!item.serving && !item.custom) {
      options.unshift({ value: '', label: item.snapshotServingLabel || item.unit || 'serving' });
    }
    return [...options, { value: CUSTOM_SERVING_KEY, label: 'Custom grams' }];
  }

  rowServingKey(item: BuilderMealItem): string {
    if (item.custom) {
      return CUSTOM_SERVING_KEY;
    }
    return item.serving ? this.servingKey(item.serving) : '';
  }

  /** A row switches to another serving of its food, or to an amount in grams, keeping what it can. */
  setItemServing(itemId: string, key: string): void {
    this.replaceItem(itemId, (item) => {
      const detail = item.detail;
      if (!detail || key === this.rowServingKey(item)) {
        return item;
      }
      if (key === CUSTOM_SERVING_KEY) {
        const each = item.serving ? servingGrams(detail, item.serving) : null;
        const grams = item.custom ? (item.grams ?? 100) : roundDecimal((each ?? 100) * item.quantity, 1);
        const draft = calculateGramsItem(detail, grams);
        return draft ? { ...draft, id: item.id, detail, custom: true, grams } : item;
      }
      const serving = detail.servings.find((entry) => this.servingKey(entry) === key);
      const draft = serving ? calculateMealItem(detail, serving, item.custom ? 1 : item.quantity) : null;
      return serving && draft ? { ...draft, id: item.id, detail, serving } : item;
    });
  }

  /** The grams typed on a custom row. */
  setItemGrams(itemId: string, rawValue: string): void {
    const grams = roundDecimal(Number(rawValue), 1);
    if (!Number.isFinite(grams) || grams <= 0) {
      return;
    }
    this.replaceItem(itemId, (item) => {
      const draft = item.custom && item.detail ? calculateGramsItem(item.detail, grams) : null;
      return draft ? { ...draft, id: item.id, detail: item.detail, custom: true, grams } : item;
    });
  }

  incrementItem(itemId: string, delta: number): void {
    const item = this.items().find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }
    const nextQuantity = roundDecimal(Math.max(0, item.quantity + delta), 2);
    if (nextQuantity <= 0) {
      this.removeItem(itemId);
      return;
    }
    this.updateItemQuantity(itemId, String(nextQuantity));
  }

  removeItem(itemId: string): void {
    this.items.update((items) => items.filter((item) => item.id !== itemId));
  }

  saveMeal(): void {
    if (!this.items().length) {
      this.toast.error('Add at least one food before saving the meal.');
      return;
    }
    this.mealForm.markAllAsTouched();
    if (this.mealForm.invalid) {
      this.toast.error('Name your meal before saving.');
      return;
    }

    this.saving.set(true);
    const raw = this.mealForm.getRawValue();
    this.dataService
      .createMeal({
        mealType: raw.mealType,
        name: this.resolveMealName(raw.mealType, raw.name),
        note: raw.note,
        items: this.items().map((item) => this.toDraft(item))
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Meal saved to your day.');
          this.items.set([]);
          this.mealForm.reset({ mealType: raw.mealType, name: '', note: '' });
          this.loadDailySummary();
          this.saved.emit();
        },
        error: () => {
          this.saving.set(false);
          this.toast.error('Unable to save meal. Check the items and try again.');
        }
      });
  }

  saveAsTemplate(): void {
    if (!this.items().length || this.templateSaving()) {
      return;
    }
    this.mealForm.markAllAsTouched();
    if (this.mealForm.invalid) {
      this.toast.error('Name your meal before saving it as a template.');
      return;
    }
    const raw = this.mealForm.getRawValue();
    this.templateSaving.set(true);
    this.dataService
      .createMealTemplate({
        name: this.resolveMealName(raw.mealType, raw.name),
        mealType: raw.mealType,
        note: raw.note,
        items: this.items().map((item) => this.toDraft(item))
      })
      .subscribe({
        next: (template) => {
          this.templateSaving.set(false);
          this.mealTemplates.update((templates) => [template, ...templates.filter((entry) => entry.templateId !== template.templateId)]);
          this.toast.success('Saved meal template.');
        },
        error: () => {
          this.templateSaving.set(false);
          this.toast.error('Unable to save meal template. Please retry.');
        }
      });
  }

  saveQuickAdd(): void {
    this.quickAddForm.markAllAsTouched();
    if (this.quickAddForm.invalid) {
      return;
    }

    this.quickSaving.set(true);
    this.dataService.quickAddMeal(this.quickAddForm.getRawValue()).subscribe({
      next: () => {
        this.quickSaving.set(false);
        this.toast.success('Quick-add meal saved.');
        this.quickAddForm.reset({ mealType: 'SNACK', name: '', calories: 100, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });
        this.quickAddOpen.set(false);
        this.loadDailySummary();
        this.saved.emit();
      },
      error: () => {
        this.quickSaving.set(false);
        this.toast.error('Unable to quick-add that meal. Please retry.');
      }
    });
  }

  /** Opens the quick add form, for a meal type when one is given. */
  openQuickAdd(mealType?: string): void {
    if (mealType) {
      this.quickAddForm.controls.mealType.setValue(mealType);
    }
    this.quickAddOpen.set(true);
  }

  toggleQuickAdd(): void {
    this.quickAddOpen.update((value) => !value);
  }

  clearSelectedFood(): void {
    this.selectedDetail.set(null);
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
        this.addLoggedFoodToMeal(food);
        this.barcodeOpen.set(false);
      },
      error: () => {
        this.barcodeLooking.set(false);
        this.toast.error('Barcode lookup failed. Please retry.');
      }
    });
  }

  logTemplate(template: MealTemplate): void {
    this.addTemplateToMeal(template);
  }

  addTemplateToMeal(template: MealTemplate, event?: Event): void {
    event?.stopPropagation();
    if (this.templateLoading()) {
      return;
    }
    this.templateLoading.set(template.templateId);
    this.dataService.getMealTemplate(template.templateId).subscribe({
      next: (loaded) => {
        this.templateLoading.set(null);
        const source = loaded ?? template;
        if (!source.items.length) {
          this.toast.error('That saved meal has no food items.');
          return;
        }
        source.items.forEach((item) => this.mergeMealItem(this.mealItemFromTemplateItem(item)));
        this.toast.success(`Added "${source.name}" to this meal.`);
      },
      error: () => {
        this.templateLoading.set(null);
        this.toast.error('Unable to load saved meal. Please retry.');
      }
    });
  }

  isFavorite(food: FoodSearchResult): boolean {
    return Boolean(food.foodId && this.favoriteIds().has(food.foodId));
  }

  isFavoriteUpdating(food: FoodSearchResult): boolean {
    return Boolean(food.foodId && this.favoriteUpdating().has(food.foodId));
  }

  toggleFavorite(food: FoodSearchResult, event?: Event): void {
    event?.stopPropagation();
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

  setServing(servingId: string): void {
    this.selectedServingId.set(servingId);
  }

  setQuantity(value: string): void {
    const quantity = Number(value);
    this.selectedQuantity.set(Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
  }

  adjustSelectedQuantity(delta: number): void {
    this.selectedQuantity.update((value) => roundDecimal(Math.max(0.1, value + delta), 2));
  }

  servingKey(serving: FoodServing): string {
    return serving.servingId ?? serving.label;
  }

  formatAmount(value: number | null | undefined, suffix = ''): string {
    return `${Math.round(value ?? 0)}${suffix}`;
  }

  readonly defaultMealName = computed(() => this.resolveMealName(this.mealType(), ''));

  formatServing(item: MealItemDraft): string {
    const label = item.snapshotServingLabel || item.unit || 'serving';
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity === 1) {
      return label;
    }
    const normalizedLabel = label.trim().toLowerCase();
    const normalizedQuantityLabel = `${Math.round(quantity)} ${item.servingUnit ?? item.unit}`.trim().toLowerCase();
    if (normalizedLabel === normalizedQuantityLabel) {
      return label;
    }
    return `${this.formatQuantity(quantity)} x ${label}`;
  }

  formatQuantity(value: number): string {
    return Number.isInteger(value) ? String(value) : String(roundDecimal(value, 2));
  }

  formatLoggedAt(value: string | null | undefined, now = new Date()): string {
    if (!value) {
      return '';
    }
    const loggedAt = new Date(value);
    if (Number.isNaN(loggedAt.getTime())) {
      return '';
    }

    const elapsedMs = now.getTime() - loggedAt.getTime();
    const minuteMs = 60_000;
    const hourMs = 60 * minuteMs;
    if (this.isYesterday(loggedAt, now)) {
      return `Yesterday ${this.formatClock(loggedAt)}`;
    }
    if (elapsedMs >= 0 && elapsedMs < hourMs) {
      return `${Math.max(1, Math.round(elapsedMs / minuteMs))}m ago`;
    }
    if (elapsedMs >= 0 && elapsedMs < 24 * hourMs) {
      return `${Math.round(elapsedMs / hourMs)}h ago`;
    }

    const dayMs = 24 * hourMs;
    if (elapsedMs >= 0 && elapsedMs < 7 * dayMs) {
      return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(loggedAt);
    }

    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(loggedAt);
  }

  foodTags(food: FoodSearchResult): string[] {
    const tags: string[] = [];
    if (food.verified) {
      tags.push('Verified');
    }
    if (food.brandName) {
      tags.push(food.brandName);
    }
    if (isCustomFoodScope(food.scope)) {
      tags.push('Custom');
    }
    if (food.categoryName) {
      tags.push(food.categoryName);
    }
    if (food.foodId && this.recentIds().has(food.foodId)) {
      tags.push('Recent');
    }
    if (this.isFavorite(food)) {
      tags.push('Favorite');
    }
    return tags;
  }

  selectedCount(food: FoodSearchResult): number {
    if (!food.foodId) {
      return 0;
    }
    return this.items()
      .filter((item) => item.foodCatalogItemId === food.foodId || item.customFoodId === food.foodId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  ringSegment(value: number, target: number | null): number {
    if (!target || target <= 0) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
  }

  ringMealOffset(metric: RingMetric): number {
    return -this.ringSegment(metric.current, metric.target);
  }

  ringOverSegment(metric: RingMetric): number {
    if (!metric.target || metric.target <= 0) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round(((metric.current + metric.meal - metric.target) / metric.target) * 100)));
  }

  remainingCalories(): number | null {
    const target = this.dailySummary()?.targetCalories ?? null;
    if (target == null) {
      return null;
    }
    return target - (this.dailySummary()?.totalCalories ?? 0) - this.totals().calories;
  }

  private loadReferenceData(): void {
    this.dataService.getFoodCategories().subscribe((categories) => this.categories.set(categories));
    this.dataService.getRecentFoods().subscribe((foods) => this.recentFoods.set(foods));
    this.dataService.getFavoriteFoods().subscribe((foods) => this.favoriteFoods.set(foods));
    this.dataService.getFrequentFoods().subscribe((foods) => this.frequentFoods.set(foods));
    this.dataService.getMealTemplates().subscribe((templates) => this.mealTemplates.set(templates));
    this.loadDrinks();
  }

  private loadDrinks(): void {
    this.diary
      .frequentDrinks(2)
      .pipe(catchError(() => of([] as FrequentDrink[])))
      .subscribe((drinks) => this.frequentDrinks.set(drinks));
    this.diary
      .searchDrinks('water')
      .pipe(
        switchMap((options) => {
          const water = options.find((option) => /^water\b/i.test(option.name)) ?? options.find((option) => option.countsTowardWater);
          return water ? this.diary.getDrinkDetail(water.foodId) : of(null);
        }),
        catchError(() => of(null))
      )
      .subscribe((detail) => this.waterFood.set(detail));
  }

  /** Adds a glass or a bottle of the catalogue's water to the meal. */
  addWater(ml: number): void {
    const detail = this.waterFood();
    const item = detail ? drinkItem(detail, ml) : null;
    if (!item) {
      this.toast.error('Water is not available to add right now.');
      return;
    }
    this.mergeMealItem(item);
    this.toast.success(`Added ${ml} ml of water.`);
  }

  addFrequentDrink(drink: FrequentDrink): void {
    this.mergeMealItem(drink.draft);
    this.toast.success(`Added "${drink.name}".`);
  }

  /** Narrows the search to the beverages category. */
  searchDrinks(): void {
    const category = this.beveragesCategory();
    if (category) {
      this.activeTab.set('results');
      this.selectCategory(category);
    }
  }

  private loadDailySummary(): void {
    this.dataService.getDailyNutritionSummary().subscribe((summary) => this.dailySummary.set(summary));
  }

  private runSearch(): void {
    this.page.set(0);
    this.loadFoods();
  }

  private loadFoods(): void {
    this.searching.set(true);
    this.searchFoodsPage(this.searchControl.value).subscribe((result) => this.applySearchResult(result));
  }

  private searchFoodsPage(query: string) {
    const category = this.selectedCategory();
    return this.dataService.searchFoodsPage(query, {
      categoryId: category?.categoryId ?? null,
      includeSubcategories: category ? category.children.length > 0 : false,
      verified: this.verifiedOnly(),
      page: this.page(),
      size: this.pageSize()
    });
  }

  private applySearchResult(result: PagedFoods): void {
    this.foods.set(result.items);
    this.page.set(result.totalPages > 0 ? result.page : 0);
    this.totalPages.set(result.totalPages);
    this.totalElements.set(result.totalElements);
    this.searching.set(false);
  }

  private setSelectedDetail(detail: FoodDetail): void {
    const defaultServing = detail.servings.find((serving) => serving.defaultServing) ?? detail.servings[0] ?? null;
    this.selectedDetail.set(detail);
    this.selectedServingId.set(defaultServing ? this.servingKey(defaultServing) : '');
    this.selectedQuantity.set(1);
  }

  /** The serving a food is added with: the one the search named, else the flagged default, else the first. */
  private defaultServingOf(detail: FoodDetail, food?: FoodSearchResult): FoodServing | null {
    const named = food?.defaultServing?.servingId;
    return (
      (named ? detail.servings.find((entry) => entry.servingId === named) : undefined) ??
      detail.servings.find((entry) => entry.defaultServing) ??
      detail.servings[0] ??
      null
    );
  }

  private toDraft(item: BuilderMealItem): MealItemDraft {
    const { id: _id, detail: _detail, serving: _serving, custom: _custom, grams: _grams, ...draft } = item;
    return draft;
  }

  private replaceItem(itemId: string, change: (item: BuilderMealItem) => BuilderMealItem): void {
    this.items.update((items) => items.map((item) => (item.id === itemId ? change(item) : item)));
  }

  /** Loads the food behind a row that arrived without it, so its serving and quantity can be changed. */
  private attachDetail(itemId: string, foodId: string): void {
    this.dataService.getFoodDetail(foodId).subscribe((detail) => {
      if (!detail) {
        return;
      }
      this.replaceItem(itemId, (item) =>
        item.detail
          ? item
          : {
              ...item,
              detail,
              serving: detail.servings.find((entry) => entry.servingId !== null && entry.servingId === item.foodServingId)
            }
      );
    });
  }

  private mergeMealItem(item: MealItemDraft, detail?: FoodDetail, serving?: FoodServing): void {
    const newId = crypto.randomUUID();
    const foodId = item.customFoodId ?? item.foodCatalogItemId ?? null;
    let created = false;
    this.items.update((items) => {
      const matchIndex = items.findIndex((existing) => !existing.custom && this.itemMergeKey(existing) === this.itemMergeKey(item));
      if (matchIndex < 0) {
        created = true;
        return [...items, { ...item, id: newId, detail, serving }];
      }
      return items.map((existing, index) => {
        if (index !== matchIndex) {
          return existing;
        }
        const nextQuantity = roundDecimal(existing.quantity + item.quantity, 2);
        if (detail && serving) {
          const recalculated = calculateMealItem(detail, serving, nextQuantity);
          return recalculated ? { ...recalculated, id: existing.id, detail, serving } : existing;
        }
        if (existing.detail && existing.serving) {
          const recalculated = calculateMealItem(existing.detail, existing.serving, nextQuantity);
          return recalculated ? { ...recalculated, id: existing.id, detail: existing.detail, serving: existing.serving } : existing;
        }
        return {
          ...existing,
          quantity: nextQuantity,
          calories: existing.calories + item.calories,
          proteinGrams: roundDecimal(existing.proteinGrams + item.proteinGrams),
          carbsGrams: roundDecimal(existing.carbsGrams + item.carbsGrams),
          fatGrams: roundDecimal(existing.fatGrams + item.fatGrams),
          fiberGrams: this.sumNullable(existing.fiberGrams, item.fiberGrams),
          sugarGrams: this.sumNullable(existing.sugarGrams, item.sugarGrams),
          sodiumMg: this.sumNullable(existing.sodiumMg, item.sodiumMg)
        };
      });
    });
    if (created && !detail && foodId) {
      this.attachDetail(newId, foodId);
    }
  }

  private itemMergeKey(item: Pick<MealItemDraft, 'foodCatalogItemId' | 'customFoodId' | 'foodServingId' | 'foodName' | 'snapshotServingLabel'>): string {
    return [
      item.customFoodId || item.foodCatalogItemId || item.foodName.toLowerCase(),
      item.foodServingId || item.snapshotServingLabel || ''
    ].join('|');
  }

  private sumNullable(first: number | null, second: number | null): number | null {
    if (first == null && second == null) {
      return null;
    }
    return roundDecimal((first ?? 0) + (second ?? 0));
  }

  private mealItemFromLoggedFood(food: LoggedFood): MealItemDraft {
    const isCustom = Boolean(food.customFoodId) || isCustomFoodScope(food.scope);
    return {
      foodCatalogItemId: isCustom ? null : food.foodId,
      customFoodId: isCustom ? food.customFoodId ?? food.foodId : null,
      foodServingId: food.foodServingId,
      foodName: food.foodName,
      brandName: food.brandName || null,
      quantity: food.quantity || 1,
      unit: food.unit || 'serving',
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      snapshotServingLabel: food.servingLabel,
      calories: food.calories,
      proteinGrams: food.proteinGrams,
      carbsGrams: food.carbsGrams,
      fatGrams: food.fatGrams,
      fiberGrams: food.fiberGrams,
      sugarGrams: food.sugarGrams,
      sodiumMg: food.sodiumMg
    };
  }

  private mealItemFromTemplateItem(item: MealTemplateItem): MealItemDraft {
    return {
      foodCatalogItemId: item.foodCatalogItemId,
      customFoodId: item.customFoodId,
      foodServingId: item.foodServingId,
      foodName: item.foodName,
      brandName: item.brandName,
      quantity: item.quantity || 1,
      unit: item.unit || 'serving',
      servingSize: null,
      servingUnit: null,
      snapshotServingLabel: item.snapshotServingLabel,
      calories: item.calories,
      proteinGrams: item.proteinGrams,
      carbsGrams: item.carbsGrams,
      fatGrams: item.fatGrams,
      fiberGrams: item.fiberGrams,
      sugarGrams: item.sugarGrams,
      sodiumMg: item.sodiumMg
    };
  }

  private macroRing(label: string, unit: string, key: MacroKey, current: number, target: number | null): RingMetric {
    return {
      label,
      unit,
      current,
      target,
      meal: this.totals()[key]
    };
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

  private flattenCategories(categories: FoodCategory[]): FoodCategory[] {
    return categories.flatMap((category) => [category, ...this.flattenCategories(category.children)]);
  }

  private isYesterday(value: Date, now: Date): boolean {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return value.getFullYear() === yesterday.getFullYear()
      && value.getMonth() === yesterday.getMonth()
      && value.getDate() === yesterday.getDate();
  }

  private formatClock(value: Date): string {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }

  private updateMealNameValidator(mealType: string): void {
    if (mealType === 'OTHER') {
      this.labelNoteOpen.set(true);
    }
    const validators = mealType === 'OTHER'
      ? [Validators.required, Validators.maxLength(120)]
      : [Validators.maxLength(120)];
    this.mealForm.controls.name.setValidators(validators);
    this.mealForm.controls.name.updateValueAndValidity({ emitEvent: false });
  }

  private resolveMealName(mealType: string, rawName: string): string {
    const trimmed = rawName.trim();
    if (trimmed) {
      return trimmed;
    }
    return this.mealTypeOptions.find((option) => option.value === mealType)?.label ?? 'Meal';
  }
}
