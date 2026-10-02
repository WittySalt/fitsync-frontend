import { mapDiaryItem, mapDiaryMeal } from './diary-mappers';

describe('mapDiaryItem and recipes', () => {
  it('keeps the recipe an item was logged from and the servings of it', () => {
    const mapped = mapDiaryItem({ mealItemId: 'a', foodName: 'Salmon', recipeId: 'r1', recipeServings: '1.5' });

    expect(mapped.recipeId).toBe('r1');
    expect(mapped.recipeServings).toBe(1.5);
  });

  it('has no recipe for a food logged by hand', () => {
    const mapped = mapDiaryItem({ mealItemId: 'a', foodName: 'Tea', recipeId: null, recipeServings: null });

    expect(mapped.recipeId).toBeNull();
    expect(mapped.recipeServings).toBeNull();
    expect(mapDiaryItem({ foodName: 'Tea' }).recipeId).toBeNull();
  });

  it('carries the recipe link through a meal', () => {
    const meal = mapDiaryMeal({ mealId: 'm', items: [{ foodName: 'Salmon', recipeId: 'r1', recipeServings: 1 }] });

    expect(meal.items[0].recipeId).toBe('r1');
  });
});
