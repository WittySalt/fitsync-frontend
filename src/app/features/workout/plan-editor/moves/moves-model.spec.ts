import { Exercise } from '../../../../core/fitsync.models';
import {
  PickedExercise,
  PlanSetEntry,
  appendEntry,
  moveEntry,
  muscleLineOf,
  newEntry,
  parseField,
  patchField,
  patchNotes,
  pickedFrom,
  pickerLineOf,
  removeEntry,
  renumber,
  swapExercise,
  widthBand
} from './moves-model';

const picked = (id: string, overrides: Partial<PickedExercise> = {}): PickedExercise => ({
  exerciseId: id,
  exerciseName: `Move ${id}`,
  muscleLine: 'chest',
  thumbnailUrl: null,
  timeBased: false,
  ...overrides
});

function three(): PlanSetEntry[] {
  return ['a', 'b', 'c'].reduce<PlanSetEntry[]>((all, id) => appendEntry(all, picked(id), false), []);
}

describe('moves model', () => {
  it('picks the width band from the component width', () => {
    expect(widthBand(1120)).toBe('wide');
    expect(widthBand(900)).toBe('wide');
    expect(widthBand(899)).toBe('medium');
    expect(widthBand(600)).toBe('medium');
    expect(widthBand(599)).toBe('narrow');
    expect(widthBand(360)).toBe('narrow');
  });

  it('appends rows with positions counting from one and sensible defaults', () => {
    const rows = three();
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3]);
    expect(rows[0]).toEqual(jasmine.objectContaining({ entryType: 'SET', sets: 3, reps: 10, restSeconds: 60, timeBased: false, plannedSeconds: null }));
  });

  it('makes a time-based row for a timed exercise or a mobility day', () => {
    const timedExercise = newEntry(picked('x', { timeBased: true }), 1, false);
    const mobilityDay = newEntry(picked('y'), 1, true);
    for (const row of [timedExercise, mobilityDay]) {
      expect(row.timeBased).toBeTrue();
      expect(row.reps).toBeNull();
      expect(row.plannedSeconds).toBe(45);
    }
  });

  it('moves a row and renumbers every row', () => {
    const moved = moveEntry(three(), 0, 2);
    expect(moved.map((row) => row.exerciseId)).toEqual(['b', 'c', 'a']);
    expect(moved.map((row) => row.position)).toEqual([1, 2, 3]);
  });

  it('leaves the list alone for a move that goes nowhere', () => {
    expect(moveEntry(three(), 1, 1).map((row) => row.exerciseId)).toEqual(['a', 'b', 'c']);
    expect(moveEntry(three(), 0, 5).map((row) => row.exerciseId)).toEqual(['a', 'b', 'c']);
    expect(moveEntry(three(), -1, 1).map((row) => row.exerciseId)).toEqual(['a', 'b', 'c']);
  });

  it('removes a row and renumbers', () => {
    const rest = removeEntry(three(), 1);
    expect(rest.map((row) => row.exerciseId)).toEqual(['a', 'c']);
    expect(rest.map((row) => row.position)).toEqual([1, 2]);
  });

  it('renumbers without touching rows that are already right', () => {
    const rows = three();
    expect(renumber(rows)[0]).toBe(rows[0]);
  });

  it('reads a box: clamps, rounds, and treats blank as unset only for optional fields', () => {
    expect(parseField('sets', '4')).toBe(4);
    expect(parseField('sets', '99')).toBe(20);
    expect(parseField('sets', '0')).toBe(1);
    expect(parseField('sets', '')).toBeUndefined();
    expect(parseField('sets', 'abc')).toBeUndefined();
    expect(parseField('weightKg', '')).toBeNull();
    expect(parseField('weightKg', '22.54')).toBe(22.5);
    expect(parseField('tempoSeconds', '0.2')).toBe(1);
    expect(parseField('tempoSeconds', '3')).toBe(3);
    expect(parseField('restSeconds', '-5')).toBe(0);
  });

  it('patches one box of one row and ignores text it cannot read', () => {
    const rows = three();
    const heavier = patchField(rows, 1, 'weightKg', '20');
    expect(heavier[1].weightKg).toBe(20);
    expect(heavier[0]).toBe(rows[0]);
    expect(patchField(rows, 1, 'sets', 'x')[1].sets).toBe(3);
    expect(patchField(rows, 9, 'sets', '4').length).toBe(3);
  });

  it('stores a note, and clears it when blank', () => {
    const rows = patchNotes(three(), 0, 'Pause one second at the bottom');
    expect(rows[0].notes).toBe('Pause one second at the bottom');
    expect(patchNotes(rows, 0, '   ')[0].notes).toBeNull();
  });

  it('swaps the exercise and keeps sets, reps, weight and notes', () => {
    const rows = patchNotes(patchField(three(), 1, 'weightKg', '30'), 1, 'slow');
    const swapped = swapExercise(rows, 1, picked('z', { exerciseName: 'Cable Fly', muscleLine: 'chest · cable' }));
    expect(swapped[1]).toEqual(jasmine.objectContaining({ exerciseId: 'z', exerciseName: 'Cable Fly', muscleLine: 'chest · cable', weightKg: 30, sets: 3, reps: 10, notes: 'slow', position: 2 }));
  });

  describe('exercise lines', () => {
    const bench: Exercise = {
      exerciseId: 'e1',
      code: 'BENCH',
      name: 'Dumbbell Bench Press',
      description: '',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'CHEST',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER',
      status: 'ACTIVE',
      custom: false,
      secondaryMuscleGroups: ['SHOULDERS', 'ARMS'],
      images: [{ position: 1, url: '/a.png' }]
    };

    it('builds the table line in lower case', () => {
      expect(muscleLineOf(bench)).toBe('chest · shoulders, arms · dumbbell');
    });

    it('builds the picker line with the level', () => {
      expect(pickerLineOf(bench)).toBe('Chest · shoulders, arms · Dumbbell · Beginner');
    });

    it('leaves out a missing secondary group and no equipment', () => {
      expect(muscleLineOf({ ...bench, secondaryMuscleGroups: [], equipment: 'NONE' })).toBe('chest');
    });

    it('turns an exercise into a pick with its first image and its timed-ness', () => {
      expect(pickedFrom(bench)).toEqual(jasmine.objectContaining({ exerciseId: 'e1', thumbnailUrl: '/a.png', timeBased: false }));
      expect(pickedFrom({ ...bench, exerciseType: 'MOBILITY' })?.timeBased).toBeTrue();
      expect(pickedFrom({ ...bench, exerciseId: null })).toBeNull();
    });
  });
});
