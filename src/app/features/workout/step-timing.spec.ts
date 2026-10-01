import { STEP_MIN_MS, stepDwellMs, wordCount } from './step-timing';

describe('step timing', () => {
  it('counts the words of a step', () => {
    expect(wordCount('  Press both   up. ')).toBe(3);
    expect(wordCount('')).toBe(0);
  });

  it('never goes under four seconds', () => {
    expect(stepDwellMs('Hold.')).toBe(STEP_MIN_MS);
    expect(stepDwellMs('Keep the hips level')).toBe(STEP_MIN_MS);
  });

  it('is 2.5 seconds plus 0.3 seconds a word above that', () => {
    const twelve = 'Lie back with a dumbbell in each hand at chest height, palms';
    expect(wordCount(twelve)).toBe(12);
    expect(stepDwellMs(twelve)).toBe(2500 + 12 * 300);
    expect(stepDwellMs('Lie back with a dumbbell in each hand at chest height, palms forward.')).toBe(2500 + 13 * 300);
  });
});
