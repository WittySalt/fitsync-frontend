import { mapGroupsGrams, mapRecipeCard, mapRecipeDetail, mapRecipePage, mapRecipeSuggestions, mapSavedMeal, safeImageUrl } from './recipes-mappers';
import { SUGGESTION_PAYLOADS } from './recipes-testing.spec';

describe('recipe mappers', () => {
  it('maps a card and keeps only known plate groups', () => {
    const mapped = mapRecipeCard({
      id: 'r1',
      name: 'Chickpea Fajitas',
      scope: 'SYSTEM',
      imageUrl: 'https://img.example/a.jpg',
      category: 'Vegetarian',
      servings: '4',
      kcalPerServing: 455,
      proteinGramsPerServing: 14.2,
      tags: ['High fibre'],
      dietFlags: ['VEGETARIAN'],
      topFoodGroups: ['LEGUMES', 'GRAINS', 'MYSTERY'],
      favorite: true
    });

    expect(mapped.servings).toBe(4);
    expect(mapped.topFoodGroups).toEqual(['LEGUMES', 'GRAINS']);
    expect(mapped.favorite).toBeTrue();
    expect(mapped.cuisine).toBeNull();
  });

  it('maps lastCookedAt and the fit block of a list, and tolerates their absence', () => {
    expect(mapRecipeCard({ id: 'a', lastCookedAt: '2026-10-01T18:30:00Z' }).lastCookedAt).toBe('2026-10-01T18:30:00Z');
    expect(mapRecipeCard({ id: 'a' }).lastCookedAt).toBeNull();
    const page = mapRecipePage({ content: [], fit: { kcalLeft: 950, proteinShortGrams: 41, lowestNutrient: { displayName: 'Vitamin D' } } });
    expect(page.fit).toEqual({ kcalLeft: 950, proteinShortGrams: 41, lowestNutrient: 'Vitamin D' });
    expect(mapRecipePage({ content: [], fit: { lowestNutrient: 'Zinc' } }).fit).toEqual({ kcalLeft: null, proteinShortGrams: null, lowestNutrient: 'Zinc' });
    expect(mapRecipePage({ content: [], fit: 'no' }).fit).toBeNull();
  });

  it('reads what the last activity of a card was, and leaves it null from an older backend', () => {
    expect(mapRecipeCard({ id: 'a', lastActivity: 'LOGGED' }).lastActivity).toBe('LOGGED');
    expect(mapRecipeCard({ id: 'a', lastActivity: 'COOKED' }).lastActivity).toBe('COOKED');
    expect(mapRecipeCard({ id: 'a', lastActivity: 'SOMETHING' }).lastActivity).toBeNull();
    expect(mapRecipeCard({ id: 'a' }).lastActivity).toBeNull();
  });

  describe('suggestions', () => {
    it('maps the FITS payload with its facts and three recipes', () => {
      const mapped = mapRecipeSuggestions(SUGGESTION_PAYLOADS['FITS']);
      expect(mapped.state).toBe('FITS');
      expect(mapped.facts).toEqual({ kcalLeft: 620, proteinShortGrams: 41, lowestNutrient: 'Iron', usualDinnerTime: '19:30', eatenKcal: 1480, targetKcal: 2100, proteinMet: false });
      expect(mapped.suggestions.map((entry) => [entry.recipeId, entry.source, entry.kcalPerServing, entry.proteinPerServing])).toEqual([
        ['s1', 'LIBRARY', 548, 38],
        ['s2', 'MINE', 455, 14],
        ['s3', 'RECENT', 286, 19]
      ]);
      expect(mapped.suggestions[0].reason).toBe('Fits your 620 left and closes most of the protein gap');
    });

    it('maps every state, and the folded one has no recipes', () => {
      expect(Object.keys(SUGGESTION_PAYLOADS).map((key) => mapRecipeSuggestions(SUGGESTION_PAYLOADS[key]).state)).toEqual(['FITS', 'NOTHING_LOGGED', 'PAST_TARGET', 'PROTEIN_ONLY', 'DINNER_LOGGED']);
      expect(mapRecipeSuggestions(SUGGESTION_PAYLOADS['DINNER_LOGGED']).suggestions).toEqual([]);
      expect(mapRecipeSuggestions(SUGGESTION_PAYLOADS['PAST_TARGET']).facts.proteinMet).toBeTrue();
    });

    it('is forgiving: an unknown state reads as FITS, a recipe without an id is dropped, a photo that is not a web address is left out', () => {
      const mapped = mapRecipeSuggestions({ state: 'ODD', suggestions: [{ name: 'No id' }, { recipeId: 'x', name: 'Soup', imageUrl: 'javascript:alert(1)', source: 'ELSEWHERE' }] });
      expect(mapped.state).toBe('FITS');
      expect(mapped.facts.kcalLeft).toBeNull();
      expect(mapped.facts.proteinMet).toBeFalse();
      expect(mapped.suggestions.length).toBe(1);
      expect(mapped.suggestions[0]).toEqual(jasmine.objectContaining({ recipeId: 'x', imageUrl: null, source: 'LIBRARY', kcalPerServing: 0 }));
    });

    it('takes the nutrient as a plain name too', () => {
      expect(mapRecipeSuggestions({ state: 'FITS', facts: { lowestNutrient: 'Zinc' }, suggestions: [] }).facts.lowestNutrient).toBe('Zinc');
    });
  });

  it('reads the cook count and the last cook of a recipe, and a recipe without them was never cooked', () => {
    const cooked = mapRecipeDetail({ id: 'r', cookCount: 3, lastCookedAt: '2026-10-01T18:00:00Z' });
    expect([cooked.cookCount, cooked.lastCookedAt]).toEqual([3, '2026-10-01T18:00:00Z']);
    const never = mapRecipeDetail({ id: 'r' });
    expect([never.cookCount, never.lastCookedAt]).toEqual([0, null]);
  });

  it('uses a photo only when it is a web address', () => {
    expect(safeImageUrl('https://x.example/a.jpg')).toBe('https://x.example/a.jpg');
    expect(safeImageUrl('javascript:alert(1)')).toBeNull();
    expect(safeImageUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(safeImageUrl(null)).toBeNull();
  });

  it('maps a page with its counts', () => {
    const page = mapRecipePage({ content: [{ id: 'a', name: 'A' }], number: 2, totalPages: 5, totalElements: 91 });

    expect(page).toEqual(jasmine.objectContaining({ page: 2, totalPages: 5, totalElements: 91 }));
    expect(page.items.length).toBe(1);
  });

  it('maps an empty answer to an empty page', () => {
    expect(mapRecipePage({})).toEqual({ items: [], page: 0, totalPages: 0, totalElements: 0, fit: null });
  });

  it('maps a detail, taking the cook mode step fields as optional', () => {
    const mapped = mapRecipeDetail({
      id: 'r1',
      name: 'Salad',
      servings: 4,
      ingredients: [{ ingredientId: 'i1', foodName: 'Salmon', grams: 100 }],
      steps: [
        { stepNumber: 1, text: 'Fry.' },
        { text: 'Rest.', title: 'Rest', ingredientIds: ['i1'], timers: [{ seconds: 60, phrase: '1 min' }, { seconds: 'x' }] }
      ],
      perServing: {
        kcal: 600,
        nutrients: [{ code: 'VIT_D', displayName: 'Vitamin D', amount: 8, unit: 'µg', share: 0.5 }, { code: 'BAD' }]
      },
      groupsGrams: { VEG: 50, PROTEIN: 400, WEIRD: 9 },
      editable: true
    });

    expect(mapped.ingredients[0].displayText).toBe('Salmon');
    expect(mapped.ingredients[0].name).toBe('Salmon');
    expect(mapRecipeDetail({ ingredients: [{ foodName: 'Salmon, Atlantic, farmed, raw', name: 'Salmon' }] }).ingredients[0].name).toBe('Salmon');
    expect(mapped.steps[0].timers).toEqual([]);
    expect(mapped.steps[1].stepNumber).toBe(2);
    expect(mapped.steps[1].timers).toEqual([{ seconds: 60, maxSeconds: 60, eachSide: false, phrase: '1 min' }]);
    expect(mapped.perServing.nutrients.length).toBe(1);
    expect(mapped.groupsGrams.map((entry) => entry.group)).toEqual(['PROTEIN', 'VEG']);
    expect(mapped.editable).toBeTrue();
    expect(mapped.favorite).toBeFalse();
  });

  it('reads the plate groups from a list as well as from an object', () => {
    expect(mapGroupsGrams([{ group: 'VEG', grams: 10 }, { group: 'DAIRY', grams: 30 }]).map((entry) => entry.group)).toEqual(['DAIRY', 'VEG']);
    expect(mapGroupsGrams(null)).toEqual([]);
  });

  it('maps a saved meal and keeps what the server sent for rebuilding it', () => {
    const meal = mapSavedMeal({
      templateId: 't1',
      name: 'Salad lunch',
      mealType: 'lunch',
      totalCalories: 614,
      items: [
        { templateItemId: 'a', foodName: 'Salad', quantity: 1, recipeId: 'r1', recipeServings: 1 },
        { templateItemId: 'b', foodName: 'Coffee', quantity: 1, calories: 2 }
      ]
    });

    expect(meal.mealType).toBe('LUNCH');
    expect(meal.items[0].recipeId).toBe('r1');
    expect(meal.items[1].recipeId).toBeNull();
    expect(meal.raw.length).toBe(2);
  });
});
