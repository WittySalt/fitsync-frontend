import { asFoodGroup, FoodGroup } from '../../../shared/food/food-groups';
import { list, num, text } from '../diary/diary-mappers';
import {
  GroupGrams,
  PerServing,
  RecipeCard,
  RecipeDetail,
  RecipeFit,
  RecipeIngredient,
  RecipeNutrient,
  RecipePageOf,
  RecipeStep,
  RecipeTimer,
  SavedMeal,
  SavedMealItem
} from './recipes.models';

type Wire = Record<string, unknown>;

function words(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];
}

/** A photo address is used only when it is a plain web address; anything else is left out. */
export function safeImageUrl(value: unknown): string | null {
  const address = text(value);
  return address !== null && /^https?:\/\//i.test(address) ? address : null;
}

function scopeOf(value: unknown): 'SYSTEM' | 'USER' {
  return value === 'USER' ? 'USER' : 'SYSTEM';
}

function groups(value: unknown): FoodGroup[] {
  return words(value)
    .map((entry) => asFoodGroup(entry))
    .filter((group): group is FoodGroup => group !== null);
}

export function mapRecipeCard(raw: Wire): RecipeCard {
  return {
    id: text(raw['id']) ?? '',
    name: text(raw['name']) ?? 'Recipe',
    scope: scopeOf(raw['scope']),
    imageUrl: safeImageUrl(raw['imageUrl']),
    imageCredit: text(raw['imageCredit']),
    category: text(raw['category']),
    cuisine: text(raw['cuisine']),
    servings: num(raw['servings']) ?? 1,
    kcalPerServing: num(raw['kcalPerServing']) ?? 0,
    proteinGramsPerServing: num(raw['proteinGramsPerServing']) ?? 0,
    tags: words(raw['tags']),
    dietFlags: words(raw['dietFlags']),
    topFoodGroups: groups(raw['topFoodGroups']),
    favorite: raw['favorite'] === true,
    lastCookedAt: text(raw['lastCookedAt'])
  };
}

/** The fit block of a list, or null when the server sent none (an older backend). */
export function mapFit(value: unknown): RecipeFit | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const raw = value as Wire;
  const nutrient = raw['lowestNutrient'];
  const lowest = typeof nutrient === 'object' && nutrient !== null ? text((nutrient as Wire)['displayName']) : text(nutrient);
  return {
    kcalLeft: num(raw['kcalLeft']),
    proteinShortGrams: num(raw['proteinShortGrams']),
    lowestNutrient: lowest
  };
}

export function mapRecipePage(raw: Wire): RecipePageOf<RecipeCard> {
  const items = list(raw['content']).map(mapRecipeCard);
  return {
    items,
    page: num(raw['number']) ?? 0,
    totalPages: num(raw['totalPages']) ?? (items.length ? 1 : 0),
    totalElements: num(raw['totalElements']) ?? items.length,
    fit: mapFit(raw['fit'])
  };
}

function mapIngredient(raw: Wire): RecipeIngredient {
  const foodName = text(raw['foodName']) ?? 'Ingredient';
  return {
    ingredientId: text(raw['ingredientId']) ?? '',
    displayText: text(raw['displayText']) ?? foodName,
    foodCatalogItemId: text(raw['foodCatalogItemId']),
    foodName,
    name: text(raw['name']) ?? foodName,
    grams: num(raw['grams']),
    foodGroup: asFoodGroup(text(raw['foodGroup'])),
    categoryCode: text(raw['categoryCode'])
  };
}

function mapTimer(raw: Wire): RecipeTimer | null {
  const seconds = num(raw['seconds']);
  if (seconds === null || seconds <= 0) {
    return null;
  }
  return {
    seconds,
    maxSeconds: num(raw['maxSeconds']) ?? seconds,
    eachSide: raw['eachSide'] === true,
    phrase: text(raw['phrase']) ?? ''
  };
}

function mapStep(raw: Wire, index: number): RecipeStep {
  return {
    stepNumber: num(raw['stepNumber']) ?? index + 1,
    text: text(raw['text']) ?? '',
    title: text(raw['title']),
    ingredientIds: words(raw['ingredientIds']),
    timers: list(raw['timers']).map(mapTimer).filter((timer): timer is RecipeTimer => timer !== null)
  };
}

function mapNutrient(raw: Wire): RecipeNutrient | null {
  const code = text(raw['code']);
  const amount = num(raw['amount']);
  if (code === null || amount === null) {
    return null;
  }
  return { code, displayName: text(raw['displayName']) ?? code, amount, unit: text(raw['unit']) ?? 'g', share: num(raw['share']) };
}

function mapPerServing(raw: Wire): PerServing {
  return {
    kcal: num(raw['kcal']) ?? 0,
    proteinGrams: num(raw['proteinGrams']) ?? 0,
    carbsGrams: num(raw['carbsGrams']) ?? 0,
    fatGrams: num(raw['fatGrams']) ?? 0,
    fiberGrams: num(raw['fiberGrams']),
    sugarGrams: num(raw['sugarGrams']),
    sodiumMg: num(raw['sodiumMg']),
    saturatedFatGrams: num(raw['saturatedFatGrams']),
    potassiumMg: num(raw['potassiumMg']),
    nutrients: list(raw['nutrients']).map(mapNutrient).filter((entry): entry is RecipeNutrient => entry !== null)
  };
}

/** Grams per plate group, as an object of group to grams or as a list of entries, largest first. */
export function mapGroupsGrams(value: unknown): GroupGrams[] {
  const entries: [unknown, unknown][] = Array.isArray(value)
    ? list(value).map((entry): [unknown, unknown] => [entry['group'], entry['grams']])
    : typeof value === 'object' && value !== null
      ? Object.entries(value as Wire)
      : [];
  return entries
    .map(([key, grams]) => ({ group: asFoodGroup(typeof key === 'string' ? key : null), grams: num(grams) ?? 0 }))
    .filter((entry): entry is GroupGrams => entry.group !== null && entry.grams > 0)
    .sort((a, b) => b.grams - a.grams);
}

export function mapRecipeDetail(raw: Wire): RecipeDetail {
  return {
    id: text(raw['id']) ?? '',
    name: text(raw['name']) ?? 'Recipe',
    scope: scopeOf(raw['scope']),
    servings: num(raw['servings']) ?? 1,
    note: text(raw['note']) ?? '',
    category: text(raw['category']),
    cuisine: text(raw['cuisine']),
    prepMinutes: num(raw['prepMinutes']),
    source: text(raw['source']),
    sourceUrl: safeImageUrl(raw['sourceUrl']),
    imageUrl: safeImageUrl(raw['imageUrl']),
    imageCredit: text(raw['imageCredit']),
    ingredients: list(raw['ingredients']).map(mapIngredient),
    steps: list(raw['steps']).map(mapStep),
    perServing: mapPerServing(typeof raw['perServing'] === 'object' && raw['perServing'] !== null ? (raw['perServing'] as Wire) : {}),
    groupsGrams: mapGroupsGrams(raw['groupsGrams']),
    tags: words(raw['tags']),
    dietFlags: words(raw['dietFlags']),
    favorite: raw['favorite'] === true,
    editable: raw['editable'] === true,
    cookCount: Math.max(0, Math.round(num(raw['cookCount']) ?? 0)),
    lastCookedAt: text(raw['lastCookedAt'])
  };
}

function mapSavedItem(raw: Wire): SavedMealItem {
  return {
    templateItemId: text(raw['templateItemId']) ?? '',
    foodName: text(raw['foodName']) ?? 'Food',
    quantity: num(raw['quantity']) ?? 1,
    unit: text(raw['unit']) ?? 'serving',
    calories: num(raw['calories']) ?? 0,
    recipeId: text(raw['recipeId']),
    recipeServings: num(raw['recipeServings']),
    categoryCode: text(raw['categoryCode']),
    foodGroup: asFoodGroup(text(raw['foodGroup']))
  };
}

export function mapSavedMeal(raw: Wire): SavedMeal {
  const items = list(raw['items']);
  return {
    templateId: text(raw['templateId']) ?? '',
    name: text(raw['name']) ?? 'Saved meal',
    mealType: (text(raw['mealType']) ?? 'MEAL').toUpperCase(),
    totalCalories: num(raw['totalCalories']) ?? 0,
    items: items.map(mapSavedItem),
    raw: items
  };
}
