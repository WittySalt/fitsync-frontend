import { FoodGroup } from '../../../shared/food/food-groups';
import { CookIngredient, CookRecipe, CookStep } from './cook.models';

const MIN_SERVINGS = 0.25;
const MAX_SERVINGS = 20;

/** The servings from the query string: a number from 0.25 to 20, otherwise 1. */
export function parseServings(raw: string | null | undefined): number {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n >= MIN_SERVINGS && n <= MAX_SERVINGS ? n : 1;
}

/** How much the recipe's amounts grow or shrink for the servings asked. */
export function scaleFactor(servings: number, recipeServings: number): number {
  return recipeServings > 0 ? servings / recipeServings : servings;
}

export function scaledGrams(grams: number | null, factor: number): number | null {
  return grams === null ? null : grams * factor;
}

/** The ingredients a step uses, in the order the step lists them; ids that match nothing are left out. */
export function ingredientsOf(step: CookStep, ingredients: readonly CookIngredient[]): CookIngredient[] {
  return step.ingredientIds
    .map((id) => ingredients.find((ingredient) => ingredient.id === id))
    .filter((ingredient): ingredient is CookIngredient => !!ingredient);
}

/**
 * The ingredients in the order the steps first use them, then the ones no step names. When no step
 * names any, they are all in the second list and the page shows them as one plain list.
 */
export function splitIngredients(recipe: CookRecipe): { inSteps: CookIngredient[]; loose: CookIngredient[] } {
  const seen = new Set<string>();
  const inSteps: CookIngredient[] = [];
  for (const step of recipe.steps) {
    for (const ingredient of ingredientsOf(step, recipe.ingredients)) {
      if (!seen.has(ingredient.id)) {
        seen.add(ingredient.id);
        inSteps.push(ingredient);
      }
    }
  }
  return { inSteps, loose: recipe.ingredients.filter((ingredient) => !seen.has(ingredient.id)) };
}

/** The three plate groups with the most grams, for the cover of a recipe that has no photo. */
export function topGroups(recipe: Pick<CookRecipe, 'ingredients'>): FoodGroup[] {
  const grams = new Map<FoodGroup, number>();
  for (const ingredient of recipe.ingredients) {
    if (ingredient.foodGroup) {
      grams.set(ingredient.foodGroup, (grams.get(ingredient.foodGroup) ?? 0) + (ingredient.grams ?? 0));
    }
  }
  return [...grams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([group]) => group);
}

/** How many of the recipe's ingredients are ticked as added. */
export function addedCount(recipe: CookRecipe, added: readonly string[]): number {
  return recipe.ingredients.filter((ingredient) => added.includes(ingredient.id)).length;
}

/** False while the backend sends no ingredient ids, so the page shows plain lists instead of progress. */
export function hasAssignments(recipe: CookRecipe): boolean {
  return recipe.steps.some((step) => step.ingredientIds.length > 0);
}

export type StepState = 'done' | 'now' | 'next';

export function stepState(index: number, currentIndex: number): StepState {
  return index < currentIndex ? 'done' : index === currentIndex ? 'now' : 'next';
}

/** The text of a step split around the timer phrase, so the phrase can be coloured. */
export function splitAtPhrase(text: string, phrase: string): { before: string; match: string; after: string } {
  const at = phrase ? text.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
  return at < 0
    ? { before: text, match: '', after: '' }
    : { before: text.slice(0, at), match: text.slice(at, at + phrase.length), after: text.slice(at + phrase.length) };
}

/**
 * What to turn when the first side is done: the one protein of the step, else its only ingredient,
 * else nothing ("Turn it").
 */
export function turnSubject(step: CookStep, ingredients: readonly CookIngredient[]): string | null {
  const used = ingredientsOf(step, ingredients);
  const proteins = used.filter((ingredient) => ingredient.foodGroup === 'PROTEIN');
  const pick = proteins.length === 1 ? proteins[0] : used.length === 1 ? used[0] : null;
  const name = pick?.name.split(',')[0].trim().toLowerCase();
  return name ? name : null;
}

export function turnHeading(subject: string | null): string {
  return subject ? `Turn the ${subject}` : 'Turn it';
}
