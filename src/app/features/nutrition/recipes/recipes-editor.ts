import { FoodDetail } from '../../../core/fitsync.models';
import { DiaryMeal } from '../diary/diary.models';
import { FoodGroup } from '../../../shared/food/food-groups';
import { PerServing, RecipeDraft } from './recipes.models';

export const NAME_MAX = 120;
export const SERVINGS_MAX = 100;
export const STEPS_MAX = 60;
export const STEP_MAX = 1000;
export const INGREDIENTS_MAX = 60;
export const GRAMS_MAX = 100000;

/** One ingredient line of the editor. The food's figures are per its basis amount, so the grams can be scaled live. */
export interface EditorRow {
  key: number;
  foodCatalogItemId: string;
  name: string;
  /** Null until the person types an amount. */
  grams: number | null;
  /** What the food has per basis amount, or null when it could not be read. */
  detail: FoodDetail | null;
  group: FoodGroup | null;
  categoryCode: string | null;
}

export interface EditorTotals {
  kcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  /** Ingredients counted, and ingredients left out for want of figures or an amount. */
  counted: number;
  left: number;
}

/**
 * How many basis amounts of a food the grams make. A food listed per 100 ml is turned from grams
 * to millilitres with its density, one gram a millilitre when it has none.
 */
export function basisFactor(detail: FoodDetail, grams: number): number {
  const basis = detail.basisQuantity > 0 ? detail.basisQuantity : 100;
  const amount = detail.basisUnit.toLowerCase() === 'ml' ? grams / (detail.densityGramsPerMl && detail.densityGramsPerMl > 0 ? detail.densityGramsPerMl : 1) : grams;
  return amount / basis;
}

/** Calories and macros of one serving, worked out from the rows as they stand. */
export function editorTotals(rows: readonly EditorRow[], servings: number): EditorTotals {
  const totals: EditorTotals = { kcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, counted: 0, left: 0 };
  for (const row of rows) {
    if (!row.detail || row.grams === null || row.grams <= 0) {
      totals.left += 1;
      continue;
    }
    const factor = basisFactor(row.detail, row.grams);
    totals.kcal += row.detail.calories * factor;
    totals.proteinGrams += row.detail.proteinGrams * factor;
    totals.carbsGrams += row.detail.carbsGrams * factor;
    totals.fatGrams += row.detail.fatGrams * factor;
    totals.counted += 1;
  }
  const share = servings > 0 ? servings : 1;
  return {
    ...totals,
    kcal: totals.kcal / share,
    proteinGrams: totals.proteinGrams / share,
    carbsGrams: totals.carbsGrams / share,
    fatGrams: totals.fatGrams / share
  };
}

/** The server's own per-serving figures in the shape the live card shows, for a recipe that has not been changed yet. */
export function totalsOf(perServing: PerServing, ingredientCount: number): EditorTotals {
  return {
    kcal: perServing.kcal,
    proteinGrams: perServing.proteinGrams,
    carbsGrams: perServing.carbsGrams,
    fatGrams: perServing.fatGrams,
    counted: ingredientCount,
    left: 0
  };
}

export interface EditorInput {
  name: string;
  servings: number | null;
  rows: readonly EditorRow[];
  steps: readonly string[];
}

export interface EditorErrors {
  name?: string;
  servings?: string;
  ingredients?: string;
  steps?: string;
}

export function editorErrors(input: EditorInput): EditorErrors {
  const errors: EditorErrors = {};
  const name = input.name.trim();
  if (!name) {
    errors.name = 'Give the recipe a name.';
  } else if (name.length > NAME_MAX) {
    errors.name = `Keep the name to ${NAME_MAX} characters.`;
  }
  if (input.servings === null || !(input.servings > 0) || input.servings > SERVINGS_MAX) {
    errors.servings = `Servings must be more than 0 and at most ${SERVINGS_MAX}.`;
  }
  if (input.rows.length === 0) {
    errors.ingredients = 'Add at least one ingredient.';
  } else if (input.rows.length > INGREDIENTS_MAX) {
    errors.ingredients = `A recipe can have ${INGREDIENTS_MAX} ingredients at most.`;
  } else if (input.rows.some((row) => row.foodCatalogItemId === '')) {
    errors.ingredients = 'Remove the ingredient that has no food, or search for it again.';
  } else if (input.rows.some((row) => row.grams === null || !(row.grams > 0) || row.grams > GRAMS_MAX)) {
    errors.ingredients = 'Every ingredient needs an amount in grams above 0.';
  }
  const steps = input.steps.map((step) => step.trim()).filter(Boolean);
  if (steps.length > STEPS_MAX) {
    errors.steps = `A recipe can have ${STEPS_MAX} steps at most.`;
  } else if (steps.some((step) => step.length > STEP_MAX)) {
    errors.steps = `Keep each step to ${STEP_MAX} characters.`;
  }
  return errors;
}

export function hasErrors(errors: EditorErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** What is sent on save. Blank steps are left out and the rest are numbered by their order on the server. */
export function toDraft(input: EditorInput): RecipeDraft {
  return {
    name: input.name.trim(),
    servings: input.servings ?? 1,
    ingredients: input.rows.map((row) => ({ foodCatalogItemId: row.foodCatalogItemId, grams: row.grams ?? 0, displayText: row.name })),
    steps: input.steps.map((step) => step.trim()).filter(Boolean)
  };
}

/** A number from a text box: blank or not a number is null. A comma is taken as a decimal point. */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

// ---- reordering, categories and the live preview

/** A list with one item moved from one place to another. A place out of range leaves the list as it is. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * The category code a category name stands for: "Meat & Poultry" is MEAT_POULTRY. The food search
 * names the category but sends no code, and the plate group and the icon come from the code.
 */
export function categoryCodeOf(name: string | null | undefined): string | null {
  const code = (name ?? '').toUpperCase().replace(/[^A-Z]+/g, '_').replace(/^_+|_+$/g, '');
  return code === '' ? null : code;
}

/** The three plate groups with the most grams among the rows, largest first. Rows without a group or an amount are left out. */
export function rowGroups(rows: readonly EditorRow[]): FoodGroup[] {
  const grams = new Map<FoodGroup, number>();
  for (const row of rows) {
    if (row.group) {
      grams.set(row.group, (grams.get(row.group) ?? 0) + (row.grams ?? 0));
    }
  }
  return [...grams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([group]) => group);
}

const KCAL_PER_PROTEIN_GRAM = 4;
const NON_VEGETARIAN = new Set(['MEAT_POULTRY', 'SEAFOOD']);
const NON_VEGAN = new Set(['MEAT_POULTRY', 'SEAFOOD', 'DAIRY', 'EGGS']);

/**
 * The tags the recipe page will most likely show, worked out from the rows with the thresholds of
 * API contract section 7.2 (per 100 g of the ingredients): protein at least 20% of the energy and 3 g,
 * fibre 6 g, sugar over 22.5 g, sodium over 600 mg; Vegetarian and Vegan when every row has a
 * category. Nothing is said while a row has no amount or no figures. The server's tags are the ones
 * that count once the recipe is saved.
 */
export function previewTags(rows: readonly EditorRow[]): string[] {
  if (rows.length === 0 || rows.some((row) => !row.detail || row.grams === null || !(row.grams > 0))) {
    return [];
  }
  let weight = 0;
  let kcal = 0;
  let protein = 0;
  let fibre = 0;
  let sugar = 0;
  let sodium = 0;
  for (const row of rows) {
    const detail = row.detail as FoodDetail;
    const factor = basisFactor(detail, row.grams as number);
    weight += row.grams as number;
    kcal += detail.calories * factor;
    protein += detail.proteinGrams * factor;
    fibre += (detail.fiberGrams ?? 0) * factor;
    sugar += (detail.sugarGrams ?? 0) * factor;
    sodium += (detail.sodiumMg ?? 0) * factor;
  }
  const per100 = (value: number) => (value / weight) * 100;
  const tags: string[] = [];
  if (per100(protein) >= 3 && kcal > 0 && (protein * KCAL_PER_PROTEIN_GRAM) / kcal >= 0.2) {
    tags.push('High protein');
  }
  if (per100(fibre) >= 6) {
    tags.push('High fibre');
  }
  if (per100(sugar) > 22.5) {
    tags.push('High sugar');
  }
  if (per100(sodium) > 600) {
    tags.push('High salt');
  }
  if (rows.every((row) => row.categoryCode)) {
    const codes = rows.map((row) => (row.categoryCode ?? '').toUpperCase());
    if (!codes.some((code) => NON_VEGAN.has(code))) {
      tags.push('Vegan');
    } else if (!codes.some((code) => NON_VEGETARIAN.has(code))) {
      tags.push('Vegetarian');
    }
  }
  return tags;
}

/** An ingredient row taken from a food of a logged meal; the page gives it a key and loads its figures. */
export type RowSeed = Omit<EditorRow, 'key' | 'detail'>;

/**
 * The foods of a logged meal as ingredient rows, with the grams that were logged. A food logged in
 * servings has no weight and gets none, so the person fills it in. A custom food has no catalogue
 * entry, which a recipe needs, so it is counted in `left` and not added.
 */
export function mealToRows(meal: Pick<DiaryMeal, 'items'>): { rows: RowSeed[]; left: number } {
  const rows: RowSeed[] = [];
  let left = 0;
  for (const item of meal.items) {
    const id = item.draft.foodCatalogItemId;
    if (!id) {
      left += 1;
      continue;
    }
    const grams = item.gramsConsumed ?? (item.draft.unit.toLowerCase() === 'g' ? item.draft.quantity : null);
    rows.push({ foodCatalogItemId: id, name: item.foodName, grams: grams !== null && grams > 0 ? Math.round(grams * 10) / 10 : null, group: item.foodGroup, categoryCode: item.categoryCode });
  }
  return { rows, left };
}
