import { Exercise, ExerciseDetail, ExerciseSearchOptions } from '../../../../core/fitsync.models';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from '../../../../shared/charts/muscle-figure/muscle-figure';

/** The page size of the picker's list; "Show more" asks for the next page. */
export const PICKER_PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;

export interface MuscleChip {
  code: string;
  label: string;
}

/** The seven groups of the catalogue and Cardio, which is an exercise type rather than a group. */
export const CARDIO_CHIP = 'CARDIO';
export const MUSCLE_CHIPS: MuscleChip[] = [
  ...MUSCLE_GROUPS.map((code) => ({ code: code as string, label: MUSCLE_GROUP_LABELS[code] })),
  { code: CARDIO_CHIP, label: 'Cardio' }
];

export const LEVEL_CHIPS = [
  { code: '', label: 'Any' },
  { code: 'BEGINNER', label: 'Beginner' },
  { code: 'INTERMEDIATE', label: 'Intermediate' },
  { code: 'ADVANCED', label: 'Advanced' }
];

/** What the profile calls its equipment, and the catalogue words that stand for it. */
const INVENTORY_TO_CATALOGUE: Record<string, string[]> = {
  DUMBBELLS: ['DUMBBELL'],
  BARBELL: ['BARBELL'],
  BANDS: ['BAND'],
  PULL_UP_BAR: [],
  KETTLEBELL: ['KETTLEBELL'],
  MACHINES: ['MACHINE', 'CABLE', 'CARDIO_MACHINE']
};

/**
 * The catalogue equipment "What I own" stands for: the person's inventory plus bodyweight, kept to
 * what the catalogue lists. Null means no restriction, for a full gym or a profile with no list.
 */
export function ownedEquipmentCodes(inventory: readonly string[] | null | undefined, catalogue: readonly string[]): string[] | null {
  const owned = (inventory ?? []).filter((item) => item !== 'NONE');
  if (!owned.length || owned.includes('FULL_GYM')) {
    return null;
  }
  const codes = new Set<string>(['BODYWEIGHT', 'NONE']);
  for (const item of owned) {
    for (const code of INVENTORY_TO_CATALOGUE[item] ?? []) {
      codes.add(code);
    }
  }
  const known = new Set(catalogue);
  return [...codes].filter((code) => !known.size || known.has(code));
}

export interface PickerFilters {
  q: string;
  muscle: string | null;
  equipment: string | null;
  level: string | null;
}

/** The catalogue query for the filters, without the equipment that "What I own" fans out. */
export function searchOptionsFor(filters: PickerFilters, page: number, size = PICKER_PAGE_SIZE): ExerciseSearchOptions {
  const cardio = filters.muscle === CARDIO_CHIP;
  return {
    q: filters.q.trim(),
    exerciseType: cardio ? 'CARDIO' : undefined,
    primaryMuscleGroup: filters.muscle && !cardio ? filters.muscle : undefined,
    equipment: filters.equipment || undefined,
    difficulty: filters.level || undefined,
    page,
    size
  };
}

/** Merges the pages of several single-equipment queries into one list, without repeats (by id, else code). */
export function mergeExercises(lists: readonly (readonly Exercise[])[]): Exercise[] {
  const seen = new Set<string>();
  const merged: Exercise[] = [];
  for (const exercise of lists.flat()) {
    const key = exercise.exerciseId ?? exercise.code;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(exercise);
    }
  }
  // One list keeps the server's order (relevance for a search); several are merged by name.
  return lists.length > 1 ? merged.sort((a, b) => a.name.localeCompare(b.name)) : merged;
}

/** Three short steps: the catalogue's own, or else the first three sentences of the description. */
export function stepsOf(detail: Pick<ExerciseDetail, 'shortSteps' | 'description'> | null): string[] {
  if (!detail) {
    return [];
  }
  const own = (detail.shortSteps ?? []).map((step) => step.trim()).filter(Boolean);
  if (own.length) {
    return own.slice(0, 3);
  }
  return (detail.description ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function imagesOf(detail: Pick<ExerciseDetail, 'images' | 'imageUrls'> | Exercise | null): string[] {
  if (!detail) {
    return [];
  }
  const urls = (detail.images ?? []).map((image) => image.url);
  return (urls.length ? urls : (detail.imageUrls ?? [])).slice(0, 3);
}
