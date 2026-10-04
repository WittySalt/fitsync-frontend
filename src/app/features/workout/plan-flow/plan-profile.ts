import { PlanProfile } from './plan-draft';

export const LEVEL_OPTIONS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' }
] as const;

export const EQUIPMENT_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'DUMBBELLS', label: 'Dumbbells' },
  { value: 'BARBELL', label: 'Barbell' },
  { value: 'BANDS', label: 'Bands' },
  { value: 'PULL_UP_BAR', label: 'Pull-up bar' },
  { value: 'KETTLEBELL', label: 'Kettlebell' },
  { value: 'MACHINES', label: 'Machines' },
  { value: 'FULL_GYM', label: 'Full gym' }
] as const;

export const FOCUS_OPTIONS = [
  { value: 'FULL_BODY', label: 'Full body' },
  { value: 'UPPER', label: 'Upper' },
  { value: 'LOWER', label: 'Lower' },
  { value: 'CORE', label: 'Core' },
  { value: 'MOBILITY', label: 'Mobility' },
  { value: 'CARDIO', label: 'Cardio' }
] as const;

function words(code: string): string {
  return code.toLowerCase().replace(/_/g, ' ');
}

function joinAnd(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** What the focus areas say the person trains: the lifting areas are one "strength". */
export function focusWords(focusAreas: readonly string[]): string {
  const upper = focusAreas.map((area) => area.toUpperCase());
  const parts: string[] = [];
  if (upper.length === 0 || upper.some((area) => ['FULL_BODY', 'UPPER', 'LOWER', 'CORE', 'STRENGTH'].includes(area))) {
    parts.push('strength');
  }
  if (upper.includes('CARDIO')) {
    parts.push('cardio');
  }
  if (upper.includes('MOBILITY')) {
    parts.push('mobility');
  }
  return joinAnd(parts);
}

/** "Beginner · 4 days a week · 45 min · dumbbells, bands · strength and cardio". */
export function profileLine(profile: PlanProfile): string {
  const level = words(profile.fitnessLevel);
  const equipment = profile.equipment.filter((item) => item.toUpperCase() !== 'NONE').map(words);
  return [
    level.charAt(0).toUpperCase() + level.slice(1),
    `${profile.weeklyWorkoutDays} ${profile.weeklyWorkoutDays === 1 ? 'day' : 'days'} a week`,
    `${profile.preferredDurationMinutes} min`,
    equipment.length ? equipment.join(', ') : 'no equipment',
    focusWords(profile.focusAreas)
  ].join(' · ');
}

export const MIN_PROFILE_DAYS = 2;
export const MAX_PROFILE_DAYS = 6;
export const MIN_PROFILE_MINUTES = 10;
export const MAX_PROFILE_MINUTES = 180;

/** The first thing wrong with the profile form, or null. */
export function profileProblem(profile: PlanProfile): string | null {
  if (!Number.isInteger(profile.weeklyWorkoutDays) || profile.weeklyWorkoutDays < MIN_PROFILE_DAYS || profile.weeklyWorkoutDays > MAX_PROFILE_DAYS) {
    return `Days a week must be between ${MIN_PROFILE_DAYS} and ${MAX_PROFILE_DAYS}.`;
  }
  if (!Number.isInteger(profile.preferredDurationMinutes) || profile.preferredDurationMinutes < MIN_PROFILE_MINUTES || profile.preferredDurationMinutes > MAX_PROFILE_MINUTES) {
    return `Minutes must be between ${MIN_PROFILE_MINUTES} and ${MAX_PROFILE_MINUTES}.`;
  }
  return null;
}
