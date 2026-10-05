import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { FoodDetail, FoodSearchResult, FoodServing, NutritionSummary } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { NutritionDiaryService } from './diary/nutrition-diary.service';
import { MealBuilderComponent } from './meal-builder.component';

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
  diary: jasmine.SpyObj<NutritionDiaryService>;
  toast: jasmine.SpyObj<ToastService>;
  el: HTMLElement;
}

/** A builder over a stubbed backend whose food detail comes from `details`, keyed by food id. */
export async function createBuilder(
  details: FoodDetail[],
  results: FoodSearchResult[] = [],
  setup: (stubs: { data: jasmine.SpyObj<FitSyncDataService>; diary: jasmine.SpyObj<NutritionDiaryService> }) => void = () => undefined
): Promise<BuilderHarness> {
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
  const diary = jasmine.createSpyObj<NutritionDiaryService>('NutritionDiaryService', ['frequentDrinks', 'searchDrinks', 'getDrinkDetail']);
  diary.frequentDrinks.and.returnValue(of([]));
  diary.searchDrinks.and.returnValue(of([]));
  const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
  setup({ data, diary });
  await TestBed.configureTestingModule({
    imports: [MealBuilderComponent],
    providers: [
      { provide: FitSyncDataService, useValue: data },
      { provide: NutritionDiaryService, useValue: diary },
      { provide: ToastService, useValue: toast }
    ]
  }).compileComponents();
  const fixture = TestBed.createComponent(MealBuilderComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, data, diary, toast, el: fixture.nativeElement as HTMLElement };
}
