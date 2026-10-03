import { dateRangeLabel, parseLocalDate, shortDateLabel } from './date-label';

describe('date-label', () => {
  const now = new Date(2026, 9, 3);

  it('writes a day as day and month, with Sept as the coach does', () => {
    expect(shortDateLabel('2026-10-03', now)).toBe('3 Oct');
    expect(shortDateLabel('2026-09-28', now)).toBe('28 Sept');
    expect(shortDateLabel('2026-01-05T08:00:00Z', now)).toBe('5 Jan');
  });

  it('adds the year only for another year', () => {
    expect(shortDateLabel('2027-12-11', now)).toBe('11 Dec 2027');
  });

  it('is empty for anything that is not a date', () => {
    expect(shortDateLabel(null, now)).toBe('');
    expect(shortDateLabel('soon', now)).toBe('');
    expect(shortDateLabel('2026-13-40', now)).toBe('');
  });

  it('writes a range inside a month, across two months and for a single day', () => {
    expect(dateRangeLabel('2026-09-21', '2026-09-27', now)).toBe('21 to 27 Sept');
    expect(dateRangeLabel('2026-09-28', '2026-10-03', now)).toBe('28 Sept to 3 Oct');
    expect(dateRangeLabel('2026-10-03', '2026-10-03', now)).toBe('3 Oct');
    expect(dateRangeLabel('2026-12-28', '2027-01-03', now)).toBe('28 Dec 2026 to 3 Jan 2027');
    expect(dateRangeLabel('2026-09-28', null, now)).toBe('');
  });

  it('parses a key as a local calendar date', () => {
    const date = parseLocalDate('2026-10-03');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 3]);
    expect(Number.isNaN(parseLocalDate('nope').getTime())).toBeTrue();
  });
});
