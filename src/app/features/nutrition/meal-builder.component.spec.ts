import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { FoodDetail, FoodSearchResult, FoodServing, PagedFoods } from '../../core/fitsync.models';
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

  it('resets to the first food page when the page size changes', () => {
    dataService.searchFoodsPage.and.callFake((query, options) =>
      of(
        pagedFoods([searchFood], {
          page: options?.page ?? 0,
          size: options?.size ?? 20,
          totalPages: 5,
          totalElements: 90
        })
      )
    );

    component.nextPage();
    fixture.detectChanges();
    component.setPageSize(50);
    fixture.detectChanges();

    expect(component.page()).toBe(0);
    expect(dataService.searchFoodsPage).toHaveBeenCalledWith(
      '',
      jasmine.objectContaining({
        page: 0,
        size: 50
      })
    );
  });

  it('renders food search page totals in the pagination bar', () => {
    expect(fixture.nativeElement.textContent).toContain('Page 1 / 2 (21 foods)');
    expect(fixture.nativeElement.textContent).toContain('Per page');
  });

  it('hides the pagination bar when there is only one food page', () => {
    component.totalPages.set(1);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.pagination-bar')).toBeNull();
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
});
