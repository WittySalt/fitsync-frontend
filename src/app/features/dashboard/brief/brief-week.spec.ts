import { DayInsight, WorkoutSession } from '../../../core/fitsync.models';
import { buildWeek, buildWeekFromInsight, completedSessionCount, weekRange } from './brief-week';

const TZ = 'Asia/Singapore';

function session(overrides: Partial<WorkoutSession>): WorkoutSession {
  return {
    sessionId: 'session-1',
    planId: null,
    name: 'Session',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-09-21T09:00:00Z',
    durationMinutes: 50,
    caloriesBurned: 300,
    completedAt: '2026-09-21T10:00:00Z',
    exerciseCount: 5,
    ...overrides
  };
}

describe('weekRange', () => {
  it('returns the Monday-to-Sunday week containing "now"', () => {
    const range = weekRange(new Date('2026-09-27T00:10:00Z'), TZ); // Sunday 08:10 SGT
    expect(range.dateKeys).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'
    ]);
  });

  it('crosses a month boundary correctly', () => {
    const range = weekRange(new Date('2026-09-01T04:00:00Z'), TZ); // Tuesday noon SGT
    expect(range.dateKeys).toEqual([
      '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'
    ]);
  });
});

describe('buildWeek', () => {
  const now = new Date('2026-09-27T00:10:00Z'); // Sunday 08:10 SGT, matches the fixed component clock

  it('marks a day with a completed strength session as trained, with its duration', () => {
    const week = buildWeek([session({ workoutType: 'STRENGTH', durationMinutes: 50 })], now, TZ);
    const monday = week.find((day) => day.dateKey === '2026-09-21')!;
    expect(monday.state).toBe('trained');
    expect(monday.minutes).toBe(50);
    expect(monday.kind).toBe('STRENGTH');
  });

  it('marks a past day with no session as rest', () => {
    const week = buildWeek([], now, TZ);
    const tuesday = week.find((day) => day.dateKey === '2026-09-22')!;
    expect(tuesday.state).toBe('rest');
    expect(tuesday.minutes).toBeNull();
    expect(tuesday.kind).toBeNull();
  });

  it('marks today with no session as today-open', () => {
    const week = buildWeek([], now, TZ);
    const sunday = week.find((day) => day.dateKey === '2026-09-27')!;
    expect(sunday.state).toBe('today-open');
  });

  it('marks today with a completed session as today-trained', () => {
    const todaySession = session({
      startedAt: '2026-09-27T01:00:00Z',
      completedAt: '2026-09-27T02:00:00Z',
      workoutType: 'STRENGTH'
    });
    const week = buildWeek([todaySession], now, TZ);
    const sunday = week.find((day) => day.dateKey === '2026-09-27')!;
    expect(sunday.state).toBe('today-trained');
  });

  it('marks a future day as upcoming', () => {
    const midWeekNow = new Date('2026-09-23T04:00:00Z'); // Wednesday SGT
    const week = buildWeek([], midWeekNow, TZ);
    const friday = week.find((day) => day.dateKey === '2026-09-25')!;
    expect(friday.state).toBe('upcoming');
    expect(friday.minutes).toBeNull();
  });

  it('sums the minutes of several sessions on the same day', () => {
    const sessions = [
      session({ durationMinutes: 20, completedAt: '2026-09-21T09:00:00Z', workoutType: 'STRENGTH' }),
      session({ durationMinutes: 30, completedAt: '2026-09-21T11:00:00Z', workoutType: 'STRENGTH' })
    ];
    const week = buildWeek(sessions, now, TZ);
    const monday = week.find((day) => day.dateKey === '2026-09-21')!;
    expect(monday.minutes).toBe(50);
  });

  it('classes a day as cardio only when every session that day is cardio', () => {
    const cardioOnly = buildWeek(
      [session({ workoutType: 'CARDIO', completedAt: '2026-09-24T10:00:00Z' })],
      now,
      TZ
    );
    expect(cardioOnly.find((day) => day.dateKey === '2026-09-24')!.kind).toBe('CARDIO');

    const mixed = buildWeek(
      [
        session({ workoutType: 'CARDIO', completedAt: '2026-09-24T09:00:00Z' }),
        session({ workoutType: 'STRENGTH', completedAt: '2026-09-24T11:00:00Z' })
      ],
      now,
      TZ
    );
    expect(mixed.find((day) => day.dateKey === '2026-09-24')!.kind).toBe('STRENGTH');
  });

  it('ignores sessions that are not COMPLETED', () => {
    const week = buildWeek([session({ status: 'IN_PROGRESS' })], now, TZ);
    const monday = week.find((day) => day.dateKey === '2026-09-21')!;
    expect(monday.state).toBe('rest');
  });

  it('ignores sessions outside the week', () => {
    const week = buildWeek(
      [session({ completedAt: '2026-09-14T10:00:00Z', startedAt: '2026-09-14T09:00:00Z' })],
      now,
      TZ
    );
    expect(week.every((day) => day.state !== 'trained')).toBe(true);
  });

  it('reproduces the reference week: Mon/Thu/Fri/Sat trained, Tue/Wed rest, Sun open', () => {
    const sessions = [
      session({ workoutType: 'STRENGTH', durationMinutes: 50, completedAt: '2026-09-21T10:00:00Z', startedAt: '2026-09-21T09:00:00Z' }),
      session({ workoutType: 'CARDIO', durationMinutes: 35, completedAt: '2026-09-24T10:00:00Z', startedAt: '2026-09-24T09:00:00Z' }),
      session({ workoutType: 'STRENGTH', durationMinutes: 50, completedAt: '2026-09-25T10:00:00Z', startedAt: '2026-09-25T09:00:00Z' }),
      session({ workoutType: 'CARDIO', durationMinutes: 35, completedAt: '2026-09-26T10:00:00Z', startedAt: '2026-09-26T09:00:00Z' })
    ];
    const week = buildWeek(sessions, now, TZ);
    expect(week.map((day) => day.state)).toEqual([
      'trained', 'rest', 'rest', 'trained', 'trained', 'trained', 'today-open'
    ]);
  });
});

describe('completedSessionCount', () => {
  const now = new Date('2026-09-27T00:10:00Z');

  it('counts only completed sessions inside the week', () => {
    const sessions = [
      session({ completedAt: '2026-09-21T10:00:00Z', startedAt: '2026-09-21T09:00:00Z' }),
      session({ completedAt: '2026-09-24T10:00:00Z', startedAt: '2026-09-24T09:00:00Z' }),
      session({ status: 'IN_PROGRESS', completedAt: '2026-09-25T10:00:00Z', startedAt: '2026-09-25T09:00:00Z' }),
      session({ completedAt: '2026-09-14T10:00:00Z', startedAt: '2026-09-14T09:00:00Z' })
    ];
    expect(completedSessionCount(sessions, now, TZ)).toBe(2);
  });
});

describe('buildWeekFromInsight', () => {
  const WEEK_KEYS = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
  const TODAY_KEY = '2026-09-25'; // Friday, the middle of the week fixture

  function dayInsight(date: string, overrides: Partial<DayInsight> = {}): DayInsight {
    return {
      date,
      dayOfWeek: WEEK_KEYS.indexOf(date) + 1,
      kind: 'OPEN',
      label: '',
      source: 'NONE',
      minutes: null,
      sessions: [],
      planned: null,
      ...overrides
    };
  }

  function weekOf(byDate: Record<string, Partial<DayInsight>>): DayInsight[] {
    return WEEK_KEYS.map((key) => dayInsight(key, byDate[key] ?? {}));
  }

  it('marks a whole week of NONE-source days as rest before today, open today, upcoming after', () => {
    const week = buildWeekFromInsight(weekOf({}), TODAY_KEY);
    expect(week.map((day) => day.state)).toEqual([
      'rest', 'rest', 'rest', 'rest', 'today-open', 'upcoming', 'upcoming'
    ]);
    // A day with no data at all (kind OPEN, source NONE) is quieter than a day the coach knows to
    // be a rest day: its caption is left blank, not "rest".
    expect(week.every((day) => day.kind === 'OPEN')).toBe(true);
  });

  it('keeps a past day that is reported as rest without a source free of a kind', () => {
    const week = buildWeekFromInsight(weekOf({ '2026-09-21': { kind: 'REST', label: 'Rest', source: 'NONE' } }), TODAY_KEY);
    const monday = week.find((day) => day.dateKey === '2026-09-21')!;
    expect(monday.state).toBe('rest');
    expect(monday.kind).toBe('OPEN');
  });

  it('keeps a rest day that comes from the plan or a habit as rest', () => {
    const week = buildWeekFromInsight(weekOf({ '2026-09-21': { kind: 'REST', label: 'Rest', source: 'HABIT' } }), TODAY_KEY);
    expect(week.find((day) => day.dateKey === '2026-09-21')!.kind).toBe('REST');
  });

  it('marks a fulfilled plan day as trained, keeping its minutes and kind', () => {
    const week = buildWeekFromInsight(
      weekOf({
        '2026-09-21': {
          kind: 'STRENGTH',
          label: 'Strength',
          source: 'DONE',
          minutes: 50,
          planned: { planDayId: 'pd-1', kind: 'STRENGTH', title: 'Full body', sportActivity: null, estimatedMinutes: 50, moves: 4, fulfilled: true }
        }
      }),
      TODAY_KEY
    );
    const monday = week.find((day) => day.dateKey === '2026-09-21')!;
    expect(monday.state).toBe('trained');
    expect(monday.minutes).toBe(50);
    expect(monday.kind).toBe('STRENGTH');
    expect(monday.planned).toBe(false);
  });

  it('draws a past day that was scheduled but never done as a quiet rest day, not a missed one', () => {
    const week = buildWeekFromInsight(
      weekOf({
        '2026-09-22': {
          kind: 'CARDIO',
          label: 'Cardio',
          source: 'PLAN',
          planned: { planDayId: 'pd-2', kind: 'CARDIO', title: 'Treadmill run', sportActivity: null, estimatedMinutes: 35, moves: null, fulfilled: false }
        }
      }),
      TODAY_KEY
    );
    const tuesday = week.find((day) => day.dateKey === '2026-09-22')!;
    expect(tuesday.state).toBe('rest');
    expect(tuesday.planned).toBe(false);
  });

  it('marks a later scheduled or habitual training day as upcoming and planned', () => {
    const week = buildWeekFromInsight(
      weekOf({
        '2026-09-26': { kind: 'SPORT', label: 'Badminton', source: 'PLAN' },
        '2026-09-27': { kind: 'STRENGTH', label: 'Strength', source: 'HABIT' }
      }),
      TODAY_KEY
    );
    const saturday = week.find((day) => day.dateKey === '2026-09-26')!;
    const sunday = week.find((day) => day.dateKey === '2026-09-27')!;
    expect(saturday.state).toBe('upcoming');
    expect(saturday.planned).toBe(true);
    expect(saturday.label).toBe('Badminton');
    expect(sunday.state).toBe('upcoming');
    expect(sunday.planned).toBe(true);
  });

  const TODAY_KINDS: Array<{ kind: DayInsight['kind']; label: string }> = [
    { kind: 'STRENGTH', label: 'Strength' },
    { kind: 'CARDIO', label: 'Cardio' },
    { kind: 'MOBILITY', label: 'Mobility' },
    { kind: 'SPORT', label: 'Badminton' },
    { kind: 'REST', label: 'Rest' },
    { kind: 'OPEN', label: '' }
  ];

  for (const { kind, label } of TODAY_KINDS) {
    it(`marks today as today-open for a ${kind} day that has not been trained yet`, () => {
      const week = buildWeekFromInsight(weekOf({ [TODAY_KEY]: { kind, label, source: 'PLAN' } }), TODAY_KEY);
      const today = week.find((day) => day.dateKey === TODAY_KEY)!;
      expect(today.state).toBe('today-open');
      expect(today.kind).toBe(kind);
      expect(today.label).toBe(label);
    });
  }

  it('marks today as today-trained once its source is DONE', () => {
    const week = buildWeekFromInsight(weekOf({ [TODAY_KEY]: { kind: 'CARDIO', label: 'Cardio', source: 'DONE', minutes: 35 } }), TODAY_KEY);
    const today = week.find((day) => day.dateKey === TODAY_KEY)!;
    expect(today.state).toBe('today-trained');
    expect(today.minutes).toBe(35);
  });
});
