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
    timesLogged: 3
  };
  const template: MealTemplate = {
    templateId: 'template-1',
    name: 'Training lunch',
    mealType: 'LUNCH',
    note: 'Default',
    totalCalories: 450
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
      'getFoodDetail',
      'createMeal',
      'quickAddMeal',
      'getFoodByBarcode',
      'logMealFromTemplate',
      'addFavoriteFood',
      'removeFavoriteFood'
    ]);
    dataService.searchFoodsPage.and.returnValue(of(pagedFoods([searchFood])));
    dataService.getFoodCategories.and.returnValue(of([]));
    dataService.getRecentFoods.and.returnValue(of([]));
    dataService.getFavoriteFoods.and.returnValue(of([]));
    dataService.getFrequentFoods.and.returnValue(of([]));
    dataService.getMealTemplates.and.returnValue(of([]));
    dataService.getFoodDetail.and.returnValue(of(chickenDetail));
    dataService.createMeal.and.returnValue(of({ mealId: 'meal-1', mealType: 'LUNCH', name: 'Lunch', totalCalories: 300, totalProteinGrams: 30, consumedAt: '2026-06-20T04:00:00Z', itemCount: 1 }));
    dataService.quickAddMeal.and.returnValue(of({ mealId: 'meal-2', mealType: 'SNACK', name: 'Snack', totalCalories: 120, totalProteinGrams: 5, consumedAt: '2026-06-20T04:00:00Z', itemCount: 0 }));
    dataService.getFoodByBarcode.and.returnValue(of(null));
    dataService.logMealFromTemplate.and.returnValue(of({ ok: true }));
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

  it('hides the page controls when there is only one food page', () => {
    component.totalPages.set(1);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.page-controls')).toBeNull();
  });

  it('adds multiple foods and totals their nutrition', () => {
    component.selectFood(searchFood);
    component.setQuantity('2');
    component.addSelectedFood();

    component.selectFood(searchFood);
    component.setQuantity('1');
    component.addSelectedFood();

    expect(component.items().length).toBe(2);
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
    expect(draft.items.length).toBe(2);
    expect(draft.items[0]).toEqual(
      jasmine.objectContaining({
        foodCatalogItemId: 'food-chicken',
        foodServingId: 'serving-150',
        quantity: 2,
        calories: 300,
        proteinGrams: 30
      })
    );
    expect(component.items().length).toBe(0);
  });

  it('maps USER scoped foods to customFoodId', () => {
    const item = calculateMealItem({ ...chickenDetail, scope: 'USER', foodId: 'custom-1' }, serving, 1);

    expect(item?.customFoodId).toBe('custom-1');
    expect(item?.foodCatalogItemId).toBeNull();
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
    expect(component.formatAmount(12.34, 'g')).toBe('12.3g');
  });

  it('adds logged foods from detail lookup or snapshot and updates item quantities', () => {
    dataService.getFoodDetail.and.returnValue(of(chickenDetail));
    component.addLoggedFood(loggedFood);

    expect(component.selectedDetail()).toEqual(chickenDetail);
    expect(toast.success).toHaveBeenCalledWith('Loaded "Chicken rice" for serving selection.');

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
    const detailedItem = component.items().at(-1)!;
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

    expect(component.selectedDetail()).toEqual(chickenDetail);

    dataService.getFoodByBarcode.and.returnValue(throwError(() => new Error('scanner offline')));
    component.lookupBarcode();

    expect(component.barcodeLooking()).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith('Barcode lookup failed. Please retry.');
  });

  it('logs templates and rolls back favorite updates on failure', () => {
    spyOn(component.saved, 'emit');

    component.logTemplate(template);

    expect(dataService.logMealFromTemplate).toHaveBeenCalledWith('template-1');
    expect(toast.success).toHaveBeenCalledWith('Logged "Training lunch".');
    expect(component.saved.emit).toHaveBeenCalled();

    dataService.logMealFromTemplate.and.returnValue(throwError(() => new Error('template failed')));
    component.logTemplate(template);

    expect(toast.error).toHaveBeenCalledWith('Unable to log from template. Please retry.');

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
    expect(component.isFavoriteUpdating(searchFood)).toBeTrue();
    expect(toast.error).toHaveBeenCalledWith('Unable to update favorites. Please retry.');
  });
});
