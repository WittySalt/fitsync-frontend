import { historyGroup, relativeWhen, surfaceLabel } from './history-time';

/** Local-time constructor, so the cases mean the same thing in any zone the tests run in. */
const at = (y: number, m: number, d: number, h = 12, min = 0): Date => new Date(y, m - 1, d, h, min);

describe('history time', () => {
  // Saturday 3 October 2026.
  const now = at(2026, 10, 3, 15, 30);

  it('says Today with the time, Yesterday, then the date', () => {
    expect(relativeWhen(at(2026, 10, 3, 12, 10).toISOString(), now)).toBe('Today 12:10');
    expect(relativeWhen(at(2026, 10, 2, 23, 0).toISOString(), now)).toBe('Yesterday');
    expect(relativeWhen(at(2026, 9, 28).toISOString(), now)).toBe('28 Sept');
  });

  it('adds the year only for another year', () => {
    expect(relativeWhen(at(2025, 12, 31).toISOString(), now)).toBe('31 Dec 2025');
  });

  it('is empty for a time that cannot be read', () => {
    expect(relativeWhen(null, now)).toBe('');
    expect(relativeWhen('not a date', now)).toBe('');
  });

  it('groups by today, the rest of this Monday to Sunday week, and earlier', () => {
    expect(historyGroup(at(2026, 10, 3, 1).toISOString(), now)).toBe('Today');
    expect(historyGroup(at(2026, 9, 28).toISOString(), now)).toBe('This week');
    expect(historyGroup(at(2026, 9, 27).toISOString(), now)).toBe('Earlier');
    expect(historyGroup(null, now)).toBe('Earlier');
  });

  it('names each surface and has no label for an unknown one', () => {
    expect(surfaceLabel('NUTRITION')).toBe('Nutrition');
    expect(surfaceLabel(null)).toBeNull();
  });
});
