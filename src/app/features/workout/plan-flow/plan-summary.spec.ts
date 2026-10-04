import { hasBackToBackStrength, isOverProfile, localGroupSets, readingLines, weekMinutes } from './plan-coverage';
import { DEFAULT_PROFILE, DraftDay, DraftMove, emptyDay, emptyWeek } from './plan-draft';
import { currentPlanNote, derivePlanType, reviewRows, shortWeekLine, suggestPlanName, weekFigures, weekSummaryLine } from './plan-summary';

function move(over: Partial<DraftMove> = {}): DraftMove {
  return {
    exerciseId: 'e1',
    name: 'Dumbbell Bench Press',
    meta: 'chest',
    imageUrl: null,
    timed: false,
    sets: 3,
    reps: 10,
    durationSeconds: null,
    weightKg: null,
    restSeconds: 75,
    tempoSeconds: null,
    notes: '',
    ...over
  };
}

function week(spec: Record<number, Partial<DraftDay>>): DraftDay[] {
  return emptyWeek().map((day) => ({ ...day, ...(spec[day.dayOfWeek] ?? {}) }));
}

const strength = (title: string, minutes = 45, moves: DraftMove[] = [move()]): Partial<DraftDay> => ({ kind: 'STRENGTH', title, minutes, moves });
const cardio: Partial<DraftDay> = { kind: 'CARDIO', title: 'Easy run', minutes: 30, location: 'TREADMILL', effort: 'EASY' };
const sport: Partial<DraftDay> = { kind: 'SPORT', title: 'Badminton', minutes: 60, effort: 'MODERATE', sportActivity: 'BADMINTON' };

describe('review figures', () => {
  const days = week({ 1: strength('Full body A'), 2: cardio, 4: strength('Full body B', 45, [move(), move({ sets: 4 })]), 6: sport });

  it('counts days by kind, minutes, moves and sets a week', () => {
    expect(weekFigures(days)).toEqual({
      trainingDays: 4,
      strengthDays: 2,
      cardioDays: 1,
      sportDays: 1,
      mobilityDays: 0,
      minutes: 180,
      moves: 3,
      setsPerWeek: 10
    });
  });

  it('counts a timed move as one set when it has no sets', () => {
    const figures = weekFigures(week({ 7: { kind: 'MOBILITY', title: 'Flow', minutes: 20, moves: [move({ timed: true, sets: null, durationSeconds: 40, reps: null })] } }));
    expect(figures.setsPerWeek).toBe(1);
    expect(figures.moves).toBe(1);
  });

  it('words the one line the narrow panel folds to', () => {
    expect(shortWeekLine(weekFigures(days))).toBe('2 strength · 1 cardio · 1 sport · 180 min');
  });

  it('words the summary line against the profile', () => {
    expect(weekSummaryLine(weekFigures(days), { ...DEFAULT_PROFILE, weeklyWorkoutDays: 4, preferredDurationMinutes: 45 })).toBe(
      '4 days · 2 strength · 1 cardio · 1 sport · 180 min a week. Your profile says 4 days and 45 min.'
    );
  });

  it('says one day, not one days', () => {
    expect(weekSummaryLine(weekFigures(week({ 1: strength('Full body') })), DEFAULT_PROFILE)).toContain('1 day ·');
  });
});

describe('plan name and type', () => {
  it('suggests the names the board shows', () => {
    expect(suggestPlanName(week({ 1: strength('Upper'), 2: cardio, 4: strength('Lower'), 5: strength('Full') }))).toBe('Strength and running, 4 days');
    expect(suggestPlanName(week({ 1: strength('Full body A'), 3: strength('Full body B'), 5: strength('Full body C') }))).toBe('Full body, 3 days');
    expect(suggestPlanName(week({ 1: cardio, 3: { ...cardio, title: 'Long run' }, 6: sport }))).toBe('Running and badminton, 3 days');
    expect(suggestPlanName(emptyWeek())).toBe('');
  });

  it('names cardio that is not a run as cardio', () => {
    expect(suggestPlanName(week({ 1: strength('Upper'), 3: { ...cardio, title: 'Bike' } }))).toBe('Strength and cardio, 2 days');
  });

  it('derives the plan type from the kinds present', () => {
    expect(derivePlanType(week({ 1: strength('A'), 3: strength('B') }))).toBe('STRENGTH');
    expect(derivePlanType(week({ 1: cardio }))).toBe('CARDIO');
    expect(derivePlanType(week({ 1: cardio, 2: sport }))).toBe('CARDIO');
    expect(derivePlanType(week({ 1: { kind: 'MOBILITY', title: 'Flow', minutes: 20 } }))).toBe('MOBILITY');
    expect(derivePlanType(week({ 1: strength('A'), 3: cardio }))).toBe('MIXED');
  });

  it('keeps the note about the current plan to when it applies', () => {
    expect(currentPlanNote('Recomp Strength + Cardio')).toBe('Your current plan is Recomp Strength + Cardio; switching archives nothing.');
    expect(currentPlanNote(null)).toBe('');
  });
});

describe('review rows', () => {
  it('writes the moves, the cardio line and the sport line as plain text', () => {
    const rows = reviewRows(week({ 1: strength('Full body A'), 2: cardio, 6: sport }));
    expect(rows.length).toBe(3);
    expect(rows[0].meta).toBe('Strength · 45 min');
    expect(rows[0].lines).toEqual(['Dumbbell Bench Press 3 × 10']);
    expect(rows[1].lines).toEqual(['30 min · treadmill']);
    expect(rows[2].lines).toEqual(['Badminton · 60 min · moderate']);
  });

  it('writes a timed move in seconds', () => {
    const rows = reviewRows(week({ 7: { kind: 'MOBILITY', title: 'Flow', minutes: 20, moves: [move({ name: 'Cat Cow', timed: true, sets: 2, durationSeconds: 40, reps: null })] } }));
    expect(rows[0].lines).toEqual(['Cat Cow 2 × 40 s']);
  });

  it('leaves rest days out', () => {
    expect(reviewRows(emptyWeek())).toEqual([]);
  });
});

describe('coverage reading lines', () => {
  const profile = { ...DEFAULT_PROFILE, weeklyWorkoutDays: 3, preferredDurationMinutes: 40 };

  it('notices two strength days back to back, and Sunday against Monday', () => {
    expect(hasBackToBackStrength(week({ 1: strength('A'), 2: strength('B') }))).toBeTrue();
    expect(hasBackToBackStrength(week({ 1: strength('A'), 7: strength('B') }))).toBeTrue();
    expect(hasBackToBackStrength(week({ 1: strength('A'), 3: strength('B') }))).toBeFalse();
    expect(hasBackToBackStrength(week({ 1: strength('A') }))).toBeFalse();
  });

  it('calls minutes a week over the profile only at 50 percent or more', () => {
    const under = week({ 1: strength('A', 60), 3: strength('B', 60) });
    const over = week({ 1: strength('A', 60), 3: strength('B', 60), 5: strength('C', 60) });
    expect(isOverProfile(under, profile)).toBeFalse();
    expect(isOverProfile(over, profile)).toBeTrue();
    expect(weekMinutes(over)).toBe(180);
  });

  it('shows at most two lines, in the preferred order, once each', () => {
    const days = week({ 1: strength('A', 90), 2: strength('B', 90), 5: strength('C', 90) });
    const lines = readingLines(
      [{ code: 'CALVES_NOT_TRAINED', text: '' }, { code: 'STRENGTH_BACK_TO_BACK', text: '' }, { code: 'NO_VERTICAL_PULL', text: '' }],
      days,
      profile
    );
    expect(lines).toEqual(['Two strength days back to back.', 'Calves are not trained yet.']);
  });

  it('words each server note in the panel voice', () => {
    const lines = readingLines([{ code: 'NO_VERTICAL_PULL', text: 'x' }], emptyWeek(), profile);
    expect(lines).toEqual(['No pull from above yet (lats).']);
    expect(readingLines([{ code: 'SHOULDERS_HELPER_ONLY', text: 'x' }], emptyWeek(), profile)).toEqual(['Shoulders only as a helper.']);
    expect(readingLines([{ code: 'UNKNOWN', text: 'x' }], emptyWeek(), profile)).toEqual([]);
  });

  it('sums hard sets from the moves own muscle data, primary 1 and secondary 0.5', () => {
    const days = week({ 1: strength('A', 45, [move({ sets: 4, primaryGroups: ['CHEST'], secondaryGroups: ['ARMS'] })]) });
    expect(localGroupSets(days)).toEqual({ CHEST: 4, ARMS: 2 });
    expect(localGroupSets(week({ 1: { ...emptyDay(1), kind: 'CARDIO' } }))).toEqual({});
  });
});
