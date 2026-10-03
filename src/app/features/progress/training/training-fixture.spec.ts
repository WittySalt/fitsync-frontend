import { mapTrainingProgress } from './training-mappers';
import { TrainingProgress } from './training.models';

/** A training response in the contract's shape, the board's four weeks of 6 Sept to 3 Oct 2026. */
export const TRAINING_WIRE = {
  period: { from: '2026-09-06', to: '2026-10-03' },
  previous: { from: '2026-08-09', to: '2026-09-05' },
  hero: {
    sessions: { value: 15, previous: 13 },
    minutes: { value: 710, previous: 640 },
    load: { value: 4320, previous: 3960, estimatedShare: 0.2 },
    records: { value: 4, exercises: ['Deadlift', 'Squat'] }
  },
  highlights: [
    { code: 'LIFT_UP', title: "Your deadlift's estimated best single is up 14% in four weeks.", series: [{ label: '8 Sept', value: 81.7 }, { label: '2 Oct', value: 93.3 }], unit: 'kg', context: '+11.6 kg compared with 8 Sept' },
    { code: 'PACE_FASTER', title: 'You run a kilometre 20 seconds faster.', series: [{ label: '10 Sept', value: 370 }, { label: '1 Oct', value: 350 }], unit: 'secPerKm', context: 'Treadmill at your usual effort' },
    { code: 'MUSCLE_UNDER', title: 'Shoulders had 3 hard sets a week, the fewest of any group.', series: [{ label: 'Shoulders', value: 3 }], unit: 'sets', context: 'A usual range is 10 to 20 hard sets a week' },
    { code: 'LOAD_TREND', title: 'Load rose for two weeks, and this week is lighter so far.', series: [{ label: '7 Sept', value: 1060 }, { label: '28 Sept', value: 720 }], unit: 'load', context: '+9% on the 4 weeks before' }
  ],
  activities: [
    {
      key: 'STRENGTH', name: 'Strength', sessions: 6, minutes: 290,
      cumulativeMinutes: [{ date: '2026-09-08', minutes: 50 }, { date: '2026-09-15', minutes: 95 }],
      summary: [{ text: 'e1RM +13% across four lifts', trend: 'UP' }, { text: 'Volume 1.9 t a week', trend: 'STEADY' }, { text: '1 or 2 sessions a week', trend: 'STEADY' }],
      context: '−10 min on the 4 weeks before'
    },
    {
      key: 'SPORT:badminton', name: 'Badminton', sessions: 4, minutes: 245,
      cumulativeMinutes: [{ date: '2026-09-06', minutes: 60 }],
      summary: [{ text: 'Once a week, 5 weeks in a row', trend: 'STEADY' }],
      context: '+1 h 10 on the 4 weeks before'
    }
  ],
  load: {
    weeks: [
      { weekStart: '2026-09-07', byKind: { STRENGTH: 600, CARDIO: 260, SPORT: 200 }, total: 1060, estimated: false },
      { weekStart: '2026-09-14', byKind: { STRENGTH: 720, CARDIO: 300, SPORT: 220 }, total: 1240, estimated: false },
      { weekStart: '2026-09-28', byKind: { STRENGTH: 460, CARDIO: 260 }, total: 720, estimated: true }
    ],
    fitness: [{ weekStart: '2026-09-07', value: 990 }, { weekStart: '2026-09-14', value: 1040 }, { weekStart: '2026-09-28', value: 1070 }],
    fatigue: [{ weekStart: '2026-09-07', value: 1000 }, { weekStart: '2026-09-14', value: 1180 }, { weekStart: '2026-09-28', value: 600 }],
    form: 'FRESH'
  },
  muscles: {
    weeksCounted: 4,
    groups: [
      { group: 'LEGS', setsPerWeek: 22, exercises: [{ exerciseId: 'sq', name: 'Squat', sets: 8 }, { exerciseId: 'rdl', name: 'Romanian deadlift', sets: 6 }] },
      { group: 'SHOULDERS', setsPerWeek: 3, exercises: [{ exerciseId: 'ohp', name: 'Overhead press', sets: 3 }] },
      { group: 'CHEST', setsPerWeek: 14, exercises: [] }
    ],
    usualRange: { low: 10, high: 20 }
  },
  lifts: [
    {
      exerciseId: 'dl', name: 'Deadlift',
      e1rm: [{ date: '2026-09-08', value: 81.67, isRecord: false }, { date: '2026-09-15', value: 87.5, isRecord: true }, { date: '2026-10-02', value: 93.33, isRecord: true }],
      bestSet: { weightKg: 80, reps: 5, date: '2026-10-02' }, changePct: 14.3,
      relative: null, bodyWeightKg: 71.2, bestBefore: 85
    },
    {
      exerciseId: 'sq', name: 'Squat',
      e1rm: [{ date: '2026-09-08', value: 72, isRecord: false }, { date: '2026-10-02', value: 81, isRecord: true }],
      bestSet: { weightKg: 67.5, reps: 6, date: '2026-10-02' }, changePct: null,
      relative: { ratio: 1.14, level: 'INTERMEDIATE', nextLevel: 'ADVANCED', nextAtKg: 89 }, bodyWeightKg: 71.2
    }
  ],
  calendar: [
    { date: '2026-09-08', kind: 'STRENGTH', minutes: 50, record: false, sessionId: 's-1' },
    { date: '2026-09-15', kind: 'STRENGTH', minutes: 45, record: true },
    { date: '2026-10-02', kind: 'STRENGTH', minutes: 50, record: true }
  ],
  records: [
    { date: '2026-09-15', exerciseId: 'dl', name: 'Deadlift', value: 87.5, unit: 'kg', delta: 2.5 },
    { date: '2026-10-02', exerciseId: 'dl', name: 'Deadlift', value: 93.3, unit: 'kg', delta: 5.8 }
  ]
};

export function trainingFixture(): TrainingProgress {
  return mapTrainingProgress(JSON.parse(JSON.stringify(TRAINING_WIRE)), '2026-09-06', '2026-10-03');
}

describe('training fixture', () => {
  it('maps to a full page', () => {
    const progress = trainingFixture();
    expect(progress.lifts.length).toBe(2);
    expect(progress.highlights.length).toBe(4);
  });
});
