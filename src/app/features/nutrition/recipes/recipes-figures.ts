import { FoodGroup, groupColour } from '../../../shared/food/food-groups';
import { DiarySummary, NutrientSummary } from '../diary/diary.models';
import { PerServing, RecipeCard, RecipeDetail, RecipeIngredient, RecipeNutrient, SavedMealItem } from './recipes.models';

export const SERVING_STEP = 0.25;
export const MIN_SERVINGS = 0.25;
export const MAX_SERVINGS = 20;
/** A nutrient is "a good source" from a fifth of the day's reference in one serving. */
export const GOOD_SOURCE_SHARE = 0.2;
/** Fat is "higher in" when a serving holds more than this part of the day's fat target. */
export const HIGH_FAT_SHARE = 0.3;
const MAX_GOOD_SOURCES = 6;

/** The nearest quarter, kept between 0.25 and 20. Something that is not a number gives one serving. */
export function clampServings(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const rounded = Math.round(value / SERVING_STEP) * SERVING_STEP;
  return Math.min(Math.max(rounded, MIN_SERVINGS), MAX_SERVINGS);
}

export function stepServings(current: number, direction: 1 | -1): number {
  return clampServings(current + direction * SERVING_STEP);
}

/** "1 serving", "2 servings", "0.25 serving". Only a count above one is plural. */
export function servingsLabel(servings: number): string {
  return `${servings} ${servings > 1 ? 'servings' : 'serving'}`;
}

/** What a number of servings of a per-serving figure comes to. */
export function scaled(perServing: number, servings: number): number {
  return perServing * servings;
}

/**
 * An ingredient's grams for the amount shown: the whole recipe, or the chosen number of servings
 * (the whole recipe over its servings, times the chosen count). Null when the weight is not known.
 */
export function ingredientGrams(ingredient: RecipeIngredient, recipeServings: number, servings: number, whole: boolean): number | null {
  if (ingredient.grams === null) {
    return null;
  }
  return whole ? ingredient.grams : (ingredient.grams / Math.max(recipeServings, 0.01)) * servings;
}

/** Grams for display: whole numbers from ten up, one decimal below that. */
export function gramsText(grams: number | null): string {
  if (grams === null) {
    return '';
  }
  const value = grams >= 10 ? Math.round(grams) : Math.round(grams * 10) / 10;
  return `${value} g`;
}

export interface Highlight {
  name: string;
  percent: number;
}

/** The nutrients a serving gives a fifth of the day or more of, richest first. */
export function goodSources(nutrients: readonly RecipeNutrient[]): Highlight[] {
  return nutrients
    .filter((entry) => entry.share !== null && entry.share >= GOOD_SOURCE_SHARE)
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0))
    .slice(0, MAX_GOOD_SOURCES)
    .map((entry) => ({ name: entry.displayName, percent: Math.round((entry.share ?? 0) * 100) }));
}

/** The share of a day's calories that fat makes up when the account has no fat target of its own. */
export const DEFAULT_FAT_ENERGY_SHARE = 0.3;
const KCAL_PER_FAT_GRAM = 9;

/**
 * The fat target "higher in" measures against: the account's own, or, when none was projected
 * yet, 30% of the calorie target as grams of fat. Null when there is neither.
 */
export function fatTargetOf(summary: DiarySummary | null): number | null {
  if (!summary) {
    return null;
  }
  if (summary.targetFatGrams !== null && summary.targetFatGrams > 0) {
    return summary.targetFatGrams;
  }
  return summary.targetCalories !== null && summary.targetCalories > 0
    ? Math.round((summary.targetCalories * DEFAULT_FAT_ENERGY_SHARE) / KCAL_PER_FAT_GRAM)
    : null;
}

export interface WatchItem {
  name: string;
  detail: string;
}

/** What a serving is higher in: fat over 30% of the fat target, and the High sugar and High salt tags. Never a warning. */
export function higherIn(perServing: PerServing, tags: readonly string[], fatTargetGrams: number | null): WatchItem[] {
  const items: WatchItem[] = [];
  if (fatTargetGrams !== null && fatTargetGrams > 0 && perServing.fatGrams > fatTargetGrams * HIGH_FAT_SHARE) {
    items.push({
      name: 'Fat',
      detail: `${Math.round(perServing.fatGrams)} g, ${Math.round((perServing.fatGrams / fatTargetGrams) * 100)}% of a day`
    });
  }
  if (tags.includes('High sugar') && perServing.sugarGrams !== null) {
    items.push({ name: 'Sugar', detail: `${Math.round(perServing.sugarGrams)} g` });
  }
  if (tags.includes('High salt') && perServing.sodiumMg !== null) {
    items.push({ name: 'Salt', detail: `${Math.round(perServing.sodiumMg)} mg sodium` });
  }
  return items;
}

export interface FitRow {
  label: string;
  /** The day before this recipe and after it, in the unit of the row. */
  before: number;
  after: number;
  /** The target or reference the figures are measured against, null when there is none. */
  of: number | null;
  unit: string;
  beforeShare: number;
  afterShare: number;
}

export interface TodayFit {
  calories: FitRow | null;
  protein: FitRow | null;
  vitamin: FitRow | null;
  /** Calories left for the day after the recipe, negative when it goes over. Null without a target. */
  leftKcal: number | null;
}

function fitRow(label: string, before: number, add: number, of: number | null, unit: string): FitRow {
  const after = before + add;
  return {
    label,
    before,
    after,
    of,
    unit,
    beforeShare: of !== null && of > 0 ? before / of : 0,
    afterShare: of !== null && of > 0 ? after / of : 0
  };
}

/**
 * What the chosen servings do to today. Calories and protein come from the Diary's daily summary.
 * The vitamin is the one the day holds the least of among those the recipe gives something of, so
 * the line shows a change rather than a vitamin the recipe has none of. The recipe's share is a
 * share of the same daily reference the Diary measures against, so the shares simply add.
 */
export function todayFit(summary: DiarySummary | null, nutrients: NutrientSummary | null, perServing: PerServing, servings: number): TodayFit {
  const calories = summary
    ? fitRow('Calories', summary.totalCalories, scaled(perServing.kcal, servings), summary.targetCalories, 'kcal')
    : null;
  const protein = summary
    ? fitRow('Protein', summary.totalProteinGrams, scaled(perServing.proteinGrams, servings), summary.targetProteinGrams, 'g')
    : null;
  let vitamin: FitRow | null = null;
  if (nutrients) {
    let lowest = Number.POSITIVE_INFINITY;
    for (const row of nutrients.nutrients) {
      const own = perServing.nutrients.find((entry) => entry.code === row.code);
      const ownShare = own?.share ?? 0;
      if (row.kind !== 'VITAMIN' || ownShare <= 0) {
        continue;
      }
      const before = row.share ?? 0;
      if (before < lowest) {
        lowest = before;
        vitamin = {
          label: row.displayName,
          before: before * 100,
          after: (before + scaled(ownShare, servings)) * 100,
          of: 100,
          unit: '%',
          beforeShare: before,
          afterShare: before + scaled(ownShare, servings)
        };
      }
    }
  }
  const target = summary?.targetCalories ?? null;
  return { calories, protein, vitamin, leftKcal: calories && target !== null ? target - calories.after : null };
}

export interface CoverStyle {
  /** The groups drawn as icons, at most three. */
  groups: FoodGroup[];
  /** A CSS gradient made of the first two groups' tints, or a plain sunken tint when there are none. */
  background: string;
}

const TINT = 30;

function tint(group: FoodGroup): string {
  return `color-mix(in srgb, ${groupColour(group)} ${TINT}%, var(--surface))`;
}

/** The cover drawn when a recipe has no photo or the photo failed: its top groups' icons on their food tints. */
export function fallbackCover(topGroups: readonly FoodGroup[]): CoverStyle {
  const groups = [...new Set(topGroups)].slice(0, 3);
  if (groups.length === 0) {
    return { groups, background: 'var(--surface-sunken)' };
  }
  const second = groups[1] ?? groups[0];
  return { groups, background: `linear-gradient(135deg, ${tint(groups[0])}, ${tint(second)})` };
}

/** The three biggest plate groups of a recipe, for a cover built from a detail. */
export function topGroupsOf(detail: Pick<RecipeDetail, 'groupsGrams'>): FoodGroup[] {
  return detail.groupsGrams.slice(0, 3).map((entry) => entry.group);
}

/** The tags a card shows: its own quality tags, then one diet tag (Vegan before Vegetarian). */
export function cardTags(card: Pick<RecipeCard, 'tags' | 'dietFlags'>): string[] {
  const diet = card.dietFlags.includes('VEGAN') ? 'Vegan' : card.dietFlags.includes('VEGETARIAN') ? 'Vegetarian' : null;
  return diet ? [...card.tags, diet] : [...card.tags];
}

export function heading(card: Pick<RecipeCard, 'category' | 'cuisine'>): string {
  return [card.category, card.cuisine].filter((part): part is string => !!part).join(' · ');
}

// ---- ticks kept for the session

const TICKS_KEY = 'fitsync.recipe.ticks.';

/** The ingredient ids ticked for a recipe in this browser session. Storage that fails gives none. */
export function loadTicks(storage: Pick<Storage, 'getItem'> | null, recipeId: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(TICKS_KEY + recipeId) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveTicks(storage: Pick<Storage, 'setItem'> | null, recipeId: string, ticks: ReadonlySet<string>): void {
  try {
    storage?.setItem(TICKS_KEY + recipeId, JSON.stringify([...ticks]));
  } catch {
    // The ticks are a convenience; a full or blocked store only means they are not kept.
  }
}

export function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** The tags that say a recipe is higher in something. They are drawn grey, never red. */
export function isCaution(tag: string): boolean {
  return tag === 'High sugar' || tag === 'High salt';
}

/** The foods of a saved meal as one line. A recipe in it reads as its name and its servings. */
export function savedMealLine(meal: { items: readonly SavedMealItem[] }): string {
  return meal.items
    .map((item) => (item.recipeId !== null ? `${item.foodName} · ${servingsLabel(item.recipeServings ?? item.quantity)}` : item.foodName))
    .join(', ');
}
