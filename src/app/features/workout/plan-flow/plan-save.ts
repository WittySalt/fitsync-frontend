import { EFFORT_VALUES, DraftDay, DraftMove, DraftPlan, DraftSegment, PlanProfile, PlanType } from './plan-draft';
import { segmentTotal } from './segments/segment-math';

export const MAX_TITLE_LENGTH = 120;
export const MAX_DAY_MINUTES = 600;
export const MAX_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 1000;

/** One entry of a plan day as the server takes it: a SET for a move, a SEGMENT for a stretch of cardio. */
export interface PlanEntryRequest {
  entryType: 'SET' | 'SEGMENT';
  position: number;
  exerciseId?: string;
  targetSets?: number | null;
  targetReps?: number | null;
  targetDurationSeconds?: number | null;
  targetWeightKg?: number | null;
  restSeconds?: number | null;
  tempoSeconds?: number | null;
  notes?: string;
  kind?: string;
  label?: string;
  plannedSeconds?: number;
  rounds?: number | null;
}

export interface PlanDaySaveRequest {
  planDayId?: string;
  dayOfWeek: number;
  kind: string;
  title: string;
  sportActivity: string | null;
  estimatedDurationMinutes: number | null;
  targetKind: string | null;
  targetValue: number | null;
  location: string | null;
  effortTarget: number | null;
  entries: PlanEntryRequest[];
}

export interface PlanSaveRequest {
  name: string;
  description: string;
  goalFocus: string;
  workoutType: string;
  difficulty: string;
  estimatedDurationMinutes: number | null;
  exercises: [];
  days: PlanDaySaveRequest[];
}

const WORKOUT_TYPE: Record<PlanType, string> = {
  STRENGTH: 'STRENGTH',
  CARDIO: 'CARDIO',
  MIXED: 'CUSTOM',
  MOBILITY: 'MOBILITY'
};

const GOAL_FOCUS: Record<PlanType, string> = {
  STRENGTH: 'STRENGTH',
  CARDIO: 'ENDURANCE',
  MIXED: 'GENERAL_FITNESS',
  MOBILITY: 'MOBILITY'
};

const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

export function moveToEntry(move: DraftMove, position: number): PlanEntryRequest {
  return {
    entryType: 'SET',
    position,
    exerciseId: move.exerciseId,
    targetSets: move.sets,
    targetReps: move.timed ? null : move.reps,
    targetDurationSeconds: move.timed ? (move.durationSeconds ?? move.reps) : null,
    targetWeightKg: move.weightKg,
    restSeconds: move.restSeconds,
    tempoSeconds: move.tempoSeconds,
    notes: move.notes.trim()
  };
}

export function segmentToEntry(segment: DraftSegment, position: number): PlanEntryRequest {
  return {
    entryType: 'SEGMENT',
    position,
    kind: segment.kind,
    label: segment.label,
    plannedSeconds: Math.round(segment.minutes * 60),
    rounds: segment.rounds
  };
}

function dayToRequest(day: DraftDay): PlanDaySaveRequest {
  const withSegments = day.kind === 'CARDIO' || day.kind === 'SPORT';
  const entries = withSegments
    ? day.segments.map((segment, index) => segmentToEntry(segment, index + 1))
    : day.moves.map((move, index) => moveToEntry(move, index + 1));
  return {
    ...(day.planDayId ? { planDayId: day.planDayId } : {}),
    dayOfWeek: day.dayOfWeek,
    kind: day.kind,
    title: day.title.trim(),
    sportActivity: day.kind === 'SPORT' ? day.sportActivity : null,
    estimatedDurationMinutes: day.minutes,
    targetKind: day.kind === 'CARDIO' ? day.targetKind : null,
    targetValue: day.kind === 'CARDIO' ? day.targetValue : null,
    location: day.kind === 'CARDIO' ? day.location : null,
    effortTarget: withSegments && day.effort ? EFFORT_VALUES[day.effort] : null,
    entries
  };
}

/** The create and update body: rest days are left out, and every other day carries its entries. */
export function buildSaveRequest(plan: DraftPlan, profile: PlanProfile): PlanSaveRequest {
  const days = plan.days.filter((day) => day.kind !== 'REST').map(dayToRequest);
  const minutes = days.map((day) => day.estimatedDurationMinutes ?? 0).filter((value) => value > 0);
  const average = minutes.length ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length) : null;
  const level = profile.fitnessLevel.toUpperCase();
  return {
    name: plan.name.trim(),
    description: plan.description.trim(),
    goalFocus: GOAL_FOCUS[plan.planType],
    workoutType: WORKOUT_TYPE[plan.planType],
    difficulty: DIFFICULTIES.includes(level) ? level : 'BEGINNER',
    estimatedDurationMinutes: average,
    exercises: [],
    days
  };
}

export interface DraftProblem {
  /** The weekday to open, or null when the problem is about the plan itself. */
  dayOfWeek: number | null;
  message: string;
}

/** The first thing to fix on a day before the week can go on, in the words the editor shows. */
export function dayProblem(day: DraftDay): string | null {
  if (day.kind === 'REST') {
    return null;
  }
  if (!day.title.trim()) {
    return 'Give this day a name.';
  }
  if (day.title.trim().length > MAX_TITLE_LENGTH) {
    return `Keep the name under ${MAX_TITLE_LENGTH} characters.`;
  }
  const minutes = day.minutes;
  if (minutes === null || !Number.isInteger(minutes) || minutes < 1 || minutes > MAX_DAY_MINUTES) {
    return `Set a duration between 1 and ${MAX_DAY_MINUTES} minutes.`;
  }
  if (day.kind === 'SPORT' && !day.sportActivity) {
    return 'Choose the sport.';
  }
  if (day.kind === 'STRENGTH' || day.kind === 'MOBILITY') {
    if (day.moves.length === 0) {
      return 'Add at least one move.';
    }
    if (day.moves.some((move) => !move.exerciseId)) {
      return 'Every move needs an exercise.';
    }
  } else if (Math.abs(segmentTotal(day.segments) - minutes) > 1) {
    return 'The segments have to add up to the duration.';
  }
  return null;
}

export function firstDayProblem(plan: DraftPlan): DraftProblem | null {
  if (plan.days.every((day) => day.kind === 'REST')) {
    return { dayOfWeek: null, message: 'Plan at least one training day.' };
  }
  for (const day of plan.days) {
    const message = dayProblem(day);
    if (message) {
      return { dayOfWeek: day.dayOfWeek, message };
    }
  }
  return null;
}

/** The problem on the review step's own fields, or null. */
export function reviewProblem(plan: DraftPlan): string | null {
  if (!plan.name.trim()) {
    return 'Give the plan a name.';
  }
  if (plan.name.trim().length > MAX_NAME_LENGTH) {
    return `Keep the name under ${MAX_NAME_LENGTH} characters.`;
  }
  if (plan.description.length > MAX_DESCRIPTION_LENGTH) {
    return `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  return null;
}
