import { MonthDayInsight, NutritionSummary } from '../../../../core/fitsync.models';
import { DayInput, buildDayRows, clockTime, exerciseSentence, quietLine } from './month-day';
import { TextRow, isPending } from './month-rows';

const STRENGTH_DAY: MonthDayInsight = { date: '2026-09-25', kind: 'STRENGTH', label: 'Strength', sessions: 1, minutes: 50, muscles: ['CHEST'], record: false };

function food(overrides: Partial<NutritionSummary> = {}): NutritionSummary {
  return {
    totalCalories: 2037,
    targetCalories: 2100,
    totalProteinGrams: 158,
    targetProteinGrams: null,
    totalCarbsGrams: 0,
    targetCarbsGrams: null,
    totalFatGrams: 0,
    targetFatGrams: null,
    mealCount: 5,
    totalFiberGrams: null,
    totalSugarGrams: null,
    totalSodiumMg: null,
    fiberTargetGrams: null,
    sugarLimitGrams: null,
    sodiumLimitMg: null,
    fiberTargetMet: null,
    sugarWithinLimit: null,
    sodiumWithinLimit: null,
    ...overrides
  };
}

function input(overrides: Partial<DayInput> = {}): DayInput {
  return {
    dateKey: '2026-09-25',
    timezone: 'Asia/Singapore',
    referenceDate: '2026-09-27',
    firstSessionDate: '2026-08-03',
    day: STRENGTH_DAY,
    sessions: [{ startedAt: '2026-09-25T10:30:00Z', kind: 'STRENGTH' }],
    exercises: ['Bench Press', 'Goblet Squat', 'Row', 'Plank'],
    food: food(),
    weightKg: null,
    sessionsLoad: 'done',
    foodLoad: 'done',
    ...overrides
  };
}

function lines(overrides: Partial<DayInput> = {}): string[] {
  return buildDayRows(input(overrides)).rows.map((row) => {
    const text = row as TextRow;
    return text.note ? `${text.headline} ${text.note}` : text.headline;
  });
}

describe('day lines', () => {
  describe('training', () => {
    it('names the kind, the minutes and the start in the timezone of the person, with the exercises under it', () => {
      expect(lines({ food: null })).toEqual(['Strength, 50 min at 18:30. Bench press, goblet squat, row and plank.']);
    });

    it('leaves the time out when no session is known, and the exercises when none were loaded', () => {
      expect(lines({ food: null, sessions: [], exercises: [] })).toEqual(['Strength, 50 min.']);
    });

    it('names the activity of a sport day and keeps at most four exercises', () => {
      const day: MonthDayInsight = { ...STRENGTH_DAY, kind: 'SPORT', label: 'Badminton', minutes: 90 };
      expect(lines({ food: null, day, exercises: ['A', 'B', 'C', 'D', 'E'] })).toEqual(['Badminton, 1 h 30 min at 18:30. A, b, c and d.']);
    });

    it('says two sessions with the total length and lists the kinds', () => {
      const day: MonthDayInsight = { ...STRENGTH_DAY, sessions: 2, minutes: 85 };
      const sessions = [
        { startedAt: '2026-09-25T10:30:00Z', kind: 'STRENGTH' as const },
        { startedAt: '2026-09-25T12:30:00Z', kind: 'CARDIO' as const }
      ];
      expect(lines({ food: null, day, sessions, exercises: [] })).toEqual(['Two sessions, 1 h 25 min. Strength and cardio.']);
    });

    it('lower-cases every kind after the first when three kinds are listed', () => {
      const day: MonthDayInsight = { ...STRENGTH_DAY, sessions: 3, minutes: 85 };
      const sessions = [
        { startedAt: '', kind: 'STRENGTH' as const },
        { startedAt: '', kind: 'CARDIO' as const },
        { startedAt: '', kind: 'MOBILITY' as const }
      ];
      expect(lines({ food: null, day, sessions, exercises: [] })).toEqual(['Three sessions, 1 h 25 min. Strength, cardio and mobility.']);
    });

    it('says both when two sessions are of one kind and leaves the note out when no kind is known', () => {
      const day: MonthDayInsight = { ...STRENGTH_DAY, sessions: 2, minutes: 85 };
      const same = [
        { startedAt: '', kind: 'CARDIO' as const },
        { startedAt: '', kind: 'CARDIO' as const }
      ];
      expect(lines({ food: null, day, sessions: same })).toEqual(['Two sessions, 1 h 25 min. Both cardio.']);
      expect(lines({ food: null, day, sessions: [] })).toEqual(['Two sessions, 1 h 25 min.']);
    });

    it('does not claim training on a day that only had a plan', () => {
      const planned: MonthDayInsight = { ...STRENGTH_DAY, sessions: 0, minutes: 0 };
      expect(lines({ day: planned, food: null, sessions: [] })).toEqual([]);
    });
  });

  describe('record', () => {
    it('says a record without naming an exercise, since the session detail does not tell which one', () => {
      expect(lines({ food: null, day: { ...STRENGTH_DAY, record: true } })).toEqual([
        'Strength, 50 min at 18:30. Bench press, goblet squat, row and plank.',
        'A record on this day.'
      ]);
    });
  });

  describe('food', () => {
    it('says the calories and the protein, and the meals inside the budget', () => {
      expect(lines({ day: null, sessions: [] })).toEqual(['2,037 kcal and 158 g of protein. Five meals, inside the 2,100 kcal budget.']);
    });

    it('says only the meals on a day over the budget, and when there is no budget', () => {
      expect(lines({ day: null, food: food({ totalCalories: 2400 }) })).toEqual(['2,400 kcal and 158 g of protein. Five meals.']);
      expect(lines({ day: null, food: food({ targetCalories: null }) })).toEqual(['2,037 kcal and 158 g of protein. Five meals.']);
    });

    it('counts one meal in the singular and counts a day at the budget as inside it', () => {
      expect(lines({ day: null, food: food({ mealCount: 1, totalCalories: 2100 }) })).toEqual([
        '2,100 kcal and 158 g of protein. One meal, inside the 2,100 kcal budget.'
      ]);
    });

    it('leaves a day without a meal out', () => {
      expect(lines({ day: null, food: food({ mealCount: 0, totalCalories: 0 }) })).toEqual([]);
    });
  });

  describe('weigh-in', () => {
    it('says the weight with one decimal and nothing under it', () => {
      const rows = buildDayRows(input({ day: null, food: null, weightKg: 71.2 })).rows as TextRow[];
      expect(rows.map((row) => row.headline)).toEqual(['Weighed 71.2 kg.']);
      expect(rows[0].note).toBe('');
    });
  });

  describe('order and number', () => {
    it('shows training, record, food and weigh-in in that order and at most three of them', () => {
      expect(lines({ day: { ...STRENGTH_DAY, record: true }, weightKg: 71.2 })).toEqual([
        'Strength, 50 min at 18:30. Bench press, goblet squat, row and plank.',
        'A record on this day.',
        '2,037 kcal and 158 g of protein. Five meals, inside the 2,100 kcal budget.'
      ]);
    });

    it('lets the weigh-in in when a line before it is missing', () => {
      expect(lines({ weightKg: 71.2 }).slice(-1)).toEqual(['Weighed 71.2 kg.']);
    });
  });

  describe('loading', () => {
    it('keeps a skeleton in the place of a line that has not arrived, in order', () => {
      const rows = buildDayRows(input({ day: { ...STRENGTH_DAY, record: true }, sessionsLoad: 'loading', foodLoad: 'loading' })).rows;
      expect(rows.map((row) => (isPending(row) ? `pending ${row.id}` : row.id))).toEqual(['pending training', 'record', 'pending food']);
    });

    it('does not wait for the sessions of a day without training', () => {
      const rows = buildDayRows(input({ day: null, sessionsLoad: 'loading', foodLoad: 'loading' })).rows;
      expect(rows.map((row) => row.id)).toEqual(['food']);
    });

    it('shows no quiet sentence while a line is still to come', () => {
      expect(buildDayRows(input({ day: null, foodLoad: 'loading' })).quiet).toBe('');
    });
  });

  describe('a day with nothing', () => {
    const empty = { day: null, food: null, sessions: [] };

    it('says that nothing was logged on a past day', () => {
      expect(buildDayRows(input(empty)).quiet).toBe('Nothing logged on this day.');
    });

    it('says a day to come is still to come', () => {
      expect(quietLine({ dateKey: '2026-09-28', referenceDate: '2026-09-27', firstSessionDate: '2026-08-03' })).toBe('Still to come.');
    });

    it('says a day before the first session is before it', () => {
      expect(quietLine({ dateKey: '2026-08-02', referenceDate: '2026-09-27', firstSessionDate: '2026-08-03' })).toBe('Before your first session.');
    });

    it('treats today as a day that can still have something', () => {
      expect(quietLine({ dateKey: '2026-09-27', referenceDate: '2026-09-27', firstSessionDate: '2026-08-03' })).toBe('Nothing logged on this day.');
    });

    it('shows no quiet sentence once a line exists', () => {
      expect(buildDayRows(input()).quiet).toBe('');
    });
  });

  describe('tone', () => {
    it('never mentions what is missing, compares or asks for anything', () => {
      const all = [
        ...lines({ day: { ...STRENGTH_DAY, record: true }, weightKg: 71.2 }),
        ...lines({ day: null, food: food({ totalCalories: 2600 }) }),
        buildDayRows(input({ day: null, food: null, sessions: [] })).quiet
      ].join(' ');
      expect(all).not.toMatch(/\b(missed|missing|only|should|try|must|need|didn't|no meals|than|average|others)\b/i);
    });
  });
});

describe('exerciseSentence', () => {
  it('lowercases all but the first word and keeps a word in capitals', () => {
    expect(exerciseSentence(['Bench Press', 'EZ-Bar Curl', 'DB Row'])).toBe('Bench press, EZ-bar curl and DB row.');
  });

  it('stops adding names before the line would be longer than the column holds, and always keeps the first', () => {
    expect(exerciseSentence(['Barbell Bench Press', 'Goblet Squat', 'Seated Cable Row', 'Plank Hold'])).toBe('Barbell bench press and goblet squat.');
    expect(exerciseSentence(['Dumbbell Romanian Deadlift With A Long Name Indeed', 'Row'])).toBe('Dumbbell romanian deadlift with a long name indeed.');
  });

  it('drops repeats and empty names and returns nothing for no names', () => {
    expect(exerciseSentence(['Squat', 'squat', '  ', 'Row'])).toBe('Squat and row.');
    expect(exerciseSentence([])).toBe('');
  });
});

describe('clockTime', () => {
  it('writes the time of the timezone on a 24 hour clock, midnight included', () => {
    expect(clockTime('2026-09-25T10:30:00Z', 'Asia/Singapore')).toBe('18:30');
    expect(clockTime('2026-09-25T16:05:00Z', 'Asia/Singapore')).toBe('00:05');
  });

  it('returns nothing for an unknown instant', () => {
    expect(clockTime('', 'Asia/Singapore')).toBe('');
    expect(clockTime('not a time', 'Asia/Singapore')).toBe('');
  });
});
