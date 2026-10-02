import {
  hasAssignments,
  ingredientsOf,
  parseServings,
  scaleFactor,
  scaledGrams,
  splitAtPhrase,
  stepState,
  turnHeading,
  turnSubject,
  usedCount,
  usedIds
} from './cook-recipe';
import { CookIngredient, CookRecipe, CookStep } from './cook.models';

function ingredient(id: string, name: string, group: CookIngredient['foodGroup'] = null, grams: number | null = 100): CookIngredient {
  return { id, name, displayText: name, grams, foodGroup: group, categoryCode: null };
}

function step(number: number, ids: string[], text = 'Do it.'): CookStep {
  return { number, text, title: text, ingredientIds: ids, timer: null };
}

const salmon = ingredient('i1', 'Salmon, Atlantic, raw', 'PROTEIN');
const oil = ingredient('i2', 'Olive oil', 'NUTS');
const lime = ingredient('i3', 'Lime', 'FRUIT');
const recipe: CookRecipe = {
  id: 'r1',
  name: 'Salmon salad',
  imageUrl: null,
  servings: 2,
  ingredients: [salmon, oil, lime],
  steps: [step(1, ['i3']), step(2, ['i1', 'i2']), step(3, [])]
};

describe('cook recipe helpers', () => {
  it('reads servings from the query, defaulting to 1', () => {
    expect(parseServings('2')).toBe(2);
    expect(parseServings('0.5')).toBe(0.5);
    expect(parseServings(null)).toBe(1);
    expect(parseServings('abc')).toBe(1);
    expect(parseServings('0')).toBe(1);
    expect(parseServings('99')).toBe(1);
  });

  it('scales amounts by the servings over the recipe servings', () => {
    expect(scaleFactor(1, 2)).toBe(0.5);
    expect(scaleFactor(3, 0)).toBe(3);
    expect(scaledGrams(200, 0.5)).toBe(100);
    expect(scaledGrams(null, 3)).toBeNull();
  });

  it('finds the ingredients of a step and skips unknown ids', () => {
    expect(ingredientsOf(step(1, ['i2', 'zz', 'i1']), recipe.ingredients)).toEqual([oil, salmon]);
  });

  it('counts an ingredient as used once an earlier step has it', () => {
    expect([...usedIds(recipe.steps, 0)]).toEqual([]);
    expect([...usedIds(recipe.steps, 1)]).toEqual(['i3']);
    expect(usedCount(recipe, 1)).toBe(1);
    expect(usedCount(recipe, 2)).toBe(3);
    expect(usedCount(recipe, 5)).toBe(3);
  });

  it('tells whether any step has ingredient ids', () => {
    expect(hasAssignments(recipe)).toBeTrue();
    expect(hasAssignments({ ...recipe, steps: [step(1, []), step(2, [])] })).toBeFalse();
  });

  it('labels a step as done, now or next', () => {
    expect([0, 1, 2].map((i) => stepState(i, 1))).toEqual(['done', 'now', 'next']);
  });

  it('splits a step around the timer phrase, ignoring case', () => {
    expect(splitAtPhrase('Fry for 3-4 mins a side.', '3-4 MINS')).toEqual({ before: 'Fry for ', match: '3-4 mins', after: ' a side.' });
    expect(splitAtPhrase('No time here.', '3 mins')).toEqual({ before: 'No time here.', match: '', after: '' });
    expect(splitAtPhrase('Text', '')).toEqual({ before: 'Text', match: '', after: '' });
  });

  it('turns the one protein, else the only ingredient, else "it"', () => {
    expect(turnSubject(step(2, ['i1', 'i2']), recipe.ingredients)).toBe('salmon');
    expect(turnSubject(step(1, ['i3']), recipe.ingredients)).toBe('lime');
    expect(turnSubject(step(2, ['i2', 'i3']), recipe.ingredients)).toBeNull();
    expect(turnSubject(step(3, []), recipe.ingredients)).toBeNull();
    expect(turnHeading('salmon')).toBe('Turn the salmon');
    expect(turnHeading(null)).toBe('Turn it');
  });
});
