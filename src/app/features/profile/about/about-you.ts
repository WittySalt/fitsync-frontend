import { MUSCLE_GROUPS, groupLabel } from '../../../shared/charts/muscle-figure/muscle-figure';
import { EQUIPMENT_OPTIONS, equipmentNames } from '../../workout/plan-flow/plan-profile';
import { shortDate } from '../../../shared/coach/insight/slope-chart.geometry';

export interface AboutGoal {
  type: string;
  targetValue: number | null;
  targetUnit: string | null;
  targetDate: string | null;
}

export interface AboutInputs {
  weeklyDays: number | null;
  /** The usual start time as "HH:mm", or null. */
  trainingTime: string | null;
  goal: AboutGoal | null;
  weightKg: number | null;
}

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];

/** "morning", "afternoon" or "evening" for a clock time, or empty when it cannot be read. */
export function partOfDay(time: string | null): string {
  const match = typeof time === 'string' ? /^([01]\d|2[0-3]):[0-5]\d/.exec(time) : null;
  if (!match) {
    return '';
  }
  const hour = Number(match[1]);
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

function trainingPart(inputs: AboutInputs): string {
  const days = inputs.weeklyDays;
  if (!days || days < 1) {
    return '';
  }
  const count = NUMBER_WORDS[days] ?? String(days);
  const part = partOfDay(inputs.trainingTime);
  const noun = part ? `${part}s` : days === 1 ? 'day' : 'days';
  return `${count} ${noun} a week`;
}

function number(value: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value);
}

function dayMonth(key: string): string {
  return shortDate(key.slice(0, 10));
}

function goalPart(inputs: AboutInputs): string {
  const goal = inputs.goal;
  if (!goal || goal.targetValue === null || goal.targetValue <= 0) {
    return '';
  }
  const by = goal.targetDate ? ` by ${dayMonth(goal.targetDate)}` : '';
  if (goal.type === 'WEIGHT') {
    const target = `${number(goal.targetValue)} kg`;
    const now = inputs.weightKg;
    if (now === null || !Number.isFinite(now)) {
      return `weight target ${target}${by}`;
    }
    if (Math.abs(now - goal.targetValue) < 0.05) {
      return `keep weight at ${target}`;
    }
    return `${now > goal.targetValue ? 'lose' : 'gain'} weight to ${target}${by}`;
  }
  return '';
}

/**
 * The lead sentence of About you, written from the inputs: "Four evenings a week, lose weight to
 * 68 kg by 11 Dec." With only one part it stands alone; with none it says nothing is set.
 */
export function leadSentence(inputs: AboutInputs): string {
  const training = trainingPart(inputs);
  const goal = goalPart(inputs);
  if (training && goal) {
    return `${training}, ${goal}.`;
  }
  const only = training || goal;
  return only ? `${only.charAt(0).toUpperCase()}${only.slice(1)}.` : 'Nothing set yet.';
}

const FOCUS_GROUPS: Record<string, readonly string[]> = {
  UPPER: ['CHEST', 'BACK', 'SHOULDERS', 'ARMS'],
  LOWER: ['GLUTES', 'LEGS'],
  CORE: ['CORE'],
  FULL_BODY: MUSCLE_GROUPS
};
const FOCUS_WORDS: Record<string, string> = { UPPER: 'upper body', LOWER: 'lower body', FULL_BODY: 'full body', CORE: 'core', MOBILITY: 'mobility', CARDIO: 'cardio' };

/** The muscle groups the chosen focus areas colour on the figure. */
export function focusedGroups(focusAreas: readonly string[]): string[] {
  const groups = new Set<string>();
  for (const raw of focusAreas) {
    const code = raw.trim().toUpperCase();
    if ((MUSCLE_GROUPS as readonly string[]).includes(code)) {
      groups.add(code);
    }
    (FOCUS_GROUPS[code] ?? []).forEach((group) => groups.add(group));
  }
  return [...groups];
}

/** The figure's input: each focused group at a hard-set count the figure draws in green. */
export function focusSets(focusAreas: readonly string[]): Record<string, number> {
  return Object.fromEntries(focusedGroups(focusAreas).map((group) => [group, 15]));
}

/** "Focus: shoulders, arms, glutes" or "Focus: not set". */
export function focusCaption(focusAreas: readonly string[]): string {
  const words = focusAreas
    .map((raw) => raw.trim().toUpperCase())
    .filter((code, index, all) => code !== '' && !/^\d+$/.test(code) && all.indexOf(code) === index)
    .map((code) => ((MUSCLE_GROUPS as readonly string[]).includes(code) ? groupLabel(code).toLowerCase() : (FOCUS_WORDS[code] ?? code.toLowerCase().replace(/_/g, ' '))));
  return words.length ? `Focus: ${words.join(', ')}` : 'Focus: not set';
}

export function equipmentLabels(values: readonly string[]): string[] {
  return equipmentNames(values).map((name) => EQUIPMENT_OPTIONS.find((option) => option.value === name)?.label ?? name.charAt(0) + name.slice(1).toLowerCase().replace(/_/g, ' '));
}

const DIET_LABELS: Record<string, string> = {
  '300001': 'No preference',
  '300002': 'Halal',
  '300003': 'Vegetarian',
  '300004': 'Vegan',
  '300005': 'Keto',
  '300006': 'Low carbohydrate',
  NONE: 'No preference',
  NO_PREFERENCE: 'No preference'
};

/** The diet chip, or null when nothing has been chosen. */
export function dietLabel(value: string | null | undefined): string | null {
  const key = (value ?? '').trim().toUpperCase();
  if (!key) {
    return null;
  }
  return DIET_LABELS[key] ?? key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function injuryLabels(values: readonly string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().replace(/_/g, ' '));
}

/** Everything the About you card reads, gathered by the page. */
export interface AboutData extends AboutInputs {
  focusAreas: string[];
  equipment: string[];
  injuries: string[];
  diet: string | null;
  meals: { label: string; time: string }[];
}
