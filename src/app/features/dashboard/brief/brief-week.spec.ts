import { WorkoutSession } from '../../../core/fitsync.models';
import { buildWeek, completedSessionCount, weekRange } from './brief-week';

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
    expect(monday.kind).toBe('strength');
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
    expect(cardioOnly.find((day) => day.dateKey === '2026-09-24')!.kind).toBe('cardio');

    const mixed = buildWeek(
      [
        session({ workoutType: 'CARDIO', completedAt: '2026-09-24T09:00:00Z' }),
        session({ workoutType: 'STRENGTH', completedAt: '2026-09-24T11:00:00Z' })
      ],
      now,
      TZ
    );
    expect(mixed.find((day) => day.dateKey === '2026-09-24')!.kind).toBe('strength');
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
