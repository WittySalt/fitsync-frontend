import { fastedMeal, foodTags, groupsOf, macroLine, macroSplit, mealParts } from './diary-food';
import { item, meal } from './diary-testing.spec';

describe('foodTags', () => {
  it('tags a protein rich food as high protein', () => {
    expect(foodTags(item({ calories: 248, proteinGrams: 46, gramsConsumed: 150 }))).toEqual([{ label: 'High protein', good: true }]);
  });

  it('tags a fibre rich food as high fibre when protein is not the main energy', () => {
    const almonds = item({ calories: 116, proteinGrams: 4, fiberGrams: 2.6, gramsConsumed: 20, foodGroup: 'NUTS' });
    expect(foodTags(almonds)).toEqual([{ label: 'High fibre', good: true }]);
  });

  it('tags a sugary food in grey, never as a good tag', () => {
    const granola = item({ calories: 180, proteinGrams: 4, sugarGrams: 12, gramsConsumed: 40, foodGroup: 'GRAINS' });
    expect(foodTags(granola)).toEqual([{ label: 'High sugar', good: false }]);
  });

  it('uses a lower sugar limit for a drink', () => {
    const cola = item({ calories: 105, proteinGrams: 0, sugarGrams: 30, gramsConsumed: 250, foodGroup: 'DRINKS' });
    expect(foodTags(cola).map((tag) => tag.label)).toEqual(['High sugar']);
    const juiceLike = item({ calories: 50, proteinGrams: 0, sugarGrams: 30, gramsConsumed: 250, foodGroup: 'DAIRY' });
    expect(foodTags(juiceLike)).toEqual([]);
  });

  it('tags a salty food and keeps sugar ahead of salt', () => {
    const ham = item({ calories: 120, proteinGrams: 3, sodiumMg: 900, gramsConsumed: 100 });
    expect(foodTags(ham)).toEqual([{ label: 'High salt', good: false }]);
    const both = item({ calories: 300, proteinGrams: 2, sugarGrams: 40, sodiumMg: 900, gramsConsumed: 100 });
    expect(foodTags(both).map((tag) => tag.label)).toEqual(['High sugar']);
  });

  it('can give one green and one grey tag together', () => {
    const cheese = item({ calories: 400, proteinGrams: 25, sodiumMg: 1500, gramsConsumed: 100 });
    expect(foodTags(cheese).map((tag) => tag.label)).toEqual(['High protein', 'High salt']);
  });

  it('gives no tag when the food has no weight or nothing stands out', () => {
    expect(foodTags(item({ gramsConsumed: null }))).toEqual([]);
    expect(foodTags(item({ gramsConsumed: 0 }))).toEqual([]);
    expect(foodTags(item({ calories: 105, proteinGrams: 1, carbsGrams: 27, fatGrams: 0, gramsConsumed: 118 }))).toEqual([]);
  });
});

describe('macroLine and macroSplit', () => {
  it('rounds each macro and writes P, C and F', () => {
    expect(macroLine(19.6, 7.2, 8)).toBe('P 20 · C 7 · F 8 g');
  });

  it('weighs fat at nine kcal a gram and gives nothing for an empty meal', () => {
    expect(macroSplit(10, 10, 10)).toEqual({ protein: 40, carbs: 40, fat: 90 });
    expect(macroSplit(0, 0, 0)).toBeNull();
  });
});

describe('mealParts', () => {
  const at = (hour: number) => new Date(2026, 9, 2, hour, 15).toISOString();

  it('leaves a fasted mark out of the four parts and finds it on its own', () => {
    const fast = meal({ mealId: 'f', mealType: 'FAST', consumedAt: at(12), items: [] });
    expect(mealParts([fast]).every((part) => !part.logged)).toBeTrue();
    expect(fastedMeal([meal({ mealId: 'a', mealType: 'LUNCH' }), fast])?.mealId).toBe('f');
    expect(fastedMeal([meal({ mealId: 'a', mealType: 'LUNCH' })])).toBeNull();
  });

  it('always returns the four parts in order', () => {
    const parts = mealParts([]);
    expect(parts.map((part) => part.label)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
    expect(parts.every((part) => !part.logged)).toBeTrue();
  });

  it('puts the meals of one type together with their ids, time and totals', () => {
    const parts = mealParts([
      meal({ mealId: 'b', mealType: 'LUNCH', consumedAt: at(14), items: [item({ calories: 100 })] }),
      meal({ mealId: 'a', mealType: 'LUNCH', consumedAt: at(12), items: [item({ calories: 200 })] })
    ]);
    const lunch = parts[1];
    expect(lunch.logged).toBeTrue();
    expect(lunch.mealIds).toEqual(['a', 'b']);
    expect(lunch.time).toBe('12:15');
    expect(lunch.calories).toBe(300);
    expect(lunch.items.length).toBe(2);
  });

  it('counts supper as dinner and any other meal type as a snack', () => {
    const parts = mealParts([meal({ mealType: 'SUPPER' }), meal({ mealId: 'x', mealType: 'OTHER' })]);
    expect(parts[2].logged).toBeTrue();
    expect(parts[3].logged).toBeTrue();
  });
});

describe('groupsOf', () => {
  it('lists each food group once and skips foods with none', () => {
    const groups = groupsOf([item({ foodGroup: 'DAIRY' }), item({ foodGroup: 'DAIRY' }), item({ foodGroup: null }), item({ foodGroup: 'VEG' })]);
    expect([...groups].sort()).toEqual(['DAIRY', 'VEG']);
  });
});
