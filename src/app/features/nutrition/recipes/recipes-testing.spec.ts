import { of } from 'rxjs';

import { PerServing, RecipeCard, RecipeDetail, RecipeIngredient, SavedMeal } from './recipes.models';
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
      ingredient({ ingredientId: 'i2', displayText: '3 Avocado', foodName: 'Avocado', grams: 453, foodGroup: 'FRUIT', categoryCode: 'FRUITS' })
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
  stub.setFavorite.and.returnValue(of(undefined));
  stub.remove.and.returnValue(of(undefined));
  stub.logRecipe.and.returnValue(of({ mealId: 'm1' }));
  stub.logSavedMeal.and.returnValue(of({ mealId: 'm2' }));
  stub.createSavedMealWithRecipe.and.returnValue(of(undefined));
  stub.addRecipeToSavedMeal.and.returnValue(of(undefined));
  return stub;
}
