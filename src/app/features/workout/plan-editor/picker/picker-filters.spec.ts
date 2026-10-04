import { Exercise } from '../../../../core/fitsync.models';
import { CARDIO_CHIP, MUSCLE_CHIPS, mergeExercises, ownedEquipmentCodes, searchOptionsFor, stepsOf } from './picker-filters';

const ex = (id: string, name: string): Exercise => ({
  exerciseId: id,
  code: id,
  name,
  description: '',
  exerciseType: 'STRENGTH',
  primaryMuscleGroup: 'CHEST',
  equipment: 'DUMBBELL',
  difficulty: 'BEGINNER',
  status: 'ACTIVE',
  custom: false
});

describe('picker filters', () => {
  const catalogue = ['BODYWEIGHT', 'DUMBBELL', 'BARBELL', 'BAND', 'MACHINE', 'NONE'];

  it('offers the seven groups and Cardio as muscle chips', () => {
    expect(MUSCLE_CHIPS.map((chip) => chip.label)).toEqual(['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Glutes', 'Legs', 'Cardio']);
  });

  it('maps the inventory to catalogue equipment plus bodyweight', () => {
    expect(ownedEquipmentCodes(['DUMBBELLS', 'BANDS'], catalogue)?.sort()).toEqual(['BAND', 'BODYWEIGHT', 'DUMBBELL', 'NONE']);
  });

  it('puts no restriction on a full gym or an empty profile', () => {
    expect(ownedEquipmentCodes(['FULL_GYM', 'DUMBBELLS'], catalogue)).toBeNull();
    expect(ownedEquipmentCodes([], catalogue)).toBeNull();
    expect(ownedEquipmentCodes(undefined, catalogue)).toBeNull();
  });

  it('keeps a pull-up bar person to bodyweight moves', () => {
    expect(ownedEquipmentCodes(['PULL_UP_BAR'], catalogue)?.sort()).toEqual(['BODYWEIGHT', 'NONE']);
  });

  it('builds the catalogue query from the filters', () => {
    expect(searchOptionsFor({ q: ' bench ', muscle: 'CHEST', equipment: 'DUMBBELL', level: 'BEGINNER' }, 1)).toEqual({
      q: 'bench',
      exerciseType: undefined,
      primaryMuscleGroup: 'CHEST',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER',
      page: 1,
      size: 20
    });
  });

  it('asks for the cardio type, not a muscle group, for the Cardio chip', () => {
    const options = searchOptionsFor({ q: '', muscle: CARDIO_CHIP, equipment: null, level: null }, 0);
    expect(options.exerciseType).toBe('CARDIO');
    expect(options.primaryMuscleGroup).toBeUndefined();
  });

  it('merges several lists by name without repeats, and keeps one list in server order', () => {
    expect(mergeExercises([[ex('2', 'Row'), ex('1', 'Curl')], [ex('1', 'Curl'), ex('3', 'Bench')]]).map((e) => e.name)).toEqual(['Bench', 'Curl', 'Row']);
    expect(mergeExercises([[ex('2', 'Row'), ex('1', 'Curl')]]).map((e) => e.name)).toEqual(['Row', 'Curl']);
  });

  it('uses the catalogue steps, at most three', () => {
    expect(stepsOf({ shortSteps: ['One', 'Two', 'Three', 'Four'], description: 'x' })).toEqual(['One', 'Two', 'Three']);
  });

  it('falls back to the first three sentences of the description', () => {
    expect(stepsOf({ shortSteps: [], description: 'Lie back. Press up. Lower slowly. Repeat. Rest.' })).toEqual(['Lie back.', 'Press up.', 'Lower slowly.']);
    expect(stepsOf(null)).toEqual([]);
  });
});
