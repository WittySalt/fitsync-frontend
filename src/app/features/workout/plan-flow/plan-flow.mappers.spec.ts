import { lastCardioLine, targetHint, formatPace } from './cardio-text';
import { coverageFromRaw, draftFromRaw, mapFlowKind, proposalFromRaw } from './plan-flow.mappers';
import { profileLine, profileProblem } from './plan-profile';
import { DEFAULT_PROFILE } from './plan-draft';
import { profileFromPreferences } from './plan-flow.api';
import { AccountPreferences } from '../../../core/account-data.service';
import { weekFromTemplate } from './plan-flow.templates';

describe('plan mappers', () => {
  const raw = {
    planId: 'p1',
    name: 'Mixed',
    description: 'd',
    workoutType: 'CUSTOM',
    days: [
      {
        planDayId: 'd1',
        dayOfWeek: 1,
        kind: 'STRENGTH',
        title: 'Full body A',
        estimatedDurationMinutes: 45,
        entries: [
          { entryType: 'SET', exerciseId: 'e1', exerciseNameSnapshot: 'Squat', targetSets: 3, targetReps: 10, targetWeightKg: '20.5', restSeconds: 75, tempoSeconds: '3', notes: 'n', primaryImageUrl: 'u' }
        ]
      },
      {
        planDayId: 'd2',
        dayOfWeek: 3,
        kind: 'CARDIO',
        title: 'Run',
        estimatedDurationMinutes: 30,
        targetKind: 'PACE',
        targetValue: 6,
        location: 'TREADMILL',
        effortTarget: 3,
        entries: [
          { entryType: 'SEGMENT', kind: 'WARMUP', label: 'Warm-up', plannedSeconds: 300 },
          { entryType: 'SEGMENT', kind: 'WORK', plannedSeconds: 120, rounds: 4 },
          { entryType: 'SEGMENT', kind: 'EASY', plannedSeconds: 120, rounds: 4 },
          { entryType: 'SEGMENT', kind: 'COOLDOWN', plannedSeconds: 300 }
        ]
      },
      { planDayId: 'd3', dayOfWeek: 6, kind: 'SPORT', title: 'Badminton', sportActivity: 'BADMINTON', estimatedDurationMinutes: 60 },
      { dayOfWeek: 9, kind: 'STRENGTH' }
    ]
  };

  it('maps a saved plan into seven days with SET and SEGMENT entries', () => {
    const plan = draftFromRaw(raw)!;
    expect(plan.planId).toBe('p1');
    expect(plan.days.length).toBe(7);
    expect(plan.days.map((day) => day.kind)).toEqual(['STRENGTH', 'REST', 'CARDIO', 'REST', 'REST', 'SPORT', 'REST']);
    expect(plan.planType).toBe('MIXED');
    expect(plan.nameTyped).toBeTrue();
    const move = plan.days[0].moves[0];
    expect(move.name).toBe('Squat');
    expect(move.weightKg).toBe(20.5);
    expect(move.tempoSeconds).toBe(3);
    expect(move.imageUrl).toBe('u');
    const run = plan.days[2];
    expect(run.targetKind).toBe('PACE');
    expect(run.location).toBe('TREADMILL');
    expect(run.effort).toBe('EASY');
    expect(run.segments.map((segment) => [segment.kind, segment.minutes, segment.rounds])).toEqual([
      ['WARMUP', 5, null],
      ['WORK', 2, 4],
      ['EASY', 2, 4],
      ['COOLDOWN', 5, null]
    ]);
  });

  it('gives a sport day without segments the default shape', () => {
    const sport = draftFromRaw(raw)!.days[5];
    expect(sport.segments.map((segment) => segment.minutes)).toEqual([5, 50, 5]);
  });

  it('reads the old exercises shape as moves', () => {
    const plan = draftFromRaw({ planId: 'old', name: 'Old', days: [{ dayOfWeek: 2, kind: 'STRENGTH', title: 'A', estimatedDurationMinutes: 30, exercises: [{ exerciseId: 'e2', exerciseNameSnapshot: 'Row', targetSets: 4, targetReps: 8 }] }] })!;
    expect(plan.days[1].moves[0].name).toBe('Row');
    expect(plan.days[1].moves[0].sets).toBe(4);
  });

  it('treats a time-based set as a timed move', () => {
    const plan = draftFromRaw({ days: [{ dayOfWeek: 7, kind: 'MOBILITY', entries: [{ entryType: 'SET', exerciseId: 'e', targetSets: 2, targetDurationSeconds: 40 }] }] })!;
    expect(plan.days[6].moves[0].timed).toBeTrue();
    expect(plan.days[6].moves[0].durationSeconds).toBe(40);
  });

  it('rejects an answer that is not a plan, and tolerates missing fields', () => {
    expect(draftFromRaw(null)).toBeNull();
    expect(draftFromRaw('x')).toBeNull();
    const bare = draftFromRaw({})!;
    expect(bare.days.every((day) => day.kind === 'REST')).toBeTrue();
  });

  it('reads the proposal as days, or as null when it holds no training day', () => {
    expect(proposalFromRaw({ days: raw.days })!.length).toBe(7);
    expect(proposalFromRaw({ plan: { days: raw.days } })!.length).toBe(7);
    expect(proposalFromRaw({ days: [] })).toBeNull();
    expect(proposalFromRaw(null)).toBeNull();
  });

  it('reads coverage and drops malformed rows', () => {
    const coverage = coverageFromRaw({ groups: [{ group: 'chest', setsPerWeek: 9.5 }, { nope: 1 }], notes: [{ code: 'CALVES_NOT_TRAINED', text: 'x' }, {}] })!;
    expect(coverage.groups).toEqual([{ group: 'CHEST', setsPerWeek: 9.5 }]);
    expect(coverage.notes).toEqual([{ code: 'CALVES_NOT_TRAINED', text: 'x' }]);
    expect(coverageFromRaw(undefined)).toBeNull();
    expect(coverageFromRaw({})).toBeNull();
  });

  it('maps day kinds, with HIIT as cardio and anything unknown as strength', () => {
    expect(mapFlowKind('hiit')).toBe('CARDIO');
    expect(mapFlowKind('MOBILITY')).toBe('MOBILITY');
    expect(mapFlowKind('whatever')).toBe('STRENGTH');
  });
});

describe('the profile', () => {
  it('words the one line of the card', () => {
    expect(
      profileLine({ fitnessLevel: 'BEGINNER', weeklyWorkoutDays: 4, preferredDurationMinutes: 45, equipment: ['DUMBBELLS', 'BANDS'], focusAreas: ['FULL_BODY', 'CARDIO'] })
    ).toBe('Beginner · 4 days a week · 45 min · dumbbells, bands · strength and cardio');
    expect(profileLine({ ...DEFAULT_PROFILE, weeklyWorkoutDays: 1, equipment: ['NONE'], focusAreas: ['MOBILITY'] })).toBe(
      'Beginner · 1 day a week · 45 min · no equipment · mobility'
    );
  });

  it('checks the form values', () => {
    expect(profileProblem(DEFAULT_PROFILE)).toBeNull();
    expect(profileProblem({ ...DEFAULT_PROFILE, weeklyWorkoutDays: 9 })).toContain('Days a week');
    expect(profileProblem({ ...DEFAULT_PROFILE, preferredDurationMinutes: 5 })).toContain('Minutes');
  });

  it('reads the profile from the preferences, with defaults when there are none', () => {
    expect(profileFromPreferences(null)).toEqual(DEFAULT_PROFILE);
    const preferences = {
      training: { fitnessLevel: 'advanced', trainingLocation: 'GYM', weeklyWorkoutDays: 5, preferredDurationMinutes: 60, preferredWorkoutTime: null, intensityPreference: 'HIGH', focusAreas: ['240006'], equipmentInventory: ['BARBELL'] }
    } as unknown as AccountPreferences;
    expect(profileFromPreferences(preferences)).toEqual({ fitnessLevel: 'ADVANCED', weeklyWorkoutDays: 5, preferredDurationMinutes: 60, equipment: ['BARBELL'], focusAreas: ['CARDIO'] });
  });
});

describe('cardio text', () => {
  it('words the last run', () => {
    expect(lastCardioLine({ distanceKm: 5.75, minutes: 35, startedAt: '2026-09-29T10:00:00Z' })).toMatch(/^Last run: 5\.75 km in 35 min, 6:05 a km, Tue 29 Sep/);
    expect(lastCardioLine({ distanceKm: null, minutes: 20, startedAt: 'not a date' })).toBe('Last run: 20 min');
    expect(lastCardioLine(null)).toBe('No runs logged yet');
  });

  it('writes a pace as minutes and seconds', () => {
    expect(formatPace(6.08)).toBe('6:05');
    expect(formatPace(0)).toBe('');
  });

  it('works the other targets out from the chosen one', () => {
    expect(targetHint({ targetKind: 'PACE', targetValue: 6, minutes: 30 })).toBe('About 5 km at this pace');
    expect(targetHint({ targetKind: 'DISTANCE', targetValue: 5, minutes: 30 })).toBe('About 6:00 a km over 30 min');
    expect(targetHint({ targetKind: 'MINUTES', targetValue: 30, minutes: 30 })).toBe('');
    expect(targetHint({ targetKind: 'PACE', targetValue: null, minutes: 30 })).toBe('');
  });
});

describe('a template as a week', () => {
  const template = { name: 'Full-body beginner', workoutType: 'STRENGTH', estimatedDurationMinutes: 35, moves: [] };

  it('lays the session out on as many days as the profile asks, at most three, with rest between', () => {
    const three = weekFromTemplate(template, { ...DEFAULT_PROFILE, weeklyWorkoutDays: 5 });
    expect(three.filter((day) => day.kind === 'STRENGTH').map((day) => day.dayOfWeek)).toEqual([1, 4, 6]);
    const two = weekFromTemplate(template, { ...DEFAULT_PROFILE, weeklyWorkoutDays: 2 });
    expect(two.filter((day) => day.kind === 'STRENGTH').length).toBe(2);
    expect(two[0].title).toBe('Full-body beginner');
    expect(two[0].minutes).toBe(35);
  });

  it('makes a mobility template a mobility week', () => {
    const week = weekFromTemplate({ ...template, workoutType: 'MOBILITY' }, DEFAULT_PROFILE);
    expect(week.some((day) => day.kind === 'MOBILITY')).toBeTrue();
  });
});
