import { nutrientsDays } from './food-nutrients-range';
import { monthSlots } from './food-figures';

describe('nutrientsDays', () => {
  it('reads 30 days at 4 weeks and 90 days at 3 months, with no caption', () => {
    expect(nutrientsDays('4w')).toEqual({ days: 30, caption: null });
    expect(nutrientsDays('3m')).toEqual({ days: 90, caption: null });
  });

  it('reads the last 90 days at 1 year and says so', () => {
    expect(nutrientsDays('1y')).toEqual({ days: 90, caption: 'Last 3 months' });
  });
});

describe('monthSlots', () => {
  it('gives the 12 full months and the current one for a year ending in October, 13 for a year that starts on a first', () => {
    const year = monthSlots('2025-10-06', '2026-10-04');
    expect(year.length).toBe(12);
    expect(year[0]).toBe('2025-11-01');
    expect(year.at(-1)).toBe('2026-10-01');
    expect(monthSlots('2025-10-01', '2026-10-04').length).toBe(13);
  });

  it('gives 3 slots at 3 months and crosses a new year', () => {
    expect(monthSlots('2026-07-05', '2026-10-03')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    expect(monthSlots('2025-11-10', '2026-02-08')).toEqual(['2025-12-01', '2026-01-01', '2026-02-01']);
  });
});
