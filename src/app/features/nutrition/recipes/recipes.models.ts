import { FoodGroup } from '../../../shared/food/food-groups';

/** One card of the recipe library or of My recipes (API contract, section 7.2). */
export interface RecipeCard {
  id: string;
  name: string;
  scope: 'SYSTEM' | 'USER';
  imageUrl: string | null;
  imageCredit: string | null;
  category: string | null;
  cuisine: string | null;
  servings: number;
  kcalPerServing: number;
  proteinGramsPerServing: number;
  /** "High protein", "High fibre", "High sugar", "High salt". */
  tags: string[];
  /** VEGETARIAN and VEGAN. A vegan recipe lists both. */
  dietFlags: string[];
  /** The plate groups with the most grams, largest first. They draw the cover when there is no photo. */
  topFoodGroups: FoodGroup[];
  favorite: boolean;
}

export interface RecipePageOf<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalElements: number;
}

export interface RecipeIngredient {
  ingredientId: string;
  /** The line as written, or the food name when none was stored. */
  displayText: string;
  foodCatalogItemId: string | null;
  foodName: string;
  /** The weight the nutrition counts, null when it cannot be worked out. */
  grams: number | null;
  foodGroup: FoodGroup | null;
  categoryCode: string | null;
}

export interface RecipeTimer {
  seconds: number;
  maxSeconds: number;
  eachSide: boolean;
  phrase: string;
}

/** A step. The cook mode fields (section 8) arrive from a newer backend, so they are optional. */
export interface RecipeStep {
  stepNumber: number;
  text: string;
  title: string | null;
  ingredientIds: string[];
  timers: RecipeTimer[];
}

export interface RecipeNutrient {
  code: string;
  displayName: string;
  amount: number;
  unit: string;
  /** The amount over the caller's daily reference target (0.25 is a quarter), null when there is none. */
  share: number | null;
}

export interface PerServing {
  kcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number | null;
  sugarGrams: number | null;
  sodiumMg: number | null;
  saturatedFatGrams: number | null;
  potassiumMg: number | null;
  nutrients: RecipeNutrient[];
}

export interface GroupGrams {
  group: FoodGroup;
  grams: number;
}

export interface RecipeDetail {
  id: string;
  name: string;
  scope: 'SYSTEM' | 'USER';
  servings: number;
  note: string;
  category: string | null;
  cuisine: string | null;
  prepMinutes: number | null;
  source: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  perServing: PerServing;
  groupsGrams: GroupGrams[];
  tags: string[];
  dietFlags: string[];
  favorite: boolean;
  editable: boolean;
}

export type RecipeScope = 'library' | 'mine' | 'favorites';

export interface RecipeQuery {
  scope: RecipeScope;
  category?: string;
  q?: string;
  diet?: 'VEGETARIAN' | 'VEGAN';
  page?: number;
  size?: number;
}

/** What the editor sends for one ingredient row. */
export interface RecipeIngredientDraft {
  foodCatalogItemId: string;
  grams: number;
  /** The food's name, kept as the line as written. */
  displayText: string;
}

export interface RecipeDraft {
  name: string;
  servings: number;
  ingredients: RecipeIngredientDraft[];
  steps: string[];
}

/** A food of a saved meal, or a recipe in it (recipeId set, recipeServings the servings). */
export interface SavedMealItem {
  templateItemId: string;
  foodName: string;
  quantity: number;
  unit: string;
  calories: number;
  recipeId: string | null;
  recipeServings: number | null;
  categoryCode: string | null;
  foodGroup: FoodGroup | null;
}

export interface SavedMeal {
  templateId: string;
  name: string;
  mealType: string;
  totalCalories: number;
  items: SavedMealItem[];
  /** The items as the server sent them, so a saved meal can be rebuilt with one more recipe in it. */
  raw: Record<string, unknown>[];
}
