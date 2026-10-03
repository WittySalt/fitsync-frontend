/** The seven muscle groups of the workout catalogue, in the order the boards list them. */
export const MUSCLE_GROUPS = ['CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'CORE', 'GLUTES', 'LEGS'] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  CHEST: 'Chest',
  BACK: 'Back',
  SHOULDERS: 'Shoulders',
  ARMS: 'Arms',
  CORE: 'Core',
  GLUTES: 'Glutes',
  LEGS: 'Legs'
};

/** Where a week's hard sets sit against the usual 10 to 20: amber is only ever "under". */
export type HeatLevel = 'under' | 'low' | 'in' | 'over';

/** The usual range of hard sets a week, shaded green on every chart that shows it. */
export const USUAL_RANGE = { low: 10, high: 20 } as const;

export function heatLevel(sets: number, range: { low: number; high: number } = USUAL_RANGE): HeatLevel {
  const value = Number.isFinite(sets) ? sets : 0;
  if (value < 6) {
    return 'under';
  }
  if (value < range.low) {
    return 'low';
  }
  return value <= range.high ? 'in' : 'over';
}

/** The colour key of the figure, in the board's order. */
export const HEAT_KEY: { level: HeatLevel; label: string }[] = [
  { level: 'under', label: 'under 6' },
  { level: 'low', label: '6 to 9' },
  { level: 'in', label: '10 to 20' },
  { level: 'over', label: 'above 20' }
];

/** Half sets come from secondary groups, so a value is shown with one decimal only when it has one. */
export function formatSets(sets: number): string {
  const rounded = Math.round((Number.isFinite(sets) ? sets : 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function groupLabel(group: string): string {
  return MUSCLE_GROUP_LABELS[group] ?? group.charAt(0) + group.slice(1).toLowerCase();
}

/** "Shoulders, 3 sets a week": what a screen reader says for a region. */
export function regionAriaLabel(group: string, sets: number): string {
  const value = formatSets(sets);
  return `${groupLabel(group)}, ${value} ${value === '1' ? 'set' : 'sets'} a week`;
}
