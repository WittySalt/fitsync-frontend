import { MuscleGroupInsight, WeeklyTrainingInsight } from '../../../core/fitsync.models';
import { dailyObservations } from './brief-observations';

const TZ = 'Asia/Singapore';

function group(overrides: Partial<MuscleGroupInsight>): MuscleGroupInsight {
  return {
    muscleGroup: 'CHEST',
    sessionsThisWeek: 0,
    inActivePlan: false,
    trainedYesterday: false,
    lastTrainedOn: null,
    consecutiveSessions: 0,
    exerciseNames: [],
    ...overrides
  };
}

function insight(overrides: Partial<WeeklyTrainingInsight>): WeeklyTrainingInsight {
  return {
    timezone: TZ,
    referenceDate: '2026-09-27',
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    completedSessions: 0,
    totalMinutes: 0,
    previousWeekCompletedSessions: 0,
    previousWeekTotalMinutes: 0,
    muscleGroups: [],
    volume: {
      thisWeekKg: 0,
      previousWeekKg: 0,
      weekBeforePreviousKg: 0,
      thisWeekSessionsWithVolume: 0,
      previousWeekSessionsWithVolume: 0
    },
    days: null,
    today: null,
    nextTraining: null,
    ...overrides
  };
}

describe('dailyObservations - reference fixtures', () => {
  it('fixture 1: Sunday reference with a fresh rested trio, a live streak and a lift that rose', () => {
    const now = new Date('2026-09-27T00:10:00Z');
    const fixture = insight({
      referenceDate: '2026-09-27',
      completedSessions: 4,
      totalMinutes: 170,
      previousWeekCompletedSessions: 3,
      previousWeekTotalMinutes: 120,
      muscleGroups: [
        group({ muscleGroup: 'CHEST', inActivePlan: true, sessionsThisWeek: 2, lastTrainedOn: '2026-09-25', consecutiveSessions: 0 }),
        group({ muscleGroup: 'BACK', inActivePlan: true, sessionsThisWeek: 2, lastTrainedOn: '2026-09-25', consecutiveSessions: 0 }),
        group({ muscleGroup: 'LEGS', inActivePlan: true, sessionsThisWeek: 2, lastTrainedOn: '2026-09-25', consecutiveSessions: 0 }),
        group({
          muscleGroup: 'CORE',
          inActivePlan: true,
          sessionsThisWeek: 4,
          trainedYesterday: true,
          lastTrainedOn: '2026-09-26',
          consecutiveSessions: 8,
          exerciseNames: ['Plank']
        }),
        group({ muscleGroup: 'CARDIO', inActivePlan: false, sessionsThisWeek: 2, trainedYesterday: true, lastTrainedOn: '2026-09-26', consecutiveSessions: 1 })
      ],
      lifts: [{ exerciseId: 'x-20', name: 'Dumbbell Bench Press', e1rmStart: 27, e1rmNow: 30.2, changePct: 12 }]
    });

    const result = dailyObservations(fixture, now, TZ);

    expect(result.map((o) => o.fact)).toEqual([
      'Chest, back and legs have had two days off.',
      'Your core has worked eight sessions running.',
      'Your Dumbbell Bench Press best single rose 12% to 30.2 kg.'
    ]);
    expect(result.map((o) => o.note)).toEqual([
      'They were last trained on Friday, so they are ready whenever you are.',
      'Plank was in every session this week, including yesterday.',
      'It was 27 kg before. A best single is the most you could lift once, worked out from your sets.'
    ]);
    expect(result.map((o) => o.id)).toEqual(['rested', 'streak', 'best-single']);
    expect(result.map((o) => o.icon)).toEqual(['rest', 'streak', 'strength']);
    expect(result.map((o) => o.muscle)).toEqual(['CHEST', 'CORE', null]);
  });

  it('fixture 2: Monday reference, nothing trained yet this week, a lift that rose', () => {
    const now = new Date('2026-09-28T00:10:00Z');
    const fixture = insight({
      referenceDate: '2026-09-28',
      completedSessions: 0,
      totalMinutes: 0,
      previousWeekCompletedSessions: 4,
      previousWeekTotalMinutes: 170,
      muscleGroups: [
        group({ muscleGroup: 'CHEST', inActivePlan: true, sessionsThisWeek: 0, lastTrainedOn: '2026-09-25', consecutiveSessions: 0 }),
        group({ muscleGroup: 'BACK', inActivePlan: true, sessionsThisWeek: 0, lastTrainedOn: '2026-09-25', consecutiveSessions: 0 }),
        group({ muscleGroup: 'LEGS', inActivePlan: true, sessionsThisWeek: 0, lastTrainedOn: '2026-09-25', consecutiveSessions: 0 }),
        group({
          muscleGroup: 'CORE',
          inActivePlan: true,
          sessionsThisWeek: 0,
          trainedYesterday: false,
          lastTrainedOn: '2026-09-26',
          consecutiveSessions: 8,
          exerciseNames: ['Plank']
        }),
        group({ muscleGroup: 'CARDIO', inActivePlan: false, sessionsThisWeek: 0, trainedYesterday: false, lastTrainedOn: '2026-09-26', consecutiveSessions: 1 })
      ],
      lifts: [{ exerciseId: 'x-8', name: 'Deadlift', e1rmStart: 81.7, e1rmNow: 93.3, changePct: 14 }]
    });

    const result = dailyObservations(fixture, now, TZ);

    expect(result.map((o) => o.fact)).toEqual([
      'Chest, back and legs have had three days off.',
      'Your core has worked eight sessions running.',
      'Your Deadlift best single rose 14% to 93.3 kg.'
    ]);
    expect(result.map((o) => o.note)).toEqual([
      'They were last trained on Friday, so they are ready whenever you are.',
      'The most recent one was on Saturday.',
      'It was 81.7 kg before. A best single is the most you could lift once, worked out from your sets.'
    ]);
    expect(result.map((o) => o.muscle)).toEqual(['CHEST', 'CORE', null]);
  });
});

describe('dailyObservations - rested groups (rule A)', () => {
  const now = new Date('2026-09-27T00:10:00Z');

  it('uses singular has/it when only one group qualifies', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [group({ muscleGroup: 'BACK', inActivePlan: true, lastTrainedOn: '2026-09-20', consecutiveSessions: 0 })]
    });
    const [observation] = dailyObservations(fixture, now, TZ);
    expect(observation.fact).toBe('Back has had seven days off.');
    expect(observation.note).toBe('It was last trained on Sunday, so it is ready whenever you are.');
  });

  it('keeps the plural verb for one group whose name is a plural noun', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [group({ muscleGroup: 'LEGS', inActivePlan: true, lastTrainedOn: '2026-09-24', consecutiveSessions: 0 })]
    });
    const [observation] = dailyObservations(fixture, now, TZ);
    expect(observation.fact).toBe('Legs have had three days off.');
    expect(observation.note).toBe('They were last trained on Thursday, so they are ready whenever you are.');
  });

  it('returns nothing, and does not throw, when the timezone or the reference date is missing', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [group({ muscleGroup: 'BACK', inActivePlan: true, lastTrainedOn: '2026-09-20', consecutiveSessions: 0 })]
    });
    expect(() => dailyObservations(fixture, now, '')).not.toThrow();
    expect(dailyObservations({ ...fixture, referenceDate: '' }, now, TZ)).toEqual([]);
  });

  it('excludes groups outside the 2-to-14 day rested window', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [
        group({ muscleGroup: 'BACK', inActivePlan: true, lastTrainedOn: '2026-09-26', consecutiveSessions: 0 }), // 1 day off
        group({ muscleGroup: 'CHEST', inActivePlan: true, lastTrainedOn: '2026-09-10', consecutiveSessions: 0 }) // 17 days off
      ]
    });
    expect(dailyObservations(fixture, now, TZ).some((o) => o.id === 'rested')).toBe(false);
  });

  it('includes the boundary days (2 and 14) of the rested window', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [
        group({ muscleGroup: 'BACK', inActivePlan: true, lastTrainedOn: '2026-09-25', consecutiveSessions: 0 }), // 2 days off
        group({ muscleGroup: 'CHEST', inActivePlan: true, lastTrainedOn: '2026-09-13', consecutiveSessions: 0 }) // 14 days off
      ]
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'rested');
    expect(observation).toBeTruthy();
  });

  it('ignores a group that is trained this week but not in the active plan', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [group({ muscleGroup: 'CARDIO', inActivePlan: false, lastTrainedOn: '2026-09-25', consecutiveSessions: 0 })]
    });
    expect(dailyObservations(fixture, now, TZ).some((o) => o.id === 'rested')).toBe(false);
  });

  it('breaks a tie between equally-sized groups by picking the more recent date', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [
        group({ muscleGroup: 'BACK', inActivePlan: true, lastTrainedOn: '2026-09-15', consecutiveSessions: 0 }),
        group({ muscleGroup: 'CHEST', inActivePlan: true, lastTrainedOn: '2026-09-20', consecutiveSessions: 0 })
      ]
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'rested')!;
    expect(observation.fact).toBe('Chest has had seven days off.');
    expect(observation.muscle).toBe('CHEST');
  });
});

describe('dailyObservations - streak (rule B)', () => {
  const now = new Date('2026-09-27T00:10:00Z');

  it('requires at least three consecutive sessions', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [group({ muscleGroup: 'CORE', consecutiveSessions: 2 })]
    });
    expect(dailyObservations(fixture, now, TZ).some((o) => o.id === 'streak')).toBe(false);
  });

  it('uses "have" for legs, arms, shoulders and glutes', () => {
    for (const code of ['LEGS', 'ARMS', 'SHOULDERS', 'GLUTES'] as const) {
      const fixture = insight({
        referenceDate: '2026-09-27',
        muscleGroups: [group({ muscleGroup: code, consecutiveSessions: 3, lastTrainedOn: '2026-09-27' })]
      });
      const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'streak')!;
      expect(observation.fact).toContain(' have worked three sessions running.');
    }
  });

  it('uses "has" for chest, back, core, full body and cardio', () => {
    for (const code of ['CHEST', 'BACK', 'CORE', 'FULL_BODY', 'CARDIO'] as const) {
      const fixture = insight({
        referenceDate: '2026-09-27',
        muscleGroups: [group({ muscleGroup: code, consecutiveSessions: 3, lastTrainedOn: '2026-09-27' })]
      });
      const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'streak')!;
      expect(observation.fact).toContain(' has worked three sessions running.');
    }
  });

  it('breaks a tie by keeping the first group in backend order', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [
        group({ muscleGroup: 'BACK', consecutiveSessions: 5, lastTrainedOn: '2026-09-27' }),
        group({ muscleGroup: 'CHEST', consecutiveSessions: 5, lastTrainedOn: '2026-09-27' })
      ]
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'streak')!;
    expect(observation.fact).toBe('Your back has worked five sessions running.');
    expect(observation.muscle).toBe('BACK');
  });

  it('reports "today" when the streak group trained today', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [group({ muscleGroup: 'BACK', consecutiveSessions: 3, lastTrainedOn: '2026-09-27', sessionsThisWeek: 1 })]
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'streak')!;
    expect(observation.note).toBe('The most recent one was today.');
  });

  it('reports "yesterday" when the streak group trained yesterday', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      muscleGroups: [group({ muscleGroup: 'BACK', consecutiveSessions: 3, lastTrainedOn: '2026-09-26', sessionsThisWeek: 1 })]
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'streak')!;
    expect(observation.note).toBe('The most recent one was yesterday.');
  });
});

describe('dailyObservations - best single (rule C)', () => {
  const now = new Date('2026-09-27T00:10:00Z');
  const read = (lifts: WeeklyTrainingInsight['lifts']) =>
    dailyObservations(insight({ referenceDate: '2026-09-27', lifts }), now, TZ).find((o) => o.id === 'best-single');
  const lift = (name: string, e1rmStart: number, e1rmNow: number, changePct?: number | null) => ({ exerciseId: name, name, e1rmStart, e1rmNow, changePct });

  it('says a lift rose, by how much and to what', () => {
    const observation = read([lift('Dumbbell Bench Press', 27, 30, 12)])!;
    expect(observation.fact).toBe('Your Dumbbell Bench Press best single rose 12% to 30 kg.');
    expect(observation.icon).toBe('strength');
    expect(observation.muscle).toBeNull();
  });

  it('says a lift fell in the same plain words', () => {
    expect(read([lift('Squat', 100, 90, -10)])!.fact).toBe('Your Squat best single is 10% lower, at 90 kg.');
  });

  it('says steady when the change rounds to nothing', () => {
    expect(read([lift('Squat', 100, 100.4, 0)])!.fact).toBe('Your Squat best single is steady at 100.4 kg.');
  });

  it('works the percent out when the server leaves it out', () => {
    expect(read([lift('Row', 40, 50, null)])!.fact).toBe('Your Row best single rose 25% to 50 kg.');
    expect(read([lift('Row', 40, 50)])!.fact).toBe('Your Row best single rose 25% to 50 kg.');
  });

  it('leads with the lift that changed most, in either direction', () => {
    expect(read([lift('Row', 40, 41, 3), lift('Squat', 100, 80, -20), lift('Press', 30, 32, 7)])!.fact).toBe('Your Squat best single is 20% lower, at 80 kg.');
  });

  it('keeps the first of two lifts that changed the same amount', () => {
    expect(read([lift('Row', 40, 44, 10), lift('Press', 30, 33, 10)])!.fact).toContain('Row');
  });

  it('keeps the note plain: what it was, and what a best single is', () => {
    expect(read([lift('Row', 40, 44, 10)])!.note).toBe('It was 40 kg before. A best single is the most you could lift once, worked out from your sets.');
  });

  it('is skipped with no lifts, or lifts with no start or current figure', () => {
    expect(read(undefined)).toBeUndefined();
    expect(read([])).toBeUndefined();
    expect(read([lift('Row', 0, 44, null)])).toBeUndefined();
    expect(read([lift('Row', 40, 0, null)])).toBeUndefined();
  });

  it('never speaks of weight moved or lifted', () => {
    const all = dailyObservations(insight({ referenceDate: '2026-09-27', lifts: [lift('Row', 40, 44, 10)], volume: { thisWeekKg: 2000, previousWeekKg: 1000, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 2, previousWeekSessionsWithVolume: 2 } }), now, TZ);
    for (const o of all) {
      expect(o.fact + o.note).not.toMatch(/moved|lifted [0-9]|times as much/i);
    }
  });
});

describe('dailyObservations - week so far (rule D)', () => {
  const now = new Date('2026-09-27T00:10:00Z');

  it('fills the third slot with singular wording when only one session is logged', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      completedSessions: 1,
      totalMinutes: 50,
      previousWeekCompletedSessions: 1,
      previousWeekTotalMinutes: 40
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'week')!;
    expect(observation.fact).toBe('One session this week, 50 min in all.');
    expect(observation.note).toBe('Last week had one session and 40 min.');
  });

  it('uses plural wording for more than one session', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      completedSessions: 2,
      totalMinutes: 90,
      previousWeekCompletedSessions: 3,
      previousWeekTotalMinutes: 120
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'week')!;
    expect(observation.fact).toBe('Two sessions this week, 1 h 30 min in all.');
    expect(observation.note).toBe('Last week had three sessions and 2 h in all.'.replace(' in all.', '.'));
  });

  it('reports the not-started branch when nothing is logged this week yet', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      completedSessions: 0,
      previousWeekCompletedSessions: 2,
      previousWeekTotalMinutes: 90
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'week')!;
    expect(observation.fact).toBe('Last week had two sessions, 1 h 30 min in all.');
    expect(observation.note).toBe('This week has not started yet.');
  });

  it('is never added when nothing is logged in either week', () => {
    const fixture = insight({ referenceDate: '2026-09-27' });
    expect(dailyObservations(fixture, now, TZ).length).toBe(0);
  });

  it('is not added once three higher-priority observations already exist', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      completedSessions: 5,
      totalMinutes: 200,
      previousWeekCompletedSessions: 5,
      previousWeekTotalMinutes: 200,
      muscleGroups: [
        group({ muscleGroup: 'BACK', inActivePlan: true, lastTrainedOn: '2026-09-25', consecutiveSessions: 0 }),
        group({ muscleGroup: 'CORE', consecutiveSessions: 4, lastTrainedOn: '2026-09-27' })
      ],
      lifts: [{ exerciseId: 'x-8', name: 'Deadlift', e1rmStart: 81.7, e1rmNow: 93.3, changePct: 14 }]
    });
    const result = dailyObservations(fixture, now, TZ);
    expect(result.length).toBe(3);
    expect(result.some((o) => o.id === 'week')).toBe(false);
  });
});

describe('dailyObservations - overall shape', () => {
  const now = new Date('2026-09-27T00:10:00Z');

  it('returns an empty array with no data at all', () => {
    const fixture = insight({ referenceDate: '2026-09-27' });
    expect(dailyObservations(fixture, now, TZ)).toEqual([]);
  });

  it('never returns more than three observations', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      completedSessions: 5,
      totalMinutes: 200,
      previousWeekCompletedSessions: 5,
      previousWeekTotalMinutes: 200,
      muscleGroups: [
        group({ muscleGroup: 'BACK', inActivePlan: true, lastTrainedOn: '2026-09-25', consecutiveSessions: 0 }),
        group({ muscleGroup: 'CORE', consecutiveSessions: 4, lastTrainedOn: '2026-09-27' })
      ],
      lifts: [{ exerciseId: 'x-8', name: 'Deadlift', e1rmStart: 81.7, e1rmNow: 93.3, changePct: 14 }]
    });
    expect(dailyObservations(fixture, now, TZ).length).toBeLessThanOrEqual(3);
  });
});

describe("dailyObservations - today's kind", () => {
  const now = new Date('2026-09-27T00:10:00Z');

  function today(overrides: Partial<NonNullable<WeeklyTrainingInsight['today']>>): WeeklyTrainingInsight['today'] {
    return {
      date: '2026-09-27',
      kind: 'STRENGTH',
      label: 'Strength',
      source: 'PLAN',
      planDayId: null,
      title: null,
      estimatedMinutes: null,
      moves: null,
      lastOfKind: null,
      carriedOver: [],
      ...overrides
    };
  }

  it('leads with a cardio last-run fact and pace note when today is cardio', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      today: today({
        kind: 'CARDIO',
        label: 'Cardio',
        lastOfKind: { date: '2026-09-23', minutes: 35, distanceKm: 5.75, paceSecondsPerKm: 365 }
      })
    });
    const [first] = dailyObservations(fixture, now, TZ);
    expect(first.id).toBe('today-kind');
    expect(first.dayKind).toBe('CARDIO');
    expect(first.fact).toBe('Your last run was 5.75 km in 35 min.');
    expect(first.note).toBe('That is 6:05 per km.');
  });

  it('leads with a mobility last-session fact and date note when today is mobility', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      today: today({
        kind: 'MOBILITY',
        label: 'Mobility',
        lastOfKind: { date: '2026-09-23', minutes: 20, distanceKm: null, paceSecondsPerKm: null }
      })
    });
    const [first] = dailyObservations(fixture, now, TZ);
    expect(first.id).toBe('today-kind');
    expect(first.dayKind).toBe('MOBILITY');
    expect(first.fact).toBe('Your last mobility session was 20 min.');
    expect(first.note).toBe('It was on Wednesday 23 Sept.');
  });

  it('leads with the sport activity by name when today is a sport day', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      today: today({
        kind: 'SPORT',
        label: 'Badminton',
        lastOfKind: { date: '2026-09-20', minutes: 45, distanceKm: null, paceSecondsPerKm: null }
      })
    });
    const [first] = dailyObservations(fixture, now, TZ);
    expect(first.id).toBe('today-kind');
    expect(first.dayKind).toBe('SPORT');
    expect(first.fact).toBe('Your last badminton was 45 min.');
    expect(first.note).toBe('It was on Sunday 20 Sept.');
  });

  it('adds nothing for a strength day', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      today: today({ kind: 'STRENGTH', label: 'Strength', lastOfKind: { date: '2026-09-23', minutes: 50, distanceKm: null, paceSecondsPerKm: null } })
    });
    expect(dailyObservations(fixture, now, TZ).some((o) => o.id === 'today-kind')).toBe(false);
  });

  it('adds nothing for a rest day, leaving the existing yesterday-facing observations as they are', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      today: today({ kind: 'REST', label: 'Rest', source: 'PLAN' }),
      muscleGroups: [group({ muscleGroup: 'CORE', inActivePlan: true, lastTrainedOn: '2026-09-26', consecutiveSessions: 8, trainedYesterday: true })]
    });
    const result = dailyObservations(fixture, now, TZ);
    expect(result.some((o) => o.id === 'today-kind')).toBe(false);
    expect(result.some((o) => o.id === 'streak')).toBe(true);
  });

  it('adds nothing when today is missing or its kind has no last-time record', () => {
    const noToday = insight({ referenceDate: '2026-09-27', today: null });
    expect(dailyObservations(noToday, now, TZ).some((o) => o.id === 'today-kind')).toBe(false);

    const noLastOfKind = insight({ referenceDate: '2026-09-27', today: today({ kind: 'CARDIO', label: 'Cardio' }) });
    expect(dailyObservations(noLastOfKind, now, TZ).some((o) => o.id === 'today-kind')).toBe(false);
  });
});
