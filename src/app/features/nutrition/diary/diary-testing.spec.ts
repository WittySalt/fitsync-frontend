import { of } from 'rxjs';

import { NutritionDiaryService } from './nutrition-diary.service';
import { BalanceEntry, DiaryItem, DiaryMeal, DiarySummary, NutrientRow, RangeDay, WaterDay } from './diary.models';

/** Builders for specs. Each takes only what a spec cares about and fills the rest with plain values. */
export function item(overrides: Partial<DiaryItem> = {}): DiaryItem {
  const base: DiaryItem = {
    mealItemId: 'item-1',
    foodName: 'Greek yogurt',
    amount: '200 g',
    calories: 146,
    proteinGrams: 20,
    carbsGrams: 7,
    fatGrams: 8,
    fiberGrams: null,
    sugarGrams: null,
    sodiumMg: null,
    categoryCode: 'DAIRY',
    foodGroup: 'DAIRY',
    gramsConsumed: 200,
    waterMl: null,
    recipeId: null,
    recipeServings: null,
    draft: {
      foodCatalogItemId: 'food-1',
      customFoodId: null,
      foodServingId: 'serving-1',
      foodName: 'Greek yogurt',
      brandName: null,
      quantity: 1,
      unit: 'serving',
      servingSize: 200,
      servingUnit: 'g',
      snapshotServingLabel: '200 g',
      calories: 146,
      proteinGrams: 20,
      carbsGrams: 7,
      fatGrams: 8,
      fiberGrams: null,
      sugarGrams: null,
      sodiumMg: null
    }
  };
  const merged = { ...base, ...overrides };
  // The draft follows the item, so a spec that renames a food or changes its kcal gets a matching draft.
  return {
    ...merged,
    draft: { ...base.draft, foodName: merged.foodName, calories: merged.calories, proteinGrams: merged.proteinGrams, ...overrides.draft }
  };
}

export function meal(overrides: Partial<DiaryMeal> = {}): DiaryMeal {
  const items = overrides.items ?? [item()];
  return {
    mealId: 'meal-1',
    mealType: 'BREAKFAST',
    name: 'Breakfast',
    consumedAt: new Date(2026, 9, 2, 7, 40).toISOString(),
    totalCalories: items.reduce((sum, entry) => sum + entry.calories, 0),
    totalProteinGrams: items.reduce((sum, entry) => sum + entry.proteinGrams, 0),
    totalCarbsGrams: items.reduce((sum, entry) => sum + entry.carbsGrams, 0),
    totalFatGrams: items.reduce((sum, entry) => sum + entry.fatGrams, 0),
    ...overrides,
    items
  };
}

export function summary(overrides: Partial<DiarySummary> = {}): DiarySummary {
  return {
    totalCalories: 1500,
    targetCalories: 2100,
    totalProteinGrams: 87,
    targetProteinGrams: 140,
    totalCarbsGrams: 158,
    targetCarbsGrams: 236,
    totalFatGrams: 36,
    targetFatGrams: 70,
    mealCount: 3,
    balance: null,
    proteinByMeal: null,
    ...overrides
  };
}

export function rangeDay(date: string, overrides: Partial<RangeDay> = {}): RangeDay {
  return {
    date,
    logged: true,
    totalCalories: 2000,
    targetCalories: 2100,
    fiberMet: null,
    potassiumMet: null,
    sugarWithin: null,
    saturatedFatWithin: null,
    sodiumWithin: null,
    ...overrides
  };
}

export function balanceEntry(overrides: Partial<BalanceEntry> = {}): BalanceEntry {
  return {
    code: 'FIBER',
    displayName: 'Fibre',
    kind: 'TARGET',
    amount: 15,
    unit: 'g',
    reference: 28,
    share: 15 / 28,
    met: false,
    over: false,
    topSources: [],
    ...overrides
  };
}

export function waterDay(overrides: Partial<WaterDay> = {}): WaterDay {
  return { date: '2026-10-02', totalMl: 0, fromDrinksMl: 0, entries: [], drinkEntries: [], ...overrides };
}

export function nutrientRow(overrides: Partial<NutrientRow> = {}): NutrientRow {
  return {
    code: 'VIT_D',
    displayName: 'Vitamin D',
    kind: 'VITAMIN',
    unit: 'µg',
    averageAmount: 5.1,
    reference: 15,
    share: 0.34,
    met: false,
    upperLimit: 100,
    aboveUpperLimit: false,
    richestUsualFood: null,
    days: [],
    ...overrides
  };
}

/** A stand-in for the Diary service with the answers of an empty, quiet day. A spec overrides what it cares about. */
export function diaryServiceStub(): jasmine.SpyObj<NutritionDiaryService> {
  const stub = jasmine.createSpyObj<NutritionDiaryService>('NutritionDiaryService', [
    'getSummary',
    'getMeals',
    'getRange',
    'getWater',
    'getNutrients',
    'searchDrinks',
    'recentDrinks',
    'frequentDrinks',
    'getDrinkDetail',
    'logWater',
    'deleteWater',
    'logDrink',
    'deleteMeal'
  ]);
  stub.getSummary.and.returnValue(of(summary()));
  stub.getMeals.and.returnValue(of([]));
  stub.getRange.and.returnValue(of([]));
  stub.getWater.and.returnValue(of(waterDay()));
  stub.getNutrients.and.returnValue(of({ daysLogged: 0, referenceLabel: null, focusCodes: [], itemsLogged: null, itemsWithoutNutrients: null, nutrients: [] }));
  stub.searchDrinks.and.returnValue(of([]));
  stub.recentDrinks.and.returnValue(of([]));
  stub.frequentDrinks.and.returnValue(of([]));
  stub.deleteMeal.and.returnValue(of(undefined));
  stub.deleteWater.and.returnValue(of(undefined));
  return stub;
}

/**
 * The text of an element with a space between the separate pieces of it, the way the pieces read
 * one after another. textContent alone runs neighbouring elements together.
 */
export function spoken(element: Node | null | undefined): string {
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const piece = node.textContent?.trim();
      if (piece) {
        parts.push(piece);
      }
    } else {
      node.childNodes.forEach(walk);
    }
  };
  if (element) {
    walk(element);
  }
  return parts.join(' ');
}
