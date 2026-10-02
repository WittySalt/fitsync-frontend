import { normalizeReferenceRange } from '../../../core/account-data.service';
import { FoodServing, MealItemDraft } from '../../../core/fitsync.models';
import { asFoodGroup } from '../../../shared/food/food-groups';
import {
  BalanceEntry,
  DiaryItem,
  DiaryMeal,
  DiarySummary,
  DrinkDetail,
  DrinkOption,
  FrequentDrink,
  NutrientDay,
  NutrientRow,
  NutrientSummary,
  ProteinByMealView,
  RangeDay,
  WaterDay
} from './diary.models';

type Wire = Record<string, unknown>;

/** A finite number from the wire (numbers and numeric strings both occur), or null. */
export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function flag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function list(value: unknown): Wire[] {
  return Array.isArray(value) ? value.filter((entry): entry is Wire => typeof entry === 'object' && entry !== null) : [];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * How much of the food was logged, as a person would say it. Grams and millilitres read as "187 g"
 * and "250 ml". Any other unit reads as the serving label ("1 medium"), or "1.1 servings of 1 medium"
 * for another count, with the weight after it in brackets when it is known and not already said.
 */
export function amountLabel(
  quantity: number,
  unit: string | null,
  servingLabel: string | null,
  gramsConsumed: number | null
): string {
  const measure = (unit ?? '').trim().toLowerCase();
  if (measure === 'g' || measure === 'ml') {
    return `${round(quantity)} ${measure}`;
  }
  const grams = gramsConsumed !== null && gramsConsumed > 0 ? `${Math.round(gramsConsumed)} g` : null;
  let amount: string;
  if (servingLabel) {
    if (quantity === 1) {
      amount = servingLabel;
    } else {
      // "1.1 x medium" reads well for a bare word, but "2 x 1 cup" does not, so a label with a count in it is spelled out.
      amount = /^\d/.test(servingLabel) ? `${round(quantity)} servings of ${servingLabel}` : `${round(quantity)} \u00d7 ${servingLabel}`;
    }
  } else if (unit) {
    amount = `${round(quantity)} ${unit}`.trim();
  } else if (grams) {
    return grams;
  } else {
    amount = `${round(quantity)} serving`;
  }
  return grams && amount !== grams ? `${amount} (${grams})` : amount;
}

export function mapDiaryItem(raw: Wire): DiaryItem {
  const quantity = num(raw['quantity']) ?? 1;
  const gramsConsumed = num(raw['gramsConsumed']);
  const servingLabel = text(raw['snapshotServingLabel']);
  const draft: MealItemDraft = {
    foodCatalogItemId: text(raw['foodCatalogItemId']),
    customFoodId: text(raw['customFoodId']),
    foodServingId: text(raw['foodServingId']),
    foodName: text(raw['foodName']) ?? 'Food',
    brandName: text(raw['brandName']),
    quantity,
    unit: text(raw['unit']) ?? 'serving',
    servingSize: num(raw['servingSize']),
    servingUnit: text(raw['servingUnit']),
    snapshotServingLabel: servingLabel,
    calories: num(raw['calories']) ?? 0,
    proteinGrams: num(raw['proteinGrams']) ?? 0,
    carbsGrams: num(raw['carbsGrams']) ?? 0,
    fatGrams: num(raw['fatGrams']) ?? 0,
    fiberGrams: num(raw['fiberGrams']),
    sugarGrams: num(raw['sugarGrams']),
    sodiumMg: num(raw['sodiumMg'])
  };
  return {
    mealItemId: text(raw['mealItemId']) ?? '',
    foodName: draft.foodName,
    amount: amountLabel(quantity, draft.unit, servingLabel, gramsConsumed),
    calories: draft.calories,
    proteinGrams: draft.proteinGrams,
    carbsGrams: draft.carbsGrams,
    fatGrams: draft.fatGrams,
    fiberGrams: draft.fiberGrams,
    sugarGrams: draft.sugarGrams,
    sodiumMg: draft.sodiumMg,
    categoryCode: text(raw['categoryCode']),
    foodGroup: asFoodGroup(text(raw['foodGroup'])),
    gramsConsumed,
    waterMl: num(raw['waterMl']),
    draft
  };
}

export function mapDiaryMeal(raw: Wire): DiaryMeal {
  return {
    mealId: text(raw['mealId']) ?? '',
    mealType: (text(raw['mealType']) ?? 'SNACK').toUpperCase(),
    name: text(raw['name']) ?? '',
    consumedAt: text(raw['consumedAt']) ?? '',
    totalCalories: num(raw['totalCalories']) ?? 0,
    totalProteinGrams: num(raw['totalProteinGrams']) ?? 0,
    totalCarbsGrams: num(raw['totalCarbsGrams']) ?? 0,
    totalFatGrams: num(raw['totalFatGrams']) ?? 0,
    items: list(raw['items']).map(mapDiaryItem)
  };
}

function mapBalanceEntry(raw: Wire): BalanceEntry | null {
  const amount = num(raw['amount']);
  const reference = num(raw['reference']);
  const code = text(raw['code']);
  if (!code || reference === null || reference <= 0) {
    return null;
  }
  return {
    code,
    displayName: text(raw['displayName']) ?? code,
    kind: raw['kind'] === 'LIMIT' ? 'LIMIT' : 'TARGET',
    amount,
    unit: text(raw['unit']) ?? 'g',
    reference,
    share: amount === null ? null : (num(raw['share']) ?? amount / reference),
    met: raw['met'] === true,
    over: raw['over'] === true,
    topSources: list(raw['topSources'])
      .map((source) => ({ foodName: text(source['foodName']) ?? '', amount: num(source['amount']) ?? 0 }))
      .filter((source) => source.foodName)
  };
}

function mapProteinByMeal(raw: unknown): ProteinByMealView | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const wire = raw as Wire;
  const low = num(wire['lowGrams']);
  const high = num(wire['highGrams']);
  if (low === null || high === null) {
    return null;
  }
  return {
    weightKg: num(wire['weightKg']),
    lowGrams: low,
    highGrams: high,
    meals: list(wire['meals']).map((meal) => ({
      mealType: (text(meal['mealType']) ?? '').toUpperCase(),
      grams: num(meal['grams']) ?? 0
    }))
  };
}

/** The day's summary. Balance and protein by meal are null when the backend sends none, so the cards hide. */
export function mapDiarySummary(raw: Wire): DiarySummary {
  const balance = Array.isArray(raw['balance'])
    ? list(raw['balance']).map(mapBalanceEntry).filter((entry): entry is BalanceEntry => entry !== null)
    : null;
  return {
    totalCalories: num(raw['totalCalories']) ?? 0,
    targetCalories: num(raw['targetCalories']),
    totalProteinGrams: num(raw['totalProteinGrams']) ?? 0,
    targetProteinGrams: num(raw['targetProteinGrams']),
    totalCarbsGrams: num(raw['totalCarbsGrams']) ?? 0,
    targetCarbsGrams: num(raw['targetCarbsGrams']),
    totalFatGrams: num(raw['totalFatGrams']) ?? 0,
    targetFatGrams: num(raw['targetFatGrams']),
    mealCount: num(raw['mealCount']) ?? 0,
    balance: balance && balance.length ? balance : null,
    proteinByMeal: mapProteinByMeal(raw['proteinByMeal'])
  };
}

export function mapRangeDay(raw: Wire): RangeDay {
  return {
    date: text(raw['date']) ?? '',
    logged: raw['logged'] === true,
    totalCalories: num(raw['totalCalories']) ?? 0,
    targetCalories: num(raw['targetCalories']),
    fiberMet: flag(raw['fiberMet']),
    potassiumMet: flag(raw['potassiumMet']),
    sugarWithin: flag(raw['sugarWithin']),
    saturatedFatWithin: flag(raw['saturatedFatWithin']),
    sodiumWithin: flag(raw['sodiumWithin'])
  };
}

export function mapWaterDay(raw: Wire, date: string): WaterDay {
  return {
    date: text(raw['date']) ?? date,
    totalMl: num(raw['totalMl']) ?? 0,
    fromDrinksMl: num(raw['fromDrinksMl']),
    entries: list(raw['entries']).map((entry) => ({
      waterId: text(entry['waterId']) ?? '',
      amountMl: num(entry['amountMl']) ?? 0,
      loggedAt: text(entry['loggedAt']) ?? ''
    })),
    drinkEntries: list(raw['drinkEntries']).map((entry) => ({
      mealItemId: text(entry['mealItemId']) ?? '',
      mealId: text(entry['mealId']) ?? '',
      foodName: text(entry['foodName']) ?? 'Drink',
      waterMl: num(entry['waterMl']) ?? 0,
      consumedAt: text(entry['consumedAt']) ?? ''
    }))
  };
}

function mapNutrientDay(raw: Wire, reference: number): NutrientDay | null {
  const date = text(raw['date']);
  if (!date) {
    return null;
  }
  const amount = num(raw['amount']);
  return { date, logged: raw['logged'] === true, amount, share: amount === null ? null : (num(raw['share']) ?? amount / reference) };
}

function mapNutrientRow(raw: Wire): NutrientRow | null {
  const code = text(raw['code']);
  const reference = num(raw['reference']);
  const average = num(raw['averageAmount']);
  if (!code || reference === null || reference <= 0) {
    return null;
  }
  const kind = raw['kind'] === 'MINERAL' ? 'MINERAL' : raw['kind'] === 'VITAMIN' ? 'VITAMIN' : 'OTHER';
  return {
    code,
    displayName: text(raw['displayName']) ?? code,
    kind,
    unit: text(raw['unit']) ?? '',
    averageAmount: average,
    reference,
    share: average === null ? null : (num(raw['share']) ?? average / reference),
    met: raw['met'] === true,
    upperLimit: num(raw['upperLimit']),
    aboveUpperLimit: raw['aboveUpperLimit'] === true,
    richestUsualFood: text(raw['richestUsualFood']),
    days: list(raw['days']).map((day) => mapNutrientDay(day, reference)).filter((day): day is NutrientDay => day !== null)
  };
}

export function mapNutrientSummary(raw: Wire): NutrientSummary {
  const coverage = typeof raw['coverage'] === 'object' && raw['coverage'] !== null ? (raw['coverage'] as Wire) : null;
  return {
    daysLogged: num(raw['daysLogged']) ?? 0,
    referenceLabel: text(raw['referenceLabel']),
    referenceRange: raw['referenceRange'] === undefined || raw['referenceRange'] === null ? null : normalizeReferenceRange(raw['referenceRange']),
    focusCodes: Array.isArray(raw['focusCodes']) ? raw['focusCodes'].filter((code): code is string => typeof code === 'string') : [],
    itemsLogged: coverage ? num(coverage['itemsLogged']) : null,
    itemsWithoutNutrients: coverage ? num(coverage['itemsWithoutNutrients']) : null,
    nutrients: list(raw['nutrients']).map(mapNutrientRow).filter((row): row is NutrientRow => row !== null)
  };
}

export function mapDrinkOption(raw: Wire): DrinkOption | null {
  const foodId = text(raw['foodId']) ?? text(raw['foodCatalogItemId']);
  if (!foodId) {
    return null;
  }
  return {
    foodId,
    name: text(raw['displayName']) ?? text(raw['foodName']) ?? 'Drink',
    calories: num(raw['calories']) ?? 0,
    basisLabel: text(raw['basisLabel']) ?? text(raw['snapshotServingLabel']) ?? '',
    countsTowardWater: raw['countsTowardWater'] === true
  };
}

export function mapFrequentDrink(raw: Wire): FrequentDrink | null {
  if (!text(raw['foodCatalogItemId'])) {
    return null;
  }
  const item = mapDiaryItem(raw);
  return { name: item.foodName, calories: item.calories, draft: item.draft };
}

function mapServing(raw: Wire, index: number): FoodServing {
  return {
    servingId: text(raw['servingId']),
    label: text(raw['label']) ?? '',
    quantity: num(raw['quantity']),
    unit: text(raw['unit']),
    gramsEquivalent: num(raw['gramsEquivalent']),
    millilitersEquivalent: num(raw['millilitersEquivalent']),
    sortOrder: num(raw['sortOrder']) ?? index,
    defaultServing: raw['defaultServing'] === true
  };
}

export function mapDrinkDetail(raw: Wire): DrinkDetail {
  return {
    foodId: text(raw['foodId']),
    displayName: text(raw['displayName']) ?? 'Drink',
    brandName: text(raw['brandName']) ?? '',
    categoryName: text(raw['categoryName']),
    scope: text(raw['scope']) ?? 'CATALOG',
    calories: num(raw['calories']) ?? 0,
    proteinGrams: num(raw['proteinGrams']) ?? 0,
    carbsGrams: num(raw['carbsGrams']) ?? 0,
    fatGrams: num(raw['fatGrams']) ?? 0,
    fiberGrams: num(raw['fiberGrams']),
    sugarGrams: num(raw['sugarGrams']),
    sodiumMg: num(raw['sodiumMg']),
    basisQuantity: num(raw['basisQuantity']) ?? 100,
    basisUnit: text(raw['basisUnit']) ?? 'ml',
    densityGramsPerMl: num(raw['densityGramsPerMl']),
    primaryBarcode: text(raw['primaryBarcode']) ?? '',
    sourceDataset: text(raw['sourceDataset']),
    servings: list(raw['servings']).map(mapServing),
    foodGroup: text(raw['foodGroup']),
    countsTowardWater: raw['countsTowardWater'] === true,
    waterGrams: num(raw['waterGrams']),
    alcoholGrams: num(raw['alcoholGrams'])
  };
}
