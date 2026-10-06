import { STEP_FLOOR_MS, STEP_MAX_MS, STEP_MIN_MS, stepDwellMs, stepReadingMs, wordCount } from './step-timing';

const words = (count: number) => Array(count).fill('word').join(' ');

describe('step timing', () => {
  it('counts the words of a step', () => {
    expect(wordCount('  Press both   up. ')).toBe(3);
    expect(wordCount('')).toBe(0);
  });

  it('keeps the reading time between five and ten seconds', () => {
    expect(stepReadingMs('Hold.')).toBe(STEP_MIN_MS);
    expect(stepReadingMs(words(60))).toBe(STEP_MAX_MS);
  });

  it('is words / 3 seconds plus 2 seconds between those limits', () => {
    expect(stepReadingMs(words(21))).toBe(9000);
    expect(stepReadingMs(words(12))).toBe(6000);
  });

  it('splits a short set evenly, never under three seconds', () => {
    expect(stepDwellMs(words(12), 60, 4)).toBe(6000);
    expect(stepDwellMs(words(12), 20, 4)).toBe(5000);
    expect(stepDwellMs(words(12), 8, 4)).toBe(STEP_FLOOR_MS);
    expect(stepDwellMs(words(12), 0, 4)).toBe(6000);
  });
});
