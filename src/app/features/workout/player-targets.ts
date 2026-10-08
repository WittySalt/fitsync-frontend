import { WorkoutExerciseLog, WorkoutExerciseSetLog, WorkoutPlan, WorkoutPlanExercise } from '../../core/fitsync.models';

/** What one set is meant to be, in the plan's own numbers. */
export interface SetTarget {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  restSeconds: number | null;
}

/** One set as a dot in the folded set list beside the name while a set runs. */
export type SetDot = 'done' | 'skipped' | 'current' | 'open';

/** One set of an exercise as the player sees it: the target, and what was logged against it. */
export interface PlayerSet {
  setNumber: number;
  target: SetTarget | null;
  /** The values that were recorded, or null while the set is open. */
  logged: SetTarget | null;
  skipped: boolean;
}

type LogLike = Pick<WorkoutExerciseLog, 'exerciseId' | 'sequence' | 'sets'>;

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function toTarget(source: {
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  distanceKm?: number | null;
  restSeconds?: number | null;
}): SetTarget | null {
  const target: SetTarget = {
    reps: positive(source.reps),
    weightKg: positive(source.weightKg),
    durationSeconds: positive(source.durationSeconds),
    distanceKm: positive(source.distanceKm),
    restSeconds: positive(source.restSeconds)
  };
  return hasTarget(target) ? target : null;
}

/** A target says something when it has reps, weight, time or distance. A rest alone does not. */
export function hasTarget(target: SetTarget | null): target is SetTarget {
  return !!target && (target.reps !== null || target.weightKg !== null
    || target.durationSeconds !== null || target.distanceKm !== null);
}

function planTarget(exercise: WorkoutPlanExercise, setNumber: number): SetTarget | null {
  const perSet = (exercise.setTargets ?? []).find((entry) => entry.setNumber === setNumber);
  return toTarget(perSet
    ? {
        reps: perSet.targetReps,
        weightKg: perSet.targetWeightKg,
        durationSeconds: perSet.targetDurationSeconds,
        distanceKm: perSet.targetDistanceKm,
        restSeconds: perSet.restSeconds
      }
    : {
        reps: exercise.targetReps,
        weightKg: exercise.targetWeightKg,
        durationSeconds: exercise.targetDurationSeconds,
        distanceKm: exercise.targetDistanceKm,
        restSeconds: exercise.restSeconds
      });
}

function planSetCount(exercise: WorkoutPlanExercise): number {
  return Math.max(1, exercise.targetSets ?? (exercise.setTargets?.length || 1));
}

function matchInList(
  exercises: WorkoutPlanExercise[],
  log: LogLike,
  allowSequence: boolean
): WorkoutPlanExercise | null {
  return exercises.find((exercise) => !!log.exerciseId && exercise.exerciseId === log.exerciseId)
    ?? (allowSequence ? exercises.find((exercise) => exercise.sequence === log.sequence) : undefined)
    ?? null;
}

/**
 * The plan's entry for an exercise: in the plan day the session was started from, else in the plan
 * day that holds the exercise, else in the flat list.
 */
export function findPlanExercise(
  log: LogLike | null,
  planDayId: string | null | undefined,
  plan: WorkoutPlan | null
): WorkoutPlanExercise | null {
  if (!log || !plan) {
    return null;
  }
  const days = plan.days ?? [];
  const sessionDay = planDayId ? days.find((day) => day.planDayId === planDayId) : undefined;
  const fromSessionDay = sessionDay ? matchInList(sessionDay.exercises ?? [], log, true) : null;
  if (fromSessionDay) {
    return fromSessionDay;
  }
  for (const day of days) {
    const found = matchInList(day.exercises ?? [], log, false);
    if (found) {
      return found;
    }
  }
  return matchInList(plan.exercises ?? [], log, true);
}

function isSkipped(row: WorkoutExerciseSetLog): boolean {
  return row.status === 'SKIPPED';
}

/** Seconds a rep takes when a plan sets no tempo: 4 for mobility, 2.5 for cardio and sport, 3 otherwise. */
export function defaultTempoSeconds(exerciseType: string | null | undefined): number {
  switch (exerciseType) {
    case 'MOBILITY':
      return 4;
    case 'CARDIO':
    case 'SPORT':
      return 2.5;
    default:
      return 3;
  }
}

/** The tempo of an exercise in a workout: the workout's own copy, then the plan's, then the default of its kind. */
export function resolveTempoSeconds(
  log: { tempoSeconds?: number | null } | null,
  planExercise: { tempoSeconds?: number | null } | null,
  exerciseType: string | null | undefined
): number {
  const own = log?.tempoSeconds ?? planExercise?.tempoSeconds ?? null;
  return typeof own === 'number' && Number.isFinite(own) && own > 0 ? own : defaultTempoSeconds(exerciseType);
}

/**
 * A set that is still to do: neither done nor skipped. The server answers a skipped set with
 * logged false, so "not logged" alone would take a skipped set for the next one.
 */
export function isOpenSet(row: Pick<WorkoutExerciseSetLog, 'logged' | 'status'>): boolean {
  return !row.logged && row.status !== 'SKIPPED';
}

/**
 * The sets of one exercise with their targets. The session's own set rows come first: the server
 * seeds one row per planned set. An exercise without rows takes its sets from the plan. When
 * neither says anything it is one set without a target.
 */
export function resolveExerciseSets(
  log: LogLike | null,
  planDayId: string | null | undefined,
  plan: WorkoutPlan | null
): PlayerSet[] {
  const rows = [...(log?.sets ?? [])].sort((a, b) => a.setNumber - b.setNumber);
  const planned = findPlanExercise(log, planDayId, plan);
  if (rows.length) {
    return rows.map((row) => {
      const own = toTarget(row);
      const fromPlan = planned ? planTarget(planned, row.setNumber) : null;
      // A row that was logged holds the logged values, so the plan is the only place its target remains.
      // An open row without values says nothing, so the plan is asked.
      const target = row.logged ? (fromPlan ?? own) : (own ?? fromPlan);
      return {
        setNumber: row.setNumber,
        target,
        logged: row.logged && !isSkipped(row) ? (own ?? { reps: null, weightKg: null, durationSeconds: null, distanceKm: null, restSeconds: null }) : null,
        skipped: isSkipped(row)
      };
    });
  }
  if (planned) {
    return Array.from({ length: planSetCount(planned) }, (_, index) => ({
      setNumber: index + 1,
      target: planTarget(planned, index + 1),
      logged: null,
      skipped: false
    }));
  }
  return [{ setNumber: 1, target: null, logged: null, skipped: false }];
}

/** 45 sec, 30 min, 1 h 5 min. */
export function formatTargetDuration(seconds: number): string {
  if (seconds < 120) {
    return `${Math.round(seconds)} sec`;
  }
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function numberText(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** "10 reps · 20 kg", "30 min · 5.75 km", then " · 75 sec rest". Empty when the set has no target. */
export function targetLine(target: SetTarget | null): string {
  if (!hasTarget(target)) {
    return '';
  }
  const parts: string[] = [];
  if (target.reps !== null) {
    parts.push(`${numberText(target.reps)} reps`);
    if (target.weightKg !== null) {
      parts.push(`${numberText(target.weightKg)} kg`);
    }
  } else {
    if (target.durationSeconds !== null) {
      parts.push(formatTargetDuration(target.durationSeconds));
    }
    if (target.distanceKm !== null) {
      parts.push(`${numberText(target.distanceKm)} km`);
    }
    if (target.weightKg !== null && !parts.length) {
      parts.push(`${numberText(target.weightKg)} kg`);
    }
  }
  if (target.restSeconds !== null) {
    parts.push(`${formatTargetDuration(target.restSeconds)} rest`);
  }
  return parts.join(' · ');
}

/** The values of a set without its rest: "10 × 20 kg", "8 reps", "30 min · 5.75 km". */
export function valuesLine(target: SetTarget | null): string {
  if (!hasTarget(target)) {
    return '';
  }
  if (target.reps !== null) {
    return target.weightKg !== null
      ? `${numberText(target.reps)} × ${numberText(target.weightKg)} kg`
      : `${numberText(target.reps)} reps`;
  }
  return targetLine({ ...target, restSeconds: null });
}

/** Two amounts are the same when both are missing or both are present and equal; 10 and 10.0 are. */
function sameAmount(a: number | null, b: number | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return Math.abs(a - b) < 0.005;
}

/**
 * Whether two sets say the same thing to the person, by value. Only what the line shows is
 * compared: a set with reps shows reps and weight, so a time the player filled in beside the
 * reps does not make a logged set look different from its plan. Two missing targets are equal.
 */
export function sameTarget(a: SetTarget | null, b: SetTarget | null): boolean {
  if (!a || !b) {
    return !a && !b;
  }
  if (a.reps !== null || b.reps !== null) {
    return sameAmount(a.reps, b.reps) && sameAmount(a.weightKg, b.weightKg);
  }
  return sameAmount(a.durationSeconds, b.durationSeconds) && sameAmount(a.distanceKm, b.distanceKm)
    && sameAmount(a.weightKg, b.weightKg);
}

/** One line for the movement queue: "3 × 10 · 20 kg", "3 × 45 sec", or "3 sets" when the sets differ. */
export function exerciseSummary(sets: PlayerSet[]): string {
  const count = sets.length;
  const noun = count === 1 ? '1 set' : `${count} sets`;
  const first = sets[0]?.target ?? null;
  if (!hasTarget(first) || !sets.every((set) => sameTarget(set.target, first))) {
    return noun;
  }
  const body = first.reps !== null
    ? [numberText(first.reps), first.weightKg !== null ? `${numberText(first.weightKg)} kg` : ''].filter(Boolean).join(' · ')
    : valuesLine(first);
  return count > 1 ? `${count} × ${body}` : (first.reps !== null ? `1 × ${body}` : body);
}
