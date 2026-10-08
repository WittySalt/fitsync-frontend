import { shortDateLabel } from '../../shared/date-label';
import { GoalProjection, PrimaryGoal } from './onboarding-projection';

/** Everything the "What this changes" card and the plan summary read, taken from the form. */
export interface ExplainState {
  goal: PrimaryGoal | null;
  units: 'METRIC' | 'IMPERIAL';
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  weeklyPaceKg: number | null;
  projection: Pick<GoalProjection, 'weekCount' | 'projectedDate' | 'dailyCalories' | 'proteinGrams'>;
  weeklyWorkoutDays: number | null;
  durationMinutes: number | null;
  location: string;
  fitnessLevel: string;
  intensity: string;
  equipment: readonly string[];
  focusAreas: readonly string[];
  hasHealthFlag: boolean;
  injuryAreas: readonly string[];
  calorieTrackingMode: string;
}

export interface HowHardChoice {
  value: 'EASE_IN' | 'STEADY' | 'PUSH';
  label: string;
  description: string;
  /** The request fields this choice writes. */
  fitnessLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  intensityPreference: 'LOW' | 'MODERATE' | 'HIGH';
  /** How the choice reads inside the plan summary. */
  effort: string;
}

export const HOW_HARD_CHOICES: readonly HowHardChoice[] = [
  {
    value: 'EASE_IN',
    label: 'Ease in',
    description: 'New or coming back. Easy starts with room to recover.',
    fitnessLevel: 'BEGINNER',
    intensityPreference: 'LOW',
    effort: 'gentle effort'
  },
  {
    value: 'STEADY',
    label: 'Steady',
    description: 'Training regularly. Balanced weeks you can keep up.',
    fitnessLevel: 'INTERMEDIATE',
    intensityPreference: 'MODERATE',
    effort: 'steady effort'
  },
  {
    value: 'PUSH',
    label: 'Push',
    description: 'Experienced. Hard sessions when recovery allows.',
    fitnessLevel: 'ADVANCED',
    intensityPreference: 'HIGH',
    effort: 'hard effort'
  }
];

/** The choice a pair of stored values stands for. A pair that matches none follows the intensity. */
export function howHardFor(fitnessLevel: string | null, intensity: string | null): HowHardChoice | null {
  return (
    HOW_HARD_CHOICES.find((choice) => choice.fitnessLevel === fitnessLevel && choice.intensityPreference === intensity) ??
    HOW_HARD_CHOICES.find((choice) => choice.intensityPreference === intensity) ??
    null
  );
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

const DAY_PATTERNS: Record<number, string[]> = {
  1: ['Wed'],
  2: ['Tue', 'Fri'],
  3: ['Mon', 'Wed', 'Fri'],
  4: ['Mon', 'Thu', 'Fri', 'Sat'],
  5: ['Mon', 'Tue', 'Thu', 'Fri', 'Sat'],
  6: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  7: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
};

const FOCUS_NAMES: Record<string, string> = {
  UPPER: 'Upper body',
  LOWER: 'Lower body',
  CORE: 'Core',
  MOBILITY: 'Mobility',
  CARDIO: 'Cardio'
};

const INJURY_NAMES: Record<string, string> = {
  LOWER_BACK: 'lower back',
  KNEE: 'knee',
  SHOULDER: 'shoulder',
  HIP: 'hip',
  ANKLE: 'ankle',
  NECK: 'neck',
  WRIST: 'wrist',
  OTHER: 'sore area'
};

const LOCATION_NAMES: Record<string, string> = { HOME: 'Home', GYM: 'Gym', OUTDOOR: 'Outdoor', MIXED: 'Mixed' };

/** "2,100 kcal". */
export function formatKcal(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} kcal`;
}

/** "128 g". */
export function formatGrams(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} g`;
}

/** "24 Nov 2026": always with the year, in the same short-month style as the rest of the app. */
export function formatDate(key: string | null): string {
  // A 1970 reference year never matches, so the label always carries the year.
  return shortDateLabel(key, new Date(0));
}

/** "71.2 kg" or "157 lb", in the units the person chose. */
export function formatWeight(kg: number, units: 'METRIC' | 'IMPERIAL'): string {
  // 2.20462 lb per kg.
  const value = units === 'IMPERIAL' ? kg * 2.20462 : kg;
  return `${trimmed(value)} ${units === 'IMPERIAL' ? 'lb' : 'kg'}`;
}

/** "7 weeks". */
export function formatWeeks(count: number): string {
  return `${count} ${count === 1 ? 'week' : 'weeks'}`;
}

/** "128 g protein · 194 g carbs · 48 g fat". */
export function formatMacros(protein: number, carbs: number, fat: number): string {
  return `${formatGrams(protein)} protein · ${formatGrams(carbs)} carbs · ${formatGrams(fat)} fat`;
}

function trimmed(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinList(items: readonly string[]): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function daysWord(days: number): string {
  return NUMBER_WORDS[days] ?? String(days);
}

/** Step 1. */
export function explainGoal(state: ExplainState): string[] {
  switch (state.goal) {
    case 'LOSE_FAT':
      return ['Lose fat sets a weekly pace and a target weight.', 'Progress draws the road to it and the Diary budget sits a little under what you burn.'];
    case 'BUILD_MUSCLE':
      return ['Build muscle sets a gentle surplus and a target weight.', 'Progress draws the road to it and the Diary budget sits a little over what you burn.'];
    case 'MAINTAIN':
      return ['Maintain keeps the Diary budget close to what you burn.', 'Progress follows your weight around it.'];
    case 'IMPROVE_FITNESS':
      return ['Improve fitness builds the plan around your training rhythm.', 'The Workout page and the coach plan your week without a scale target.'];
    default:
      return ['Your goal sets the first defaults for pace, workouts and daily targets.', 'Each one can be changed later in Me.'];
  }
}

/** Step 2. */
export function explainYou(state: ExplainState): string[] {
  const { projection } = state;
  if (!projection.dailyCalories || state.currentWeightKg === null) {
    return ['Add your height and current weight to see your daily target.', 'The Diary budget starts from it.'];
  }
  const sentences: string[] = [];
  const current = formatWeight(state.currentWeightKg, state.units);
  const target = state.targetWeightKg;
  if (target !== null && state.weeklyPaceKg && projection.projectedDate && projection.weekCount) {
    const pace = `${formatWeight(state.weeklyPaceKg, state.units)} a week`;
    sentences.push(
      `At ${current}, ${formatWeight(target, state.units)} at ${pace} lands on ${formatDate(projection.projectedDate)}, ${formatWeeks(projection.weekCount)} away.`
    );
    sentences.push('Progress draws the road to it.');
  } else {
    sentences.push(`At ${current}, this goal keeps your weight steady and Progress follows it.`);
  }
  const protein = projection.proteinGrams ? ` with ${formatGrams(projection.proteinGrams)} protein` : '';
  sentences.push(`Your daily target in the Diary becomes ${formatKcal(projection.dailyCalories)}${protein}.`);
  return sentences;
}

/** Step 3. */
export function explainTraining(state: ExplainState): string[] {
  const sentences: string[] = [];
  const days = state.weeklyWorkoutDays;
  if (days === null) {
    sentences.push('Your weekly target stays open until you set one on the Workout page.');
  } else {
    const names = DAY_PATTERNS[days] ?? [];
    const plural = days === 1 ? 'session' : 'sessions';
    sentences.push(`${capitalise(daysWord(days))} ${plural} a week becomes your target. The coach plans ${joinList(names)}.`);
  }
  if (state.equipment.includes('NONE')) {
    sentences.push('Exercises are bodyweight moves.');
  } else if (state.equipment.length > 0) {
    sentences.push('Exercises are picked from what you own.');
  }
  const focus = state.focusAreas.filter((area) => FOCUS_NAMES[area]).map((area) => FOCUS_NAMES[area]);
  if (focus.length > 0) {
    sentences.push(`${joinList(focus)} ${focus.length === 1 ? 'gets' : 'get'} more of the weekly plan.`);
  }
  return sentences;
}

/** Step 4. */
export function explainHealth(state: ExplainState): string[] {
  const sentences: string[] = [];
  if (state.hasHealthFlag) {
    sentences.push('A yes keeps the plan conservative and the coach suggests a check-up first.');
  } else {
    sentences.push('With no flags the coach plans at the effort you chose.');
  }
  const areas = state.injuryAreas.filter((area) => INJURY_NAMES[area]).map((area) => INJURY_NAMES[area]);
  if (areas.length > 0) {
    sentences.push(`Moves that load your ${joinList(areas)} are swapped out of Workout plans.`);
  }
  return sentences;
}

/** Step 5. */
export function explainPlan(state: ExplainState): string[] {
  const sentences = ['These targets feed the Diary budget and the Progress Goal card.', 'Change them any time in Me.'];
  if (state.calorieTrackingMode === 'OFF') {
    sentences.splice(1, 0, 'With calorie tracking off, the Diary lists your meals without a budget.');
  } else if (state.calorieTrackingMode === 'STRICT') {
    sentences.splice(1, 0, 'Strict tracking holds each Diary day to the calorie target.');
  } else {
    sentences.splice(1, 0, 'Flexible tracking reads the Diary across the week.');
  }
  return sentences;
}

/** The sentences of one step (zero based). */
export function explainStep(step: number, state: ExplainState): string[] {
  switch (step) {
    case 0:
      return explainGoal(state);
    case 1:
      return explainYou(state);
    case 2:
      return explainTraining(state);
    case 3:
      return explainHealth(state);
    default:
      return explainPlan(state);
  }
}

/** "Gym, four days a week, 45 minutes, steady effort. Lose fat to 68 kg by 24 Nov 2026." */
export function planSummary(state: ExplainState): string {
  const parts: string[] = [LOCATION_NAMES[state.location] ?? 'Mixed'];
  const days = state.weeklyWorkoutDays;
  parts.push(days === null ? 'days a week to be decided' : `${daysWord(days)} ${days === 1 ? 'day' : 'days'} a week`);
  if (state.durationMinutes) {
    parts.push(`${state.durationMinutes} minutes`);
  }
  const effort = howHardFor(state.fitnessLevel, state.intensity)?.effort;
  if (effort) {
    parts.push(effort);
  }
  return `${parts.join(', ')}. ${goalSentence(state)}`;
}

function goalSentence(state: ExplainState): string {
  const target = state.targetWeightKg === null ? '' : ` to ${formatWeight(state.targetWeightKg, state.units)}`;
  const date = state.projection.projectedDate ? ` by ${formatDate(state.projection.projectedDate)}` : '';
  switch (state.goal) {
    case 'LOSE_FAT':
      return `Lose fat${target}${date}.`;
    case 'BUILD_MUSCLE':
      return `Build muscle${target}${date}.`;
    case 'IMPROVE_FITNESS':
      return 'Improve fitness.';
    default:
      return state.currentWeightKg === null ? 'Maintain your weight.' : `Maintain around ${formatWeight(state.currentWeightKg, state.units)}.`;
  }
}
