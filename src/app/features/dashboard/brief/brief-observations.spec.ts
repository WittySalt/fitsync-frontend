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
  it('fixture 1: Sunday reference with a fresh rested trio, a live streak and a strong volume week', () => {
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
      volume: { thisWeekKg: 3846, previousWeekKg: 1716, weekBeforePreviousKg: 1716, thisWeekSessionsWithVolume: 2, previousWeekSessionsWithVolume: 1, previousWeekSameDaysKg: 1716, previousWeekSameDaysSessionsWithVolume: 1 }
    });

    const result = dailyObservations(fixture, now, TZ);

    expect(result.map((o) => o.fact)).toEqual([
      'Chest, back and legs have had two days off.',
      'Your core has worked eight sessions running.',
      'You have lifted 2.2 times as much as by this point last week.'
    ]);
    expect(result.map((o) => o.note)).toEqual([
      'They were last trained on Friday, so they are ready whenever you are.',
      'Plank was in every session this week, including yesterday.',
      '3,846 kg over two sessions so far, against 1,716 kg over one session by this point last week.'
    ]);
    expect(result.map((o) => o.id)).toEqual(['rested', 'streak', 'volume']);
    expect(result.map((o) => o.icon)).toEqual(['rest', 'streak', 'volume']);
    expect(result.map((o) => o.muscle)).toEqual(['CHEST', 'CORE', null]);
  });

  it('fixture 2: Monday reference, nothing trained yet this week, last week carried the volume', () => {
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
      volume: { thisWeekKg: 0, previousWeekKg: 3846, weekBeforePreviousKg: 1716, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 2, previousWeekSameDaysKg: 3846, previousWeekSameDaysSessionsWithVolume: 2 }
    });

    const result = dailyObservations(fixture, now, TZ);

    expect(result.map((o) => o.fact)).toEqual([
      'Chest, back and legs have had three days off.',
      'Your core has worked eight sessions running.',
      'Last week you lifted 3,846 kg.'
    ]);
    expect(result.map((o) => o.note)).toEqual([
      'They were last trained on Friday, so they are ready whenever you are.',
      'The most recent one was on Saturday.',
      'That is 2.2 times the week before.'
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

describe('dailyObservations - volume (rule C)', () => {
  const now = new Date('2026-09-27T00:10:00Z');

  it('reports "about the same" when the ratio is within 0.85 to 1.15', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      volume: { thisWeekKg: 1000, previousWeekKg: 1000, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 2, previousWeekSessionsWithVolume: 2, previousWeekSameDaysKg: 1000, previousWeekSameDaysSessionsWithVolume: 2 }
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'volume')!;
    expect(observation.fact).toBe('You have lifted about the same as by this point last week.');
    expect(observation.note).toBe('1,000 kg so far, against 1,000 kg by this point last week.');
    expect(observation.muscle).toBeNull();
  });

  it('reports a percentage when the ratio drops to 0.85 or below', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      volume: { thisWeekKg: 600, previousWeekKg: 1000, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 2, previousWeekSessionsWithVolume: 2, previousWeekSameDaysKg: 1000, previousWeekSameDaysSessionsWithVolume: 2 }
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'volume')!;
    expect(observation.fact).toBe('You have lifted 60% of what you had by this point last week.');
  });

  it('skips the note session breakdown when the session counts match', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      volume: { thisWeekKg: 2000, previousWeekKg: 1000, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 3, previousWeekSessionsWithVolume: 3, previousWeekSameDaysKg: 1000, previousWeekSameDaysSessionsWithVolume: 3 }
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'volume')!;
    expect(observation.note).toBe('2,000 kg so far, against 1,000 kg by this point last week.');
  });

  it('reports the first full week on record when there is no week-before-previous data', () => {
    const fixture = insight({
      referenceDate: '2026-09-27',
      volume: { thisWeekKg: 0, previousWeekKg: 1000, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 2, previousWeekSameDaysKg: 1000, previousWeekSameDaysSessionsWithVolume: 2 }
    });
    const observation = dailyObservations(fixture, now, TZ).find((o) => o.id === 'volume')!;
    expect(observation.fact).toBe('Last week you lifted 1,000 kg.');
    expect(observation.note).toBe('It is the first full week on record.');
  });

  it('is skipped entirely when neither week has any lifted weight', () => {
    const fixture = insight({ referenceDate: '2026-09-27' });
    expect(dailyObservations(fixture, now, TZ).some((o) => o.id === 'volume')).toBe(false);
  });
});

describe('dailyObservations - volume against last week by the same weekday', () => {
  const now = new Date('2026-10-03T00:10:00Z');
  const volume = (sameKg?: number, sameSessions = 1) => ({
    thisWeekKg: 1923,
    previousWeekKg: 3846,
    weekBeforePreviousKg: 0,
    thisWeekSessionsWithVolume: 1,
    previousWeekSessionsWithVolume: 2,
    previousWeekSameDaysKg: sameKg,
    previousWeekSameDaysSessionsWithVolume: sameSessions
  });
  const read = (fixture: WeeklyTrainingInsight) => dailyObservations(fixture, now, TZ).find((o) => o.id === 'volume');

  it('compares with last week up to the same weekday, not with all of last week', () => {
    const observation = read(insight({ referenceDate: '2026-10-03', volume: volume(1900) }))!;
    expect(observation.fact).toBe('You have lifted about the same as by this point last week.');
    expect(observation.note).toBe('1,923 kg so far, against 1,900 kg by this point last week.');
  });

  it('says how much more and how much less, in the same words', () => {
    expect(read(insight({ referenceDate: '2026-10-03', volume: volume(1000) }))!.fact).toBe(
      'You have lifted 1.9 times as much as by this point last week.'
    );
    expect(read(insight({ referenceDate: '2026-10-03', volume: volume(3000) }))!.fact).toBe(
      'You have lifted 64% of what you had by this point last week.'
    );
  });

  it('names the sessions when the counts differ', () => {
    const observation = read(insight({ referenceDate: '2026-10-03', volume: volume(1000, 2) }))!;
    expect(observation.note).toBe('1,923 kg over one session so far, against 1,000 kg over two sessions by this point last week.');
  });

  it('is left out when last week had no weight by this point, or the figure is missing', () => {
    expect(read(insight({ referenceDate: '2026-10-03', volume: volume(0, 0) }))).toBeUndefined();
    expect(read(insight({ referenceDate: '2026-10-03', volume: volume(undefined) }))).toBeUndefined();
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
      volume: { thisWeekKg: 2000, previousWeekKg: 1000, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 2, previousWeekSessionsWithVolume: 2, previousWeekSameDaysKg: 1000, previousWeekSameDaysSessionsWithVolume: 2 }
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
      volume: { thisWeekKg: 2000, previousWeekKg: 1000, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 2, previousWeekSessionsWithVolume: 2, previousWeekSameDaysKg: 1000, previousWeekSameDaysSessionsWithVolume: 2 }
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
