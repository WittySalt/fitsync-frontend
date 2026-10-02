import { findTimer, timerFoundText } from './recipes-timers';

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
