import { clipName, findTimer, labelForPhrase, suggestTimerName, timerFoundText, timerLabel, uniqueLabel } from './recipes-timers';

describe('findTimer, the rules of API contract section 8', () => {
  it('finds a time next to a cooking word', () => {
    expect(findTimer('Stir the oats and milk together and simmer for 5 minutes.')).toEqual({ seconds: 300, maxSeconds: null, eachSide: false, phrase: '5 minutes' });
    expect(findTimer('Bake for 20 minutes.')?.seconds).toBe(1200);
    expect(findTimer('Roast 30 secs.')?.seconds).toBe(30);
  });

  it('reads a range as its lower and upper end, and each side', () => {
    expect(findTimer('Fry the salmon for 3-4 mins on each side.')).toEqual({ seconds: 180, maxSeconds: 240, eachSide: true, phrase: '3-4 mins' });
    expect(findTimer('Grill 2 to 3 minutes per side.')).toEqual({ seconds: 120, maxSeconds: 180, eachSide: true, phrase: '2 to 3 minutes' });
    expect(findTimer('Sear for 2 minutes on both sides, then cook.')?.eachSide).toBeTrue();
    expect(findTimer('Fry until golden on both sides, about 4 minutes.')?.eachSide).toBeFalse();
    expect(findTimer('Fry 4 minutes, until golden, then 2 minutes on both sides.')?.eachSide).toBeTrue();
  });

  it('adds hours and minutes written together', () => {
    expect(findTimer('Roast for 1 hour 15 mins.')).toEqual({ seconds: 4500, maxSeconds: null, eachSide: false, phrase: '1 hour 15 mins' });
    expect(findTimer('Simmer 2 hours and 30 minutes.')?.seconds).toBe(9000);
  });

  it('needs a cooking word in the same sentence', () => {
    expect(findTimer('Wait 10 minutes.')).toBeNull();
    expect(findTimer('Chop the onion. Simmer the sauce. It takes 10 minutes to chop.')).toBeNull();
    expect(findTimer('Chop the onion for 2 minutes. Simmer for 10 minutes.')?.seconds).toBe(600);
  });

  it('ignores times under 30 seconds, over 3 hours, days and overnight', () => {
    expect(findTimer('Stir for 20 secs.')).toBeNull();
    expect(findTimer('Roast for 4 hours.')).toBeNull();
    expect(findTimer('Marinate for 2 days.')).toBeNull();
    expect(findTimer('Marinate overnight.')).toBeNull();
  });

  it('skips a time that does not count and takes the next one', () => {
    expect(findTimer('Cook for 4 hours, then rest for 10 minutes.')?.seconds).toBe(600);
  });

  it('finds nothing in an empty text', () => {
    expect(findTimer('')).toBeNull();
    expect(findTimer('   ')).toBeNull();
  });

  it('words what was found', () => {
    expect(timerFoundText({ seconds: 300, maxSeconds: null, eachSide: false, phrase: '' })).toBe('A 5 min timer was found');
    expect(timerFoundText({ seconds: 180, maxSeconds: 240, eachSide: true, phrase: '' })).toBe('A 3 to 4 min timer was found');
    expect(timerFoundText({ seconds: 4500, maxSeconds: null, eachSide: false, phrase: '' })).toBe('A 1 h 15 min timer was found');
  });
});

/** The examples of the naming rule (API contract section 8, `label`); the server tests use the same ones. */
const LABEL_EXAMPLES: { text: string; ingredient?: string; title?: string; label: string }[] = [
  { text: 'Heat a large skillet. Brown patties in batches in the hot skillet for about 10 minutes.', label: 'Brown patties' },
  { text: 'Place on the grill plate and cook for 5 minutes.', ingredient: 'Sausages', label: 'Cook · Sausages' },
  { text: 'Simmer, stirring occasionally, for about 30 minutes.', ingredient: 'Tomatoes', label: 'Simmer · Tomatoes' },
  { text: 'Simmer, stirring occasionally, for about 30 minutes.', label: 'Simmer' },
  { text: 'Poach the eggs for 3 minutes.', label: 'Poach the eggs' },
  { text: 'Braise the lamb with the stock for 2 hours.', label: 'Braise the lamb' },
  { text: 'Add the sauce and simmer the sauce for 15 minutes.', label: 'Simmer the sauce' },
  { text: 'Stir the oats and milk together and simmer for 5 minutes.', ingredient: 'Oats', label: 'Simmer · Oats' },
  { text: 'Bake for 35 minutes.', ingredient: 'Pie', label: 'Bake · Pie' },
  { text: 'Bake for 35 minutes.', ingredient: 'Pie, apple, raw', label: 'Bake · Pie' },
  { text: 'Bake for 35 minutes.', label: 'Bake' },
  { text: 'Roast the vegetables until soft, 30 minutes.', label: 'Roast the vegetables' },
  { text: 'Fry the salmon, 3-4 mins on each side.', label: 'Fry the salmon' },
  { text: 'Simmer the tomato sauce with the basil and pepper for 20 minutes.', label: 'Simmer the tomato sauce' },
  { text: 'Simmer the very long chickpea and spinach curry for 20 minutes.', label: 'Simmer the very long chickpea' }
];

describe('timerLabel, the naming rule of API contract section 8', () => {
  LABEL_EXAMPLES.forEach((example) => {
    it(`names "${example.text}" as "${example.label}"`, () => {
      expect(timerLabel(example.text, { ingredient: example.ingredient, title: example.title, stepNumber: 3 })).toBe(example.label);
    });
  });

  it('finds the timers the older word list missed: brown, sear, poach, braise and broil', () => {
    expect(findTimer('Brown the patties, about 10 minutes.')?.seconds).toBe(600);
    expect(findTimer('Sear the steak 90 seconds.')?.seconds).toBe(90);
    expect(findTimer('Poach for 3 minutes.')?.seconds).toBe(180);
    expect(findTimer('Braise for 2 hours.')?.seconds).toBe(7200);
    expect(findTimer('Broil for 4 minutes.')?.seconds).toBe(240);
  });

  it('is null for a text with no timer', () => {
    expect(timerLabel('Mix the lime and the oil.', { stepNumber: 1 })).toBeNull();
  });

  it('falls back to the step title, then to "Step N timer", when the sentence has no cooking verb', () => {
    const sentence = 'Cook it in the oven.';
    expect(labelForPhrase('Leave it, about 10 minutes.', '10 minutes', { title: 'Wait it out', stepNumber: 3 })).toBe('Wait it out');
    expect(labelForPhrase('Leave it, about 10 minutes.', '10 minutes', { title: '', stepNumber: 3 })).toBe('Step 3 timer');
    expect(labelForPhrase(`${sentence} Then wait 2 minutes.`, '2 minutes', { stepNumber: 4 })).toBe('Step 4 timer');
  });

  it('names the Algerian Kefta step from its phrase even though the step text has no cooking word in it', () => {
    const text = 'Heat a large skillet over medium-high heat. Brown patties in batches in the hot skillet until crispy on both sides, about 10 minutes.';
    expect(findTimer(text)).toEqual({ seconds: 600, maxSeconds: null, eachSide: false, phrase: '10 minutes' });
    expect(labelForPhrase(text, '10 minutes', { stepNumber: 3 })).toBe('Brown patties');
  });

  it('names the sentence that holds the phrase, and cuts to 32 characters on a word boundary', () => {
    expect(labelForPhrase('Brown the onions. Simmer the stew for 40 minutes.', '40 minutes', { stepNumber: 1 })).toBe('Simmer the stew');
    expect(clipName('Marinate the chicken thighs overnight')).toBe('Marinate the chicken thighs');
    expect(clipName('Supercalifragilisticexpialidocious plus')).toHaveSize(32);
    expect(clipName('Bake the pie').length).toBeLessThanOrEqual(32);
  });

  it('gives a second timer with the same name " · 2"', () => {
    expect(uniqueLabel('Brown patties', [])).toBe('Brown patties');
    expect(uniqueLabel('Brown patties', ['Brown patties'])).toBe('Brown patties · 2');
    expect(uniqueLabel('Brown patties', ['Brown patties', 'Brown patties · 2'])).toBe('Brown patties · 3');
  });
});

describe('suggestTimerName, what "+ Add a timer" starts with', () => {
  it('applies the rule to the step text, with or without a time in it', () => {
    expect(suggestTimerName('Heat the oil. Brown patties in batches, until crispy.', {})).toBe('Brown patties');
    expect(suggestTimerName('Let the dough rest.', { title: 'Rest' })).toBe('Rest');
  });

  it('uses the ingredient when nothing follows the verb, and the title when there is no verb', () => {
    expect(suggestTimerName('Bake until done.', { ingredient: 'Pie' })).toBe('Bake · Pie');
    expect(suggestTimerName('Serve with lime.', { title: 'Serve' })).toBe('Serve');
    expect(suggestTimerName('Serve with lime.', {})).toBeNull();
  });
});
