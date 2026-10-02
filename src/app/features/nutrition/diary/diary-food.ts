import { MEAL_SLOTS, MealSlot, slotForMealType } from '../../dashboard/today/today-meals';
import { FoodGroup } from '../../../shared/food/food-groups';
import { DiaryItem, DiaryMeal } from './diary.models';
import { clockText } from './diary-time';

export interface FoodTag {
  label: string;
  /** Good tags are green, the others grey. Neither is ever red. */
  good: boolean;
}

/** Per 100 g thresholds. Fibre follows the EU claim, sugar and salt the UK front-of-pack "high" bands. */
const HIGH_PROTEIN_ENERGY_SHARE = 0.2;
const HIGH_FIBRE_PER_100G = 6;
const HIGH_SUGAR_PER_100G = 22.5;
const HIGH_SUGAR_PER_100ML_DRINK = 11.25;
const HIGH_SODIUM_MG_PER_100G = 600;

/**
 * The quality tags of one food, worked out per 100 g from the item's own values and the grams
 * eaten: at most one green tag (protein before fibre) and one grey tag (sugar before salt).
 * A food without a weight has none, because a per 100 g figure cannot be told.
 */
export function foodTags(item: DiaryItem): FoodTag[] {
  const grams = item.gramsConsumed;
  if (grams === null || grams <= 0) {
    return [];
  }
  const per100 = (value: number | null): number | null => (value === null ? null : (value / grams) * 100);
  const tags: FoodTag[] = [];
  const proteinEnergy = item.calories > 0 ? (item.proteinGrams * 4) / item.calories : 0;
  const fibre = per100(item.fiberGrams);
  if (proteinEnergy >= HIGH_PROTEIN_ENERGY_SHARE && item.proteinGrams >= 3) {
    tags.push({ label: 'High protein', good: true });
  } else if (fibre !== null && fibre >= HIGH_FIBRE_PER_100G) {
    tags.push({ label: 'High fibre', good: true });
  }
  const sugar = per100(item.sugarGrams);
  const sugarLimit = item.foodGroup === 'DRINKS' ? HIGH_SUGAR_PER_100ML_DRINK : HIGH_SUGAR_PER_100G;
  const sodium = per100(item.sodiumMg);
  if (sugar !== null && sugar > sugarLimit) {
    tags.push({ label: 'High sugar', good: false });
  } else if (sodium !== null && sodium > HIGH_SODIUM_MG_PER_100G) {
    tags.push({ label: 'High salt', good: false });
  }
  return tags;
}

/** The "P 20 · C 7 · F 8 g" line of a food or a meal. */
export function macroLine(protein: number, carbs: number, fat: number): string {
  return `P ${Math.round(protein)} · C ${Math.round(carbs)} · F ${Math.round(fat)} g`;
}

/** One of the four parts of the meals card: every meal logged under that meal type that day, together. */
export interface MealPart {
  slot: MealSlot;
  label: string;
  logged: boolean;
  /** The ids of the meals in the part, which Delete, Log again and Save act on. */
  mealIds: string[];
  /** The time of the first meal in the part, "HH:mm", or an empty string. */
  time: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  items: DiaryItem[];
  /** Meals of a part, for Log again, which copies each one. */
  meals: DiaryMeal[];
}

/** The four parts in order. Supper counts as dinner and any other type as a snack, as on the Today card. */
export function mealParts(meals: readonly DiaryMeal[]): MealPart[] {
  const parts: MealPart[] = MEAL_SLOTS.map((slot) => ({
    slot: slot.key,
    label: slot.label,
    logged: false,
    mealIds: [],
    time: '',
    calories: 0,
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0,
    items: [],
    meals: []
  }));
  const ordered = [...meals].sort((a, b) => a.consumedAt.localeCompare(b.consumedAt));
  for (const meal of ordered) {
    const part = parts.find((entry) => entry.slot === slotForMealType(meal.mealType));
    if (!part) {
      continue;
    }
    part.logged = true;
    part.mealIds.push(meal.mealId);
    part.meals.push(meal);
    part.time = part.time || clockText(meal.consumedAt);
    part.calories += meal.totalCalories;
    part.proteinGrams += meal.totalProteinGrams;
    part.carbsGrams += meal.totalCarbsGrams;
    part.fatGrams += meal.totalFatGrams;
    part.items.push(...meal.items);
  }
  return parts;
}

/** Shares of the energy in protein, carbs and fat (4, 4 and 9 kcal a gram), for the thin split bar. */
export function macroSplit(protein: number, carbs: number, fat: number): { protein: number; carbs: number; fat: number } | null {
  const energy = { protein: protein * 4, carbs: carbs * 4, fat: fat * 9 };
  const total = energy.protein + energy.carbs + energy.fat;
  return total > 0 ? energy : null;
}

/** The food groups of a day's items, for the group count and the plate. */
export function groupsOf(items: readonly DiaryItem[]): Set<FoodGroup> {
  const found = new Set<FoodGroup>();
  for (const item of items) {
    if (item.foodGroup) {
      found.add(item.foodGroup);
    }
  }
  return found;
}

/** A food on its own, or the foods of one recipe in one meal drawn as a single row. */
export type DiaryRow =
  | { kind: 'food'; item: DiaryItem }
  | {
      kind: 'recipe';
      recipeId: string;
      /** The servings logged, null when the server did not say. */
      servings: number | null;
      items: DiaryItem[];
      calories: number;
      proteinGrams: number;
      carbsGrams: number;
      fatGrams: number;
    };

/**
 * The rows of a part: the items of one meal that came from the same recipe are one row, placed
 * where the recipe's first item was. Items of different meals are never joined, so a recipe logged
 * twice in a day stays two rows.
 */
export function diaryRows(meals: readonly DiaryMeal[]): DiaryRow[] {
  const rows: DiaryRow[] = [];
  for (const meal of meals) {
    const open = new Map<string, Extract<DiaryRow, { kind: 'recipe' }>>();
    for (const item of meal.items) {
      if (item.recipeId === null) {
        rows.push({ kind: 'food', item });
        continue;
      }
      let row = open.get(item.recipeId);
      if (!row) {
        row = { kind: 'recipe', recipeId: item.recipeId, servings: item.recipeServings, items: [], calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 };
        open.set(item.recipeId, row);
        rows.push(row);
      }
      row.items.push(item);
      row.calories += item.calories;
      row.proteinGrams += item.proteinGrams;
      row.carbsGrams += item.carbsGrams;
      row.fatGrams += item.fatGrams;
    }
  }
  return rows;
}
