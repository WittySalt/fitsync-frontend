import { WorkoutExerciseSetLog, WorkoutSessionDetail } from '../../core/fitsync.models';
import { NONE, clock, recordExercises, recordStats, restCell, setValues } from './session-record';

function row(setNumber: number, values: Partial<WorkoutExerciseSetLog> = {}): WorkoutExerciseSetLog {
  return {
    setLogId: `set-${setNumber}`,
    setNumber,
    status: 'DONE',
    reps: 10,
    weightKg: 20,
    durationSeconds: null,
    distanceKm: null,
    restSeconds: 75,
    perceivedExertion: null,
    logged: true,
    notes: '',
    restTakenSeconds: null,
    ...values
  };
}

function session(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-1',
    name: 'Full Body Strength',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-10-01T13:13:00Z',
    completedAt: '2026-10-01T14:01:00Z',
    durationMinutes: 48,
    caloriesBurned: 290,
    caloriesEstimated: true,
    perceivedExertion: 6,
    effortEstimated: true,
    exerciseCount: 2,
    notes: '',
    createdAt: '',
    updatedAt: '',
    exercises: [
      {
        exerciseLogId: 'log-squat', exerciseId: 'ex-squat', exerciseNameSnapshot: 'Goblet Squat', sequence: 2,
        performedSets: 2, performedReps: 22, totalVolumeKg: 352, distanceKm: null, durationSeconds: null,
        averageHeartRate: null, maxHeartRate: null, notes: '',
        sets: [
          row(1, { reps: 12, weightKg: 16, restTakenSeconds: 80 }),
          row(2, { reps: 10, weightKg: 16, restTakenSeconds: 41 }),
          row(3, { status: 'PENDING', logged: false, reps: 12, weightKg: 16 })
        ]
      },
      {
        exerciseLogId: 'log-bench', exerciseId: 'ex-bench', exerciseNameSnapshot: 'Dumbbell Bench Press', sequence: 1,
        performedSets: 0, performedReps: 0, totalVolumeKg: null, distanceKm: null, durationSeconds: null,
        averageHeartRate: null, maxHeartRate: null, notes: '',
        sets: [row(1, { status: 'SKIPPED', logged: false }), row(2, { status: 'PENDING', logged: false })]
      }
    ],
    ...overrides
  };
}

describe('session record', () => {
  it('writes what a set did as reps by weight, reps, time or distance, and the dash when nothing', () => {
    expect(setValues(row(1))).toBe('10 × 20 kg');
    expect(setValues(row(1, { weightKg: null }))).toBe('10 reps');
    expect(setValues(row(1, { reps: null, weightKg: null, durationSeconds: 45 }))).toBe('0:45');
    expect(setValues(row(1, { reps: null, weightKg: null, durationSeconds: 1800, distanceKm: 5.75 }))).toBe('30:00 · 5.75 km');
    expect(setValues(row(1, { reps: null, weightKg: null }))).toBe(NONE);
    expect(clock(72)).toBe('1:12');
  });

  it('shows the rest taken, names the plan only when they differ enough, and keeps an untimed plan quiet', () => {
    expect(restCell(row(1, { restTakenSeconds: 72 }), 'done')).toEqual({ text: '1:12' });
    expect(restCell(row(1, { restTakenSeconds: 41 }), 'done')).toEqual({ text: '0:41', note: '75 planned' });
    expect(restCell(row(1), 'done')).toEqual({ text: '1:15', note: 'planned', muted: true });
    expect(restCell(row(1, { restSeconds: null }), 'done')).toEqual({ text: NONE, muted: true });
    expect(restCell(row(1, { restTakenSeconds: 41 }), 'skipped')).toEqual({ text: NONE, muted: true });
  });

  it('lists the exercises in order, marks every set, folds one that was not touched, and shows only full columns', () => {
    const [bench, squat] = recordExercises(session());

    expect(bench.name).toBe('Dumbbell Bench Press');
    expect(bench.untouched).toBeTrue();
    expect(bench.summary).toBe('0 of 2 sets');

    expect(squat.summary).toBe('2 of 3 sets done · 22 reps · 352 kg');
    expect(squat.rows.map((item) => item.state)).toEqual(['done', 'done', 'open']);
    expect(squat.rows.map((item) => item.done.text)).toEqual(['12 × 16 kg', '10 × 16 kg', 'Not done']);
    expect(squat.columns).toEqual({ rest: true, rpe: false, notes: false });
    expect(squat.rows[0].rpe).toBeNull();
    expect(squat.rows[1].rest).toEqual({ text: '0:41', note: '75 planned' });
  });

  it('shows the RPE and notes columns once one set holds them, and a timed exercise by its time', () => {
    const plank = session({
      exercises: [{
        ...session().exercises[0],
        exerciseNameSnapshot: 'Plank Hold',
        sets: [
          row(1, { reps: null, weightKg: null, durationSeconds: 45, perceivedExertion: 7, notes: 'Shaky' }),
          row(2, { reps: null, weightKg: null, durationSeconds: 45 })
        ]
      }]
    });

    const [only] = recordExercises(plank);

    expect(only.doneHeading).toBe('Time');
    expect(only.summary).toBe('2 of 2 sets done · 1:30 held');
    expect(only.columns).toEqual({ rest: true, rpe: true, notes: true });
    expect(only.rows[1].rpe).toEqual({ text: NONE, muted: true });
  });

  it('gives the figures of the page with the estimates named and the dash for what is missing', () => {
    expect(recordStats(session()).map((stat) => [stat.label, stat.value, stat.unit, stat.note])).toEqual([
      ['Duration', '48', 'min', ''],
      ['Sets', '2', 'of 5', ''],
      ['Volume', '352', 'kg', ''],
      ['Calories', '290', 'kcal', 'estimated'],
      ['Effort', '6', 'of 10', 'estimated']
    ]);
    const cancelled = recordStats(session({ status: 'CANCELLED', perceivedExertion: null, distanceKm: 5.2, caloriesEstimated: false }));
    expect(cancelled.find((stat) => stat.label === 'Effort')).toEqual({ label: 'Effort', value: NONE, unit: '', note: '' });
    expect(cancelled.find((stat) => stat.label === 'Distance')?.value).toBe('5.2');
    expect(cancelled.find((stat) => stat.label === 'Calories')?.note).toBe('');
  });
});
