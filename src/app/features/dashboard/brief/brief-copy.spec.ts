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

describe('briefHeadline — rule 1: long absence', () => {
  it('welcomes a return after fourteen or more days with nothing logged this week', () => {
    const result = briefHeadline({
      period: 'MORNING', firstName: 'Ruixian', completed: 0, target: 4, daysLeftInWeek: 7, daysSinceLastSession: 14
    });
    expect(result.lines).toEqual(['Good to see you.', 'One session restarts the week.']);
  });

  it('does not fire when a session has already been logged this week, even after a long absence', () => {
    const result = briefHeadline({
      period: 'MORNING', firstName: 'Ruixian', completed: 1, target: 4, daysLeftInWeek: 7, daysSinceLastSession: 14
    });
    expect(result.lines[0]).not.toBe('Good to see you.');
  });

  it('does not fire for an absence shorter than fourteen days', () => {
    const result = briefHeadline({
      period: 'MORNING', firstName: 'Ruixian', completed: 0, target: 4, daysLeftInWeek: 7, daysSinceLastSession: 13
    });
    expect(result.lines[0]).not.toBe('Good to see you.');
  });
});

describe('briefHeadline — rule 2: goal exactly met', () => {
  it('renders "Four for four!" with the exclamation mark, and takes priority over a same-day completion', () => {
    const result = briefHeadline({
      period: 'MORNING', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1, completedToday: true
    });
    expect(result.lines).toEqual(['Four for four!', 'The week is yours.']);
  });

  it('is the only line or greeting anywhere that contains an exclamation mark', () => {
    const result = briefHeadline({
      period: 'MORNING', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1, weeksAtGoal: 3
    });
    expect(result.lines[0]).toContain('!');
    expect(result.lines[1]).not.toContain('!');
    expect(result.greeting).not.toContain('!');
  });
});

describe('briefHeadline — rule 3: goal exceeded', () => {
  it('renders "Five this week." and "That\'s a bonus round."', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 5, target: 4, daysLeftInWeek: 1 });
    expect(result.lines).toEqual(['Five this week.', "That's a bonus round."]);
  });
});

describe('briefHeadline — rule 4: completed today, goal not met', () => {
  it('renders "Done for today." and "That makes two."', () => {
    const result = briefHeadline({
      period: 'AFTERNOON', firstName: 'Ruixian', completed: 2, target: 4, daysLeftInWeek: 3, completedToday: true
    });
    expect(result.lines).toEqual(['Done for today.', 'That makes two.']);
  });
});

describe('briefHeadline — rule 5: rest day, goal not met', () => {
  it('mentions yesterday\'s work when trainedYesterday is true', () => {
    const result = briefHeadline({
      period: 'MORNING', firstName: 'Ruixian', completed: 2, target: 4, daysLeftInWeek: 3, restToday: true, trainedYesterday: true
    });
    expect(result.lines).toEqual(['Rest day.', "Yesterday's work is settling in."]);
  });

  it('says the week is still open when yesterday had no training', () => {
    const result = briefHeadline({
      period: 'MORNING', firstName: 'Ruixian', completed: 2, target: 4, daysLeftInWeek: 3, restToday: true, trainedYesterday: false
    });
    expect(result.lines).toEqual(['Rest day.', 'The week is still open.']);
  });
});

describe('briefHeadline — rule 6: fresh week with a target', () => {
  it('renders "Fresh week." and "A clean slate."', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 0, target: 4, daysLeftInWeek: 7 });
    expect(result.lines).toEqual(['Fresh week.', 'A clean slate.']);
  });
});

describe('briefHeadline — rule 7: one session down, target above one', () => {
  it('renders "One down." and "You\'re on the board." for target 2 completed 1', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 1, target: 2, daysLeftInWeek: 5 });
    expect(result.lines).toEqual(['One down.', "You're on the board."]);
  });

  it('does not apply when the target itself is one', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 1, target: 1, daysLeftInWeek: 5 });
    expect(result.lines[1]).not.toBe("You're on the board.");
  });
});

describe('briefHeadline — rule 8: one session short of the goal', () => {
  it('renders "Three down." and "One more makes the week."', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 3, target: 4, daysLeftInWeek: 1 });
    expect(result.lines).toEqual(['Three down.', 'One more makes the week.']);
  });
});

describe('briefHeadline — rule 9: exactly halfway', () => {
  it('renders "Halfway there." and "Three in the bag." for target 6 completed 3', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 3, target: 6, daysLeftInWeek: 3 });
    expect(result.lines).toEqual(['Halfway there.', 'Three in the bag.']);
  });
});

describe('briefHeadline — rule 10: the remaining not-yet-covered cases', () => {
  it('renders "Two down." and "Three to play." for target 5 completed 2', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 2, target: 5, daysLeftInWeek: 4 });
    expect(result.lines).toEqual(['Two down.', 'Three to play.']);
  });
});

describe('briefHeadline — rule 11: fresh week, no target', () => {
  it('renders "Fresh week." and "Nothing logged yet."', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 0, target: null, daysLeftInWeek: 7 });
    expect(result.lines).toEqual(['Fresh week.', 'Nothing logged yet.']);
  });

  it('treats a target of zero or less the same as no target', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 0, target: 0, daysLeftInWeek: 7 });
    expect(result.lines).toEqual(['Fresh week.', 'Nothing logged yet.']);
  });
});

describe('briefHeadline — rule 12: sessions logged, no target', () => {
  it('renders the count and pluralizes when more than one', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 3, target: null, daysLeftInWeek: 7 });
    expect(result.lines).toEqual(['Three sessions', 'this week.']);
  });

  it('uses singular "session" for a count of one', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 1, target: null, daysLeftInWeek: 7 });
    expect(result.lines[0]).toBe('One session');
  });
});

describe('briefHeadline — greeting: no target', () => {
  it('renders the plain week-so-far sentence', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 3, target: null, daysLeftInWeek: 7 });
    expect(result.greeting).toBe('Good morning, Ruixian. Here is your week so far.');
  });
});

describe('briefHeadline — greeting: goal met or exceeded', () => {
  it('uses the morning/afternoon sentence about a free day', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1 });
    expect(result.greeting).toBe(
      'Good morning, Ruixian. Your goal of four sessions is met, so today is free for rest or a bonus.'
    );
  });

  it('hands the evening back rather than suggesting a bonus session', () => {
    const result = briefHeadline({ period: 'EVENING', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1 });
    expect(result.greeting).toBe(
      'Good evening, Ruixian. Your goal of four sessions is met, and the evening is yours.'
    );
  });

  it('uses the night sentence about tomorrow starting fresh', () => {
    const result = briefHeadline({ period: 'NIGHT', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1 });
    expect(result.greeting).toBe(
      'Good evening, Ruixian. Your goal of four sessions is met, and tomorrow starts a fresh page.'
    );
  });

  it('uses singular "session" when the target is one', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 1, target: 1, daysLeftInWeek: 1 });
    expect(result.greeting).toContain('goal of one session is met');
  });

  it('appends the streak sentence once weeksAtGoal reaches two', () => {
    const result = briefHeadline({
      period: 'NIGHT', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1, weeksAtGoal: 3
    });
    expect(result.greeting).toBe(
      'Good evening, Ruixian. Your goal of four sessions is met, and tomorrow starts a fresh page. ' +
      'That is three weeks running at four.'
    );
  });

  it('omits the streak sentence when weeksAtGoal is only one', () => {
    const result = briefHeadline({
      period: 'NIGHT', firstName: 'Ruixian', completed: 4, target: 4, daysLeftInWeek: 1, weeksAtGoal: 1
    });
    expect(result.greeting).not.toContain('weeks running');
  });

  it('omits the name and comma when firstName is blank', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: '', completed: 4, target: 4, daysLeftInWeek: 1 });
    expect(result.greeting.startsWith('Good morning. ')).toBe(true);
  });
});

describe('briefHeadline — greeting: zero completed with a target', () => {
  it('names the open week and the goal', () => {
    const result = briefHeadline({ period: 'NIGHT', firstName: 'Ruixian', completed: 0, target: 4, daysLeftInWeek: 7 });
    expect(result.greeting).toBe('Good evening, Ruixian. The week is open, and your goal is four sessions.');
  });
});

describe('briefHeadline — greeting: sessions logged, goal not yet met', () => {
  it('counts the sessions in and the days left, pluralizing both', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 1, target: 4, daysLeftInWeek: 6 });
    expect(result.greeting).toBe(
      'Good morning, Ruixian. One session in, and the week still has six days for the rest.'
    );
  });

  it('uses singular "day" when exactly one day is left', () => {
    const result = briefHeadline({ period: 'MORNING', firstName: 'Ruixian', completed: 3, target: 4, daysLeftInWeek: 1 });
    expect(result.greeting).toBe(
      'Good morning, Ruixian. Three sessions in, and today is the last day of the week.'
    );
  });

  it('also uses the last-day phrasing when zero days are left', () => {
    const result = briefHeadline({ period: 'EVENING', firstName: 'Ruixian', completed: 3, target: 4, daysLeftInWeek: 0 });
    expect(result.greeting).toBe(
      'Good evening, Ruixian. Three sessions in, and today is the last day of the week.'
    );
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

describe('briefHeadline: the usual training time', () => {
  const base = {
    period: 'MORNING' as const,
    firstName: 'Ruixian',
    completed: 4,
    target: 5,
    daysLeftInWeek: 3,
    usualStartTime: '18:30',
    nowMinutes: 8 * 60 + 10,
    todayOpen: true
  };
  const clause = 'You usually train around 18:30, so there is no rush.';

  it('adds the clause as its own sentence on a morning with the session still open', () => {
    const { greeting } = briefHeadline(base);
    expect(greeting).toBe(`Good morning, Ruixian. Four sessions in, and the week still has three days for the rest. ${clause}`);
  });

  it('adds it in the afternoon, and when the week has no goal set', () => {
    expect(briefHeadline({ ...base, period: 'AFTERNOON', nowMinutes: 13 * 60 }).greeting.endsWith(clause)).toBe(true);
    expect(briefHeadline({ ...base, target: null }).greeting).toBe(`Good morning, Ruixian. Here is your week so far. ${clause}`);
  });

  it('adds it on a week that has not started', () => {
    expect(briefHeadline({ ...base, completed: 0 }).greeting).toBe(
      `Good morning, Ruixian. The week is open, and your goal is five sessions. ${clause}`
    );
  });

  it('adds it when the usual time is exactly one hour away, and not when it is less', () => {
    const afternoon = { ...base, period: 'AFTERNOON' as const, nowMinutes: 16 * 60 + 59 };
    expect(briefHeadline({ ...afternoon, usualStartTime: '17:59' }).greeting).toContain('usually train around 17:59');
    expect(briefHeadline({ ...afternoon, usualStartTime: '17:58' }).greeting).not.toContain('usually');
  });

  it('leaves the greeting as it was in the evening and at night', () => {
    expect(briefHeadline({ ...base, period: 'EVENING', nowMinutes: 17 * 60 }).greeting).not.toContain('usually');
    expect(briefHeadline({ ...base, period: 'NIGHT', nowMinutes: 23 * 60, usualStartTime: '23:59' }).greeting).not.toContain('usually');
  });

  it('leaves the greeting as it was on a rest day', () => {
    expect(briefHeadline({ ...base, restToday: true }).greeting).not.toContain('usually');
  });

  it('leaves the greeting as it was once the goal is met', () => {
    expect(briefHeadline({ ...base, completed: 5 }).greeting).not.toContain('usually');
    expect(briefHeadline({ ...base, completed: 6 }).greeting).not.toContain('usually');
  });

  it('leaves the greeting as it was once today has been trained, or while the session is under way', () => {
    expect(briefHeadline({ ...base, completedToday: true }).greeting).not.toContain('usually');
    expect(briefHeadline({ ...base, todayOpen: false }).greeting).not.toContain('usually');
  });

  it('leaves the greeting as it was with no usual time, a malformed one, or no clock', () => {
    const plain = briefHeadline({ ...base, usualStartTime: undefined, nowMinutes: undefined, todayOpen: undefined }).greeting;
    expect(briefHeadline({ ...base, usualStartTime: null }).greeting).toBe(plain);
    expect(briefHeadline({ ...base, usualStartTime: '6:30 pm' }).greeting).toBe(plain);
    expect(briefHeadline({ ...base, nowMinutes: null }).greeting).toBe(plain);
    expect(plain).toBe('Good morning, Ruixian. Four sessions in, and the week still has three days for the rest.');
  });
});
