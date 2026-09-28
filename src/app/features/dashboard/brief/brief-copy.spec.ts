import { briefHeadline, numberWord, quickQuestions } from './brief-copy';

describe('numberWord', () => {
  it('spells out zero through twelve', () => {
    expect(numberWord(0)).toBe('zero');
    expect(numberWord(4)).toBe('four');
    expect(numberWord(12)).toBe('twelve');
  });

  it('falls back to digits above twelve', () => {
    expect(numberWord(13)).toBe('13');
    expect(numberWord(20)).toBe('20');
  });
});

describe('briefHeadline — target met', () => {
  it('renders the reference morning copy for 4 of 4', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1 });
    expect(result.lines).toEqual(['Four of four.', 'The week is yours.']);
    expect(result.greeting).toBe(
      'Good morning, Ruixian. Your goal of four sessions is met, so today is free for rest or a bonus.'
    );
  });

  it('still prints the real numbers when completed exceeds target', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 5, target: 4, daysLeftInWeek: 1 });
    expect(result.lines[0]).toBe('Five of four.');
  });

  it('uses "The week is closed." in the evening and night', () => {
    const evening = briefHeadline({ period: 'EVENING', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1 });
    expect(evening.lines[1]).toBe('The week is closed.');
    const night = briefHeadline({ period: 'NIGHT', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1 });
    expect(night.lines[1]).toBe('The week is closed.');
  });

  it('uses the evening greeting about a bonus session fitting tonight', () => {
    const result = briefHeadline({ period: 'EVENING', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1 });
    expect(result.greeting).toBe(
      'Good evening, Ruixian. Your goal of four sessions is met, and a bonus session still fits into tonight.'
    );
  });

  it('uses the night greeting about tomorrow starting fresh', () => {
    const result = briefHeadline({ period: 'NIGHT', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1 });
    expect(result.greeting).toBe(
      'Good evening, Ruixian. Your goal of four sessions is met, and tomorrow starts a fresh page.'
    );
  });

  it('uses singular "session" when the target is 1', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 1, target: 1, daysLeftInWeek: 1 });
    expect(result.greeting).toContain('goal of one session is met');
  });

  it('omits the name and comma when firstName is blank', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: '', completed: 4, target: 4, daysLeftInWeek: 1 });
    expect(result.greeting.startsWith('Good morning. ')).toBe(true);
  });
});

describe('briefHeadline — target not met', () => {
  it('renders "One to go." with correct singular in the greeting', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 3, target: 4, daysLeftInWeek: 1 });
    expect(result.lines).toEqual(['Three of four.', 'One to go.']);
    expect(result.greeting).toBe(
      'Good morning, Ruixian. One more session would reach your goal of four sessions, with 1 day left in the week.'
    );
  });

  it('pluralizes remaining sessions and days when more than one', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 1, target: 4, daysLeftInWeek: 3 });
    expect(result.lines[1]).toBe('Three to go.');
    expect(result.greeting).toContain('Three more sessions would reach your goal of four sessions, with 3 days left in the week.');
  });
});

describe('briefHeadline — no target', () => {
  it('renders "A new week." when nothing has been logged', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 0, target: null, daysLeftInWeek: 7 });
    expect(result.lines).toEqual(['A new week.', 'Nothing logged yet.']);
    expect(result.greeting).toBe('Good morning, Ruixian. Here is your week so far.');
  });

  it('renders the session count when some sessions exist with no target', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 3, target: null, daysLeftInWeek: 7 });
    expect(result.lines).toEqual(['Three sessions', 'this week.']);
  });

  it('uses singular "session" for a count of one with no target', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 1, target: null, daysLeftInWeek: 7 });
    expect(result.lines[0]).toBe('One session');
  });

  it('treats a target of zero or less the same as no target', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 0, target: 0, daysLeftInWeek: 7 });
    expect(result.lines).toEqual(['A new week.', 'Nothing logged yet.']);
  });
});

describe('quickQuestions', () => {
  it('returns the morning set with a formatted calorie target', () => {
    expect(quickQuestions('MORNING', 2100)).toEqual([
      'What should I eat before training?',
      'Plan my meals for 2,100 kcal',
      'How is my week going?'
    ]);
  });

  it('falls back to a generic meal-planning question with no calorie target', () => {
    expect(quickQuestions('MORNING', null)).toEqual([
      'What should I eat before training?',
      'Plan my meals for today',
      'How is my week going?'
    ]);
  });

  it('returns the afternoon set', () => {
    expect(quickQuestions('AFTERNOON', 2100)).toEqual([
      'What should I eat before training?',
      'How is my week going?',
      'What is a good snack now?'
    ]);
  });

  it('returns the evening set', () => {
    expect(quickQuestions('EVENING', 2100)).toEqual([
      'What fits in the calories I have left?',
      'Is it too late to train tonight?',
      'How is my week going?'
    ]);
  });

  it('returns the night set', () => {
    expect(quickQuestions('NIGHT', 2100)).toEqual([
      'How did today go?',
      'What should tomorrow start with?',
      'How is my week going?'
    ]);
  });
});
