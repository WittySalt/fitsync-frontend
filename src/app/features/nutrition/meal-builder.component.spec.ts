import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  FoodCategory,
  FoodDetail,
  FoodSearchResult,
  FoodServing,
  LoggedFood,
  MealTemplate,
  NutritionSummary,
  PagedFoods
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { MealBuilderComponent, calculateMealItem } from './meal-builder.component';

describe('MealBuilderComponent', () => {
  let fixture: ComponentFixture<MealBuilderComponent>;
  let component: MealBuilderComponent;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  const serving: FoodServing = {
    servingId: 'serving-150',
    label: '1 bowl',
    quantity: 150,
    unit: 'g',
    gramsEquivalent: 150,
    millilitersEquivalent: null,
    sortOrder: 1,
    defaultServing: true
  };

  const chickenDetail: FoodDetail = {
    foodId: 'food-chicken',
    displayName: 'Chicken rice',
    brandName: 'Hawker',
    categoryName: 'Prepared meals',
    scope: 'CATALOG',
    calories: 100,
    proteinGrams: 10,
    carbsGrams: 12,
    fatGrams: 3,
    fiberGrams: 1,
    sugarGrams: 2,
    sodiumMg: 80,
    basisQuantity: 100,
    basisUnit: 'g',
    densityGramsPerMl: null,
    primaryBarcode: '',
    servings: [serving]
  };

  const searchFood: FoodSearchResult = {
    foodId: 'food-chicken',
    displayName: 'Chicken rice',
    brandName: 'Hawker',
    categoryName: 'Prepared meals',
    scope: 'CATALOG',
    calories: 100,
    proteinGrams: 0,
    basisUnit: '100 g',
    basisLabel: '100 g',
    primaryBarcode: '',
    verified: true
  };
  const category: FoodCategory = {
    categoryId: 'cat-protein',
    parentId: null,
    code: 'PROTEIN',
    displayName: 'Protein',
    slug: 'protein',
    sortOrder: 1,
    children: [{
      categoryId: 'cat-chicken',
      parentId: 'cat-protein',
      code: 'CHICKEN',
      displayName: 'Chicken',
      slug: 'chicken',
      sortOrder: 1,
      children: []
    }]
  };
  const loggedFood: LoggedFood = {
    foodId: 'food-chicken',
    customFoodId: null,
    foodServingId: 'serving-150',
    scope: 'CATALOG',
    foodName: 'Chicken rice',
    brandName: 'Hawker',
    servingLabel: '1 bowl',
    quantity: 1,
    unit: 'serving',
    servingSize: 150,
    servingUnit: 'g',
    calories: 150,
    proteinGrams: 15,
    carbsGrams: 18,
    fatGrams: 4.5,
    fiberGrams: 1.5,
    sugarGrams: 3,
    sodiumMg: 120,
    timesLogged: 3,
    lastLoggedAt: '2026-06-20T04:00:00Z'
  };
  const template: MealTemplate = {
    templateId: 'template-1',
    name: 'Training lunch',
    mealType: 'LUNCH',
    note: 'Default',
    totalCalories: 450,
    items: [{
      templateItemId: 'template-item-1',
      customFoodId: null,
      foodCatalogItemId: 'food-chicken',
      foodServingId: 'serving-150',
      foodName: 'Chicken rice',
      brandName: 'Hawker',
      quantity: 1,
      unit: 'serving',
      snapshotServingLabel: '1 bowl',
      calories: 150,
      proteinGrams: 15,
      carbsGrams: 18,
      fatGrams: 4.5,
      fiberGrams: 1.5,
      sugarGrams: 3,
      sodiumMg: 120
    }]
  };
  const dailySummary: NutritionSummary = {
    totalCalories: 600,
    targetCalories: 2000,
    totalProteinGrams: 40,
    targetProteinGrams: 140,
    totalCarbsGrams: 80,
    targetCarbsGrams: 220,
    totalFatGrams: 20,
    targetFatGrams: 70,
    mealCount: 2,
    totalFiberGrams: null,
    totalSugarGrams: null,
    totalSodiumMg: null,
    fiberTargetGrams: null,
    sugarLimitGrams: null,
    sodiumLimitMg: null,
    fiberTargetMet: null,
    sugarWithinLimit: null,
    sodiumWithinLimit: null
  };

  function pagedFoods(items: FoodSearchResult[], overrides: Partial<Omit<PagedFoods, 'items'>> = {}): PagedFoods {
    return {
      items,
      page: 0,
      size: 20,
      totalPages: 2,
      totalElements: 21,
      ...overrides
    };
  }

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'searchFoodsPage',
      'getFoodCategories',
      'getRecentFoods',
      'getFavoriteFoods',
      'getFrequentFoods',
      'getMealTemplates',
      'getMealTemplate',
      'createMealTemplate',
      'getDailyNutritionSummary',
      'getFoodDetail',
      'createMeal',
      'quickAddMeal',
      'getFoodByBarcode',
      'addFavoriteFood',
      'removeFavoriteFood'
    ]);
    dataService.searchFoodsPage.and.returnValue(of(pagedFoods([searchFood])));
    dataService.getFoodCategories.and.returnValue(of([]));
    dataService.getRecentFoods.and.returnValue(of([]));
    dataService.getFavoriteFoods.and.returnValue(of([]));
    dataService.getFrequentFoods.and.returnValue(of([]));
    dataService.getMealTemplates.and.returnValue(of([]));
    dataService.getMealTemplate.and.returnValue(of(template));
    dataService.createMealTemplate.and.returnValue(of(template));
    dataService.getDailyNutritionSummary.and.returnValue(of(dailySummary));
    dataService.getFoodDetail.and.returnValue(of(chickenDetail));
    dataService.createMeal.and.returnValue(of({ mealId: 'meal-1', mealType: 'LUNCH', name: 'Lunch', totalCalories: 300, totalProteinGrams: 30, consumedAt: '2026-06-20T04:00:00Z', itemCount: 1 }));
    dataService.quickAddMeal.and.returnValue(of({ mealId: 'meal-2', mealType: 'SNACK', name: 'Snack', totalCalories: 120, totalProteinGrams: 5, consumedAt: '2026-06-20T04:00:00Z', itemCount: 0 }));
    dataService.getFoodByBarcode.and.returnValue(of(null));
    dataService.addFavoriteFood.and.returnValue(of(void 0));
    dataService.removeFavoriteFood.and.returnValue(of(void 0));

    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [MealBuilderComponent],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MealBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calculates nutrition from selected serving scale', () => {
    const item = calculateMealItem(chickenDetail, serving, 2);

    expect(item?.calories).toBe(300);
    expect(item?.proteinGrams).toBe(30);
    expect(item?.carbsGrams).toBe(36);
    expect(item?.fatGrams).toBe(9);
    expect(item?.fiberGrams).toBe(3);
    expect(item?.foodCatalogItemId).toBe('food-chicken');
  });

  it('covers meal item calculation guard and unit conversion branches', () => {
    expect(calculateMealItem(chickenDetail, serving, 0)).toBeNull();
    expect(calculateMealItem({ ...chickenDetail, basisQuantity: 0 }, serving, 1)).toBeNull();

    const kgDetail: FoodDetail = {
      ...chickenDetail,
      basisQuantity: 1,
      basisUnit: 'kg',
      fiberGrams: null,
      sugarGrams: null,
      sodiumMg: null
    };
    const kgItem = calculateMealItem(kgDetail, { ...serving, gramsEquivalent: 500, quantity: 0.5, unit: 'kg' }, 1);

    expect(kgItem?.calories).toBe(50);
    expect(kgItem?.fiberGrams).toBeNull();
    expect(kgItem?.sugarGrams).toBeNull();
    expect(kgItem?.sodiumMg).toBeNull();

    const milkDetail: FoodDetail = {
      ...chickenDetail,
      foodId: 'food-milk',
      displayName: 'Milk',
      basisQuantity: 1,
      basisUnit: 'l',
      densityGramsPerMl: 1.03
    };

    expect(calculateMealItem(milkDetail, { ...serving, gramsEquivalent: null, millilitersEquivalent: 250 }, 1)?.calories).toBe(25);
    expect(calculateMealItem(milkDetail, { ...serving, gramsEquivalent: 206, millilitersEquivalent: null }, 1)?.calories).toBe(20);
    expect(calculateMealItem({ ...milkDetail, basisQuantity: 100, basisUnit: 'milliliters' }, { ...serving, unit: 'ml', quantity: 250, gramsEquivalent: null }, 1)?.calories).toBe(250);
    expect(calculateMealItem({ ...chickenDetail, basisUnit: 'cups' }, { ...serving, gramsEquivalent: null, millilitersEquivalent: null, quantity: null }, 1)?.calories).toBe(100);
  });

  it('loads the first food page with the default page size', () => {
    expect(dataService.searchFoodsPage).toHaveBeenCalledWith(
      '',
      jasmine.objectContaining({
        page: 0,
        size: 20
      })
    );
  });

  it('loads the next food page when the next button is clicked', () => {
    dataService.searchFoodsPage.and.callFake((query, options) =>
      of(
        pagedFoods([searchFood], {
          page: options?.page ?? 0,
          totalPages: 2,
          totalElements: 21
        })
      )
    );

    component.nextPage();
    fixture.detectChanges();

    expect(dataService.searchFoodsPage).toHaveBeenCalledWith(
      '',
      jasmine.objectContaining({
        page: 1,
        size: 20
      })
    );
  });

  it('renders food search page totals in the pagination bar', () => {
    expect(fixture.nativeElement.textContent).toContain('Page 1 / 2 (21 foods)');
  });

  it('keeps the per-page select bound to pageSize and requests the selected size from page zero', () => {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('.page-size select');

    expect(Number(select.selectedOptions[0].value)).toBe(component.pageSize());

    dataService.searchFoodsPage.calls.reset();
    select.value = '10';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.pageSize()).toBe(10);
    expect(dataService.searchFoodsPage).toHaveBeenCalledTimes(1);
    expect(dataService.searchFoodsPage).toHaveBeenCalledWith('', jasmine.objectContaining({ size: 10, page: 0 }));

    dataService.searchFoodsPage.calls.reset();
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.pageSize()).toBe(50);
    expect(dataService.searchFoodsPage).toHaveBeenCalledTimes(1);
    expect(dataService.searchFoodsPage).toHaveBeenCalledWith('', jasmine.objectContaining({ size: 50, page: 0 }));

    dataService.searchFoodsPage.calls.reset();
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(dataService.searchFoodsPage).not.toHaveBeenCalled();
  });

  it('hides the page controls when there is only one food page', () => {
    component.totalPages.set(1);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.page-controls')).toBeNull();
  });

  it('builds search result tags from backend metadata and local state', () => {
    component.recentFoods.set([loggedFood]);
    component.favoriteFoods.set([searchFood]);
    fixture.detectChanges();

    expect(component.foodTags(searchFood)).toEqual(['Verified', 'Hawker', 'Prepared meals', 'Recent', 'Favorite']);
    expect(fixture.nativeElement.textContent).toContain('Prepared meals');
  });

  it('calculates daily plan ring segments with the current meal overlay', () => {
    component.selectFood(searchFood);
    component.addSelectedFood();

    expect(component.ringSegment(component.calorieRing().current, component.calorieRing().target)).toBe(30);
    expect(component.ringSegment(component.calorieRing().meal, component.calorieRing().target)).toBe(8);
    expect(component.remainingCalories()).toBe(1250);
  });

  it('merges duplicate foods and totals their nutrition', () => {
    component.selectFood(searchFood);
    component.setQuantity('2');
    component.addSelectedFood();

    component.selectFood(searchFood);
    component.setQuantity('1');
    component.addSelectedFood();

    expect(component.items().length).toBe(1);
    expect(component.items()[0].quantity).toBe(3);
    expect(component.totals().calories).toBe(450);
    expect(component.totals().proteinGrams).toBe(45);
  });

  it('saves a multi-item meal through createMeal', () => {
    component.selectFood(searchFood);
    component.setQuantity('2');
    component.addSelectedFood();
    component.selectFood(searchFood);
    component.addSelectedFood();

    component.mealForm.patchValue({ mealType: 'DINNER', name: 'Dinner bowl', note: 'After training' });
    component.saveMeal();

    expect(dataService.createMeal).toHaveBeenCalled();
    const draft = dataService.createMeal.calls.mostRecent().args[0];
    expect(draft.mealType).toBe('DINNER');
    expect(draft.items.length).toBe(1);
    expect(draft.items[0]).toEqual(
      jasmine.objectContaining({
        foodCatalogItemId: 'food-chicken',
        foodServingId: 'serving-150',
        quantity: 3,
        calories: 450,
        proteinGrams: 45
      })
    );
    expect(component.items().length).toBe(0);
  });

  it('maps USER scoped foods to customFoodId', () => {
    const item = calculateMealItem({ ...chickenDetail, scope: 'USER', foodId: 'custom-1' }, serving, 1);

    expect(item?.customFoodId).toBe('custom-1');
    expect(item?.foodCatalogItemId).toBeNull();
  });

  it('formats serving labels without duplicated quantity text', () => {
    expect(component.formatServing({ ...loggedFood, snapshotServingLabel: '200 g', quantity: 200, servingUnit: 'g' })).toBe('200 g');
    expect(component.formatServing({ ...loggedFood, snapshotServingLabel: '100 g', quantity: 2, servingUnit: 'g' })).toBe('2 x 100 g');
  });

  it('quick-add fallback posts through quickAddMeal', () => {
    component.quickAddForm.setValue({
      mealType: 'SNACK',
      name: 'Manual shake',
      calories: 220,
      proteinGrams: 30,
      carbsGrams: 12,
      fatGrams: 4
    });

    component.saveQuickAdd();

    expect(dataService.quickAddMeal).toHaveBeenCalledWith({
      mealType: 'SNACK',
      name: 'Manual shake',
      calories: 220,
      proteinGrams: 30,
      carbsGrams: 12,
      fatGrams: 4
    });
  });

  it('shows a toast when createMeal fails', () => {
    dataService.createMeal.and.returnValue(throwError(() => new Error('bad request')));
    component.selectFood(searchFood);
    component.addSelectedFood();

    component.saveMeal();

    expect(toast.error).toHaveBeenCalledWith('Unable to save meal. Check the items and try again.');
  });

  it('searches by category, verified flag, debounced text, and bounded pagination', fakeAsync(() => {
    dataService.searchFoodsPage.calls.reset();
    dataService.searchFoodsPage.and.callFake((query, options) =>
      of(pagedFoods([searchFood], {
        page: options?.page ?? 0,
        totalPages: 3,
        totalElements: 45
      }))
    );
    component.categories.set([category]);

    component.selectCategory(category);

    expect(component.categoryLabel()).toBe('Protein');
    expect(component.categoryOptions().map((item) => item.displayName)).toEqual(['Protein', 'Chicken']);
    expect(dataService.searchFoodsPage).toHaveBeenCalledWith('', jasmine.objectContaining({
      categoryId: 'cat-protein',
      includeSubcategories: true,
      verified: false,
      page: 0
    }));

    component.toggleVerifiedOnly();

    expect(component.verifiedOnly()).toBeTrue();
    expect(dataService.searchFoodsPage).toHaveBeenCalledWith('', jasmine.objectContaining({ verified: true }));

    component.searchControl.setValue('rice');
    tick(250);

    expect(dataService.searchFoodsPage).toHaveBeenCalledWith('rice', jasmine.objectContaining({ page: 0 }));

    component.goToPage(99);

    expect(component.page()).toBe(2);

    dataService.searchFoodsPage.calls.reset();
    component.searching.set(true);
    component.goToPage(1);
    component.searching.set(false);
    component.goToPage(component.page());

    expect(dataService.searchFoodsPage).not.toHaveBeenCalled();

    component.prevPage();
    expect(component.page()).toBe(1);
  }));

  it('handles food selection guards and selected-food reset paths', () => {
    component.selectFood({ ...searchFood, foodId: null });

    expect(toast.error).toHaveBeenCalledWith('Detailed nutrition is unavailable for this fallback food.');

    dataService.getFoodDetail.and.returnValue(of(null));
    component.selectFood(searchFood);

    expect(toast.error).toHaveBeenCalledWith('Unable to load full nutrition for that food.');

    component.addSelectedFood();

    expect(toast.error).toHaveBeenCalledWith('Choose a serving with enough nutrition data first.');

    dataService.getFoodDetail.and.returnValue(of(chickenDetail));
    component.selectFood(searchFood);
    component.clearSelectedFood();

    expect(component.selectedDetail()).toBeNull();

    component.setServing('serving-150');
    component.setQuantity('not-a-number');

    expect(component.selectedQuantity()).toBe(1);
    expect(component.formatAmount(12.34, 'g')).toBe('12g');
  });

  it('adds logged foods from detail lookup or snapshot and updates item quantities', () => {
    dataService.getFoodDetail.and.returnValue(of(chickenDetail));
    component.addLoggedFood(loggedFood);

    expect(component.selectedDetail()).toEqual(chickenDetail);

    dataService.getFoodDetail.and.returnValue(of(null));
    component.addLoggedFood(loggedFood);

    expect(component.items().at(-1)?.foodName).toBe('Chicken rice');

    component.addLoggedFood({
      ...loggedFood,
      foodId: null,
      customFoodId: null,
      scope: 'CUSTOM',
      quantity: 0,
      unit: ''
    });

    const snapshot = component.items().at(-1)!;
    expect(snapshot.customFoodId).toBeNull();
    expect(snapshot.quantity).toBe(1);
    expect(snapshot.unit).toBe('serving');

    component.selectFood(searchFood);
    component.addSelectedFood();
    const detailedItem = component.items().find((item) => item.foodCatalogItemId === 'food-chicken')!;
    component.updateItemQuantity(detailedItem.id, '2.25');

    expect(component.items().find((item) => item.id === detailedItem.id)?.quantity).toBe(2.25);
    expect(component.items().find((item) => item.id === detailedItem.id)?.calories).toBe(338);

    component.updateItemQuantity(snapshot.id, '3');
    expect(component.items().find((item) => item.id === snapshot.id)?.quantity).toBe(3);

    component.updateItemQuantity(snapshot.id, '-1');
    expect(component.items().find((item) => item.id === snapshot.id)?.quantity).toBe(3);

    component.removeItem(snapshot.id);
    expect(component.items().some((item) => item.id === snapshot.id)).toBeFalse();
  });

  it('handles save meal empty guard, quick-add validation, and quick-add failure', () => {
    component.saveMeal();

    expect(toast.error).toHaveBeenCalledWith('Add at least one food before saving the meal.');

    component.quickAddForm.patchValue({ name: '', calories: -1 });
    component.saveQuickAdd();

    expect(dataService.quickAddMeal).not.toHaveBeenCalled();

    dataService.quickAddMeal.and.returnValue(throwError(() => new Error('quick failed')));
    component.quickAddForm.setValue({
      mealType: 'SNACK',
      name: 'Manual shake',
      calories: 220,
      proteinGrams: 30,
      carbsGrams: 12,
      fatGrams: 4
    });
    component.saveQuickAdd();

    expect(component.quickSaving()).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith('Unable to quick-add that meal. Please retry.');

    component.toggleQuickAdd();
    expect(component.quickAddOpen()).toBeTrue();
  });

  it('handles barcode lookup guard, empty result, success, and error paths', () => {
    component.lookupBarcode();

    expect(dataService.getFoodByBarcode).not.toHaveBeenCalled();

    component.barcodeControl.setValue(' 12345 ');
    component.barcodeLooking.set(true);
    component.lookupBarcode();

    expect(dataService.getFoodByBarcode).not.toHaveBeenCalled();

    component.barcodeLooking.set(false);
    dataService.getFoodByBarcode.and.returnValue(of(null));
    component.lookupBarcode();

    expect(dataService.getFoodByBarcode).toHaveBeenCalledWith('12345');
    expect(component.barcodeLooking()).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith('No food found for that barcode.');

    dataService.getFoodByBarcode.and.returnValue(of(loggedFood));
    component.lookupBarcode();

    expect(component.items().some((item) => item.foodName === 'Chicken rice')).toBeTrue();
    expect(component.selectedDetail()).toBeNull();

    dataService.getFoodByBarcode.and.returnValue(throwError(() => new Error('scanner offline')));
    component.lookupBarcode();

    expect(component.barcodeLooking()).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith('Barcode lookup failed. Please retry.');
  });

  it('adds saved meal templates to the current meal and rolls back favorite updates on failure', () => {
    spyOn(component.saved, 'emit');

    component.logTemplate(template);

    expect(dataService.getMealTemplate).toHaveBeenCalledWith('template-1');
    expect(component.items()[0]).toEqual(jasmine.objectContaining({ foodName: 'Chicken rice', calories: 150 }));
    expect(component.saved.emit).not.toHaveBeenCalled();

    dataService.getMealTemplate.and.returnValue(throwError(() => new Error('template failed')));
    component.logTemplate(template);

    expect(toast.error).toHaveBeenCalledWith('Unable to load saved meal. Please retry.');

    component.toggleFavorite({ ...searchFood, foodId: null });
    expect(dataService.addFavoriteFood).not.toHaveBeenCalled();

    component.toggleFavorite(searchFood);

    expect(component.isFavorite(searchFood)).toBeTrue();
    expect(component.isFavoriteUpdating(searchFood)).toBeFalse();
    expect(dataService.addFavoriteFood).toHaveBeenCalledWith('food-chicken');
    expect(toast.success).toHaveBeenCalledWith('Added to favorites.');

    component.toggleFavorite(searchFood);

    expect(component.isFavorite(searchFood)).toBeFalse();
    expect(dataService.removeFavoriteFood).toHaveBeenCalledWith('food-chicken');

    component.favoriteFoods.set([]);
    dataService.addFavoriteFood.and.returnValue(throwError(() => new Error('favorite failed')));
    component.toggleFavorite(searchFood);

    expect(component.isFavorite(searchFood)).toBeFalse();
    expect(component.isFavoriteUpdating(searchFood)).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith('Unable to update favorites. Please retry.');
  });

  it('formats recent food timestamps for relative, yesterday, weekday, and older labels', () => {
    const now = new Date('2026-06-24T12:00:00');

    expect(component.formatLoggedAt(null, now)).toBe('');
    expect(component.formatLoggedAt('not-a-date', now)).toBe('');
    expect(component.formatLoggedAt('2026-06-24T11:58:00', now)).toBe('2m ago');
    expect(component.formatLoggedAt('2026-06-24T10:00:00', now)).toBe('2h ago');
    expect(component.formatLoggedAt('2026-06-23T19:40:00', now)).toBe('Yesterday 19:40');
    expect(component.formatLoggedAt('2026-06-22T09:00:00', now)).toBe('Mon');
    expect(component.formatLoggedAt('2026-05-20T09:00:00', now)).toBe('May 20');
  });

  it('opens and resets floating filter and barcode panels without changing document flow', () => {
    component.categories.set([category]);
    component.toggleFilters();
    fixture.detectChanges();

    const popover: HTMLElement = fixture.nativeElement.querySelector('.filter-popover');
    expect(component.filtersOpen()).toBeTrue();
    expect(popover).not.toBeNull();
    expect(getComputedStyle(popover).position).toBe('absolute');
    expect(Number(getComputedStyle(popover).zIndex)).toBeGreaterThan(0);

    component.toggleVerifiedOnly();
    component.selectCategory(category.children[0]);

    expect(component.activeFilters()).toEqual(['Verified', 'Chicken']);

    component.clearFilter('Verified');
    expect(component.verifiedOnly()).toBeFalse();

    component.resetFilters();
    expect(component.selectedCategory()).toBeNull();
    expect(component.categorySearchControl.value).toBe('');

    component.toggleBarcode();
    expect(component.barcodeOpen()).toBeTrue();

    component.closeFloatingPanels();
    expect(component.filtersOpen()).toBeFalse();
    expect(component.barcodeOpen()).toBeFalse();
  });

  it('adds search results directly, handles unavailable details, and adjusts item quantities down to removal', () => {
    component.addFoodResult({ ...searchFood, foodId: null });

    expect(dataService.getFoodDetail).not.toHaveBeenCalled();

    dataService.getFoodDetail.and.returnValue(of({ ...chickenDetail, servings: [] }));
    component.addFoodResult(searchFood);

    expect(toast.error).toHaveBeenCalledWith('Choose a serving with enough nutrition data first.');

    dataService.getFoodDetail.and.returnValue(of(chickenDetail));
    component.addFoodResult(searchFood);

    expect(component.items().length).toBe(1);
    expect(component.items()[0]).toEqual(jasmine.objectContaining({ quantity: 1, calories: 150 }));
    expect(toast.success).toHaveBeenCalledWith('Added "Chicken rice".');

    const itemId = component.items()[0].id;
    component.incrementItem('missing-item', 1);
    component.incrementItem(itemId, 1);
    expect(component.items()[0].quantity).toBe(2);

    component.incrementItem(itemId, -2);
    expect(component.items().length).toBe(0);
  });

  it('saves templates, validates required names, and handles template creation failure', () => {
    component.saveAsTemplate();

    expect(dataService.createMealTemplate).not.toHaveBeenCalled();

    component.selectFood(searchFood);
    component.addSelectedFood();
    component.setMealType('OTHER');
    component.saveAsTemplate();

    expect(toast.error).toHaveBeenCalledWith('Name your meal before saving it as a template.');
    expect(dataService.createMealTemplate).not.toHaveBeenCalled();

    component.mealForm.patchValue({ mealType: 'OTHER', name: 'Custom bowl', note: 'Bulk prep' });
    component.saveAsTemplate();

    expect(dataService.createMealTemplate).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Custom bowl',
      mealType: 'OTHER',
      note: 'Bulk prep'
    }));
    expect(component.templateSaving()).toBeFalse();
    expect(component.mealTemplates()[0].templateId).toBe('template-1');

    dataService.createMealTemplate.and.returnValue(throwError(() => new Error('save failed')));
    component.saveAsTemplate();

    expect(component.templateSaving()).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith('Unable to save meal template. Please retry.');
  });

  it('uses loaded template details for Add all and handles loading guard, empty templates, and fallback source', () => {
    component.templateLoading.set('other-template');
    component.addTemplateToMeal(template);

    expect(dataService.getMealTemplate).not.toHaveBeenCalled();

    component.templateLoading.set(null);
    dataService.getMealTemplate.and.returnValue(of({ ...template, items: [] }));
    component.addTemplateToMeal(template);

    expect(component.templateLoading()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('That saved meal has no food items.');

    dataService.getMealTemplate.and.returnValue(of(null));
    component.addTemplateToMeal(template);

    expect(component.items().some((item) => item.foodName === 'Chicken rice')).toBeTrue();
    expect(toast.success).toHaveBeenCalledWith('Added "Training lunch" to this meal.');
  });

  it('calculates ring overflow and no-target fallback values', () => {
    component.dailySummary.set({
      ...dailySummary,
      totalCalories: 1900,
      targetCalories: 2000,
      totalProteinGrams: 130,
      targetProteinGrams: 140
    });
    component.selectFood(searchFood);
    component.setQuantity('2');
    component.addSelectedFood();

    expect(component.ringSegment(2600, 2000)).toBe(100);
    expect(component.ringOverSegment(component.calorieRing())).toBe(10);
    expect(component.remainingCalories()).toBe(-200);

    component.dailySummary.set({ ...dailySummary, targetCalories: null, targetProteinGrams: null });

    expect(component.ringSegment(500, null)).toBe(0);
    expect(component.ringMealOffset(component.calorieRing())).toBe(0);
    expect(component.ringOverSegment(component.calorieRing())).toBe(0);
    expect(component.remainingCalories()).toBeNull();
  });
});
