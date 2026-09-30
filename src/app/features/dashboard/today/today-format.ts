import { Goal } from '../../../core/fitsync.models';
import { shortDate } from '../../../shared/coach/insight/slope-chart.geometry';
import { dayKeyOf, daysBetweenKeys, localDateKey } from './today-tab';

/** A figure with at most one decimal and no trailing zero, for example "71.1" or "68". */
export function oneDecimal(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
}

/** When the person was last weighed, for example "yesterday" or "13 Sept", or empty when unknown. */
export function weighedLabel(value: string | null | undefined, now: Date): string {
  const key = dayKeyOf(value);
  if (key === null) {
    return '';
  }
  const day = shortDate(key);
  if (!day) {
    return '';
  }
  const age = daysBetweenKeys(key, localDateKey(now));
  if (age === 0) {
    return 'today';
  }
  if (age === 1) {
    return 'yesterday';
  }
  if (age > 1 && age < 7) {
    return `${age} days ago`;
  }
  return key.slice(0, 4) === String(now.getFullYear()) ? day : `${day} ${key.slice(0, 4)}`;
}

/** "Down 1.4 kg in 30 days", or empty when there is no change to report. */
export function weightChangeLabel(changeKg: number | null | undefined): string {
  if (changeKg == null || !Number.isFinite(changeKg)) {
    return '';
  }
  const rounded = Math.round(changeKg * 10) / 10;
  if (rounded === 0) {
    return 'No change in 30 days';
  }
  return `${rounded < 0 ? 'Down' : 'Up'} ${oneDecimal(Math.abs(rounded))} kg in 30 days`;
}

/** "Workout Frequency" from WORKOUT_FREQUENCY. */
export function goalName(goal: Goal): string {
  return goal.goalType
    .toLowerCase()
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function goalUnit(goal: Goal): string {
  const own = (goal.targetUnit ?? '').trim();
  if (own) {
    return own;
  }
  switch (goal.goalType) {
    case 'CALORIES':
      return 'kcal';
    case 'PROTEIN':
    case 'CARBS':
    case 'FAT':
      return 'g';
    case 'WEIGHT':
      return 'kg';
    case 'WORKOUT_FREQUENCY':
      return 'workouts/week';
    default:
      return '';
  }
}

/** "71.1 of 68 kg". Without a current value only the target is written, and without a target the
 *  goal says so. */
export function goalFigure(goal: Goal): string {
  if (!(goal.targetValue > 0)) {
    return 'No target set';
  }
  const unit = goalUnit(goal);
  const target = oneDecimal(goal.targetValue);
  const current = goal.currentValue != null && Number.isFinite(goal.currentValue) ? oneDecimal(goal.currentValue) : '';
  const figure = current ? `${current} of ${target}` : target;
  return unit ? `${figure} ${unit}` : figure;
}

/** "by 29 Nov 2026", "was due 29 Nov 2026" once it has passed, or empty without a date. */
export function goalDueLabel(goal: Goal): string {
  const key = dayKeyOf(goal.targetDate);
  if (key === null) {
    return '';
  }
  const day = shortDate(key);
  return day ? `${goal.expired ? 'was due' : 'by'} ${day} ${key.slice(0, 4)}` : '';
}

/** The progress bar's fill, held between 0 and 100. */
export function goalPercent(goal: Goal): number {
  const ratio = Number.isFinite(goal.progressRatio) ? goal.progressRatio : 0;
  return Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
}
