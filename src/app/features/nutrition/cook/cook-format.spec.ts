import { clockText, durationText, gramsText, rangeText, servingsText } from './cook-format';

describe('cook formatting', () => {
  it('writes a clock', () => {
    expect(clockText(0)).toBe('0:00');
    expect(clockText(99)).toBe('1:39');
    expect(clockText(600)).toBe('10:00');
    expect(clockText(4500)).toBe('1:15:00');
    expect(clockText(-5)).toBe('0:00');
  });

  it('writes a length of time', () => {
    expect(durationText(30)).toBe('30 sec');
    expect(durationText(180)).toBe('3 min');
    expect(durationText(90)).toBe('1 min 30 sec');
    expect(durationText(4500)).toBe('1 h 15 min');
    expect(durationText(3600)).toBe('1 h');
  });

  it('writes the range the recipe gives', () => {
    expect(rangeText(180, 240)).toBe('3 to 4 min');
    expect(rangeText(90, 150)).toBe('1 min 30 sec to 2 min 30 sec');
    expect(rangeText(180, null)).toBe('');
  });

  it('writes servings and grams', () => {
    expect(servingsText(1)).toBe('1 serving');
    expect(servingsText(2)).toBe('2 servings');
    expect(servingsText(0.5)).toBe('0.5 servings');
    expect(gramsText(56.4)).toBe('56 g');
    expect(gramsText(4.26)).toBe('4.3 g');
  });
});
