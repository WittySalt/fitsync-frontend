import { FoodServing, MealItemDraft } from '../../../core/fitsync.models';
import { calculateMealItem } from '../meal-item-math';
import { DrinkDetail, WaterDay } from './diary.models';
import { atClock, clockText } from './diary-time';

export const GLASS_ML = 250;
export const BOTTLE_ML = 500;
/** The amounts the add dialog offers for plain water. */
export const WATER_AMOUNTS: readonly number[] = [150, 250, 330, 500, 750];
/** The sizes of a drink. Other is typed in. */
export const DRINK_SIZES: readonly { label: string; ml: number | null }[] = [
  { label: 'Small', ml: 250 },
  { label: 'Medium', ml: 350 },
  { label: 'Large', ml: 500 },
  { label: 'Other', ml: null }
];

/** The day shown on the timeline, from 06:00 to 22:00. */
const DAY_START_HOUR = 6;
const DAY_SPAN_HOURS = 16;

export interface WaterTotals {
  plainMl: number;
  /** Water that came with drinks, or null when the backend does not say. */
  drinksMl: number | null;
  totalMl: number;
}

export function waterTotals(day: WaterDay): WaterTotals {
  const drinks = day.fromDrinksMl;
  return { plainMl: day.totalMl, drinksMl: drinks, totalMl: day.totalMl + (drinks ?? 0) };
}

/** The two parts of the progress bar as percentages of the goal, never past 100 together. */
export function progressShares(plainMl: number, drinksMl: number | null, goalMl: number | null): { plain: number; drinks: number } | null {
  if (goalMl === null || goalMl <= 0) {
    return null;
  }
  const plain = Math.min((plainMl / goalMl) * 100, 100);
  const drinks = Math.min(((drinksMl ?? 0) / goalMl) * 100, 100 - plain);
  return { plain, drinks: Math.max(drinks, 0) };
}

export interface TimelineMark {
  key: string;
  /** Position along the day as a percentage. */
  left: number;
  /** Diameter in pixels, larger for a bigger amount. */
  size: number;
  kind: 'water' | 'drink';
  label: string;
}

/** A dot for each plain water entry and each drink that counts towards water, placed by the clock. */
export function timelineMarks(day: WaterDay): TimelineMark[] {
  const mark = (key: string, at: string, ml: number, kind: TimelineMark['kind'], name: string): TimelineMark | null => {
    const date = new Date(at);
    if (Number.isNaN(date.getTime()) || ml <= 0) {
      return null;
    }
    const hours = date.getHours() + date.getMinutes() / 60;
    const left = Math.min(Math.max(((hours - DAY_START_HOUR) / DAY_SPAN_HOURS) * 100, 0), 100);
    // An 8 px dot grows 1 px for every 100 ml, up to 22 px.
    return { key, left, size: Math.min(8 + ml / 100, 22), kind, label: `${name}, ${ml} ml at ${clockText(date)}` };
  };
  return [
    ...day.entries.map((entry) => mark(`w-${entry.waterId}`, entry.loggedAt, entry.amountMl, 'water', 'Water')),
    ...day.drinkEntries.map((entry) => mark(`d-${entry.mealItemId}`, entry.consumedAt, entry.waterMl, 'drink', entry.foodName))
  ].filter((entry): entry is TimelineMark => entry !== null);
}

/** The moment an add should be logged at: now for today, otherwise the chosen clock time on that day. */
export function loggedMoment(date: string, clock: string, today: string, now: Date): Date {
  // A past day with no time chosen is logged at midday, well clear of either end of that day.
  return date === today && !clock ? now : atClock(date, clock || '12:00');
}

function basisMl(detail: DrinkDetail): number | null {
  const quantity = detail.basisQuantity;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  const unit = detail.basisUnit.trim().toLowerCase();
  if (unit === 'ml') {
    return quantity;
  }
  if (unit === 'l') {
    return quantity * 1000;
  }
  if (unit === 'g') {
    return quantity / (detail.densityGramsPerMl ?? 1);
  }
  if (unit === 'kg') {
    return (quantity * 1000) / (detail.densityGramsPerMl ?? 1);
  }
  return null;
}

export interface DrinkPreview {
  /** Water this drink counts for, or null when it does not count or the amount is not known. */
  waterMl: number | null;
  calories: number;
  sugarGrams: number | null;
  /** Grams of alcohol, set only for a drink that has any. Such a drink never counts towards water. */
  alcoholGrams: number | null;
}

/** What `amountMl` of a drink adds: water, kcal, sugar, or alcohol in place of sugar. Null when the size cannot be scaled. */
export function drinkPreview(detail: DrinkDetail, amountMl: number): DrinkPreview | null {
  const basis = basisMl(detail);
  if (basis === null || !Number.isFinite(amountMl) || amountMl <= 0) {
    return null;
  }
  const scale = amountMl / basis;
  const alcoholPer100 = detail.alcoholGrams === null ? 0 : (detail.alcoholGrams / basis) * 100;
  // Up to 0.5 g per 100 is a trace, as in an alcohol-free beer, and does not stop a drink counting as water.
  const hasAlcohol = alcoholPer100 > 0.5;
  const counts = detail.countsTowardWater && !hasAlcohol && detail.waterGrams !== null;
  return {
    waterMl: counts && detail.waterGrams !== null ? Math.round(detail.waterGrams * scale) : null,
    calories: Math.round(detail.calories * scale),
    sugarGrams: detail.sugarGrams === null ? null : Math.round(detail.sugarGrams * scale * 10) / 10,
    alcoholGrams: hasAlcohol && detail.alcoholGrams !== null ? Math.round(detail.alcoholGrams * scale * 10) / 10 : null
  };
}

function servingMl(serving: FoodServing): number {
  return serving.millilitersEquivalent !== null && serving.millilitersEquivalent > 0 ? serving.millilitersEquivalent : 0;
}

/**
 * The meal item to log for `amountMl` of a drink. A listed serving of exactly that size is used as
 * it is. Otherwise the default serving that has a volume is scaled, so the backend still sees a real
 * serving and can work out grams and water. A drink with no serving of known volume gets one made
 * from the amount.
 */
export function drinkItem(detail: DrinkDetail, amountMl: number): MealItemDraft | null {
  const withVolume = detail.servings.filter((serving) => servingMl(serving) > 0);
  const exact = withVolume.find((serving) => Math.abs(servingMl(serving) - amountMl) < 0.5);
  if (exact) {
    return calculateMealItem(detail, exact, 1);
  }
  const scaled = withVolume.find((serving) => serving.defaultServing) ?? withVolume[0];
  if (scaled) {
    return calculateMealItem(detail, scaled, amountMl / servingMl(scaled));
  }
  const made: FoodServing = {
    servingId: null,
    label: `${amountMl} ml`,
    quantity: amountMl,
    unit: 'ml',
    gramsEquivalent: amountMl * (detail.densityGramsPerMl ?? 1),
    millilitersEquivalent: amountMl,
    sortOrder: 0,
    defaultServing: true
  };
  return calculateMealItem(detail, made, 1);
}
