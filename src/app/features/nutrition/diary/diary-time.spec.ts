import { addDays, atClock, clockText, dayBounds, dayLabel, mealTypeByClock, parseIsoDate, rangeLabel, toIsoDate, weekOf } from './diary-time';

describe('diary-time', () => {
  it('formats and parses a local date both ways', () => {
    const date = new Date(2026, 9, 2, 23, 59);
    expect(toIsoDate(date)).toBe('2026-10-02');
    expect(toIsoDate(parseIsoDate('2026-10-02'))).toBe('2026-10-02');
  });

  it('falls back to today for a date it cannot read', () => {
    expect(toIsoDate(parseIsoDate('nonsense'))).toBe(toIsoDate(new Date()));
  });

  it('adds days across a month end', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('lists the week Monday first, whichever day it is asked from', () => {
    const expected = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
    expect(weekOf('2026-10-02')).toEqual(expected);
    expect(weekOf('2026-09-28')).toEqual(expected);
    expect(weekOf('2026-10-04')).toEqual(expected);
  });

  it('bounds a day from its first to its last millisecond', () => {
    const { from, to } = dayBounds('2026-10-02', 'Asia/Singapore');
    expect(from).toBe('2026-10-01T16:00:00.000Z');
    expect(to).toBe('2026-10-02T15:59:59.999Z');
  });

  it('picks the meal type from the clock using the contract windows', () => {
    const at = (hour: number, minute: number) => mealTypeByClock(new Date(2026, 9, 2, hour, minute));
    expect(at(6, 0)).toBe('BREAKFAST');
    expect(at(10, 29)).toBe('BREAKFAST');
    expect(at(10, 30)).toBe('LUNCH');
    expect(at(14, 59)).toBe('LUNCH');
    expect(at(15, 0)).toBe('DINNER');
    expect(at(20, 59)).toBe('DINNER');
    expect(at(21, 0)).toBe('SNACK');
    expect(at(23, 30)).toBe('SNACK');
  });

  it('builds a moment from a date and a clock time, and ignores a bad clock time', () => {
    const moment = atClock('2026-10-02', '16:30');
    expect(moment.getHours()).toBe(16);
    expect(moment.getMinutes()).toBe(30);
    expect(atClock('2026-10-02', '25:99').getHours()).toBe(0);
  });

  it('reads the clock of a timestamp and gives nothing for a bad one', () => {
    expect(clockText(new Date(2026, 9, 2, 7, 5))).toBe('07:05');
    expect(clockText('not a time')).toBe('');
    expect(clockText(null)).toBe('');
  });

  it('labels a day and a range of days', () => {
    expect(dayLabel('2026-10-02')).toContain('Friday 2');
    expect(rangeLabel('2026-09-28', '2026-10-04')).toMatch(/^28 Sep\w* to 4 Oct$/);
  });
});
