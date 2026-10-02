import { kcalText, minutesCooked, pastTarget, ringShare } from './cook-finish-figures';

describe('cook finish figures', () => {
  it('rounds the cooking time to minutes, never below one', () => {
    expect(minutesCooked(0, 42 * 60_000 + 20_000)).toBe(42);
    expect(minutesCooked(0, 42 * 60_000 + 40_000)).toBe(43);
    expect(minutesCooked(0, 5_000)).toBe(1);
    expect(minutesCooked(10_000, 0)).toBe(1);
  });

  it('gives the ring a share between 0 and 1, and none without a target', () => {
    expect(ringShare(1050, 2100)).toBe(0.5);
    expect(ringShare(3000, 2100)).toBe(1);
    expect(ringShare(-5, 2100)).toBe(0);
    expect(ringShare(1000, null)).toBe(0);
    expect(ringShare(1000, 0)).toBe(0);
  });

  it('says how far past the target the day is', () => {
    expect(pastTarget(2390, 2100)).toBe(290);
    expect(pastTarget(2100, 2100)).toBe(0);
    expect(pastTarget(1800, 2100)).toBe(0);
    expect(pastTarget(2500, null)).toBe(0);
  });

  it('writes a thousands separator', () => {
    expect(kcalText(2100)).toBe('2,100');
    expect(kcalText(1209.6)).toBe('1,210');
    expect(kcalText(590)).toBe('590');
  });
});
