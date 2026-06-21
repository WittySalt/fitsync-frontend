import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  FoodCategory,
  FoodDetail,
  FoodSearchResult,
  FoodServing,
  LoggedFood,
  MealItemDraft,
  MealTemplate,
  PagedFoods
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';

interface BuilderMealItem extends MealItemDraft {
  id: string;
  detail?: FoodDetail;
  serving?: FoodServing;
}

export function isCustomFoodScope(scope: string | null | undefined): boolean {
  const normalized = (scope ?? '').toUpperCase();
  return normalized === 'USER' || normalized === 'CUSTOM';
}

export function calculateMealItem(detail: FoodDetail, serving: FoodServing, quantity: number): MealItemDraft | null {
  const safeQuantity = Number(quantity);
  if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
    return null;
  }

  const scale = calculateServingScale(detail, serving, safeQuantity);
  if (scale == null) {
    return null;
  }

  const isCustom = isCustomFoodScope(detail.scope);
  return {
    foodCatalogItemId: isCustom ? null : detail.foodId,
    customFoodId: isCustom ? detail.foodId : null,
    foodServingId: serving.servingId,
    foodName: detail.displayName,
    brandName: detail.brandName || null,
    quantity: roundDecimal(safeQuantity, 2),
    unit: 'serving',
    servingSize: serving.quantity,
    servingUnit: serving.unit ?? null,
    snapshotServingLabel: serving.label,
    calories: Math.round(detail.calories * scale),
    proteinGrams: roundDecimal(detail.proteinGrams * scale),
    carbsGrams: roundDecimal(detail.carbsGrams * scale),
    fatGrams: roundDecimal(detail.fatGrams * scale),
    fiberGrams: detail.fiberGrams == null ? null : roundDecimal(detail.fiberGrams * scale),
    sugarGrams: detail.sugarGrams == null ? null : roundDecimal(detail.sugarGrams * scale),
    sodiumMg: detail.sodiumMg == null ? null : roundDecimal(detail.sodiumMg * scale)
  };
}

function calculateServingScale(detail: FoodDetail, serving: FoodServing, quantity: number): number | null {
  const basis = basisAmount(detail);
  const servingAmount = servingAmountForBasis(detail, serving);
  if (!basis || !servingAmount) {
    return null;
  }
  return (quantity * servingAmount) / basis;
}

function basisAmount(detail: FoodDetail): number | null {
  const amount = Number(detail.basisQuantity);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const unit = normalizeUnit(detail.basisUnit);
  if (unit === 'kg' || unit === 'l') {
    return amount * 1000;
  }
  return amount;
}

function servingAmountForBasis(detail: FoodDetail, serving: FoodServing): number | null {
  const basisUnit = normalizeUnit(detail.basisUnit);
  if (basisUnit === 'g' || basisUnit === 'kg') {
    if (serving.gramsEquivalent != null) {
      return serving.gramsEquivalent;
    }
    if (serving.millilitersEquivalent != null && detail.densityGramsPerMl != null) {
      return serving.millilitersEquivalent * detail.densityGramsPerMl;
    }
  }
  if (basisUnit === 'ml' || basisUnit === 'l') {
    if (serving.millilitersEquivalent != null) {
      return serving.millilitersEquivalent;
    }
    if (serving.gramsEquivalent != null && detail.densityGramsPerMl != null && detail.densityGramsPerMl > 0) {
      return serving.gramsEquivalent / detail.densityGramsPerMl;
    }
  }

  if (serving.quantity != null && normalizeUnit(serving.unit) === basisUnit) {
    return serving.quantity;
  }

  return basisAmount(detail);
}

function normalizeUnit(unit: string | null | undefined): string {
  const normalized = (unit ?? '').trim().toLowerCase();
  if (['g', 'gram', 'grams'].includes(normalized)) {
    return 'g';
  }
  if (['kg', 'kilogram', 'kilograms'].includes(normalized)) {
    return 'kg';
  }
  if (['ml', 'milliliter', 'milliliters'].includes(normalized)) {
    return 'ml';
  }
  if (['l', 'liter', 'liters'].includes(normalized)) {
    return 'l';
  }
  return normalized;
}

function roundDecimal(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

@Component({
  selector: 'app-meal-builder',
  imports: [ReactiveFormsModule, StatePanelComponent],
  templateUrl: './meal-builder.component.html',
  styleUrl: './meal-builder.component.scss'
})
export class MealBuilderComponent implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly saved = output<void>();
  readonly mealTypeOptions = [
    { value: 'BREAKFAST', label: 'Breakfast' },
    { value: 'LUNCH', label: 'Lunch' },
    { value: 'DINNER', label: 'Dinner' },
    { value: 'SNACK', label: 'Snack' },
    { value: 'OTHER', label: 'Other' }
  ] as const;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly barcodeControl = new FormControl('', { nonNullable: true });
  readonly foods = signal<FoodSearchResult[]>([]);
  readonly categories = signal<FoodCategory[]>([]);
  readonly recentFoods = signal<LoggedFood[]>([]);
  readonly favoriteFoods = signal<FoodSearchResult[]>([]);
  readonly frequentFoods = signal<LoggedFood[]>([]);
  readonly mealTemplates = signal<MealTemplate[]>([]);
  readonly favoriteUpdating = signal<Set<string>>(new Set());
  readonly selectedCategory = signal<FoodCategory | null>(null);
  readonly selectedDetail = signal<FoodDetail | null>(null);
  readonly selectedServingId = signal<string>('');
  readonly selectedQuantity = signal(1);
  readonly items = signal<BuilderMealItem[]>([]);
  readonly searching = signal(false);
  readonly saving = signal(false);
  readonly quickAddOpen = signal(false);
  readonly quickSaving = signal(false);
  readonly barcodeLooking = signal(false);
  readonly verifiedOnly = signal(false);
  readonly page = signal(0);
  readonly pageSize = signal(20);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly pageSizeOptions = [10, 20, 50] as const;

  readonly mealForm = this.fb.nonNullable.group({
    mealType: ['LUNCH', Validators.required],
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
  readonly categoryLabel = computed(() => this.selectedCategory()?.displayName ?? 'All foods');
  readonly favoriteIds = computed(
    () => new Set(this.favoriteFoods().map((food) => food.foodId).filter((foodId): foodId is string => Boolean(foodId)))
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

  ngOnInit(): void {
    this.loadReferenceData();
    this.runSearch();
    this.updateMealNameValidator(this.mealForm.controls.mealType.value);

    this.searchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          this.page.set(0);
          this.searching.set(true);
          return this.searchFoodsPage(query);
        })
      )
      .subscribe((result) => this.applySearchResult(result));

    this.mealForm.controls.mealType.valueChanges.subscribe((mealType) => this.updateMealNameValidator(mealType));
  }

  setMealType(mealType: string): void {
    this.mealForm.controls.mealType.setValue(mealType);
  }

  selectCategory(category: FoodCategory | null): void {
    this.selectedCategory.set(category);
    this.runSearch();
  }

  toggleVerifiedOnly(): void {
    this.verifiedOnly.update((value) => !value);
    this.runSearch();
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
    if (!this.pageSizeOptions.includes(size as (typeof this.pageSizeOptions)[number]) || size === this.pageSize()) {
      return;
    }
    this.pageSize.set(size);
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

  addSelectedFood(): void {
    const detail = this.selectedDetail();
    const serving = this.selectedServing();
    const item = this.itemPreview();
    if (!detail || !serving || !item) {
      this.toast.error('Choose a serving with enough nutrition data first.');
      return;
    }

    this.items.update((current) => [...current, { ...item, id: crypto.randomUUID(), detail, serving }]);
    this.selectedDetail.set(null);
    this.selectedServingId.set('');
    this.selectedQuantity.set(1);
  }

  addLoggedFood(food: LoggedFood): void {
    const foodId = food.customFoodId ?? food.foodId;
    if (foodId) {
      this.dataService.getFoodDetail(foodId).subscribe((detail) => {
        if (detail) {
          this.setSelectedDetail(detail);
          this.toast.success(`Loaded "${detail.displayName}" for serving selection.`);
          return;
        }
        this.addSnapshotFood(food);
      });
      return;
    }
    this.addSnapshotFood(food);
  }

  updateItemQuantity(itemId: string, rawValue: string): void {
    const quantity = Number(rawValue);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    this.items.update((items) =>
      items.map((item) => {
        if (item.id !== itemId || !item.detail || !item.serving) {
          return { ...item, quantity: roundDecimal(quantity, 2) };
        }
        const next = calculateMealItem(item.detail, item.serving, quantity);
        return next ? { ...next, id: item.id, detail: item.detail, serving: item.serving } : item;
      })
    );
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
        items: this.items().map(({ id, detail, serving, ...item }) => item)
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Meal saved to your day.');
          this.items.set([]);
          this.mealForm.reset({ mealType: raw.mealType, name: '', note: '' });
          this.saved.emit();
        },
        error: () => {
          this.saving.set(false);
          this.toast.error('Unable to save meal. Check the items and try again.');
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
        this.saved.emit();
      },
      error: () => {
        this.quickSaving.set(false);
        this.toast.error('Unable to quick-add that meal. Please retry.');
      }
    });
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
        this.addLoggedFood(food);
      },
      error: () => {
        this.barcodeLooking.set(false);
        this.toast.error('Barcode lookup failed. Please retry.');
      }
    });
  }

  logTemplate(template: MealTemplate): void {
    this.dataService.logMealFromTemplate(template.templateId).subscribe({
      next: () => {
        this.toast.success(`Logged "${template.name}".`);
        this.saved.emit();
      },
      error: () => this.toast.error('Unable to log from template. Please retry.')
    });
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

  servingKey(serving: FoodServing): string {
    return serving.servingId ?? serving.label;
  }

  formatAmount(value: number, suffix = ''): string {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded}${suffix}`;
  }

  private loadReferenceData(): void {
    this.dataService.getFoodCategories().subscribe((categories) => this.categories.set(categories));
    this.dataService.getRecentFoods().subscribe((foods) => this.recentFoods.set(foods));
    this.dataService.getFavoriteFoods().subscribe((foods) => this.favoriteFoods.set(foods));
    this.dataService.getFrequentFoods().subscribe((foods) => this.frequentFoods.set(foods));
    this.dataService.getMealTemplates().subscribe((templates) => this.mealTemplates.set(templates));
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

  private addSnapshotFood(food: LoggedFood): void {
    const isCustom = Boolean(food.customFoodId) || isCustomFoodScope(food.scope);
    this.items.update((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
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
      }
    ]);
    this.toast.success(`Added "${food.foodName}" from recent nutrition.`);
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

  private updateMealNameValidator(mealType: string): void {
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
