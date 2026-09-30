import { MuscleGroupInsight, WeeklyTrainingInsight } from '../../../core/fitsync.models';
import { joinLabels, muscleLabel, wheelSectors } from './brief-muscles';

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

function insight(muscleGroups: MuscleGroupInsight[]): WeeklyTrainingInsight {
  return {
    timezone: 'Asia/Singapore',
    referenceDate: '2026-09-27',
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    completedSessions: 0,
    totalMinutes: 0,
    previousWeekCompletedSessions: 0,
    previousWeekTotalMinutes: 0,
    muscleGroups,
    volume: {
      thisWeekKg: 0,
      previousWeekKg: 0,
      weekBeforePreviousKg: 0,
      thisWeekSessionsWithVolume: 0,
      previousWeekSessionsWithVolume: 0
    },
    days: null,
    today: null,
    nextTraining: null
  };
}

describe('muscleLabel', () => {
  it('labels every muscle group code', () => {
    expect(muscleLabel('FULL_BODY')).toBe('Whole body');
    expect(muscleLabel('CHEST')).toBe('Chest');
    expect(muscleLabel('BACK')).toBe('Back');
    expect(muscleLabel('SHOULDERS')).toBe('Shoulders');
    expect(muscleLabel('ARMS')).toBe('Arms');
    expect(muscleLabel('CORE')).toBe('Core');
    expect(muscleLabel('GLUTES')).toBe('Glutes');
    expect(muscleLabel('LEGS')).toBe('Legs');
    expect(muscleLabel('CARDIO')).toBe('Cardio');
  });
});

describe('wheelSectors', () => {
  it('includes a group that is in the active plan even with no sessions this week', () => {
    const sectors = wheelSectors(insight([group({ muscleGroup: 'BACK', inActivePlan: true, sessionsThisWeek: 0 })]));
    expect(sectors.length).toBe(1);
    expect(sectors[0].code).toBe('BACK');
    expect(sectors[0].inPlan).toBe(true);
  });

  it('includes a group that was trained this week even when not in the active plan', () => {
    const sectors = wheelSectors(insight([group({ muscleGroup: 'CARDIO', inActivePlan: false, sessionsThisWeek: 2 })]));
    expect(sectors.length).toBe(1);
    expect(sectors[0].code).toBe('CARDIO');
    expect(sectors[0].sessions).toBe(2);
  });

  it('leaves out a group that is neither in plan nor trained this week', () => {
    const sectors = wheelSectors(insight([group({ muscleGroup: 'GLUTES', inActivePlan: false, sessionsThisWeek: 0 })]));
    expect(sectors.length).toBe(0);
  });

  it('keeps the backend order for the groups it keeps', () => {
    const sectors = wheelSectors(
      insight([
        group({ muscleGroup: 'LEGS', inActivePlan: true }),
        group({ muscleGroup: 'CHEST', inActivePlan: true }),
        group({ muscleGroup: 'BACK', sessionsThisWeek: 1 })
      ])
    );
    expect(sectors.map((sector) => sector.code)).toEqual(['LEGS', 'CHEST', 'BACK']);
  });

  it('caps at seven sectors, keeping in-plan groups first and then the most trained', () => {
    const groups: MuscleGroupInsight[] = [
      group({ muscleGroup: 'FULL_BODY', inActivePlan: false, sessionsThisWeek: 1 }),
      group({ muscleGroup: 'CHEST', inActivePlan: true, sessionsThisWeek: 0 }),
      group({ muscleGroup: 'BACK', inActivePlan: true, sessionsThisWeek: 0 }),
      group({ muscleGroup: 'SHOULDERS', inActivePlan: false, sessionsThisWeek: 5 }),
      group({ muscleGroup: 'ARMS', inActivePlan: false, sessionsThisWeek: 4 }),
      group({ muscleGroup: 'CORE', inActivePlan: false, sessionsThisWeek: 3 }),
      group({ muscleGroup: 'GLUTES', inActivePlan: false, sessionsThisWeek: 2 }),
      group({ muscleGroup: 'LEGS', inActivePlan: false, sessionsThisWeek: 1 }),
      group({ muscleGroup: 'CARDIO', inActivePlan: false, sessionsThisWeek: 6 })
    ];
    const sectors = wheelSectors(insight(groups));
    expect(sectors.length).toBe(7);
    // The two in-plan groups are always kept; among the rest, the five most trained win, so the
    // two weakest (FULL_BODY and LEGS, one session each) are dropped. Order stays backend order.
    expect(sectors.map((sector) => sector.code)).toEqual(['CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'CORE', 'GLUTES', 'CARDIO']);
  });
});

describe('joinLabels', () => {
  it('returns an empty string for no labels', () => {
    expect(joinLabels([])).toBe('');
  });

  it('returns the single label unchanged', () => {
    expect(joinLabels(['Chest'])).toBe('Chest');
  });

  it('joins two labels with "and", lower-casing the second', () => {
    expect(joinLabels(['Chest', 'Back'])).toBe('Chest and back');
  });

  it('joins three or more labels with commas and a final "and", lower-casing all but the first', () => {
    expect(joinLabels(['Chest', 'Back', 'Legs'])).toBe('Chest, back and legs');
  });
});
