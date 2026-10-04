import { DraftMove } from './plan-draft';
import { movesToSetEntries, moveToSetEntry, setEntriesToMoves, setEntryToMove } from './plan-move-mapper';

const bench: DraftMove = {
  exerciseId: 'bench',
  name: 'Dumbbell Bench Press',
  meta: 'chest · arms · dumbbell',
  imageUrl: 'https://img/bench.jpg',
  timed: false,
  sets: 3,
  reps: 10,
  durationSeconds: null,
  weightKg: 20,
  restSeconds: 75,
  tempoSeconds: 3,
  notes: 'pause at the bottom',
  primaryGroups: ['CHEST'],
  secondaryGroups: ['ARMS']
};

const plank: DraftMove = {
  ...bench,
  exerciseId: 'plank',
  name: 'Plank',
  meta: 'core',
  imageUrl: null,
  timed: true,
  sets: 2,
  reps: null,
  durationSeconds: 40,
  weightKg: null,
  tempoSeconds: null,
  notes: '',
  primaryGroups: ['CORE'],
  secondaryGroups: []
};

describe('plan move mapper', () => {
  it('maps a counted move to a SET row', () => {
    expect(moveToSetEntry(bench, 2)).toEqual({
      entryType: 'SET',
      exerciseId: 'bench',
      exerciseName: 'Dumbbell Bench Press',
      muscleLine: 'chest · arms · dumbbell',
      thumbnailUrl: 'https://img/bench.jpg',
      position: 2,
      sets: 3,
      reps: 10,
      weightKg: 20,
      restSeconds: 75,
      tempoSeconds: 3,
      timeBased: false,
      plannedSeconds: null,
      notes: 'pause at the bottom'
    });
  });

  it('maps a timed move with seconds instead of reps and a blank note to null', () => {
    const row = moveToSetEntry(plank, 1);
    expect(row.timeBased).toBe(true);
    expect(row.reps).toBeNull();
    expect(row.plannedSeconds).toBe(40);
    expect(row.notes).toBeNull();
  });

  it('numbers rows from 1 in list order', () => {
    expect(movesToSetEntries([bench, plank]).map((row) => row.position)).toEqual([1, 2]);
  });

  it('round-trips both kinds of move without losing a field', () => {
    const rows = movesToSetEntries([bench, plank]);
    expect(setEntriesToMoves(rows, [bench, plank])).toEqual([bench, plank]);
  });

  it('keeps the muscle groups when rows are reordered or one is removed', () => {
    const rows = movesToSetEntries([bench, plank]);
    const back = setEntriesToMoves([rows[1]], [bench, plank]);
    expect(back[0].primaryGroups).toEqual(['CORE']);
    expect(setEntriesToMoves([rows[1], rows[0]], [bench, plank])[1].primaryGroups).toEqual(['CHEST']);
  });

  it('drops the groups of a swapped exercise rather than keeping the old ones', () => {
    const swapped = { ...moveToSetEntry(bench, 1), exerciseId: 'fly', exerciseName: 'Fly' };
    const move = setEntryToMove(swapped, undefined);
    expect(move.primaryGroups).toBeUndefined();
    expect(move.name).toBe('Fly');
  });

  it('turns a null note into an empty string and clears reps on a timed row', () => {
    const move = setEntryToMove({ ...moveToSetEntry(plank, 1), reps: 8 }, plank);
    expect(move.notes).toBe('');
    expect(move.reps).toBeNull();
    expect(move.durationSeconds).toBe(40);
  });
});
