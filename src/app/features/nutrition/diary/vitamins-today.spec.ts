import { NutrientRow, NutrientSummary } from './diary.models';
import { nutrientRow } from './diary-testing.spec';
import { coverageLine, focusLine, noVitaminData, todayParts } from './vitamins-today';

const row = (code: string, name: string, share: number | null, overrides: Partial<NutrientRow> = {}) =>
  nutrientRow({ code, displayName: name, share, averageAmount: share === null ? null : share * 10, reference: 10, unit: 'mg', kind: 'MINERAL', met: (share ?? 0) >= 1, ...overrides });

const summary = (overrides: Partial<NutrientSummary> = {}): NutrientSummary => ({
  daysLogged: 1,
  referenceLabel: null,
  focusCodes: [],
  itemsLogged: null,
  itemsWithoutNutrients: null,
  nutrients: [row('IRON', 'Iron', 0.88), row('VIT_C', 'Vitamin C', 1.04)],
  ...overrides
});

describe('todayParts', () => {
  it('puts the three lowest nutrients that are not met large and everything else, met ones included, in the rest', () => {
    const parts = todayParts([
      row('A', 'Magnesium', 1.3),
      row('B', 'Vitamin E', 0.4),
      row('C', 'Calcium', 0.9),
      row('D', 'Vitamin D', 0.2),
      row('E', 'Iron', 0.6),
      row('F', 'Zinc', 0.7)
    ]);
    expect(parts.low.map((view) => view.row.displayName)).toEqual(['Vitamin D', 'Vitamin E', 'Iron']);
    expect(parts.rest.map((view) => view.row.displayName)).toEqual(['Magnesium', 'Calcium', 'Zinc']);
  });

  it('has no large rows when every nutrient is met, and leaves unknown nutrients out', () => {
    const parts = todayParts([row('A', 'Magnesium', 1.3), row('B', 'Zinc', null), row('C', 'Iron', 1)]);
    expect(parts.low).toEqual([]);
    expect(parts.rest.map((view) => view.row.displayName)).toEqual(['Magnesium', 'Iron']);
  });
});

describe('noVitaminData', () => {
  it('is true when every logged food lacks data or every amount is null, and false otherwise', () => {
    expect(noVitaminData(summary({ itemsLogged: 5, itemsWithoutNutrients: 5 }))).toBeTrue();
    expect(noVitaminData(summary({ itemsLogged: 5, itemsWithoutNutrients: 2 }))).toBeFalse();
    expect(noVitaminData(summary({ itemsLogged: 0, itemsWithoutNutrients: 0 }))).toBeFalse();
    expect(noVitaminData(summary({ nutrients: [row('IRON', 'Iron', null)] }))).toBeTrue();
    expect(noVitaminData(summary())).toBeFalse();
  });
});

describe('focusLine and coverageLine', () => {
  it('says is for one nutrient and are for several', () => {
    expect(focusLine(summary({ focusCodes: ['IRON'] }))).toBe('Iron is watched first.');
    expect(focusLine(summary({ focusCodes: ['IRON', 'VIT_C'] }))).toBe('Iron and vitamin C are watched first.');
    expect(focusLine(summary())).toBe('');
  });

  it('writes the coverage with a total when it is known and without when it is not', () => {
    expect(coverageLine(summary({ itemsLogged: 20, itemsWithoutNutrients: 4 }))).toBe('4 of 20 logged foods have no vitamin data, so these amounts may be low.');
    expect(coverageLine(summary({ itemsLogged: null, itemsWithoutNutrients: 3 }))).toBe('3 logged foods have no vitamin data, so these amounts may be low.');
    expect(coverageLine(summary({ itemsLogged: 5, itemsWithoutNutrients: 0 }))).toBe('');
  });
});
