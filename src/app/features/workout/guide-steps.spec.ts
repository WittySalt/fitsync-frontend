import { firstSentence, guideSteps, isRepeatStep } from './guide-steps';

describe('guide steps', () => {
  it('cuts a step to its first sentence and keeps decimals whole', () => {
    expect(firstSentence('Lower the bar to 2.5 cm above the chest. Then press up.')).toBe('Lower the bar to 2.5 cm above the chest.');
    expect(firstSentence('Stand tall')).toBe('Stand tall');
    expect(firstSentence(null)).toBe('');
  });

  it('knows a step that only says to repeat', () => {
    expect(isRepeatStep('Repeat for ten reps.')).toBeTrue();
    expect(isRepeatStep('Then repeat on the other side.')).toBeTrue();
    expect(isRepeatStep('Press up and repeat the breath.')).toBeFalse();
  });

  it('uses the short steps of the exercise when it has them', () => {
    expect(guideSteps({ shortSteps: ['  One. ', '', 'Two.'], instructions: [{ stepNumber: 1, text: 'Other.' }] }))
      .toEqual(['One.', 'Two.']);
  });

  it('falls back to the instructions in order, one sentence each, without a repeat step', () => {
    expect(guideSteps({
      shortSteps: [],
      instructions: [
        { stepNumber: 3, text: 'Repeat for ten reps.' },
        { stepNumber: 2, text: 'Press up. Breathe out.' },
        { stepNumber: 1, text: 'Lie back with the weights at the chest.' }
      ]
    })).toEqual(['Lie back with the weights at the chest.', 'Press up.']);
  });

  it('treats a missing list as no steps', () => {
    expect(guideSteps({ instructions: [] })).toEqual([]);
    expect(guideSteps(null)).toEqual([]);
  });
});
