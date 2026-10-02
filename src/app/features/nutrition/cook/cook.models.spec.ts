import { mapCookRecipe, titleFromText } from './cook.models';

describe('cook recipe mapping', () => {
  it('takes the first sentence as a title', () => {
    expect(titleFromText('Season the salmon. Then mix the dressing.')).toBe('Season the salmon.');
    expect(titleFromText('Just one line without a stop')).toBe('Just one line without a stop');
  });

  it('cuts a long first sentence at a comma, else at a word, within 60 characters', () => {
    const withComma = 'Heat the pan over a medium flame, add the oil and swirl it around until it shimmers.';
    expect(titleFromText(withComma)).toBe('Heat the pan over a medium flame');
    const noComma = 'Heat the pan over a medium flame and add the oil and swirl it around until it shimmers.';
    const cut = titleFromText(noComma);
    expect(cut.length).toBeLessThanOrEqual(60);
    expect(noComma.startsWith(cut)).toBeTrue();
  });

  it('maps the cook mode fields', () => {
    const recipe = mapCookRecipe({
      id: 'r1',
      name: 'Salmon salad',
      servings: 2,
      imageUrl: 'https://img/x.jpg',
      ingredients: [{ ingredientId: 'i1', foodName: 'Salmon', displayText: '200 g salmon', grams: 200, foodGroup: 'PROTEIN', categoryCode: 'SEAFOOD' }],
      steps: [
        { stepNumber: 2, text: 'Plate it.' },
        {
          stepNumber: 1,
          text: 'Fry the salmon 3-4 mins a side.',
          title: 'Fry the salmon',
          ingredientIds: ['i1'],
          timers: [{ seconds: 180, maxSeconds: 240, eachSide: true, phrase: '3-4 mins' }]
        }
      ]
    });
    expect(recipe.steps.map((s) => s.text)).toEqual(['Fry the salmon 3-4 mins a side.', 'Plate it.']);
    expect(recipe.steps[0]).toEqual(jasmine.objectContaining({ number: 1, title: 'Fry the salmon', ingredientIds: ['i1'] }));
    expect(recipe.steps[0].timer).toEqual({ seconds: 180, maxSeconds: 240, eachSide: true, phrase: '3-4 mins' });
    expect(recipe.ingredients[0]).toEqual(jasmine.objectContaining({ id: 'i1', name: 'Salmon', grams: 200, foodGroup: 'PROTEIN' }));
    expect(recipe.imageUrl).toBe('https://img/x.jpg');
  });

  it('degrades when the steps have no title, ingredientIds or timers', () => {
    const recipe = mapCookRecipe({ id: 'r1', name: 'Plain', steps: [{ stepNumber: 1, text: 'Boil the water. Add salt.' }] });
    expect(recipe.servings).toBe(1);
    expect(recipe.imageUrl).toBeNull();
    expect(recipe.steps[0].title).toBe('Boil the water.');
    expect(recipe.steps[0].ingredientIds).toEqual([]);
    expect(recipe.steps[0].timer).toBeNull();
  });

  it('drops a range whose top is not above its bottom', () => {
    const recipe = mapCookRecipe({ id: 'r', name: 'x', steps: [{ text: 'a', timers: [{ seconds: 60, maxSeconds: 60, eachSide: false, phrase: '1 min' }] }] });
    expect(recipe.steps[0].timer?.maxSeconds).toBeNull();
  });
});
