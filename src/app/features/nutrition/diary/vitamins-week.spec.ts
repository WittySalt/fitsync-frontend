import { NutrientDay } from './diary.models';
import { nutrientRow } from './diary-testing.spec';
import { averageShare, averageWindow, cellOpacity, countedDays, patternLine, weekNote, weekRange, weekRows } from './vitamins-week';

// The week of Monday 28 Sept to Sunday 4 Oct 2026. Friday 2 Oct is today.
const WEEK = weekRange('2026-10-02').dates;
const TODAY = '2026-10-02';

const day = (date: string, share: number | null, logged = true): NutrientDay => ({ date, logged, amount: share, share });
const row = (name: string, shares: (number | null)[], overrides = {}) =>
  nutrientRow({
    code: name.toUpperCase(),
    displayName: name,
    averageAmount: 1,
    days: shares.map((share, index) => day(WEEK[index], share, share !== null)),
    ...overrides
  });

describe('weekRange', () => {
  it('is the Monday to Sunday week that holds the selected day', () => {
    expect(weekRange('2026-10-02')).toEqual({ dates: WEEK, monday: '2026-09-28', sunday: '2026-10-04' });
    expect(weekRange('2026-09-28').monday).toBe('2026-09-28');
    expect(weekRange('2026-10-04').monday).toBe('2026-09-28');
    expect(weekRange('2026-10-05').sunday).toBe('2026-10-11');
  });
});

describe('the average', () => {
  it('counts only logged days before today', () => {
    expect(averageWindow(WEEK, TODAY)).toEqual(WEEK.slice(0, 4));
    const counted = countedDays(row('Iron', [0.5, null, 1, 0.7, 0.2]), WEEK, TODAY);
    expect(counted.map((entry) => entry.date)).toEqual([WEEK[0], WEEK[2], WEEK[3]]);
    expect(averageShare(counted)).toBeCloseTo((0.5 + 1 + 0.7) / 3);
  });

  it('counts every logged day of a past week and none of a future one', () => {
    const shares = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4];
    expect(countedDays(row('Iron', shares), WEEK, '2026-10-12').length).toBe(7);
    expect(countedDays(row('Iron', shares), WEEK, '2026-09-20').length).toBe(0);
  });

  it('is null when no day counts', () => {
    expect(averageShare([])).toBeNull();
  });
});

describe('cellOpacity', () => {
  it('runs from 0.18 for nothing to 1 for a full day, and stays there above it', () => {
    expect(cellOpacity(0)).toBeCloseTo(0.18);
    expect(cellOpacity(0.5)).toBeCloseTo(0.59);
    expect(cellOpacity(1)).toBe(1);
    expect(cellOpacity(2.4)).toBe(1);
    expect(cellOpacity(-1)).toBeCloseTo(0.18);
  });
});

describe('weekRows', () => {
  it('sorts by average ascending, with a nutrient that has no counted day last, and leaves out unknown nutrients', () => {
    const rows = weekRows(
      [
        row('Iron', [1.6, 1.9, 1.7, 2]),
        row('Vitamin D', [0.3, 0.25, 0.48, 0.37]),
        row('Zinc', [null, null, null, null, 0.4]),
        row('Boron', [0.5], { averageAmount: null })
      ],
      WEEK,
      TODAY
    );
    expect(rows.map((entry) => entry.row.displayName)).toEqual(['Vitamin D', 'Iron', 'Zinc']);
    expect(rows[0].percent).toBe(35);
    expect(rows[2].percent).toBeNull();
  });

  it('draws logged days as values, days after today and unlogged days as empty, and marks today and reached days', () => {
    const [entry] = weekRows([row('Iron', [1.2, null, 0.5, 0.9, 0.4])], WEEK, TODAY);
    expect(entry.cells.map((cell) => cell.state)).toEqual(['value', 'empty', 'value', 'value', 'value', 'future', 'future']);
    expect(entry.cells.map((cell) => cell.reached)).toEqual([true, false, false, false, false, false, false]);
    expect(entry.cells.map((cell) => cell.today)).toEqual([false, false, false, false, true, false, false]);
    expect(entry.cells[4].opacity).toBeCloseTo(0.18 + 0.82 * 0.4);
    expect(entry.counted).toBe(3);
    expect(entry.short).toBe(2);
  });
});

describe('patternLine', () => {
  const lowest = (shares: (number | null)[], overrides = {}) => weekRows([row('Vitamin D', shares, overrides)], WEEK, TODAY)[0];

  it('says every day when every counted day was short', () => {
    expect(patternLine(lowest([0.3, 0.2, 0.4, 0.1]))).toBe('Vitamin D was short on every day this week.');
  });

  it('says how many of the counted days were short otherwise', () => {
    expect(patternLine(lowest([0.3, 1.1, 0.4, 0.9]))).toBe('Vitamin D was short on 3 of 4 days this week.');
    expect(patternLine(lowest([0.3, null, 1.2]))).toBe('Vitamin D was short on 1 of 2 days this week.');
  });

  it('adds the richest usual food when it is known', () => {
    expect(patternLine(lowest([0.3, 0.2], { richestUsualFood: 'Salmon' }))).toBe('Vitamin D was short on every day this week. Among foods you often eat, salmon has the most.');
  });

  it('is empty without a counted day, and says so when nothing was short', () => {
    expect(patternLine(undefined)).toBe('');
    expect(patternLine(lowest([null, null, null, null, 0.4]))).toBe('');
    expect(patternLine(lowest([1, 1.2, 1.1]))).toBe('Every vitamin and mineral here was reached on the days counted.');
  });
});

describe('weekNote', () => {
  const label = 'for a man aged 19 to 30';

  it('names the dates and the days the average counts, and that today joins tomorrow', () => {
    expect(weekNote(WEEK, TODAY, label)).toBe(
      '28 Sept to 4 Oct. The average counts Monday to Thursday; today joins it tomorrow. Daily amounts for a man aged 19 to 30, from the US National Institutes of Health.'
    );
  });

  it('says only Monday is in so far when one day counts', () => {
    expect(weekNote(WEEK, '2026-09-29', null)).toBe(
      '28 Sept to 4 Oct. Only Monday is in the average so far, so it will move as the week fills. Daily amounts are from the US National Institutes of Health.'
    );
  });

  it('counts the whole of a past week and says nothing counts on a Monday', () => {
    expect(weekNote(WEEK, '2026-10-12', null)).toContain('The average counts Monday to Sunday. Daily');
    expect(weekNote(WEEK, '2026-09-28', null)).toContain('Nothing is in the average yet');
    expect(weekNote(WEEK, '2026-09-20', null)).toContain('This week has not started yet.');
  });
});
