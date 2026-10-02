import { mapGroupsGrams, mapRecipeCard, mapRecipeDetail, mapRecipePage, mapSavedMeal, safeImageUrl } from './recipes-mappers';

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
    expect(mapRecipePage({})).toEqual({ items: [], page: 0, totalPages: 0, totalElements: 0 });
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
