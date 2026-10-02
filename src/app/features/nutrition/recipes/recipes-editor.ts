import { FoodDetail } from '../../../core/fitsync.models';
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
