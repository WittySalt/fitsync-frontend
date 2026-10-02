import { NutrientReferenceRange } from '../../../core/account-data.service';
import { FoodDetail, MealItemDraft } from '../../../core/fitsync.models';
import { FoodGroup } from '../../../shared/food/food-groups';

/** The state of something the page loads: on its way, ready, or failed with a message for the retry panel. */
export type Load<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };

export const LOADING: Load<never> = { status: 'loading' };

/** One food of a logged meal, with the fields the Diary draws. Fields the backend may not send yet are null. */
export interface DiaryItem {
  mealItemId: string;
  foodName: string;
  /** The amount as the person logged it, for example "200 g" or "2 x 1 medium". */
  amount: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number | null;
  sugarGrams: number | null;
  sodiumMg: number | null;
  categoryCode: string | null;
  foodGroup: FoodGroup | null;
  gramsConsumed: number | null;
  waterMl: number | null;
  /** The recipe the item was logged from and the servings of it, null for a food logged by hand. */
  recipeId: string | null;
  recipeServings: number | null;
  /** The item as a draft, which is what saving a meal as a template sends back. */
  draft: MealItemDraft;
}

export interface DiaryMeal {
  mealId: string;
  mealType: string;
  name: string;
  consumedAt: string;
  totalCalories: number;
  totalProteinGrams: number;
  totalCarbsGrams: number;
  totalFatGrams: number;
  items: DiaryItem[];
}

export interface BalanceSource {
  foodName: string;
  amount: number;
}

/** One line of the Balance card. The backend works out the share, whether it was met and whether it went over. */
export interface BalanceEntry {
  code: string;
  displayName: string;
  /** TARGET is an amount to reach, LIMIT an amount to stay under. */
  kind: 'TARGET' | 'LIMIT';
  /** Null when none of the foods in the period has data for this nutrient: unknown, not zero. */
  amount: number | null;
  unit: string;
  reference: number;
  share: number | null;
  met: boolean;
  over: boolean;
  topSources: BalanceSource[];
}

export interface MealProtein {
  mealType: string;
  grams: number;
}

export interface ProteinByMealView {
  weightKg: number | null;
  lowGrams: number;
  highGrams: number;
  meals: MealProtein[];
}

/** The day's summary, with the fields added for the redesign. Those are null when the backend does not send them. */
export interface DiarySummary {
  totalCalories: number;
  targetCalories: number | null;
  totalProteinGrams: number;
  targetProteinGrams: number | null;
  totalCarbsGrams: number;
  targetCarbsGrams: number | null;
  totalFatGrams: number;
  targetFatGrams: number | null;
  mealCount: number;
  balance: BalanceEntry[] | null;
  proteinByMeal: ProteinByMealView | null;
}

/** One day of GET /summary/range. The flags are null for a day with no meals. */
export interface RangeDay {
  date: string;
  logged: boolean;
  totalCalories: number;
  targetCalories: number | null;
  fiberMet: boolean | null;
  potassiumMet: boolean | null;
  sugarWithin: boolean | null;
  saturatedFatWithin: boolean | null;
  sodiumWithin: boolean | null;
}

export interface WaterEntry {
  waterId: string;
  amountMl: number;
  loggedAt: string;
}

export interface DrinkEntry {
  mealItemId: string;
  mealId: string;
  foodName: string;
  waterMl: number;
  consumedAt: string;
}

export interface WaterDay {
  date: string;
  /** Plain water logged on its own. */
  totalMl: number;
  /** Water that came with drinks, or null when the backend does not report it. */
  fromDrinksMl: number | null;
  entries: WaterEntry[];
  drinkEntries: DrinkEntry[];
}

/** One day of a nutrient in a week summary. The share is the day's amount over the daily reference. */
export interface NutrientDay {
  date: string;
  logged: boolean;
  amount: number | null;
  share: number | null;
}

export interface NutrientRow {
  code: string;
  displayName: string;
  kind: 'VITAMIN' | 'MINERAL' | 'OTHER';
  unit: string;
  /** Null when none of the foods in the period has data for this nutrient: unknown, not zero. */
  averageAmount: number | null;
  reference: number;
  share: number | null;
  met: boolean;
  upperLimit: number | null;
  aboveUpperLimit: boolean;
  richestUsualFood: string | null;
  /** Per-day figures, sent for a range of days. Empty when the backend sends none. */
  days: NutrientDay[];
}

export interface NutrientSummary {
  daysLogged: number;
  referenceLabel: string | null;
  referenceRange?: NutrientReferenceRange | null;
  focusCodes: string[];
  itemsLogged: number | null;
  itemsWithoutNutrients: number | null;
  nutrients: NutrientRow[];
}

/** A drink found by search or taken from recent drinks. */
export interface DrinkOption {
  foodId: string;
  name: string;
  /** Calories for the basis the food is listed by, such as 100 ml. */
  calories: number;
  basisLabel: string;
  countsTowardWater: boolean;
}

/** A drink with what the preview needs: water, alcohol and the serving sizes. */
export interface DrinkDetail extends FoodDetail {
  foodGroup: string | null;
  countsTowardWater: boolean;
  waterGrams: number | null;
  alcoholGrams: number | null;
}

/** A drink the person often has, ready to log in one tap with the amount it was last logged with. */
export interface FrequentDrink {
  name: string;
  calories: number;
  draft: MealItemDraft;
}

/** Where an Add menu entry leads: the meal builder (search or quick add), the recipes, or the saved meals. */
export type AddSource = 'recipes' | 'saved' | 'quick';

export interface AddRequest {
  /** The meal type the person is adding to. */
  slot: string;
  source: AddSource;
}
