import { amountText, balanceRow, barPercent, budgetFigures, nutrientView, proteinChart, sourceLine, splitNutrients, whole } from './diary-figures';
import { balanceEntry, nutrientRow } from './diary-testing.spec';

describe('number text', () => {
  it('writes whole numbers with separators', () => {
    expect(whole(2008.4)).toBe('2,008');
  });

  it('keeps one decimal for small amounts, drops a zero decimal, and rounds milligrams', () => {
    expect(amountText(5.14, 'µg')).toBe('5.1 µg');
    expect(amountText(15, 'g')).toBe('15 g');
    expect(amountText(1860.4, 'mg')).toBe('1,860 mg');
    expect(amountText(34.9, 'mg')).toBe('35 mg');
    expect(amountText(3400, 'mg')).toBe('3,400 mg');
  });
});

describe('budgetFigures', () => {
  it('is null without a target', () => {
    expect(budgetFigures(500, null)).toBeNull();
    expect(budgetFigures(500, 0)).toBeNull();
  });

  it('says how many kcal are left and fills the ring within the target', () => {
    const figures = budgetFigures(1500, 2100);
    expect(figures?.line).toBe('600 kcal left');
    expect(figures?.within).toBeCloseTo(1500 / 2100);
    expect(figures?.over).toBe(0);
    expect(figures?.percent).toBe(71);
    expect(figures?.isOver).toBeFalse();
  });

  it('says how many kcal over and puts the part beyond the target in the over arc', () => {
    const figures = budgetFigures(2400, 2000);
    expect(figures?.line).toBe('400 kcal over');
    expect(figures?.within).toBe(1);
    expect(figures?.over).toBeCloseTo(0.2);
    expect(figures?.isOver).toBeTrue();
  });

  it('treats exactly the target as reached and not over', () => {
    const figures = budgetFigures(2000, 2000);
    expect(figures?.isOver).toBeFalse();
    expect(figures?.line).toBe('0 kcal left');
  });
});

describe('barPercent', () => {
  it('caps at full and floors at empty', () => {
    expect(barPercent(0.5)).toBe(50);
    expect(barPercent(1.4)).toBe(100);
    expect(barPercent(-1)).toBe(0);
  });
});

describe('balanceRow', () => {
  it('writes a target row with its reference and no marker', () => {
    const row = balanceRow(balanceEntry());
    expect(row.value).toBe('15 g');
    expect(row.reference).toBe('28 g a day');
    expect(row.marker).toBeNull();
    expect(row.metText).toBe('');
  });

  it('writes met and the share for a reached target', () => {
    const row = balanceRow(balanceEntry({ amount: 31, share: 31 / 28, met: true }));
    expect(row.metText).toBe('met · 111%');
  });

  it('puts the limit marker where the limit falls on a bar that went over', () => {
    const row = balanceRow(balanceEntry({ code: 'SUGAR', kind: 'LIMIT', amount: 54, reference: 50, share: 1.08, over: true }));
    expect(row.reference).toBe('50 g limit');
    expect(row.marker).toBeCloseTo(100 / 1.08);
  });

  it('has no marker for a limit that is under and no met text for a limit', () => {
    const row = balanceRow(balanceEntry({ kind: 'LIMIT', met: true, over: false, share: 0.5 }));
    expect(row.marker).toBeNull();
    expect(row.metText).toBe('');
  });
});

describe('sourceLine', () => {
  const sources = (...names: string[]) => names.map((foodName) => ({ foodName, amount: 1 }));

  it('names up to three foods in a sentence', () => {
    expect(sourceLine(balanceEntry({ topSources: sources('Apple', 'Granola', 'Banana') }))).toBe('Mostly from apple, granola and banana.');
    expect(sourceLine(balanceEntry({ topSources: sources('Apple', 'Granola') }))).toBe('Mostly from apple and granola.');
    expect(sourceLine(balanceEntry({ topSources: sources('Apple') }))).toBe('Mostly from apple.');
  });

  it('is empty with no sources', () => {
    expect(sourceLine(balanceEntry())).toBe('');
  });
});

describe('proteinChart', () => {
  const view = { weightKg: 72, lowGrams: 22, highGrams: 29, meals: [{ mealType: 'LUNCH', grams: 51 }, { mealType: 'BREAKFAST', grams: 25 }] };

  it('always has the four meals in order with zero for a meal not logged', () => {
    const chart = proteinChart(view);
    expect(chart.bars.map((bar) => bar.label)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
    expect(chart.bars.map((bar) => bar.grams)).toEqual([25, 51, 0, 0]);
  });

  it('marks the meals inside the personal band and positions the band', () => {
    const chart = proteinChart(view);
    expect(chart.bars.map((bar) => bar.inBand)).toEqual([true, false, false, false]);
    expect(chart.bandBottom).toBeCloseTo((22 / 60) * 100);
    expect(chart.bandHeight).toBeCloseTo((7 / 60) * 100);
    expect(chart.rangeText).toBe('22 to 29 g a meal');
  });

  it('grows the scale when a meal is above it', () => {
    const chart = proteinChart({ ...view, meals: [{ mealType: 'DINNER', grams: 90 }] });
    expect(chart.bars[2].height).toBe(100);
  });
});

describe('nutrientView and splitNutrients', () => {
  it('writes the percentage, the amount and the richest usual food', () => {
    const view = nutrientView(nutrientRow({ richestUsualFood: 'Salmon' }));
    expect(view.percent).toBe(34);
    expect(view.amount).toBe('5.1 of 15 µg');
    expect(view.words).toBe('The richest of the foods you often eat is salmon.');
  });

  it('says above the upper limit instead of a food when over the limit', () => {
    const view = nutrientView(nutrientRow({ aboveUpperLimit: true, upperLimit: 3000, unit: 'µg', richestUsualFood: 'Liver' }));
    expect(view.words).toBe('Above the upper limit of 3,000 µg.');
  });

  it('has no words when there is no food to name', () => {
    expect(nutrientView(nutrientRow()).words).toBe('');
  });

  it('takes the first three as large rows and the rest as chips', () => {
    const rows = ['A', 'B', 'C', 'D', 'E'].map((code) => nutrientRow({ code, displayName: code }));
    const { low, rest } = splitNutrients(rows);
    expect(low.map((entry) => entry.row.code)).toEqual(['A', 'B', 'C']);
    expect(rest.map((entry) => entry.row.code)).toEqual(['D', 'E']);
  });
});
