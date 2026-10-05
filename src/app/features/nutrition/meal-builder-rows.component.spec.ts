import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { FoodDetail, FoodSearchResult, FoodServing, NutritionSummary } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { MealBuilderComponent, defaultMealType } from './meal-builder.component';

export const hundredGrams = (id: string): FoodServing => ({
  servingId: id,
  label: '100 g',
  quantity: 100,
  unit: 'g',
  gramsEquivalent: 100,
  millilitersEquivalent: null,
  sortOrder: 0,
  defaultServing: false
});

export function foodDetail(foodId: string, name: string, calories: number, servings: FoodServing[]): FoodDetail {
  return {
    foodId,
    displayName: name,
    brandName: '',
    categoryName: null,
    scope: 'CATALOG',
    calories,
    proteinGrams: 10,
    carbsGrams: 10,
    fatGrams: 5,
    fiberGrams: null,
    sugarGrams: null,
    sodiumMg: null,
    basisQuantity: 100,
    basisUnit: 'g',
    densityGramsPerMl: null,
    primaryBarcode: '',
    sourceDataset: null,
    servings
  };
}

export function searchItem(foodId: string, name: string, extra: Partial<FoodSearchResult> = {}): FoodSearchResult {
  return {
    foodId,
    displayName: name,
    brandName: '',
    categoryName: null,
    scope: 'CATALOG',
    calories: 100,
    proteinGrams: 0,
    basisUnit: '100 g',
    basisLabel: '100 g',
    primaryBarcode: '',
    verified: false,
    ...extra
  };
}

const summary: NutritionSummary = {
  totalCalories: 0,
  targetCalories: 2000,
  totalProteinGrams: 0,
  targetProteinGrams: 140,
  totalCarbsGrams: 0,
  targetCarbsGrams: 220,
  totalFatGrams: 0,
  targetFatGrams: 70,
  mealCount: 0,
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

export interface BuilderHarness {
  fixture: ComponentFixture<MealBuilderComponent>;
  component: MealBuilderComponent;
  data: jasmine.SpyObj<FitSyncDataService>;
  el: HTMLElement;
}

/** A builder over a stubbed backend whose food detail comes from `details`, keyed by food id. */
export async function createBuilder(details: FoodDetail[], results: FoodSearchResult[] = []): Promise<BuilderHarness> {
  const data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
    'searchFoodsPage',
    'getFoodCategories',
    'getRecentFoods',
    'getFavoriteFoods',
    'getFrequentFoods',
    'getMealTemplates',
    'getDailyNutritionSummary',
    'getFoodDetail',
    'createMeal'
  ]);
  data.searchFoodsPage.and.returnValue(of({ items: results, page: 0, size: 20, totalPages: 1, totalElements: results.length }));
  data.getFoodCategories.and.returnValue(of([]));
  data.getRecentFoods.and.returnValue(of([]));
  data.getFavoriteFoods.and.returnValue(of([]));
  data.getFrequentFoods.and.returnValue(of([]));
  data.getMealTemplates.and.returnValue(of([]));
  data.getDailyNutritionSummary.and.returnValue(of(summary));
  data.getFoodDetail.and.callFake((id: string) => of(details.find((detail) => detail.foodId === id) ?? null));
  data.createMeal.and.returnValue(of({ mealId: 'm', mealType: 'LUNCH', name: 'Lunch', totalCalories: 0, totalProteinGrams: 0, consumedAt: '', itemCount: 0 }));
  await TestBed.configureTestingModule({
    imports: [MealBuilderComponent],
    providers: [
      { provide: FitSyncDataService, useValue: data },
      { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']) }
    ]
  }).compileComponents();
  const fixture = TestBed.createComponent(MealBuilderComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, data, el: fixture.nativeElement as HTMLElement };
}

describe('MealBuilderComponent rows', () => {
  const rice = foodDetail('rice', 'Rice', 130, [hundredGrams('rice-100')]);
  const egg = foodDetail('egg', 'Egg', 150, [hundredGrams('egg-100')]);
  let h: BuilderHarness;

  beforeEach(async () => {
    h = await createBuilder([rice, egg], [searchItem('rice', 'Rice'), searchItem('egg', 'Egg')]);
  });

  function quantityInputs(): HTMLInputElement[] {
    return Array.from(h.el.querySelectorAll<HTMLInputElement>('.meal-item input[type="number"]'));
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    h.fixture.detectChanges();
  }

  it('keeps each row quantity on its own and prices each row by its own quantity', () => {
    h.component.addFoodResult(searchItem('rice', 'Rice'));
    h.component.addFoodResult(searchItem('egg', 'Egg'));
    h.fixture.detectChanges();

    type(quantityInputs()[0], '2');
    type(quantityInputs()[1], '1');

    expect(quantityInputs().map((input) => input.value)).toEqual(['2', '1']);
    expect(h.component.items().map((item) => [item.quantity, item.calories])).toEqual([[2, 260], [1, 150]]);

    type(quantityInputs()[1], '3');

    expect(quantityInputs().map((input) => input.value)).toEqual(['2', '3']);
    expect(h.component.items().map((item) => item.calories)).toEqual([260, 450]);
    expect(h.component.totals().calories).toBe(710);
  });

  it('keeps the steppers of two rows apart', () => {
    h.component.addFoodResult(searchItem('rice', 'Rice'));
    h.component.addFoodResult(searchItem('egg', 'Egg'));
    const [first, second] = h.component.items();

    h.component.incrementItem(first.id, 1);

    expect(h.component.items().map((item) => item.quantity)).toEqual([2, 1]);
    expect(second.quantity).toBe(1);
  });

  it('reads the default meal type once, from the clock', () => {
    expect(defaultMealType(new Date(2026, 9, 5, 8, 0))).toBe('BREAKFAST');
    expect(defaultMealType(new Date(2026, 9, 5, 12, 30))).toBe('LUNCH');
    expect(defaultMealType(new Date(2026, 9, 5, 15, 30))).toBe('SNACK');
    expect(defaultMealType(new Date(2026, 9, 5, 19, 0))).toBe('DINNER');
    expect(defaultMealType(new Date(2026, 9, 5, 23, 30))).toBe('SNACK');
  });

  it('names the default meal from a signal, so a late meal type change does not raise NG0100', () => {
    h.component.setMealType('LUNCH');
    h.fixture.detectChanges();
    expect(h.el.querySelector('.label-note-toggle small')?.textContent).toContain('defaults to "Lunch"');

    // The page sets the meal type after the builder rendered. The check that follows must not throw.
    h.component.setMealType('DINNER');
    expect(() => h.fixture.detectChanges()).not.toThrow();
    expect(h.el.querySelector('.label-note-toggle small')?.textContent).toContain('defaults to "Dinner"');
  });
});
