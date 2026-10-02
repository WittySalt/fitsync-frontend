import { MAX_MINUTES, addMinutes, nudge, parseDuration, parseField, splitMinutes } from './cook-duration';

describe('cook duration', () => {
  it('reads a box as whole digits, blank as 0, anything else as not a number', () => {
    expect(parseField('12')).toBe(12);
    expect(parseField(' 07 ')).toBe(7);
    expect(parseField('')).toBe(0);
    expect(parseField('-1')).toBeNull();
    expect(parseField('1.5')).toBeNull();
    expect(parseField('1e2')).toBeNull();
    expect(parseField('abc')).toBeNull();
  });

  it('adds hours and minutes, and rolls minutes over 59 into hours', () => {
    expect(parseDuration('1', '30')).toEqual({ minutes: 90, note: '' });
    expect(parseDuration('0', '90')).toEqual({ minutes: 90, note: '' });
    expect(parseDuration('', '5')).toEqual({ minutes: 5, note: '' });
    expect(splitMinutes(90)).toEqual({ hours: 1, minutes: 30 });
    expect(splitMinutes(59)).toEqual({ hours: 0, minutes: 59 });
  });

  it('allows 1 min to 12 h and says why otherwise', () => {
    expect(parseDuration('12', '0').minutes).toBe(MAX_MINUTES);
    expect(parseDuration('0', '1').minutes).toBe(1);
    expect(parseDuration('12', '1')).toEqual({ minutes: null, note: 'A timer can be 12 h at most.' });
    expect(parseDuration('0', '0')).toEqual({ minutes: null, note: 'Choose at least 1 min.' });
    expect(parseDuration('x', '5')).toEqual({ minutes: null, note: 'Use whole numbers only.' });
  });

  it('adds to a time and keeps it between 1 min and 12 h', () => {
    expect(addMinutes(5, 15)).toBe(20);
    expect(addMinutes(700, 60)).toBe(MAX_MINUTES);
    expect(addMinutes(1, -5)).toBe(1);
  });

  it('nudges by 1 min under 10 min, 5 min under an hour and 15 min above', () => {
    expect(nudge(5, 1)).toBe(6);
    expect(nudge(9, 1)).toBe(10);
    expect(nudge(10, 1)).toBe(15);
    expect(nudge(55, 1)).toBe(60);
    expect(nudge(60, 1)).toBe(75);
    expect(nudge(60, -1)).toBe(55);
    expect(nudge(10, -1)).toBe(9);
    expect(nudge(1, -1)).toBe(1);
    expect(nudge(MAX_MINUTES, 1)).toBe(MAX_MINUTES);
  });
});
