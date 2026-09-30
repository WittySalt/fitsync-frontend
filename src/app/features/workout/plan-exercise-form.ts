import { FormArray, FormBuilder, Validators } from '@angular/forms';

import { WorkoutPlanExercise, WorkoutPlanExerciseInput } from '../../core/fitsync.models';

/**
 * The form group behind one exercise row of a plan. The plain list and every day of a week are
 * built from the same group, so the row, its picker and the request it produces behave the same
 * wherever it sits. The name and type are kept beside the id because the row shows the chosen
 * exercise by name and decides between sets and a duration by type.
 */
export function createExerciseGroup(fb: FormBuilder) {
  return fb.group({
    exerciseId: ['', Validators.required],
    targetSets: [3 as number | null, [Validators.min(0)]],
    targetReps: [8 as number | null, [Validators.min(0)]],
    targetDurationSeconds: [null as number | null, [Validators.min(0)]],
    targetWeightKg: [null as number | null, [Validators.min(0)]],
    restSeconds: [90 as number | null, [Validators.min(0)]],
    notes: ['', Validators.maxLength(300)],
    exerciseName: [''],
    exerciseType: [null as string | null]
  });
}

export type ExerciseGroup = ReturnType<typeof createExerciseGroup>;

// Exercise types whose plan targets are time-based (a duration) rather than sets by reps.
export const TIMED_EXERCISE_TYPES: ReadonlySet<string> = new Set(['CARDIO', 'MOBILITY']);

export function createExerciseArray(fb: FormBuilder, rows = 1): FormArray<ExerciseGroup> {
  return fb.array(Array.from({ length: rows }, () => createExerciseGroup(fb)));
}

export function resetExerciseGroup(group: ExerciseGroup): void {
  group.reset({
    exerciseId: '',
    targetSets: 3,
    targetReps: 8,
    targetDurationSeconds: null,
    targetWeightKg: null,
    restSeconds: 90,
    notes: '',
    exerciseName: '',
    exerciseType: null
  });
}

/** Copies a saved plan exercise into a row. */
export function fillExerciseGroup(group: ExerciseGroup, exercise: WorkoutPlanExercise): void {
  group.patchValue({
    exerciseId: exercise.exerciseId ?? '',
    targetSets: exercise.targetSets ?? 0,
    targetReps: exercise.targetReps ?? 0,
    targetDurationSeconds: exercise.targetDurationSeconds ?? null,
    targetWeightKg: exercise.targetWeightKg,
    restSeconds: exercise.restSeconds ?? 0,
    notes: exercise.notes,
    exerciseName: exercise.exerciseNameSnapshot || '',
    // Saved plans don't carry the exercise type; infer "timed" from a saved duration target so
    // the row shows the right inputs on edit.
    exerciseType: (exercise.targetDurationSeconds ?? 0) > 0 ? 'CARDIO' : 'STRENGTH'
  });
}

export function isTimedExerciseGroup(group: ExerciseGroup): boolean {
  const type = group.controls.exerciseType.value;
  return !!type && TIMED_EXERCISE_TYPES.has(type);
}

/** A row the user has not touched at all, which is dropped rather than moved or saved. */
export function isBlankExerciseGroup(group: ExerciseGroup): boolean {
  return !group.controls.exerciseId.value && !group.controls.exerciseName.value;
}

function optionalNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The request rows for the chosen exercises, numbered from one in the order given. */
export function exerciseGroupsToInputs(groups: readonly ExerciseGroup[]): WorkoutPlanExerciseInput[] {
  return groups
    .filter((group) => Boolean(group.controls.exerciseId.value))
    .map((group, index) => {
      const exercise = group.getRawValue();
      const timed = isTimedExerciseGroup(group);
      return {
        exerciseId: exercise.exerciseId as string,
        sequence: index + 1,
        targetSets: timed ? null : optionalNumber(exercise.targetSets),
        targetReps: timed ? null : optionalNumber(exercise.targetReps),
        targetWeightKg: timed ? null : optionalNumber(exercise.targetWeightKg),
        targetDurationSeconds: timed ? optionalNumber(exercise.targetDurationSeconds) : null,
        targetDistanceKm: null,
        restSeconds: optionalNumber(exercise.restSeconds),
        notes: exercise.notes ?? '',
        setTargets: []
      };
    });
}
