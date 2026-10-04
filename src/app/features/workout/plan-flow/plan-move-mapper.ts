import { PlanSetEntry } from '../plan-editor/moves/moves-model';
import { DraftMove } from './plan-draft';

/** A draft move as the moves table edits it. The table numbers its rows from 1 in list order. */
export function moveToSetEntry(move: DraftMove, position: number): PlanSetEntry {
  return {
    entryType: 'SET',
    exerciseId: move.exerciseId,
    exerciseName: move.name,
    muscleLine: move.meta,
    thumbnailUrl: move.imageUrl,
    position,
    sets: move.sets,
    reps: move.timed ? null : move.reps,
    weightKg: move.weightKg,
    restSeconds: move.restSeconds,
    tempoSeconds: move.tempoSeconds,
    timeBased: move.timed,
    plannedSeconds: move.timed ? move.durationSeconds : null,
    notes: move.notes.trim() === '' ? null : move.notes
  };
}

export function movesToSetEntries(moves: readonly DraftMove[]): PlanSetEntry[] {
  return moves.map((move, index) => moveToSetEntry(move, index + 1));
}

/**
 * A table row back to a draft move. The muscle groups feed the local coverage fallback and the
 * table does not carry them, so a row keeps the groups of the earlier move with the same exercise.
 */
export function setEntryToMove(entry: PlanSetEntry, earlier: DraftMove | undefined): DraftMove {
  const sameExercise = earlier?.exerciseId === entry.exerciseId;
  return {
    exerciseId: entry.exerciseId,
    name: entry.exerciseName,
    meta: entry.muscleLine,
    imageUrl: entry.thumbnailUrl,
    timed: entry.timeBased,
    sets: entry.sets,
    reps: entry.timeBased ? null : entry.reps,
    durationSeconds: entry.timeBased ? entry.plannedSeconds : null,
    weightKg: entry.weightKg,
    restSeconds: entry.restSeconds,
    tempoSeconds: entry.tempoSeconds,
    notes: entry.notes ?? '',
    ...(sameExercise && earlier.primaryGroups ? { primaryGroups: earlier.primaryGroups } : {}),
    ...(sameExercise && earlier.secondaryGroups ? { secondaryGroups: earlier.secondaryGroups } : {})
  };
}

/** Matches rows to earlier moves by exercise, so a reorder or a removal keeps each move's groups. */
export function setEntriesToMoves(entries: readonly PlanSetEntry[], earlier: readonly DraftMove[]): DraftMove[] {
  const pool = [...earlier];
  return entries.map((entry) => {
    const at = pool.findIndex((move) => move.exerciseId === entry.exerciseId);
    const match = at >= 0 ? pool.splice(at, 1)[0] : undefined;
    return setEntryToMove(entry, match);
  });
}
