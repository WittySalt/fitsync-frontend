import { GoalType, UpsertGoalRequest, UserGoal } from '../../../core/fitsync.models';
import { shortDate } from '../../../shared/coach/insight/slope-chart.geometry';

export interface TargetKind {
  type: GoalType;
  label: string;
  icon: string;
  unit: string;
  step: number;
  min: number;
}

/** The targets in the order the card lists them. */
export const TARGET_KINDS: readonly TargetKind[] = [
  { type: 'WEIGHT', label: 'Weight', icon: 'scale', unit: 'kg', step: 0.5, min: 20 },
  { type: 'CALORIES', label: 'Calories', icon: 'flame', unit: 'kcal', step: 50, min: 500 },
  { type: 'PROTEIN', label: 'Protein', icon: 'droplet', unit: 'g', step: 5, min: 10 },
  { type: 'WORKOUT_FREQUENCY', label: 'Sessions', icon: 'dumbbell', unit: 'sessions/week', step: 1, min: 1 },
  { type: 'CARBS', label: 'Carbs', icon: 'bowl', unit: 'g', step: 5, min: 10 },
  { type: 'FAT', label: 'Fat', icon: 'target', unit: 'g', step: 5, min: 10 }
];

export interface TargetRow {
  kind: TargetKind;
  goal: UserGoal;
  text: string;
}

export function kindOf(type: GoalType): TargetKind {
  return TARGET_KINDS.find((kind) => kind.type === type) ?? TARGET_KINDS[0];
}

function figure(value: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value);
}

/** "68 kg · by 11 Dec 2026", "2,100 kcal a day", "4 a week". */
export function targetText(goal: UserGoal): string {
  const value = goal.targetValue ?? 0;
  switch (goal.goalType) {
    case 'WEIGHT': {
      const by = goal.targetDate ? ` · by ${shortDate(goal.targetDate)} ${goal.targetDate.slice(0, 4)}` : '';
      return `${figure(value)} kg${by}`;
    }
    case 'CALORIES':
      return `${figure(value)} kcal a day`;
    case 'WORKOUT_FREQUENCY':
      return `${figure(value)} a week`;
    default:
      return `${figure(value)} g a day`;
  }
}

/** One row for each target that is set, in the card's order. */
export function targetRows(goals: readonly UserGoal[]): TargetRow[] {
  return TARGET_KINDS.flatMap((kind) => {
    const goal = goals.find((entry) => entry.goalType === kind.type && entry.targetValue !== null && entry.targetValue > 0);
    return goal ? [{ kind, goal, text: targetText(goal) }] : [];
  });
}

/** The types that have no target yet. */
export function unsetKinds(goals: readonly UserGoal[]): TargetKind[] {
  const set = new Set(targetRows(goals).map((row) => row.kind.type));
  return TARGET_KINDS.filter((kind) => !set.has(kind.type));
}

/** The first of carbs and fat without a target, for the quiet "Add a carbs or fat target" line. */
export function missingMacro(goals: readonly UserGoal[]): TargetKind | null {
  return unsetKinds(goals).find((kind) => kind.type === 'CARBS' || kind.type === 'FAT') ?? null;
}

/** One step of the stepper, kept to a tenth and not below the kind's floor. */
export function stepValue(kind: TargetKind, current: number | null, direction: 1 | -1): number {
  const base = current !== null && Number.isFinite(current) ? current : kind.min;
  const next = Math.round((base + direction * kind.step) * 10) / 10;
  return Math.max(next, kind.min);
}

export function targetProblem(kind: TargetKind, value: number | null, note: string): string | null {
  if (value === null || !Number.isFinite(value) || value < kind.min) {
    return `Enter a number of at least ${kind.min}.`;
  }
  if (note.length > 300) {
    return 'The note can be 300 characters at most.';
  }
  return null;
}

export function buildTargetRequest(kind: TargetKind, existing: UserGoal | null, value: number, date: string, note: string): UpsertGoalRequest {
  return {
    targetValue: value,
    targetUnit: existing?.targetUnit ?? kind.unit,
    targetDate: kind.type === 'WEIGHT' && date ? date : null,
    status: existing?.status ?? 'ACTIVE',
    notes: note.trim() || null
  };
}
