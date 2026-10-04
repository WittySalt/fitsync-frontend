import { DEFAULT_PROFILE, DraftDay, DraftMove, DraftPlan, emptyPlan, emptyWeek } from './plan-draft';
import { buildSaveRequest, dayProblem, firstDayProblem, reviewProblem } from './plan-save';
import { defaultSegments, setIntervals } from './segments/segment-math';

const move = (over: Partial<DraftMove> = {}): DraftMove => ({
  exerciseId: 'ex-1',
  name: 'Goblet Squat',
  meta: 'legs',
  imageUrl: null,
  timed: false,
  sets: 3,
  reps: 10,
  durationSeconds: null,
  weightKg: 20,
  restSeconds: 75,
  tempoSeconds: 3,
  notes: ' pause at the bottom ',
  ...over
});

function plan(spec: Record<number, Partial<DraftDay>>, over: Partial<DraftPlan> = {}): DraftPlan {
  const base = emptyPlan();
  return {
    ...base,
    name: ' Strength and running, 3 days ',
    description: ' Easy start ',
    planType: 'MIXED',
    days: emptyWeek().map((day) => ({ ...day, ...(spec[day.dayOfWeek] ?? {}) })),
    ...over
  };
}

const strengthDay: Partial<DraftDay> = { kind: 'STRENGTH', title: 'Full body A', minutes: 45, moves: [move()] };
const cardioDay: Partial<DraftDay> = {
  kind: 'CARDIO',
  title: 'Easy run',
  minutes: 40,
  targetKind: 'DISTANCE',
  targetValue: 5,
  location: 'OUTDOOR',
  effort: 'MODERATE',
  segments: defaultSegments(40)
};
const sportDay: Partial<DraftDay> = { kind: 'SPORT', title: 'Badminton', minutes: 60, sportActivity: 'BADMINTON', effort: 'HARD', segments: defaultSegments(60) };

describe('the save payload', () => {
  const request = buildSaveRequest(plan({ 1: strengthDay, 3: cardioDay, 6: sportDay }), { ...DEFAULT_PROFILE, fitnessLevel: 'intermediate' });

  it('leaves rest days out and keeps the weekday of the rest', () => {
    expect(request.days.map((day) => day.dayOfWeek)).toEqual([1, 3, 6]);
  });

  it('carries the plan fields the server needs, trimmed', () => {
    expect(request.name).toBe('Strength and running, 3 days');
    expect(request.description).toBe('Easy start');
    expect(request.workoutType).toBe('CUSTOM');
    expect(request.goalFocus).toBe('GENERAL_FITNESS');
    expect(request.difficulty).toBe('INTERMEDIATE');
    expect(request.estimatedDurationMinutes).toBe(48);
    expect(request.exercises).toEqual([]);
  });

  it('maps a strength day to SET entries in order', () => {
    const day = request.days[0];
    expect(day.kind).toBe('STRENGTH');
    expect(day.targetKind).toBeNull();
    expect(day.entries).toEqual([
      {
        entryType: 'SET',
        position: 1,
        exerciseId: 'ex-1',
        targetSets: 3,
        targetReps: 10,
        targetDurationSeconds: null,
        targetWeightKg: 20,
        restSeconds: 75,
        tempoSeconds: 3,
        notes: 'pause at the bottom'
      }
    ]);
  });

  it('maps a timed move to seconds and no reps', () => {
    const timed = buildSaveRequest(plan({ 7: { kind: 'MOBILITY', title: 'Flow', minutes: 20, moves: [move({ timed: true, reps: null, durationSeconds: 40, weightKg: null })] } }), DEFAULT_PROFILE);
    const entry = timed.days[0].entries[0];
    expect(entry.targetReps).toBeNull();
    expect(entry.targetDurationSeconds).toBe(40);
  });

  it('maps a cardio day to its target, place, effort and SEGMENT entries', () => {
    const day = request.days[1];
    expect(day.targetKind).toBe('DISTANCE');
    expect(day.targetValue).toBe(5);
    expect(day.location).toBe('OUTDOOR');
    expect(day.effortTarget).toBe(6);
    expect(day.entries.map((entry) => [entry.entryType, entry.kind, entry.plannedSeconds, entry.rounds])).toEqual([
      ['SEGMENT', 'WARMUP', 300, null],
      ['SEGMENT', 'STEADY', 1800, null],
      ['SEGMENT', 'COOLDOWN', 300, null]
    ]);
    expect(day.entries.map((entry) => entry.position)).toEqual([1, 2, 3]);
  });

  it('maps interval rounds onto Work and Easy segments', () => {
    const intervals = buildSaveRequest(plan({ 3: { ...cardioDay, segments: setIntervals(defaultSegments(40), true, 5) } }), DEFAULT_PROFILE);
    const rows = intervals.days[0].entries.filter((entry) => entry.rounds);
    expect(rows.map((entry) => entry.kind)).toEqual(['WORK', 'EASY']);
    expect(rows.every((entry) => entry.rounds === 5)).toBeTrue();
  });

  it('maps a sport day to its activity, effort and segments, with no moves and no cardio target', () => {
    const day = request.days[2];
    expect(day.sportActivity).toBe('BADMINTON');
    expect(day.effortTarget).toBe(8);
    expect(day.targetKind).toBeNull();
    expect(day.location).toBeNull();
    expect(day.entries.every((entry) => entry.entryType === 'SEGMENT')).toBeTrue();
  });

  it('keeps the id of a day that came from the server, and none for a new one', () => {
    const edited = buildSaveRequest(plan({ 1: { ...strengthDay, planDayId: 'day-9' }, 3: strengthDay }), DEFAULT_PROFILE);
    expect(edited.days[0].planDayId).toBe('day-9');
    expect('planDayId' in edited.days[1]).toBeFalse();
  });

  it('falls back to beginner for a level it does not know, and maps every plan type', () => {
    expect(buildSaveRequest(plan({ 1: strengthDay }), { ...DEFAULT_PROFILE, fitnessLevel: 'ELITE' }).difficulty).toBe('BEGINNER');
    const types = (['STRENGTH', 'CARDIO', 'MIXED', 'MOBILITY'] as const).map((planType) => buildSaveRequest(plan({ 1: strengthDay }, { planType }), DEFAULT_PROFILE));
    expect(types.map((entry) => entry.workoutType)).toEqual(['STRENGTH', 'CARDIO', 'CUSTOM', 'MOBILITY']);
    expect(types.map((entry) => entry.goalFocus)).toEqual(['STRENGTH', 'ENDURANCE', 'GENERAL_FITNESS', 'MOBILITY']);
  });
});

describe('what has to be fixed before saving', () => {
  it('asks for a training day', () => {
    expect(firstDayProblem(plan({}))).toEqual({ dayOfWeek: null, message: 'Plan at least one training day.' });
  });

  it('points at the first day with a problem', () => {
    const problem = firstDayProblem(plan({ 1: strengthDay, 3: { ...strengthDay, title: '' }, 5: { ...strengthDay, moves: [] } }));
    expect(problem).toEqual({ dayOfWeek: 3, message: 'Give this day a name.' });
  });

  it('checks each kind of day for what it needs', () => {
    const day = (spec: Partial<DraftDay>) => ({ ...emptyWeek()[0], ...spec });
    expect(dayProblem(day({ kind: 'REST' }))).toBeNull();
    expect(dayProblem(day({ ...strengthDay, moves: [] }))).toBe('Add at least one move.');
    expect(dayProblem(day({ ...strengthDay, moves: [move({ exerciseId: '' })] }))).toBe('Every move needs an exercise.');
    expect(dayProblem(day({ ...strengthDay, minutes: 0 }))).toBe('Set a duration between 1 and 600 minutes.');
    expect(dayProblem(day({ ...sportDay, sportActivity: '' }))).toBe('Choose the sport.');
    expect(dayProblem(day({ ...cardioDay, segments: defaultSegments(20) }))).toBe('The segments have to add up to the duration.');
    expect(dayProblem(day(cardioDay))).toBeNull();
    expect(dayProblem(day(strengthDay))).toBeNull();
  });

  it('checks the name and description of the plan', () => {
    expect(reviewProblem(plan({ 1: strengthDay }, { name: '  ' }))).toBe('Give the plan a name.');
    expect(reviewProblem(plan({ 1: strengthDay }, { name: 'x'.repeat(121) }))).toContain('under 120');
    expect(reviewProblem(plan({ 1: strengthDay }, { description: 'x'.repeat(1001) }))).toContain('under 1000');
    expect(reviewProblem(plan({ 1: strengthDay }))).toBeNull();
  });
});
