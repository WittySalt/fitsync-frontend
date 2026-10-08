import { DiarySummary, NutrientSummary } from '../diary/diary.models';
import { nutrientRow, summary } from '../diary/diary-testing.spec';
import {
  cardTags,
  clampServings,
  cookFigures,
  cookedLine,
  cookedWhen,
  fitLine,
  timersTotalText,
  fallbackCover,
  goodSources,
  gramsText,
  heading,
  fatTargetOf,
  higherIn,
  ingredientGrams,
  isCaution,
  loadTicks,
  saveTicks,
  savedMealLine,
  servingsLabel,
  sessionStore,
  stepServings,
  todayFit,
  topGroupsOf
} from './recipes-figures';
import { card, detail, ingredient, perServing, savedMeal } from './recipes-testing.spec';

function today(rows: ReturnType<typeof nutrientRow>[]): NutrientSummary {
  return { daysLogged: 1, referenceLabel: null, focusCodes: [], itemsLogged: null, itemsWithoutNutrients: null, nutrients: rows };
}

describe('servings', () => {
  it('moves in quarters and stays between 0.25 and 20', () => {
    expect(stepServings(1, 1)).toBe(1.25);
    expect(stepServings(0.25, -1)).toBe(0.25);
    expect(stepServings(20, 1)).toBe(20);
    expect(clampServings(0.1)).toBe(0.25);
    expect(clampServings(7.3)).toBe(7.25);
    expect(clampServings(99)).toBe(20);
  });

  it('takes something that is not a number as one serving', () => {
    expect(clampServings(Number.NaN)).toBe(1);
  });

  it('says serving in the singular up to one', () => {
    expect(servingsLabel(1)).toBe('1 serving');
    expect(servingsLabel(0.25)).toBe('0.25 serving');
    expect(servingsLabel(1.5)).toBe('1.5 servings');
  });
});

describe('ingredientGrams', () => {
  it('shares the recipe by its servings and multiplies by the chosen count', () => {
    expect(ingredientGrams(ingredient({ grams: 400 }), 4, 1, false)).toBe(100);
    expect(ingredientGrams(ingredient({ grams: 400 }), 4, 2.5, false)).toBe(250);
  });

  it('gives the whole recipe as it is, and null when the weight is unknown', () => {
    expect(ingredientGrams(ingredient({ grams: 400 }), 4, 2, true)).toBe(400);
    expect(ingredientGrams(ingredient({ grams: null }), 4, 2, true)).toBeNull();
  });

  it('writes grams whole from ten up and with a decimal below', () => {
    expect(gramsText(100.4)).toBe('100 g');
    expect(gramsText(1.26)).toBe('1.3 g');
    expect(gramsText(null)).toBe('');
  });
});

describe('highlights', () => {
  it('lists the nutrients from a fifth of the day, richest first', () => {
    expect(goodSources(perServing().nutrients)).toEqual([
      { name: 'Vitamin E', percent: 61 },
      { name: 'Vitamin D', percent: 54 }
    ]);
  });

  it('leaves out a nutrient with no share', () => {
    expect(goodSources([{ code: 'X', displayName: 'X', amount: 1, unit: 'g', share: null }])).toEqual([]);
  });

  it('names fat above 30% of the fat target, with its share of the day', () => {
    expect(higherIn(perServing({ fatGrams: 49 }), [], 70)).toEqual([{ name: 'Fat', detail: '49 g, 70% of a day' }]);
    expect(higherIn(perServing({ fatGrams: 20 }), [], 70)).toEqual([]);
  });

  it('measures fat against the account target, or 30% of the calorie target without one', () => {
    expect(fatTargetOf(summary({ targetFatGrams: 70, targetCalories: 2000 }))).toBe(70);
    expect(fatTargetOf(summary({ targetFatGrams: null, targetCalories: 2100 }))).toBe(70);
    expect(fatTargetOf(summary({ targetFatGrams: null, targetCalories: null }))).toBeNull();
    expect(fatTargetOf(null)).toBeNull();
    expect(higherIn(perServing({ fatGrams: 46 }), [], fatTargetOf(summary({ targetFatGrams: null, targetCalories: 2100 })))).toEqual([
      { name: 'Fat', detail: '46 g, 66% of a day' }
    ]);
  });

  it('leaves fat out when there is no fat target', () => {
    expect(higherIn(perServing({ fatGrams: 90 }), [], null)).toEqual([]);
  });

  it('adds sugar and salt from the tags', () => {
    const items = higherIn(perServing({ fatGrams: 1, sugarGrams: 31.4, sodiumMg: 720 }), ['High sugar', 'High salt'], 70);

    expect(items).toEqual([
      { name: 'Sugar', detail: '31 g' },
      { name: 'Salt', detail: '720 mg sodium' }
    ]);
  });
});

describe('todayFit', () => {
  const day: DiarySummary = summary({ totalCalories: 1268, targetCalories: 2100, totalProteinGrams: 87, targetProteinGrams: 140 });

  it('adds the chosen servings to calories and protein, before and after', () => {
    const fit = todayFit(day, null, perServing({ kcal: 300, proteinGrams: 20 }), 2);

    expect(fit.calories).toEqual(jasmine.objectContaining({ before: 1268, after: 1868, of: 2100 }));
    expect(fit.protein).toEqual(jasmine.objectContaining({ before: 87, after: 127, of: 140 }));
    expect(fit.leftKcal).toBe(232);
  });

  it('reports calories over the target as a negative amount left', () => {
    expect(todayFit(day, null, perServing({ kcal: 900 }), 1).leftKcal).toBe(-68);
  });

  it('has no amount left without a target', () => {
    expect(todayFit(summary({ targetCalories: null }), null, perServing(), 1).leftKcal).toBeNull();
  });

  it('picks the lowest vitamin of the day among those the recipe gives something of', () => {
    const rows = today([
      nutrientRow({ code: 'VIT_E', displayName: 'Vitamin E', share: 0.5 }),
      nutrientRow({ code: 'VIT_D', displayName: 'Vitamin D', share: 0.2 }),
      nutrientRow({ code: 'VIT_C', displayName: 'Vitamin C', share: 0.01 }),
      nutrientRow({ code: 'ZINC', displayName: 'Zinc', kind: 'MINERAL', share: 0 })
    ]);

    const fit = todayFit(day, rows, perServing(), 1);

    // Vitamin C is the lowest, but the recipe has none of it, so Vitamin D is the line.
    expect(fit.vitamin?.label).toBe('Vitamin D');
    expect(Math.round(fit.vitamin?.before ?? 0)).toBe(20);
    expect(Math.round(fit.vitamin?.after ?? 0)).toBe(74);
  });

  it('scales the vitamin with the servings', () => {
    const rows = today([nutrientRow({ code: 'VIT_D', displayName: 'Vitamin D', share: 0.2 })]);

    expect(Math.round(todayFit(day, rows, perServing(), 0.5).vitamin?.after ?? 0)).toBe(47);
  });

  it('treats a vitamin with no figure for the day as none eaten yet', () => {
    const rows = today([nutrientRow({ code: 'VIT_D', share: null })]);

    expect(todayFit(day, rows, perServing(), 1).vitamin?.before).toBe(0);
  });

  it('has no rows before the day loads', () => {
    expect(todayFit(null, null, perServing(), 1)).toEqual({ calories: null, protein: null, vitamin: null, leftKcal: null });
  });
});

describe('fallbackCover', () => {
  it('keeps at most three groups and tints from the first two', () => {
    const cover = fallbackCover(['VEG', 'PROTEIN', 'FRUIT', 'DAIRY']);

    expect(cover.groups).toEqual(['VEG', 'PROTEIN', 'FRUIT']);
    expect(cover.background).toContain('var(--food-veg)');
    expect(cover.background).toContain('var(--food-protein)');
    expect(cover.background).not.toContain('var(--food-fruit)');
  });

  it('uses one group for both ends and drops repeats', () => {
    const cover = fallbackCover(['VEG', 'VEG']);

    expect(cover.groups).toEqual(['VEG']);
    expect(cover.background.match(/var\(--food-veg\)/g)?.length).toBe(2);
  });

  it('is a plain sunken tile without groups', () => {
    expect(fallbackCover([])).toEqual({ groups: [], background: 'var(--surface-sunken)' });
  });

  it('takes the biggest groups of a recipe', () => {
    expect(topGroupsOf(detail())).toEqual(['PROTEIN', 'FRUIT']);
  });
});

describe('card text', () => {
  it('adds one diet tag, Vegan before Vegetarian', () => {
    expect(cardTags(card({ tags: ['High fibre'], dietFlags: ['VEGETARIAN', 'VEGAN'] }))).toEqual(['High fibre', 'Vegan']);
    expect(cardTags(card({ tags: [], dietFlags: ['VEGETARIAN'] }))).toEqual(['Vegetarian']);
    expect(cardTags(card({ tags: ['High protein'], dietFlags: [] }))).toEqual(['High protein']);
  });

  it('joins the category and the cuisine, whichever there is', () => {
    expect(heading(card())).toBe('Seafood · British');
    expect(heading(card({ cuisine: null }))).toBe('Seafood');
  });
});

describe('card tags and saved meal lines', () => {
  it('marks High sugar and High salt as the ones drawn grey', () => {
    expect(isCaution('High sugar')).toBeTrue();
    expect(isCaution('High salt')).toBeTrue();
    expect(isCaution('High protein')).toBeFalse();
  });

  it('writes the foods of a saved meal as one line, a recipe as its name and servings', () => {
    const line = savedMealLine(
      savedMeal({
        items: [
          { templateItemId: 'a', foodName: 'Salad', quantity: 1, unit: 'serving', calories: 1, recipeId: 'r1', recipeServings: 1.5, categoryCode: null, foodGroup: null },
          { templateItemId: 'b', foodName: 'Coffee', quantity: 1, unit: 'serving', calories: 1, recipeId: null, recipeServings: null, categoryCode: null, foodGroup: null }
        ]
      })
    );

    expect(line).toBe('Salad · 1.5 servings, Coffee');
  });

  it('falls back to the quantity when a recipe item has no servings of its own', () => {
    const line = savedMealLine(savedMeal({ items: [{ templateItemId: 'a', foodName: 'Salad', quantity: 2, unit: 'serving', calories: 1, recipeId: 'r1', recipeServings: null, categoryCode: null, foodGroup: null }] }));

    expect(line).toBe('Salad · 2 servings');
  });
});

describe('ticks', () => {
  function fakeStore(initial: Record<string, string> = {}): Storage {
    const data = { ...initial };
    return { getItem: (key: string) => data[key] ?? null, setItem: (key: string, value: string) => void (data[key] = value) } as Storage;
  }

  it('keeps ticks per recipe', () => {
    const store = fakeStore();
    saveTicks(store, 'a', new Set(['i1', 'i2']));
    saveTicks(store, 'b', new Set(['i9']));

    expect([...loadTicks(store, 'a')]).toEqual(['i1', 'i2']);
    expect([...loadTicks(store, 'b')]).toEqual(['i9']);
    expect(loadTicks(store, 'c').size).toBe(0);
  });

  it('reads nothing from a store that is broken, missing or holds something else', () => {
    expect(loadTicks(null, 'a').size).toBe(0);
    expect(loadTicks(fakeStore({ 'fitsync.recipe.ticks.a': '{oops' }), 'a').size).toBe(0);
    expect(loadTicks(fakeStore({ 'fitsync.recipe.ticks.a': '{"x":1}' }), 'a').size).toBe(0);
  });

  it('does not throw when the store refuses a write', () => {
    const full = {
      setItem: () => {
        throw new Error('full');
      }
    };

    expect(() => saveTicks(full, 'a', new Set(['i1']))).not.toThrow();
  });

  it('writes 0 g as to taste', () => {
    expect(gramsText(0)).toBe('to taste');
    expect(gramsText(null)).toBe('');
    expect(gramsText(12.4)).toBe('12 g');
  });

  it('finds the session store in a browser', () => {
    expect(sessionStore()).not.toBeNull();
  });

  it('adds up the timers of the steps for the Ready screen, both sides of a side-by-side timer', () => {
    const timer = (seconds: number, eachSide = false) => ({ seconds, maxSeconds: seconds, eachSide, phrase: '' });
    const step = (timers: ReturnType<typeof timer>[]) => ({ stepNumber: 1, text: 'x', title: null, ingredientIds: [], timers });
    expect(cookFigures({ steps: [step([]), step([timer(180, true)]), step([timer(300), timer(60)])] })).toEqual({ steps: 3, timers: 2, timerSeconds: 660 });
    expect(cookFigures({ steps: [] })).toEqual({ steps: 0, timers: 0, timerSeconds: 0 });
  });

  it('words a total of timers', () => {
    expect(timersTotalText(0)).toBe('none');
    expect(timersTotalText(20)).toBe('about 1 min');
    expect(timersTotalText(900)).toBe('about 15 min');
    expect(timersTotalText(3600)).toBe('about 1 h');
    expect(timersTotalText(4500)).toBe('about 1 h 15 min');
  });

  it('says when a recipe was last cooked, by the calendar day', () => {
    const now = new Date(2026, 9, 3, 9, 0);
    const at = (day: number, hour = 20) => new Date(2026, 8, day, hour).toISOString();
    expect(cookedWhen(new Date(2026, 9, 3, 1).toISOString(), now)).toBe('Cooked today');
    expect(cookedWhen(new Date(2026, 9, 2, 23).toISOString(), now)).toBe('Cooked yesterday');
    expect(cookedWhen(new Date(2026, 9, 1, 12).toISOString(), now)).toBe('Cooked Thursday');
    expect(cookedWhen(at(25), now)).toBe('Cooked last week');
    expect(cookedWhen(at(15), now)).toBe('Cooked 15 Sept');
    expect(cookedWhen(null, now)).toBe('');
    expect(cookedWhen(new Date(2026, 9, 1, 12).toISOString(), now, 'Logged')).toBe('Logged Thursday');
    expect(cookedWhen(new Date(2026, 9, 2, 23).toISOString(), now, 'Logged')).toBe('Logged yesterday');
    expect(cookedWhen(at(25), now, 'Logged')).toBe('Logged last week');
    expect(cookedWhen(at(15), now, 'Logged')).toBe('Logged 15 Sept');
    expect(cookedWhen('not a date', now)).toBe('');
  });

  it('counts the days of a cook in the profile zone, not the device zone', () => {
    // 09:00 UTC on Saturday 3 October is 22:00 that day in Auckland and 02:00 that day in Los Angeles.
    const now = new Date('2026-10-03T09:00:00Z');
    // 11:30 UTC on 2 October is 00:30 on the 3rd in Auckland and 04:30 on the 2nd in Los Angeles.
    const cooked = '2026-10-02T11:30:00Z';
    expect(cookedWhen(cooked, now, 'Cooked', 'Pacific/Auckland')).toBe('Cooked today');
    expect(cookedWhen(cooked, now, 'Cooked', 'America/Los_Angeles')).toBe('Cooked yesterday');
    // 11:30 UTC on 29 September is Wednesday the 30th in Auckland and Tuesday the 29th in Los Angeles.
    expect(cookedWhen('2026-09-29T11:30:00Z', now, 'Cooked', 'Pacific/Auckland')).toBe('Cooked Wednesday');
    expect(cookedWhen('2026-09-29T11:30:00Z', now, 'Cooked', 'America/Los_Angeles')).toBe('Cooked Tuesday');
    // 12:30 UTC on 15 September (before New Zealand's clocks go forward) is the 16th in Auckland and the 15th in Los Angeles.
    expect(cookedWhen('2026-09-15T12:30:00Z', now, 'Cooked', 'Pacific/Auckland')).toBe('Cooked 16 Sept');
    expect(cookedWhen('2026-09-15T12:30:00Z', now, 'Cooked', 'America/Los_Angeles')).toBe('Cooked 15 Sept');
    expect(cookedLine(2, cooked, now, 'Pacific/Auckland')).toBe('Cooked 2 times · last today');
    expect(cookedLine(2, cooked, now, 'America/Los_Angeles')).toBe('Cooked 2 times · last yesterday');
  });

  it('says how often a recipe was cooked and when last, and nothing for one never cooked', () => {
    const now = new Date(2026, 9, 3, 9, 0);
    const at = (month: number, day: number) => new Date(2026, month, day, 20).toISOString();
    expect(cookedLine(0, at(9, 2), now)).toBe('');
    expect(cookedLine(3, at(9, 1), now)).toBe('Cooked 3 times \u00b7 last on Thursday');
    expect(cookedLine(1, at(9, 3), now)).toBe('Cooked 1 time \u00b7 last today');
    expect(cookedLine(2, at(9, 2), now)).toBe('Cooked 2 times \u00b7 last yesterday');
    expect(cookedLine(2, at(8, 25), now)).toBe('Cooked 2 times \u00b7 last week');
    expect(cookedLine(2, at(8, 15), now)).toBe('Cooked 2 times \u00b7 last on 15 Sept');
    expect(cookedLine(4, null, now)).toBe('Cooked 4 times');
  });

  it('builds the line under Fits today from what the server sent, leaving out what is missing', () => {
    expect(fitLine({ kcalLeft: 950, proteinShortGrams: 41, lowestNutrient: 'Vitamin D' })).toEqual({
      lead: '950 kcal left today',
      rest: ', protein 41 g short, vitamin D lowest. Recipes that fit come first.'
    });
    expect(fitLine({ kcalLeft: 1250.4, proteinShortGrams: 0, lowestNutrient: null })).toEqual({ lead: '1,250 kcal left today', rest: '. Recipes that fit come first.' });
    expect(fitLine({ kcalLeft: -20, proteinShortGrams: null, lowestNutrient: null })?.lead).toBe('No calories left today');
    expect(fitLine({ kcalLeft: null, proteinShortGrams: 12, lowestNutrient: null })).toEqual({ lead: 'protein 12 g short', rest: '. Recipes that fit come first.' });
    expect(fitLine({ kcalLeft: null, proteinShortGrams: null, lowestNutrient: null })).toBeNull();
    expect(fitLine(null)).toBeNull();
  });
});
