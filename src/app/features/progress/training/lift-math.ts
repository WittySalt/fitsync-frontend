import { E1rmPoint, Lift, StrengthLevel } from './training.models';

/** The estimated best single, e1RM = weight × (1 + reps ÷ 30), the one strength figure on every page. */
export function e1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/** The formula as the Strength section writes it beside its title. */
export const E1RM_FORMULA = 'worked out as weight × (1 + reps ÷ 30)';

export const LEVELS: StrengthLevel[] = ['BEGINNER', 'NOVICE', 'INTERMEDIATE', 'ADVANCED'];

export const LEVEL_NAMES: Record<StrengthLevel, string> = {
  BEGINNER: 'Beginner',
  NOVICE: 'Novice',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced'
};

/**
 * The rungs of the relative-strength ladder as ratios of body weight (contract 1.1). Beginner is
 * below the first rung, novice from the first, intermediate from the second, advanced from the
 * third; the fourth closes the advanced band on the drawn track.
 */
export function rungsFor(name: string): [number, number, number, number] {
  const text = name.toLowerCase();
  if (/dead ?lift/.test(text)) {
    return [1.0, 1.25, 1.5, 2.0];
  }
  if (/bench/.test(text)) {
    return [0.5, 0.75, 1.0, 1.5];
  }
  if (/overhead|military|shoulder press|\bohp\b/.test(text)) {
    return [0.35, 0.55, 0.75, 1.0];
  }
  if (/squat/.test(text)) {
    return [0.75, 1.0, 1.25, 1.75];
  }
  return [0.5, 0.75, 1.0, 1.5];
}

export interface LadderPosition {
  ratio: number;
  level: StrengthLevel;
  nextLevel: StrengthLevel | null;
  nextAtKg: number | null;
  /** Where the dot sits on the track, 0 to 100. */
  position: number;
  rungs: [number, number, number, number];
}

function levelIndex(ratio: number, rungs: readonly number[]): number {
  return [rungs[0], rungs[1], rungs[2]].filter((rung) => ratio >= rung).length;
}

/** The dot's place on a track of four equal bands, inside the band of the given level. */
export function trackPosition(ratio: number, rungs: readonly number[], level: number): number {
  const edges = [0, rungs[0], rungs[1], rungs[2], rungs[3]];
  const low = edges[level];
  const high = edges[level + 1];
  const within = high > low ? Math.min(1, Math.max(0, (ratio - low) / (high - low))) : 1;
  return Math.round((25 * level + 25 * within) * 10) / 10;
}

/** A weight to the nearest half kilo, as plates allow. */
export function toHalfKg(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * The lift's place on the ladder. The server's level and next rung win when it sends them; the
 * client works them out from the latest e1RM and body weight only when they are missing.
 */
export function ladderPosition(lift: Lift): LadderPosition | null {
  const rungs = rungsFor(lift.name);
  const latest = lift.e1rm.length ? lift.e1rm[lift.e1rm.length - 1].value : null;
  const ratio = lift.relative?.ratio ?? (latest !== null && lift.bodyWeightKg ? latest / lift.bodyWeightKg : null);
  if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) {
    return null;
  }
  const computed = levelIndex(ratio, rungs);
  const index = lift.relative ? LEVELS.indexOf(lift.relative.level) : computed;
  const level = LEVELS[index] ?? LEVELS[computed];
  const levelAt = LEVELS.indexOf(level);
  const nextLevel = lift.relative ? lift.relative.nextLevel : (LEVELS[levelAt + 1] ?? null);
  const nextAtKg =
    lift.relative?.nextAtKg ?? (nextLevel && lift.bodyWeightKg ? toHalfKg(rungs[levelAt] * lift.bodyWeightKg) : null);
  return { ratio, level, nextLevel, nextAtKg, position: trackPosition(ratio, rungs, levelAt), rungs };
}

/** The change of the series from its first to its last point, in percent, as the server's changePct would be. */
export function seriesChangePct(points: readonly E1rmPoint[]): number | null {
  if (points.length < 2 || points[0].value <= 0) {
    return null;
  }
  return (points[points.length - 1].value / points[0].value - 1) * 100;
}

/** The lift's change, the server's figure first. */
export function liftChangePct(lift: Lift): number | null {
  return lift.changePct ?? seriesChangePct(lift.e1rm);
}
