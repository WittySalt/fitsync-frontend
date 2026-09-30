import { DayMeal, DayMealItem } from '../../../core/fitsync.models';

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export interface MealSlotDefinition {
  key: MealSlot;
  label: string;
  /** Lower-case name for a sentence such as "Log lunch". */
  noun: string;
  /** The usual time of the meal in minutes after midnight, or null for snacks, which have none. */
  usualMinutes: number | null;
}

export const MEAL_SLOTS: readonly MealSlotDefinition[] = [
  { key: 'BREAKFAST', label: 'Breakfast', noun: 'breakfast', usualMinutes: 7 * 60 + 30 },
  { key: 'LUNCH', label: 'Lunch', noun: 'lunch', usualMinutes: 12 * 60 + 30 },
  { key: 'DINNER', label: 'Dinner', noun: 'dinner', usualMinutes: 19 * 60 },
  { key: 'SNACK', label: 'Snack', noun: 'snack', usualMinutes: null }
];

/** A meal window opens an hour before the usual time and closes ninety minutes after it. */
const WINDOW_BEFORE_MINUTES = 60;
const WINDOW_AFTER_MINUTES = 90;

export interface SlotSummary {
  slot: MealSlot;
  logged: boolean;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  foods: DayMealItem[];
}

/** The slot a backend meal type belongs to. Supper counts as dinner and anything else as a snack,
 *  so that the four slots add up to what the day's summary counts. */
export function slotForMealType(mealType: string): MealSlot {
  switch (mealType.toUpperCase()) {
    case 'BREAKFAST':
      return 'BREAKFAST';
    case 'LUNCH':
      return 'LUNCH';
    case 'DINNER':
    case 'SUPPER':
      return 'DINNER';
    default:
      return 'SNACK';
  }
}

/** Sums the meals of each slot and lists their foods together. A slot with no meal is not logged. */
export function summariseSlots(meals: DayMeal[]): Record<MealSlot, SlotSummary> {
  const summaries = Object.fromEntries(
    MEAL_SLOTS.map((definition) => [
      definition.key,
      { slot: definition.key, logged: false, calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, foods: [] as DayMealItem[] }
    ])
  ) as Record<MealSlot, SlotSummary>;

  for (const meal of meals) {
    const summary = summaries[slotForMealType(meal.mealType)];
    summary.logged = true;
    summary.calories += meal.totalCalories;
    summary.proteinGrams += meal.totalProteinGrams;
    summary.carbsGrams += meal.totalCarbsGrams;
    summary.fatGrams += meal.totalFatGrams;
    summary.foods.push(...meal.items);
  }
  return summaries;
}

/**
 * The slot the card opens on: the slot of the latest meal logged today, otherwise the slot whose
 * usual window holds the current time, otherwise breakfast. Snack has no window and is never
 * opened by the card itself.
 */
export function defaultMealSlot(meals: DayMeal[], now: Date): MealSlot {
  let latest: DayMeal | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const meal of meals) {
    const time = new Date(meal.consumedAt).getTime();
    // A meal without a readable time still counts, but never outranks one that has a time.
    const rank = Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
    if (latest === null || rank >= latestTime) {
      latest = meal;
      latestTime = rank;
    }
  }
  if (latest !== null) {
    return slotForMealType(latest.mealType);
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  const due = MEAL_SLOTS.find(
    (definition) =>
      definition.usualMinutes !== null &&
      minutes >= definition.usualMinutes - WINDOW_BEFORE_MINUTES &&
      minutes <= definition.usualMinutes + WINDOW_AFTER_MINUTES
  );
  return due?.key ?? 'BREAKFAST';
}

export interface MacroShares {
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Each macro's share of the meal's energy as a percentage that adds up to 100, using 4 kcal per
 * gram of protein and carbohydrate and 9 kcal per gram of fat. Null when the meal has no macros
 * to draw, so the bar is left out instead of drawn empty.
 */
export function macroEnergyShares(proteinGrams: number, carbsGrams: number, fatGrams: number): MacroShares | null {
  const protein = Math.max(proteinGrams, 0) * 4;
  const carbs = Math.max(carbsGrams, 0) * 4;
  const fat = Math.max(fatGrams, 0) * 9;
  const total = protein + carbs + fat;
  if (!(total > 0)) {
    return null;
  }
  return { protein: (protein / total) * 100, carbs: (carbs / total) * 100, fat: (fat / total) * 100 };
}

/** A whole percent of the target, or null when there is no usable target. */
export function percentOfTarget(value: number, target: number | null | undefined): number | null {
  if (target == null || !(target > 0) || !Number.isFinite(value)) {
    return null;
  }
  return Math.round((value / target) * 100);
}

/** A bar's fill width, held between 0 and 100 whatever the figures are. */
export function fillPercent(value: number, target: number | null | undefined): number {
  const percent = percentOfTarget(value, target);
  return percent === null ? 0 : Math.min(Math.max(percent, 0), 100);
}

/** A whole number with thousands separators, for example "1,420". */
export function wholeNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

/** "1,420 of 2,100 kcal" with a target and "1,420 kcal" without one. */
export function budgetFigure(consumed: number, target: number | null | undefined, unit: string): string {
  return target != null && target > 0
    ? `${wholeNumber(consumed)} of ${wholeNumber(target)} ${unit}`
    : `${wholeNumber(consumed)} ${unit}`;
}
