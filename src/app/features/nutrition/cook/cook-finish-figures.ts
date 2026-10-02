/** Whole minutes from the start of cooking to now, at least one. */
export function minutesCooked(startedAt: number, now: number): number {
  return Math.max(1, Math.round((now - startedAt) / 60_000));
}

/** The share of a day's calories eaten, from 0 to 1 for the ring; 0 without a target. */
export function ringShare(eaten: number, target: number | null): number {
  return target !== null && target > 0 ? Math.min(1, Math.max(0, eaten / target)) : 0;
}

/** How many calories the day is past its target, 0 when it is not past it or has no target. */
export function pastTarget(eaten: number, target: number | null): number {
  return target !== null && target > 0 && eaten > target ? Math.round(eaten - target) : 0;
}

/** A calorie figure with a thousands separator: 2100 as "2,100". */
export function kcalText(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
