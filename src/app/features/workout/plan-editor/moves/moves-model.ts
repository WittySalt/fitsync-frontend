import { Exercise } from '../../../../core/fitsync.models';

/** One move of a strength or mobility day: a SET entry of the plan (spec section 6). */
export interface PlanSetEntry {
  entryType: 'SET';
  exerciseId: string;
  exerciseName: string;
  /** "chest · arms · dumbbell", shown under the name. */
  muscleLine: string;
  thumbnailUrl: string | null;
  position: number;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  restSeconds: number | null;
  tempoSeconds: number | null;
  timeBased: boolean;
  plannedSeconds: number | null;
  notes: string | null;
  /** True when the exercise needs no equipment, so an empty weight reads "Body". Unknown counts as false. */
  bodyweight?: boolean;
}

/** What the picker hands back: enough to build or swap a row without asking the catalogue again. */
export interface PickedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleLine: string;
  thumbnailUrl: string | null;
  timeBased: boolean;
  bodyweight?: boolean;
}

/** Bodyweight equipment is none at all; everything else, and anything unknown, is weighted. */
export function isBodyweight(equipment: string | null | undefined): boolean {
  const value = (equipment ?? '').trim().toUpperCase();
  return value === 'NONE' || value === 'BODYWEIGHT' || value === 'BODY_WEIGHT';
}

export type MoveField = 'sets' | 'reps' | 'weightKg' | 'restSeconds' | 'tempoSeconds' | 'plannedSeconds';

interface FieldRule {
  min: number;
  max: number;
  /** A blank box means "not set" (null) when true, and "keep what was there" when false. */
  optional: boolean;
  decimals: number;
}

const RULES: Record<MoveField, FieldRule> = {
  sets: { min: 1, max: 20, optional: false, decimals: 0 },
  reps: { min: 1, max: 100, optional: false, decimals: 0 },
  weightKg: { min: 0, max: 1000, optional: true, decimals: 1 },
  restSeconds: { min: 0, max: 600, optional: true, decimals: 0 },
  tempoSeconds: { min: 1, max: 10, optional: true, decimals: 1 },
  plannedSeconds: { min: 5, max: 3600, optional: false, decimals: 0 }
};

/** The exercise types whose moves are timed rather than counted. */
const TIMED_TYPES: ReadonlySet<string> = new Set(['CARDIO', 'MOBILITY']);

export type WidthBand = 'wide' | 'medium' | 'narrow';

/** The table's own width decides its arrangement, never the viewport (spec section 0). */
export function widthBand(width: number): WidthBand {
  if (width >= 900) {
    return 'wide';
  }
  return width >= 600 ? 'medium' : 'narrow';
}

export function renumber(entries: readonly PlanSetEntry[]): PlanSetEntry[] {
  return entries.map((entry, index) => (entry.position === index + 1 ? entry : { ...entry, position: index + 1 }));
}

export function moveEntry(entries: readonly PlanSetEntry[], from: number, to: number): PlanSetEntry[] {
  if (from === to || from < 0 || to < 0 || from >= entries.length || to >= entries.length) {
    return [...entries];
  }
  const next = [...entries];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return renumber(next);
}

export function removeEntry(entries: readonly PlanSetEntry[], index: number): PlanSetEntry[] {
  return renumber(entries.filter((_, i) => i !== index));
}

/** The number a box holds, or undefined when the text is not a number (the box then reverts). */
export function parseField(field: MoveField, raw: string): number | null | undefined {
  const rule = RULES[field];
  const text = raw.trim();
  if (text === '') {
    return rule.optional ? null : undefined;
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  const factor = 10 ** rule.decimals;
  return Math.round(Math.min(rule.max, Math.max(rule.min, value)) * factor) / factor;
}

export function fieldBounds(field: MoveField): { min: number; max: number } {
  return { min: RULES[field].min, max: RULES[field].max };
}

/** Sets one box of one row. A value that cannot be read leaves the row as it was. */
export function patchField(entries: readonly PlanSetEntry[], index: number, field: MoveField, raw: string): PlanSetEntry[] {
  const parsed = parseField(field, raw);
  if (parsed === undefined || index < 0 || index >= entries.length || entries[index][field] === parsed) {
    return [...entries];
  }
  return entries.map((entry, i) => (i === index ? { ...entry, [field]: parsed } : entry));
}

export function patchNotes(entries: readonly PlanSetEntry[], index: number, notes: string): PlanSetEntry[] {
  const value = notes.trim() === '' ? null : notes.slice(0, 300);
  return entries.map((entry, i) => (i === index ? { ...entry, notes: value } : entry));
}

/** A new row for a picked exercise. A timed move counts seconds instead of reps. */
export function newEntry(picked: PickedExercise, position: number, timeBasedDefault: boolean): PlanSetEntry {
  const timeBased = picked.timeBased || timeBasedDefault;
  return {
    entryType: 'SET',
    exerciseId: picked.exerciseId,
    exerciseName: picked.exerciseName,
    muscleLine: picked.muscleLine,
    thumbnailUrl: picked.thumbnailUrl,
    position,
    sets: timeBased ? 1 : 3,
    reps: timeBased ? null : 10,
    weightKg: null,
    restSeconds: timeBased ? 30 : 60,
    tempoSeconds: null,
    timeBased,
    plannedSeconds: timeBased ? 45 : null,
    notes: null,
    bodyweight: picked.bodyweight ?? false
  };
}

export function appendEntry(entries: readonly PlanSetEntry[], picked: PickedExercise, timeBasedDefault: boolean): PlanSetEntry[] {
  return renumber([...entries, newEntry(picked, entries.length + 1, timeBasedDefault)]);
}

/** Swapping keeps the sets, reps, weight, rest, tempo and notes; only the exercise changes. */
export function swapExercise(entries: readonly PlanSetEntry[], index: number, picked: PickedExercise): PlanSetEntry[] {
  return entries.map((entry, i) =>
    i === index
      ? {
          ...entry,
          exerciseId: picked.exerciseId,
          exerciseName: picked.exerciseName,
          muscleLine: picked.muscleLine,
          thumbnailUrl: picked.thumbnailUrl,
          bodyweight: picked.bodyweight ?? false
        }
      : entry
  );
}

function label(value: string | null | undefined): string {
  return (value ?? '').replaceAll('_', ' ').toLowerCase().trim();
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "chest · arms · dumbbell", the line under a move's name in the table. */
export function muscleLineOf(exercise: Exercise): string {
  const secondary = (exercise.secondaryMuscleGroups ?? []).map(label).filter(Boolean);
  const parts = [label(exercise.primaryMuscleGroup), secondary.join(', '), label(exercise.equipment)];
  return parts.filter((part) => part && part !== 'none').join(' · ');
}

/** "Chest · shoulders, triceps · Dumbbell · Beginner", the line under a name in the picker. */
export function pickerLineOf(exercise: Exercise): string {
  const secondary = (exercise.secondaryMuscleGroups ?? []).map(label).filter(Boolean);
  const parts = [
    capital(label(exercise.primaryMuscleGroup)),
    secondary.join(', '),
    capital(label(exercise.equipment)),
    capital(label(exercise.difficulty))
  ];
  return parts.filter((part) => part && part.toLowerCase() !== 'none').join(' · ');
}

export function thumbnailOf(exercise: Exercise): string | null {
  return exercise.images?.[0]?.url ?? exercise.imageUrls?.[0] ?? exercise.animationUrl ?? null;
}

export function pickedFrom(exercise: Exercise): PickedExercise | null {
  if (!exercise.exerciseId) {
    return null;
  }
  return {
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.name,
    muscleLine: muscleLineOf(exercise),
    thumbnailUrl: thumbnailOf(exercise),
    timeBased: TIMED_TYPES.has(exercise.exerciseType),
    bodyweight: isBodyweight(exercise.equipment)
  };
}
