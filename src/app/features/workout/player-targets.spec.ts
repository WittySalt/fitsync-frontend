import {
  WorkoutExerciseSetLog,
  WorkoutPlan,
  WorkoutPlanDay,
  WorkoutPlanExercise
} from '../../core/fitsync.models';
import {
  PlayerSet,
  SetTarget,
  defaultTempoSeconds,
  exerciseSummary,
  findPlanExercise,
  formatTargetDuration,
  resolveExerciseSets,
  resolveTempoSeconds,
  sameTarget,
  targetLine,
  valuesLine
} from './player-targets';

function row(setNumber: number, values: Partial<WorkoutExerciseSetLog> = {}): WorkoutExerciseSetLog {
  return {
    setLogId: '',
    setNumber,
    status: 'PENDING',
    reps: null,
    weightKg: null,
    durationSeconds: null,
    distanceKm: null,
    restSeconds: null,
    perceivedExertion: null,
    logged: false,
    notes: '',
    ...values
  };
}

function planExercise(overrides: Partial<WorkoutPlanExercise> = {}): WorkoutPlanExercise {
  return {
    exerciseId: 'ex-plank',
    exerciseNameSnapshot: 'Plank',
    sequence: 1,
    targetSets: 3,
    targetReps: null,
    targetWeightKg: null,
    targetDurationSeconds: 45,
    targetDistanceKm: null,
    restSeconds: 30,
    notes: '',
    setTargets: [],
    ...overrides
  };
}

function planDay(planDayId: string, exercises: WorkoutPlanExercise[]): WorkoutPlanDay {
  return {
    planDayId,
    dayOfWeek: 1,
    kind: 'STRENGTH',
    title: 'Day',
    sportActivity: null,
    sportLabel: null,
    estimatedDurationMinutes: null,
    exercises
  } as WorkoutPlanDay;
}

function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    planId: 'plan-1',
    name: 'Plan',
    description: '',
    goalFocus: '',
    workoutType: 'STRENGTH',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 30,
    status: 'ACTIVE',
    exerciseCount: 0,
    exercises: [],
    days: [],
    ...overrides
  };
}

const log = (sets: WorkoutExerciseSetLog[] = [], exerciseId = 'ex-plank', sequence = 1) => ({ exerciseId, sequence, sets });

describe('player targets', () => {
  describe('resolving the sets of an exercise', () => {
    it('takes the session rows first, one set for each row, even when the plan says otherwise', () => {
      const sets = resolveExerciseSets(
        log([row(1, { durationSeconds: 1800, distanceKm: 5.75 }), row(2, { durationSeconds: 1200 })]),
        'day-1',
        plan({ days: [planDay('day-1', [planExercise({ targetSets: 5, targetDurationSeconds: 60 })])] })
      );

      expect(sets.length).toBe(2);
      expect(sets[0].target).toEqual(jasmine.objectContaining({ durationSeconds: 1800, distanceKm: 5.75 }));
      expect(sets[1].target?.durationSeconds).toBe(1200);
    });

    it('asks the plan for an open row that carries no values', () => {
      const sets = resolveExerciseSets(log([row(1), row(2)]), null, plan({ exercises: [planExercise()] }));

      expect(sets.map((set) => set.target?.durationSeconds)).toEqual([45, 45]);
    });

    it('keeps the plan target of a logged row and shows the logged values apart', () => {
      const sets = resolveExerciseSets(
        log([row(1, { logged: true, reps: 8, weightKg: 20 })], 'ex-1'),
        null,
        plan({ exercises: [planExercise({ exerciseId: 'ex-1', targetSets: 1, targetReps: 10, targetWeightKg: 20, targetDurationSeconds: null })] })
      );

      expect(sets[0].target?.reps).toBe(10);
      expect(sets[0].logged?.reps).toBe(8);
    });

    it('marks a skipped row and keeps it out of the logged values', () => {
      const sets = resolveExerciseSets(log([row(1, { status: 'SKIPPED', logged: true })]), null, null);

      expect(sets[0].skipped).toBeTrue();
      expect(sets[0].logged).toBeNull();
    });

    it('uses the plan day of the session when the exercise has no rows', () => {
      const other = planDay('day-2', [planExercise({ targetSets: 9 })]);
      const own = planDay('day-1', [planExercise({ targetSets: 3 })]);

      const sets = resolveExerciseSets(log(), 'day-1', plan({ days: [other, own] }));

      expect(sets.length).toBe(3);
      expect(sets[0].target?.durationSeconds).toBe(45);
    });

    it('falls back to the plan day that holds the exercise when the session day does not', () => {
      const holder = planDay('day-2', [planExercise({ targetSets: 2 })]);

      expect(resolveExerciseSets(log(), 'missing', plan({ days: [holder] })).length).toBe(2);
      expect(resolveExerciseSets(log(), null, plan({ days: [holder] })).length).toBe(2);
    });

    it('falls back to the flat list of the plan', () => {
      const sets = resolveExerciseSets(log(), null, plan({ exercises: [planExercise({ targetSets: 4 })] }));

      expect(sets.length).toBe(4);
    });

    it('uses the target of each set when the plan exercise has them', () => {
      const exercise = planExercise({
        targetSets: 2,
        targetDurationSeconds: null,
        setTargets: [
          { setNumber: 1, targetReps: 12, targetWeightKg: 10, targetDurationSeconds: null, targetDistanceKm: null, restSeconds: 60 },
          { setNumber: 2, targetReps: 8, targetWeightKg: 15, targetDurationSeconds: null, targetDistanceKm: null, restSeconds: 90 }
        ]
      });

      const sets = resolveExerciseSets(log(), null, plan({ exercises: [exercise] }));

      expect(sets.map((set) => set.target?.reps)).toEqual([12, 8]);
      expect(sets[1].target?.restSeconds).toBe(90);
    });

    it('is one set without a target when nothing says more', () => {
      const sets = resolveExerciseSets(log(), null, null);

      expect(sets).toEqual([{ setNumber: 1, target: null, logged: null, skipped: false }]);
      expect(findPlanExercise(log(), 'day-1', plan())).toBeNull();
    });
  });

  describe('the target line', () => {
    const t = (values: Partial<SetTarget>): SetTarget => ({
      reps: null, weightKg: null, durationSeconds: null, distanceKm: null, restSeconds: null, ...values
    });

    it('writes reps and weight, reps alone, time and distance, time alone and distance alone', () => {
      expect(targetLine(t({ reps: 10, weightKg: 20 }))).toBe('10 reps · 20 kg');
      expect(targetLine(t({ reps: 10 }))).toBe('10 reps');
      expect(targetLine(t({ durationSeconds: 1800, distanceKm: 5.75 }))).toBe('30 min · 5.75 km');
      expect(targetLine(t({ durationSeconds: 45 }))).toBe('45 sec');
      expect(targetLine(t({ durationSeconds: 1800 }))).toBe('30 min');
      expect(targetLine(t({ durationSeconds: 3900 }))).toBe('1 h 5 min');
      expect(targetLine(t({ distanceKm: 5.75 }))).toBe('5.75 km');
    });

    it('adds the rest, and shows nothing when there is no target', () => {
      expect(targetLine(t({ reps: 10, weightKg: 20, restSeconds: 75 }))).toBe('10 reps · 20 kg · 75 sec rest');
      expect(targetLine(t({ restSeconds: 75 }))).toBe('');
      expect(targetLine(null)).toBe('');
    });

    it('writes durations the short way', () => {
      expect(formatTargetDuration(119)).toBe('119 sec');
      expect(formatTargetDuration(120)).toBe('2 min');
      expect(formatTargetDuration(3600)).toBe('1 h');
    });

    it('writes the values of a set for the list', () => {
      expect(valuesLine(t({ reps: 10, weightKg: 20, restSeconds: 60 }))).toBe('10 × 20 kg');
      expect(valuesLine(t({ reps: 8 }))).toBe('8 reps');
      expect(valuesLine(t({ durationSeconds: 1800, distanceKm: 5.75, restSeconds: 60 }))).toBe('30 min · 5.75 km');
    });
  });

  describe('the queue summary', () => {
    const set = (setNumber: number, values: Partial<SetTarget>): PlayerSet => ({
      setNumber,
      target: { reps: null, weightKg: null, durationSeconds: null, distanceKm: null, restSeconds: null, ...values },
      logged: null,
      skipped: false
    });

    it('is one line when every set shares a target', () => {
      expect(exerciseSummary([1, 2, 3].map((n) => set(n, { reps: 10, weightKg: 20 })))).toBe('3 × 10 · 20 kg');
      expect(exerciseSummary([1, 2, 3].map((n) => set(n, { durationSeconds: 45 })))).toBe('3 × 45 sec');
      expect(exerciseSummary([set(1, { durationSeconds: 1800, distanceKm: 5.75 })])).toBe('30 min · 5.75 km');
    });

    it('counts the sets when they differ or have no target', () => {
      expect(exerciseSummary([set(1, { reps: 10 }), set(2, { reps: 8 }), set(3, { reps: 8 })])).toBe('3 sets');
      expect(exerciseSummary([{ setNumber: 1, target: null, logged: null, skipped: false }])).toBe('1 set');
    });
  });

  describe('comparing a set with its plan', () => {
    const target = (values: Partial<SetTarget>): SetTarget => ({
      reps: null,
      weightKg: null,
      durationSeconds: null,
      distanceKm: null,
      restSeconds: null,
      ...values
    });

    it('treats equal values as the same, whatever the number is written like', () => {
      expect(sameTarget(target({ reps: 10, weightKg: 20 }), target({ reps: 10, weightKg: 20.0 }))).toBeTrue();
      expect(sameTarget(target({ reps: 10, weightKg: 20 }), target({ reps: 10, weightKg: 20.001 }))).toBeTrue();
    });

    it('treats a missing weight on both sides as equal', () => {
      expect(sameTarget(target({ reps: 8 }), target({ reps: 8 }))).toBeTrue();
    });

    it('tells a different count of reps apart', () => {
      expect(sameTarget(target({ reps: 10, weightKg: 20 }), target({ reps: 8, weightKg: 20 }))).toBeFalse();
    });

    it('tells a different weight apart, and a missing one from a present one', () => {
      expect(sameTarget(target({ reps: 10, weightKg: 20 }), target({ reps: 10, weightKg: 22.5 }))).toBeFalse();
      expect(sameTarget(target({ reps: 10, weightKg: 20 }), target({ reps: 10 }))).toBeFalse();
    });

    it('ignores what the line does not show, such as a time beside the reps or the rest', () => {
      expect(sameTarget(target({ reps: 10, restSeconds: 60 }), target({ reps: 10, durationSeconds: 35 }))).toBeTrue();
    });

    it('compares time and distance for a set without reps', () => {
      expect(sameTarget(target({ durationSeconds: 1800, distanceKm: 5.75 }), target({ durationSeconds: 1800, distanceKm: 5.75 }))).toBeTrue();
      expect(sameTarget(target({ durationSeconds: 1800 }), target({ durationSeconds: 1500 }))).toBeFalse();
      expect(sameTarget(target({ reps: 10 }), target({ durationSeconds: 30 }))).toBeFalse();
    });

    it('is the same only when both sides are missing, or both present', () => {
      expect(sameTarget(null, null)).toBeTrue();
      expect(sameTarget(null, target({ reps: 10 }))).toBeFalse();
      expect(sameTarget(target({ reps: 10 }), null)).toBeFalse();
    });
  });

  describe('the tempo of an exercise', () => {
    it('defaults by the kind of exercise', () => {
      expect(defaultTempoSeconds('STRENGTH')).toBe(3);
      expect(defaultTempoSeconds('MOBILITY')).toBe(4);
      expect(defaultTempoSeconds('CARDIO')).toBe(2.5);
      expect(defaultTempoSeconds('SPORT')).toBe(2.5);
      expect(defaultTempoSeconds(null)).toBe(3);
    });

    it('takes the copy of the workout first, then the plan, then the default', () => {
      expect(resolveTempoSeconds({ tempoSeconds: 2 }, { tempoSeconds: 4 }, 'STRENGTH')).toBe(2);
      expect(resolveTempoSeconds({ tempoSeconds: null }, { tempoSeconds: 4 }, 'STRENGTH')).toBe(4);
      expect(resolveTempoSeconds(null, null, 'MOBILITY')).toBe(4);
      expect(resolveTempoSeconds({ tempoSeconds: 0 }, null, 'CARDIO')).toBe(2.5);
    });
  });
});
