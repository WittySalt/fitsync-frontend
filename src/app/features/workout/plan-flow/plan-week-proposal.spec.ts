import { DEFAULT_PROFILE, DraftDay, PlanProfile } from './plan-draft';
import { clampDays, habitsFromInsight, HabitActivity, proposeWeek, wantsCardio, wantsStrength, weekUntouched } from './plan-week-proposal';
import { segmentTotal } from './segments/segment-math';

const profile = (over: Partial<PlanProfile> = {}): PlanProfile => ({ ...DEFAULT_PROFILE, ...over });
const kinds = (days: DraftDay[]) => days.map((day) => day.kind);
const titles = (days: DraftDay[]) => days.filter((day) => day.kind !== 'REST').map((day) => day.title);
const trainingDays = (days: DraftDay[]) => days.filter((day) => day.kind !== 'REST').map((day) => day.dayOfWeek);

describe('the default week rule', () => {
  it('gives a beginner with four days, strength and cardio, three full body days and an easy run', () => {
    const week = proposeWeek(profile({ fitnessLevel: 'BEGINNER', weeklyWorkoutDays: 4, preferredDurationMinutes: 45, focusAreas: ['FULL_BODY', 'CARDIO'] }));
    expect(kinds(week)).toEqual(['STRENGTH', 'CARDIO', 'REST', 'STRENGTH', 'REST', 'STRENGTH', 'REST']);
    expect(titles(week)).toEqual(['Full body A', 'Easy run', 'Full body B', 'Full body C']);
    expect(week[1].minutes).toBe(30);
    expect(week[0].minutes).toBe(45);
  });

  it('keeps a rest day between strength days', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const week = proposeWeek(profile({ weeklyWorkoutDays: days }));
      const strength = week.filter((day) => day.kind === 'STRENGTH').map((day) => day.dayOfWeek);
      strength.forEach((day, index) => {
        if (index > 0) {
          expect(day - strength[index - 1]).toBeGreaterThan(1);
        }
      });
    }
  });

  it('uses upper, lower and full for people with some experience', () => {
    const week = proposeWeek(profile({ fitnessLevel: 'INTERMEDIATE', weeklyWorkoutDays: 3 }));
    expect(titles(week)).toEqual(['Upper', 'Lower', 'Full']);
  });

  it('plans exactly the days the profile asks for, between two and six', () => {
    expect(trainingDays(proposeWeek(profile({ weeklyWorkoutDays: 1 }))).length).toBe(2);
    expect(trainingDays(proposeWeek(profile({ weeklyWorkoutDays: 9 }))).length).toBe(6);
    expect(trainingDays(proposeWeek(profile({ weeklyWorkoutDays: 5 }))).length).toBe(5);
    expect(clampDays(null)).toBe(3);
  });

  it('puts a sport with a streak of three weeks on its weekday first', () => {
    const habit: HabitActivity = { sportActivity: 'BADMINTON', label: 'Badminton', dayOfWeek: 6, streakWeeks: 4, minutes: 90 };
    const week = proposeWeek(profile({ weeklyWorkoutDays: 4, focusAreas: ['FULL_BODY'] }), [habit]);
    expect(week[5].kind).toBe('SPORT');
    expect(week[5].title).toBe('Badminton');
    expect(week[5].minutes).toBe(90);
    expect(segmentTotal(week[5].segments)).toBe(90);
    expect(trainingDays(week).length).toBe(4);
    expect(week.filter((day) => day.kind === 'STRENGTH').length).toBe(3);
  });

  it('ignores a sport that has not run three weeks, and a weekday that is out of range', () => {
    const short: HabitActivity = { sportActivity: 'TENNIS', label: 'Tennis', dayOfWeek: 2, streakWeeks: 2, minutes: 60 };
    expect(proposeWeek(profile({ weeklyWorkoutDays: 3 }), [short]).some((day) => day.kind === 'SPORT')).toBeFalse();
    expect(habitsFromInsight({ activitySummaries: [{ sportActivity: 'X', dayOfWeek: 9, streakWeeks: 5 }] })).toEqual([]);
  });

  it('reserves a day for the run when cardio is a focus and three days are asked', () => {
    const week = proposeWeek(profile({ weeklyWorkoutDays: 3, focusAreas: ['UPPER', 'CARDIO'] }));
    expect(week.filter((day) => day.kind === 'STRENGTH').length).toBe(2);
    expect(week.filter((day) => day.kind === 'CARDIO').length).toBe(1);
  });

  it('puts the run on the first free day after a strength day', () => {
    const week = proposeWeek(profile({ weeklyWorkoutDays: 4, focusAreas: ['FULL_BODY', 'CARDIO'] }));
    const run = week.find((day) => day.kind === 'CARDIO')!;
    expect(week[run.dayOfWeek - 2].kind).toBe('STRENGTH');
    expect(run.segments.length).toBe(3);
    expect(run.targetKind).toBe('MINUTES');
  });

  it('fills what is left with mobility, starting on Sunday', () => {
    const week = proposeWeek(profile({ weeklyWorkoutDays: 4, focusAreas: ['FULL_BODY'] }));
    expect(week[6].kind).toBe('MOBILITY');
    expect(week[6].minutes).toBe(45);
  });

  it('plans no lifting for a person who asked only for cardio and mobility', () => {
    const week = proposeWeek(profile({ weeklyWorkoutDays: 3, focusAreas: ['CARDIO', 'MOBILITY'] }));
    expect(week.some((day) => day.kind === 'STRENGTH')).toBeFalse();
    expect(week.filter((day) => day.kind === 'CARDIO').length).toBe(1);
  });

  it('is the same week for the same profile', () => {
    const a = proposeWeek(profile({ weeklyWorkoutDays: 5, focusAreas: ['CARDIO'] }));
    const b = proposeWeek(profile({ weeklyWorkoutDays: 5, focusAreas: ['CARDIO'] }));
    expect(weekUntouched(a, b)).toBeTrue();
    a[0] = { ...a[0], title: 'Changed' };
    expect(weekUntouched(a, b)).toBeFalse();
  });

  it('reads focus areas the way onboarding names them', () => {
    expect(wantsStrength([])).toBeTrue();
    expect(wantsStrength(['CARDIO'])).toBeFalse();
    expect(wantsStrength(['upper'])).toBeTrue();
    expect(wantsCardio(['CARDIO'])).toBeTrue();
    expect(wantsCardio(['CORE'])).toBeFalse();
  });

  it('reads habits from the weekly insight and tolerates other field names', () => {
    const habits = habitsFromInsight({
      activitySummaries: [
        { sportActivity: 'BADMINTON', sportLabel: 'Badminton', usualDayOfWeek: 6, streakWeeks: 6, usualMinutes: 75 },
        { activity: 'TENNIS', dayOfWeek: 2, weeksInARow: 3 },
        { nothing: true }
      ]
    });
    expect(habits.length).toBe(2);
    expect(habits[0]).toEqual({ sportActivity: 'BADMINTON', label: 'Badminton', dayOfWeek: 6, streakWeeks: 6, minutes: 75 });
    expect(habits[1].label).toBe('TENNIS');
    expect(habitsFromInsight(null)).toEqual([]);
    expect(habitsFromInsight({ activitySummaries: 'x' })).toEqual([]);
  });
});
