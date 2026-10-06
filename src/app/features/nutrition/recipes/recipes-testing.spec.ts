import { of } from 'rxjs';

import { PerServing, RecipeCard, RecipeDetail, RecipeIngredient, RecipeSuggestion, RecipeSuggestions, SavedMeal } from './recipes.models';
import { RecipesService } from './recipes.service';

/** Builders for specs. Each takes only what a spec cares about and fills the rest with plain values. */
export function card(overrides: Partial<RecipeCard> = {}): RecipeCard {
  return {
    id: 'r1',
    name: 'Salmon Avocado Salad',
    scope: 'SYSTEM',
    imageUrl: 'https://img.example/salmon.jpg',
    imageCredit: 'TheMealDB',
    category: 'Seafood',
    cuisine: 'British',
    servings: 4,
    kcalPerServing: 612,
    proteinGramsPerServing: 27,
    tags: ['High protein'],
    dietFlags: [],
    topFoodGroups: ['VEG', 'PROTEIN', 'FRUIT'],
    favorite: false,
    lastCookedAt: null,
    lastActivity: null,
    ...overrides
  };
}

export function perServing(overrides: Partial<PerServing> = {}): PerServing {
  return {
    kcal: 612,
    proteinGrams: 27,
    carbsGrams: 16,
    fatGrams: 49,
    fiberGrams: 9,
    sugarGrams: 4,
    sodiumMg: 300,
    saturatedFatGrams: 9,
    potassiumMg: 900,
    nutrients: [
      { code: 'VIT_E', displayName: 'Vitamin E', amount: 9, unit: 'mg', share: 0.61 },
      { code: 'VIT_D', displayName: 'Vitamin D', amount: 8, unit: 'µg', share: 0.54 },
      { code: 'ZINC', displayName: 'Zinc', amount: 1, unit: 'mg', share: 0.1 }
    ],
    ...overrides
  };
}

export function ingredient(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    ingredientId: 'i1',
    displayText: '400g Salmon',
    foodCatalogItemId: 'f1',
    foodName: 'Salmon',
    name: 'Salmon',
    grams: 400,
    foodGroup: 'PROTEIN',
    categoryCode: 'SEAFOOD',
    ...overrides
  };
}

export function detail(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: 'r1',
    name: 'Salmon Avocado Salad',
    scope: 'SYSTEM',
    servings: 4,
    note: '',
    category: 'Seafood',
    cuisine: 'British',
    prepMinutes: null,
    source: 'TheMealDB',
    sourceUrl: null,
    imageUrl: 'https://img.example/salmon.jpg',
    imageCredit: 'TheMealDB',
    ingredients: [
      ingredient(),
      ingredient({ ingredientId: 'i2', displayText: '3 Avocado', foodName: 'Avocado', name: 'Avocado', grams: 453, foodGroup: 'FRUIT', categoryCode: 'FRUITS' })
    ],
    steps: [
      { stepNumber: 1, text: 'Season the salmon.', title: null, ingredientIds: [], timers: [] },
      {
        stepNumber: 2,
        text: 'Fry for 3-4 mins on each side.',
        title: null,
        ingredientIds: ['i1'],
        timers: [{ seconds: 180, maxSeconds: 240, eachSide: true, phrase: '3-4 mins' }]
      }
    ],
    perServing: perServing(),
    groupsGrams: [
      { group: 'PROTEIN', grams: 400 },
      { group: 'FRUIT', grams: 453 }
    ],
    tags: ['High protein'],
    dietFlags: [],
    favorite: false,
    editable: false,
    cookCount: 0,
    lastCookedAt: null,
    ...overrides
  };
}

export function savedMeal(overrides: Partial<SavedMeal> = {}): SavedMeal {
  return {
    templateId: 't1',
    name: 'Usual breakfast',
    mealType: 'BREAKFAST',
    totalCalories: 499,
    items: [
      {
        templateItemId: 'ti1',
        foodName: 'Greek yogurt',
        quantity: 1,
        unit: 'serving',
        calories: 146,
        recipeId: null,
        recipeServings: null,
        categoryCode: 'DAIRY',
        foodGroup: 'DAIRY'
      }
    ],
    raw: [{ templateItemId: 'ti1', foodCatalogItemId: 'f9', foodName: 'Greek yogurt', quantity: 1, unit: 'serving', calories: 146 }],
    ...overrides
  };
}

/** A stand-in for the recipes service. A spec overrides what it cares about. */
/** The wire payload of GET /recipes/suggestions in the five states, as the spec section 1 describes them. */
export const SUGGESTION_PAYLOADS: Record<string, Record<string, unknown>> = {
  FITS: {
    state: 'FITS',
    facts: { kcalLeft: 620, proteinShortGrams: 41, lowestNutrient: { code: 'FE', displayName: 'Iron' }, usualDinnerTime: '19:30', eatenKcal: 1480, targetKcal: 2100, proteinMet: false },
    suggestions: [
      { recipeId: 's1', name: 'Chicken Quinoa Greek Salad', imageUrl: null, kcalPerServing: 548, proteinPerServing: 38, reason: 'Fits your 620 left and closes most of the protein gap', source: 'LIBRARY' },
      { recipeId: 's2', name: 'Chickpea Fajitas', imageUrl: null, kcalPerServing: 455, proteinPerServing: 14, reason: 'Brings Iron, your lowest this week', source: 'MINE' },
      { recipeId: 's3', name: 'French Omelette', imageUrl: null, kcalPerServing: 286, proteinPerServing: 19, reason: 'You cooked it 2 times this month', source: 'RECENT' }
    ]
  },
  NOTHING_LOGGED: {
    state: 'NOTHING_LOGGED',
    facts: { kcalLeft: 2100, proteinShortGrams: 155, lowestNutrient: null, usualDinnerTime: '19:30', eatenKcal: 0, targetKcal: 2100, proteinMet: false },
    suggestions: [{ recipeId: 's1', name: 'Chicken Quinoa Greek Salad', imageUrl: null, kcalPerServing: 548, proteinPerServing: 38, reason: 'Your most cooked this month', source: 'RECENT' }]
  },
  PAST_TARGET: {
    state: 'PAST_TARGET',
    facts: { kcalLeft: 0, proteinShortGrams: 0, lowestNutrient: null, usualDinnerTime: '19:30', eatenKcal: 2340, targetKcal: 2100, proteinMet: true },
    suggestions: [{ recipeId: 's4', name: 'Chickpea Fajitas', imageUrl: null, kcalPerServing: 310, proteinPerServing: 12, reason: '310 kcal, mostly vegetables', source: 'LIBRARY' }]
  },
  PROTEIN_ONLY: {
    state: 'PROTEIN_ONLY',
    facts: { kcalLeft: 620, proteinShortGrams: 41, lowestNutrient: null, usualDinnerTime: null, eatenKcal: 1480, targetKcal: 2100, proteinMet: false },
    suggestions: [
      { recipeId: 's1', name: 'Chicken Quinoa Greek Salad', imageUrl: null, kcalPerServing: 548, proteinPerServing: 38, reason: 'High protein, 38 g in a serving', source: 'LIBRARY' },
      { recipeId: 's5', name: 'Honey Teriyaki Salmon', imageUrl: null, kcalPerServing: 398, proteinPerServing: 31, reason: 'High protein, and it fits your 620 left', source: 'LIBRARY' }
    ]
  },
  DINNER_LOGGED: {
    state: 'DINNER_LOGGED',
    facts: { kcalLeft: 90, proteinShortGrams: 0, lowestNutrient: null, usualDinnerTime: '19:30', eatenKcal: 2010, targetKcal: 2100, proteinMet: true },
    suggestions: []
  }
};

export function suggestionOf(overrides: Partial<RecipeSuggestion> = {}): RecipeSuggestion {
  return { recipeId: 's1', name: 'Chicken Quinoa Greek Salad', imageUrl: null, kcalPerServing: 548, proteinPerServing: 38, reason: 'Fits your 620 left', source: 'LIBRARY', ...overrides };
}

export function suggestionsOf(overrides: Partial<RecipeSuggestions> = {}): RecipeSuggestions {
  return {
    state: 'FITS',
    facts: { kcalLeft: 620, proteinShortGrams: 41, lowestNutrient: 'Iron', usualDinnerTime: '19:30', eatenKcal: 1480, targetKcal: 2100, proteinMet: false },
    suggestions: [suggestionOf()],
    ...overrides
  };
}

export function recipesServiceStub(): jasmine.SpyObj<RecipesService> {
  const stub = jasmine.createSpyObj<RecipesService>('RecipesService', [
    'list',
    'listAll',
    'categories',
    'get',
    'lookup',
    'forget',
    'similar',
    'create',
    'update',
    'remove',
    'setFavorite',
    'copy',
    'recentMeals',
    'logRecipe',
    'savedMeals',
    'logSavedMeal',
    'createSavedMealWithRecipe',
    'addRecipeToSavedMeal'
  ]);
  stub.list.and.returnValue(of({ items: [card()], page: 0, totalPages: 1, totalElements: 1 }));
  stub.listAll.and.returnValue(of([card()]));
  stub.categories.and.returnValue(of(['Breakfast', 'Seafood']));
  stub.get.and.returnValue(of(detail()));
  stub.lookup.and.returnValue(of(detail()));
  stub.similar.and.returnValue(of([]));
  stub.savedMeals.and.returnValue(of([]));
  stub.recentMeals.and.returnValue(of([]));
  stub.setFavorite.and.returnValue(of(undefined));
  stub.remove.and.returnValue(of(undefined));
  stub.logRecipe.and.returnValue(of({ mealId: 'm1' }));
  stub.logSavedMeal.and.returnValue(of({ mealId: 'm2' }));
  stub.createSavedMealWithRecipe.and.returnValue(of(undefined));
  stub.addRecipeToSavedMeal.and.returnValue(of(undefined));
  return stub;
}
