import {
  ExerciseHistoryEntry,
  MuscleGroupInsight,
  NextTraining,
  WeeklyTrainingInsight,
  WorkoutPlanExercise,
  WorkoutSession
} from '../../../core/fitsync.models';
import {
  FocusFacts,
  FocusTarget,
  buildFocus,
  dayLabel,
  figureCaption,
  lastTimeLine,
  setsFromMoves,
  sportGroups,
  strengthLine
} from './today-focus';

const TODAY = '2026-10-06';
const zoneKey = (value: string): string => value.slice(0, 10);

function move(name: string, overrides: Partial<WorkoutPlanExercise> = {}): WorkoutPlanExercise {
  return {
    exerciseId: `ex-${name}`,
    exerciseNameSnapshot: name,
    sequence: 1,
    targetSets: 3,
    targetReps: 10,
    targetWeightKg: null,
    targetDurationSeconds: null,
    targetDistanceKm: null,
    restSeconds: 75,
    notes: '',
    setTargets: [],
    ...overrides
  };
}

function entry(overrides: Partial<ExerciseHistoryEntry>): ExerciseHistoryEntry {
  return {
    sessionId: 's1',
    exerciseLogId: 'l1',
    setLogId: 'x',
    exerciseId: 'ex-Bench',
    exerciseNameSnapshot: 'Bench',
    sessionName: 'Full body',
    startedAt: '2026-09-28T10:00:00Z',
    completedAt: '2026-09-28T11:00:00Z',
    sequence: 1,
    setNumber: 1,
    reps: 10,
    weightKg: 20,
    durationSeconds: null,
    distanceKm: null,
    restSeconds: 75,
    perceivedExertion: null,
    notes: '',
    ...overrides
  };
}

function group(overrides: Partial<MuscleGroupInsight>): MuscleGroupInsight {
  return { muscleGroup: 'CHEST', sessionsThisWeek: 0, inActivePlan: true, trainedYesterday: false, lastTrainedOn: null, consecutiveSessions: 0, exerciseNames: [], ...overrides };
}

function insight(overrides: Partial<WeeklyTrainingInsight> = {}): WeeklyTrainingInsight {
  return {
    timezone: 'Asia/Singapore',
    referenceDate: TODAY,
    weekStart: '2026-10-05',
    weekEnd: '2026-10-11',
    completedSessions: 1,
    totalMinutes: 50,
    previousWeekCompletedSessions: 0,
    previousWeekTotalMinutes: 0,
    muscleGroups: [],
    volume: { thisWeekKg: 0, previousWeekKg: 0, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 0 },
    days: null,
    today: null,
    nextTraining: null,
    ...overrides
  };
}

function session(overrides: Partial<WorkoutSession>): WorkoutSession {
  return {
    sessionId: 'a',
    name: 'Treadmill',
    workoutType: 'CARDIO',
    status: 'COMPLETED',
    startedAt: '2026-10-01T10:00:00Z',
    completedAt: '2026-10-01T10:35:00Z',
    durationMinutes: 35,
    caloriesBurned: 300,
    exerciseCount: 1,
    ...overrides
  };
}

function facts(overrides: Partial<FocusFacts> = {}): FocusFacts {
  return { insight: null, next: null, moves: [], history: [], runs: [], ...overrides };
}

function target(overrides: Partial<FocusTarget>): FocusTarget {
  return { kind: 'strength', title: 'Full body', label: 'Strength', minutes: 50, moves: [], today: TODAY, ...overrides };
}

describe('the coach line of a strength day', () => {
  const input = { leadMove: 'Dumbbell bench press', daysRested: 8, trainedYesterday: false, leadGroup: 'CHEST', planNote: 'Full body is on the plan today.' };

  it('takes the lead move to the top of its range after a week or more of rest', () => {
    expect(strengthLine(input)).toBe('Rested eight days, so take the dumbbell bench press to the top of its range today.');
    expect(strengthLine({ ...input, daysRested: 7 })).toContain('Rested seven days');
  });

  it('keeps it easy when the lead group was trained yesterday', () => {
    expect(strengthLine({ ...input, daysRested: 1, trainedYesterday: true })).toBe('Chest was trained yesterday, so keep it easy today.');
  });

  it('gives the plan note otherwise, and when the group was never trained', () => {
    expect(strengthLine({ ...input, daysRested: 3 })).toBe('Full body is on the plan today.');
    expect(strengthLine({ ...input, daysRested: null })).toBe('Full body is on the plan today.');
  });
});

describe('the figure of a strength day', () => {
  it('counts a primary group fully and a secondary group by half', () => {
    const moves = [move('Bench', { targetSets: 4 }), move('Row', { targetSets: 2 })];
    const sets = setsFromMoves(moves, [
      { exerciseId: 'ex-Bench', primary: ['CHEST'], secondary: ['ARMS'], history: [] },
      { exerciseId: 'ex-Row', primary: ['BACK'], secondary: ['ARMS'], history: [] }
    ]);
    expect(sets).toEqual({ CHEST: 4, ARMS: 3, BACK: 2 });
  });

  it('names the groups by sets, three first and the rest after a dot', () => {
    expect(figureCaption({ CHEST: 6, LEGS: 5, BACK: 4, CORE: 3 })).toBe('Chest, legs, back · core');
    expect(figureCaption({})).toBe('');
  });
});

describe('last time with a move', () => {
  it('writes the sets, the heaviest reps and weight, and the date', () => {
    const history = [entry({ setNumber: 1 }), entry({ setNumber: 2, setLogId: 'y' }), entry({ setNumber: 3, setLogId: 'z' }), entry({ sessionId: 'old', startedAt: '2026-09-01T10:00:00Z', completedAt: '2026-09-01T11:00:00Z' })];
    expect(lastTimeLine('Bench', history)).toBe('Bench · 3 × 10 at 20 kg · Mon 28 Sept');
  });

  it('writes a timed move in seconds and a move never logged plainly', () => {
    expect(lastTimeLine('Plank', [entry({ reps: null, weightKg: null, durationSeconds: 45 })])).toBe('Plank · 1 × 45 s · Mon 28 Sept');
    expect(lastTimeLine('Row', [])).toBe('Row · not logged yet');
  });
});

describe('buildFocus', () => {
  it('builds a strength day with the figure, the last time per move, the days rested and the line', () => {
    const model = buildFocus(
      target({ moves: [move('Bench', { targetSets: 4 })] }),
      facts({
        insight: insight({ muscleGroups: [group({ muscleGroup: 'CHEST', lastTrainedOn: '2026-09-28' })] }),
        moves: [{ exerciseId: 'ex-Bench', primary: ['CHEST'], secondary: [], history: [entry({})] }]
      }),
      zoneKey
    );
    expect(model.sets).toEqual({ CHEST: 4 });
    expect(model.caption).toBe('Chest');
    expect(model.heading).toBe('Last time with these moves');
    expect(model.rows.map((row) => row.text)).toEqual(['Bench · 1 × 10 at 20 kg · Mon 28 Sept', 'Last trained Mon 28 Sept, 8 days ago']);
    expect(model.coach).toBe('Rested eight days, so take the bench to the top of its range today.');
  });

  it('builds a cardio day with the planned segments, the target and the last three runs', () => {
    const runs = [session({ completedAt: '2026-10-01T10:35:00Z', durationMinutes: 35, distanceKm: 5.75 }), session({ completedAt: '2026-09-29T10:35:00Z', durationMinutes: 30, distanceKm: 5 }), session({ completedAt: '2026-09-26T10:35:00Z', durationMinutes: 29, distanceKm: 5 })];
    const model = buildFocus(
      target({
        kind: 'cardio',
        title: 'Easy run',
        minutes: 30,
        moves: [
          move('Warm-up', { targetDurationSeconds: 300, notes: 'walk, then an easy jog' }),
          move('Steady', { targetDurationSeconds: 1200, notes: 'easy pace' }),
          move('Cool-down', { targetDurationSeconds: 300, notes: 'slow jog' })
        ]
      }),
      facts({ runs, insight: insight({ muscleGroups: [group({ muscleGroup: 'LEGS', trainedYesterday: true })] }) }),
      zoneKey
    );
    expect(model.bar?.parts.map((part) => part.name)).toEqual(['Warm-up', 'Steady', 'Cool-down']);
    expect(model.bar?.target).toBe('30 min · Easy pace');
    expect(model.heading).toBe('Your last three runs');
    expect(model.rows.length).toBe(3);
    expect(model.rows[0].text).toBe('Thu 1 Oct');
    expect(model.rows[0].right).toContain('5.75 km');
    expect(model.coach).toBe('Legs worked yesterday, keep it easy today.');
  });

  it('builds a sport day: the sport main muscles, last time, yesterday and its card block', () => {
    const played = session({ name: 'Badminton', sportLabel: 'Badminton', completedAt: '2026-09-29T10:00:00Z', startedAt: '2026-09-29T09:00:00Z', durationMinutes: 60, perceivedExertion: 6 });
    const yesterday = session({ name: 'Full Body Strength', completedAt: '2026-10-05T10:00:00Z', durationMinutes: 50 });
    const model = buildFocus(target({ kind: 'sport', label: 'Badminton', minutes: 60 }), facts({ history: [yesterday, played] }), zoneKey);
    expect(sportGroups('Badminton')).toEqual(['SHOULDERS', 'LEGS']);
    expect(model.light).toBeTrue();
    expect(model.caption).toBe('Shoulders and legs work hardest');
    expect(model.rows.map((row) => row.text)).toEqual(['Last time Tue 29 Sept · 1 h · effort 6 of 10', 'Yesterday: Full Body Strength, 50 min']);
    expect(model.cardBlock?.kind).toBe('sport');
    expect(model.cardBlock?.usual).toBe('Usually Tuesdays · 1 h · counts as cardio');
    expect(model.cardBlock?.dots?.map((dot) => dot.state)).toEqual(['missed', 'missed', 'missed', 'played']);
    expect(model.cardBlock?.month).toBe('This month · 1 session · 50 min');
  });

  it('builds a rest day: what is recovering, the week so far, the rest of the week and the next day', () => {
    const next: NextTraining = { date: '2026-10-07', kind: 'CARDIO', label: 'Cardio', title: 'Easy run', estimatedMinutes: 30 };
    const model = buildFocus(
      target({ kind: 'rest', title: 'Rest day', moves: [] }),
      facts({
        next,
        insight: insight({
          muscleGroups: [group({ muscleGroup: 'CHEST', lastTrainedOn: '2026-09-28' }), group({ muscleGroup: 'BACK', lastTrainedOn: '2026-09-28' }), group({ muscleGroup: 'LEGS', lastTrainedOn: '2026-09-20' })],
          days: [
            { date: '2026-10-07', dayOfWeek: 3, kind: 'CARDIO', label: 'Cardio', source: 'PLAN', minutes: null, sessions: [], planned: { planDayId: 'p', kind: 'CARDIO', title: 'Easy run', sportActivity: null, estimatedMinutes: 30, moves: 3, fulfilled: false } },
            { date: '2026-10-04', dayOfWeek: 7, kind: 'REST', label: 'Rest', source: 'PLAN', minutes: null, sessions: [], planned: null }
          ]
        })
      }),
      zoneKey
    );
    expect(model.light).toBeTrue();
    expect(model.caption).toBe('Recovering: chest and back');
    expect(model.rows.map((row) => row.text)).toEqual(['Chest and back: eight days since their last session', 'This week so far · 1 session · 50 min']);
    expect(model.cardBlock?.week).toEqual([{ weekday: 'Wed', kind: 'CARDIO', title: 'Cardio', minutes: '30 min' }]);
    expect(model.coach).toBe('A rest day counts. Tomorrow is the easy run.');
  });

  it('labels a date from its key without a zone shift', () => {
    expect(dayLabel('2026-10-06')).toBe('Tue 6 Oct');
  });
});
