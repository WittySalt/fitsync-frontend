import { DraftDay, emptyDay, emptyWeek, PlanProfile } from './plan-draft';
import { defaultSegments } from './segments/segment-math';

/** A sport the person already does on a fixed weekday, read from the weekly insight. */
export interface HabitActivity {
  sportActivity: string;
  label: string;
  /** 1 for Monday through 7 for Sunday. */
  dayOfWeek: number;
  /** How many weeks in a row it was done on that weekday. */
  streakWeeks: number;
  minutes: number | null;
}

export const MIN_PROPOSED_DAYS = 2;
export const MAX_PROPOSED_DAYS = 6;
export const MAX_STRENGTH_DAYS = 3;
export const HABIT_STREAK_WEEKS = 3;
export const DEFAULT_HABIT_MINUTES = 60;
export const EASY_RUN_MINUTES = 30;

/** Mon, Thu, Sat first; the others are tried only when a habit took one of these. */
const STRENGTH_DAY_ORDER = [1, 4, 6, 2, 5, 3, 7];
const MOBILITY_DAY_ORDER = [7, 3, 5, 2, 4, 6, 1];

/** The focus values of onboarding that ask for lifting; no focus at all counts as strength. */
const STRENGTH_FOCUS = ['FULL_BODY', 'UPPER', 'LOWER', 'CORE', 'STRENGTH'];

export function wantsStrength(focusAreas: readonly string[]): boolean {
  return focusAreas.length === 0 || focusAreas.some((area) => STRENGTH_FOCUS.includes(area.toUpperCase()));
}

export function wantsCardio(focusAreas: readonly string[]): boolean {
  return focusAreas.some((area) => area.toUpperCase() === 'CARDIO');
}

/** A defensive reader of the weekly insight's `activitySummaries`, whose field names the backend may still change. */
export function habitsFromInsight(insight: unknown): HabitActivity[] {
  const list = (insight as { activitySummaries?: unknown } | null | undefined)?.activitySummaries;
  if (!Array.isArray(list)) {
    return [];
  }
  const habits: HabitActivity[] = [];
  for (const entry of list as Array<Record<string, unknown>>) {
    const code = pickString(entry, ['sportActivity', 'activity', 'code']);
    const day = pickNumber(entry, ['usualDayOfWeek', 'dayOfWeek', 'weekday']);
    const streak = pickNumber(entry, ['streakWeeks', 'weeksInARow', 'streak']);
    if (!code || day === null || streak === null || day < 1 || day > 7) {
      continue;
    }
    habits.push({
      sportActivity: code,
      label: pickString(entry, ['sportLabel', 'label', 'name']) || code,
      dayOfWeek: Math.round(day),
      streakWeeks: streak,
      minutes: pickNumber(entry, ['usualMinutes', 'averageMinutes', 'minutes'])
    });
  }
  return habits;
}

function pickString(entry: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = entry?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function pickNumber(entry: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(entry?.[key]);
    if (entry?.[key] !== null && entry?.[key] !== undefined && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export function clampDays(days: number | null | undefined): number {
  const value = Math.round(Number.isFinite(days as number) ? (days as number) : 3);
  return Math.max(MIN_PROPOSED_DAYS, Math.min(MAX_PROPOSED_DAYS, value));
}

function strengthTitles(count: number, level: string): string[] {
  const experienced = level.toUpperCase() === 'INTERMEDIATE' || level.toUpperCase() === 'ADVANCED';
  if (experienced) {
    return count === 1 ? ['Full body'] : count === 2 ? ['Upper', 'Lower'] : ['Upper', 'Lower', 'Full'];
  }
  return count === 1 ? ['Full body'] : ['Full body A', 'Full body B', 'Full body C'].slice(0, count);
}

/**
 * The week a person starts from when the server's proposal is not available. Habit days first
 * (a sport on its usual weekday), then up to three strength days with a rest day between them,
 * then one easy run the day after a strength day, then mobility for what is left. Everything
 * else is rest. It is pure, so the same profile always gives the same week.
 */
export function proposeWeek(profile: PlanProfile, habits: readonly HabitActivity[] = []): DraftDay[] {
  const days = emptyWeek();
  const taken = (dayOfWeek: number) => days[dayOfWeek - 1].kind !== 'REST';
  const total = clampDays(profile.weeklyWorkoutDays);
  const minutes = Math.max(10, Math.round(profile.preferredDurationMinutes || 45));
  let remaining = total;

  const usable = [...habits]
    .filter((habit) => habit.streakWeeks >= HABIT_STREAK_WEEKS)
    .sort((a, b) => b.streakWeeks - a.streakWeeks);
  for (const habit of usable) {
    if (remaining === 0) {
      break;
    }
    if (taken(habit.dayOfWeek)) {
      continue;
    }
    const length = Math.max(10, Math.round(habit.minutes ?? DEFAULT_HABIT_MINUTES));
    days[habit.dayOfWeek - 1] = {
      ...emptyDay(habit.dayOfWeek),
      kind: 'SPORT',
      title: habit.label,
      minutes: length,
      sportActivity: habit.sportActivity,
      segments: defaultSegments(length)
    };
    remaining -= 1;
  }

  const strengthOn = wantsStrength(profile.focusAreas);
  const cardioOn = wantsCardio(profile.focusAreas);
  let strengthCount = strengthOn ? Math.min(remaining, MAX_STRENGTH_DAYS) : 0;
  // A person who asked for cardio as well keeps a day for the run instead of losing it to a third lift.
  if (strengthOn && cardioOn && strengthCount >= 2 && strengthCount === remaining) {
    strengthCount -= 1;
  }
  const strengthDays: number[] = [];
  for (const candidate of STRENGTH_DAY_ORDER) {
    if (strengthDays.length === strengthCount) {
      break;
    }
    const touches = strengthDays.some((chosen) => Math.abs(chosen - candidate) === 1);
    if (!taken(candidate) && !touches) {
      strengthDays.push(candidate);
    }
  }
  strengthDays.sort((a, b) => a - b);
  const titles = strengthTitles(strengthDays.length, profile.fitnessLevel);
  strengthDays.forEach((dayOfWeek, index) => {
    days[dayOfWeek - 1] = { ...emptyDay(dayOfWeek), kind: 'STRENGTH', title: titles[index], minutes };
  });
  remaining -= strengthDays.length;

  if (cardioOn && remaining > 0) {
    const after = strengthDays.length ? strengthDays[0] : 0;
    const order = Array.from({ length: 7 }, (_, offset) => ((after + offset) % 7) + 1);
    const free = order.find((candidate) => !taken(candidate));
    if (free) {
      days[free - 1] = {
        ...emptyDay(free),
        kind: 'CARDIO',
        title: 'Easy run',
        minutes: EASY_RUN_MINUTES,
        targetKind: 'MINUTES',
        targetValue: EASY_RUN_MINUTES,
        location: 'OUTDOOR',
        effort: 'EASY',
        segments: defaultSegments(EASY_RUN_MINUTES)
      };
      remaining -= 1;
    }
  }

  for (const candidate of MOBILITY_DAY_ORDER) {
    if (remaining <= 0) {
      break;
    }
    if (!taken(candidate)) {
      days[candidate - 1] = { ...emptyDay(candidate), kind: 'MOBILITY', title: 'Mobility flow', minutes };
      remaining -= 1;
    }
  }
  return days;
}

/** True while the week is still what the rule produced: no day was edited, so a changed profile may re-propose it. */
export function weekUntouched(current: readonly DraftDay[], proposed: readonly DraftDay[]): boolean {
  return JSON.stringify(current) === JSON.stringify(proposed);
}
