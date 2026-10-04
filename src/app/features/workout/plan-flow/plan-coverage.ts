import { DraftDay, PlanProfile } from './plan-draft';

export type CoverageCode =
  | 'CALVES_NOT_TRAINED'
  | 'NO_VERTICAL_PULL'
  | 'SHOULDERS_HELPER_ONLY'
  | 'STRENGTH_BACK_TO_BACK'
  | 'OVER_PROFILE_MINUTES';

export interface CoverageNote {
  code: string;
  text: string;
}

export interface CoverageGroup {
  group: string;
  setsPerWeek: number;
}

/** What the server's coverage endpoint answers, after the defensive mapping. */
export interface PlanCoverage {
  groups: CoverageGroup[];
  notes: CoverageNote[];
}

/** The sentences the panel shows, in the order they are preferred. The client words them itself, so a note reads the same whoever computed it. */
const LINES: ReadonlyArray<{ code: CoverageCode; text: string }> = [
  { code: 'STRENGTH_BACK_TO_BACK', text: 'Two strength days back to back.' },
  { code: 'CALVES_NOT_TRAINED', text: 'Calves are not trained yet.' },
  { code: 'NO_VERTICAL_PULL', text: 'No pull from above yet (lats).' },
  { code: 'SHOULDERS_HELPER_ONLY', text: 'Shoulders only as a helper.' },
  { code: 'OVER_PROFILE_MINUTES', text: 'That is more than your profile says you have.' }
];

export const MAX_READING_LINES = 2;
/** Minutes a week this far over the profile (50%) are called out. */
export const OVER_PROFILE_FACTOR = 1.5;

/** Hard sets a week by group from the moves' own muscle data: primary 1, secondary 0.5 per set. Moves without data add nothing. */
export function localGroupSets(days: readonly DraftDay[]): Record<string, number> {
  const sets: Record<string, number> = {};
  for (const day of days) {
    if (day.kind !== 'STRENGTH') {
      continue;
    }
    for (const move of day.moves) {
      const count = move.timed ? 0 : Math.max(0, move.sets ?? 0);
      for (const group of move.primaryGroups ?? []) {
        sets[group] = (sets[group] ?? 0) + count;
      }
      for (const group of move.secondaryGroups ?? []) {
        sets[group] = (sets[group] ?? 0) + count * 0.5;
      }
    }
  }
  return sets;
}

/** The week repeats, so Sunday and the next Monday count as neighbours. */
export function hasBackToBackStrength(days: readonly DraftDay[]): boolean {
  const strength = new Set(days.filter((day) => day.kind === 'STRENGTH').map((day) => day.dayOfWeek));
  if (strength.size < 2) {
    return false;
  }
  return [...strength].some((day) => strength.has((day % 7) + 1));
}

export function weekMinutes(days: readonly DraftDay[]): number {
  return days.reduce((sum, day) => sum + (day.kind === 'REST' ? 0 : (day.minutes ?? 0)), 0);
}

export function isOverProfile(days: readonly DraftDay[], profile: PlanProfile): boolean {
  const asked = profile.weeklyWorkoutDays * profile.preferredDurationMinutes;
  return asked > 0 && weekMinutes(days) >= asked * OVER_PROFILE_FACTOR;
}

/** The notes the client can work out without the catalogue. */
export function localNotes(days: readonly DraftDay[], profile: PlanProfile): CoverageCode[] {
  const codes: CoverageCode[] = [];
  if (hasBackToBackStrength(days)) {
    codes.push('STRENGTH_BACK_TO_BACK');
  }
  if (isOverProfile(days, profile)) {
    codes.push('OVER_PROFILE_MINUTES');
  }
  return codes;
}

/** Up to two reading lines: the server's notes and the local ones together, once each, in the preferred order. */
export function readingLines(serverNotes: readonly CoverageNote[], days: readonly DraftDay[], profile: PlanProfile): string[] {
  const codes = new Set<string>([...localNotes(days, profile), ...serverNotes.map((note) => note.code)]);
  return LINES.filter((line) => codes.has(line.code))
    .slice(0, MAX_READING_LINES)
    .map((line) => line.text);
}

/** Groups as the figure draws them. Null when the server did not answer, and the figure is then hidden. */
export function groupSetsForFigure(coverage: PlanCoverage | null): Record<string, number> | null {
  if (coverage) {
    const sets: Record<string, number> = {};
    for (const entry of coverage.groups) {
      sets[entry.group] = entry.setsPerWeek;
    }
    return sets;
  }
  return null;
}
