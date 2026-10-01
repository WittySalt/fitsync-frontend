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
  return { ...base, ...overrides };
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
    ...overrides
  };
}
