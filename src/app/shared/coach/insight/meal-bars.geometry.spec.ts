import { ProteinByMeal } from '../../../core/fitsync.models';
import { MEAL_BASELINE_Y, mealBars } from './meal-bars.geometry';

const meals: ProteinByMeal[] = [
  { mealType: 'BREAKFAST', label: 'Breakfast', gramsPerDay: 27 },
  { mealType: 'LUNCH', label: 'Lunch', gramsPerDay: 54 },
  { mealType: 'DINNER', label: 'Dinner', gramsPerDay: 45 }
];

describe('meal bars geometry', () => {
  it('draws one bar for each meal, in the order given, all the same width', () => {
    const chart = mealBars(meals, true)!;
    expect(chart.bars.map((bar) => bar.fullLabel)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    expect(new Set(chart.bars.map((bar) => bar.width)).size).toBe(1);
    expect(chart.bars.map((bar) => bar.centerX)).toEqual([98, 270, 442]);
  });

  it('scales the heights to the largest bar, which is 72 tall and stands on the baseline', () => {
    const chart = mealBars(meals, true)!;
    expect(chart.bars.map((bar) => bar.height)).toEqual([36, 72, 60]);
    expect(chart.bars.map((bar) => bar.y + bar.height)).toEqual([MEAL_BASELINE_Y, MEAL_BASELINE_Y, MEAL_BASELINE_Y]);
    expect(chart.bars[1].share).toBe(1);
    expect(chart.bars[0].share).toBe(0.5);
  });

  it('writes the whole grams above each bar and the meal below it', () => {
    const chart = mealBars([{ mealType: 'SNACK', label: 'Snack', gramsPerDay: 7.4 }, { mealType: 'LUNCH', label: 'Lunch', gramsPerDay: 53.6 }], false)!;
    expect(chart.bars.map((bar) => bar.valueText)).toEqual(['7 g', '54 g']);
    expect(chart.bars[1].valueY).toBe(MEAL_BASELINE_Y - 72 - 7);
    expect(chart.bars.map((bar) => bar.label)).toEqual(['Snack', 'Lunch']);
  });

  it('brightens lunch and dinner when the reading is about their share', () => {
    const chart = mealBars(meals, true)!;
    expect(chart.bars.map((bar) => bar.bright)).toEqual([false, true, true]);
  });

  it('draws every bar in the same green otherwise', () => {
    const chart = mealBars(meals, false)!;
    expect(chart.bars.map((bar) => bar.bright)).toEqual([true, true, true]);
  });

  it('keeps a bar for a meal with no protein, flat on the baseline', () => {
    const chart = mealBars([...meals, { mealType: 'SNACK', label: 'Snack', gramsPerDay: 0 }], false)!;
    expect(chart.bars[3].height).toBe(0);
    expect(chart.bars[3].valueText).toBe('0 g');
  });

  it('cuts a long label for the drawing and keeps it whole for the list', () => {
    const chart = mealBars([{ mealType: 'SNACK', label: 'Late evening snack before bed', gramsPerDay: 10 }], false)!;
    expect(chart.bars[0].label).toBe('Late evening sn…');
    expect(chart.bars[0].fullLabel).toBe('Late evening snack before bed');
  });

  it('lists the values in the text alternative', () => {
    expect(mealBars(meals, true)!.description).toBe('Protein on an average day, by meal. Breakfast 27 g, Lunch 54 g, Dinner 45 g.');
  });

  it('draws nothing without a meal or when no meal has any protein', () => {
    expect(mealBars([], true)).toBeNull();
    expect(mealBars(meals.map((meal) => ({ ...meal, gramsPerDay: 0 })), true)).toBeNull();
    expect(mealBars([{ mealType: 'LUNCH', label: 'Lunch', gramsPerDay: Number.NaN }], true)).toBeNull();
  });
});
