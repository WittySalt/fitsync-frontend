import { WorkoutExerciseLog, WorkoutExerciseSetLog } from '../../core/fitsync.models';
import { restCoachLine, restCoachQuestion } from './rest-coach';

function set(n: number, values: Partial<WorkoutExerciseSetLog>): WorkoutExerciseSetLog {
  return {
    setLogId: `s${n}`, setNumber: n, reps: 10, weightKg: 20, durationSeconds: null, distanceKm: null,
    restSeconds: 30, perceivedExertion: null, logged: true, notes: '', ...values
  };
}

function log(name: string, sets: WorkoutExerciseSetLog[]): WorkoutExerciseLog {
  return {
    exerciseLogId: 'l1', exerciseId: 'e1', exerciseNameSnapshot: name, sequence: 1, performedSets: null,
    performedReps: null, totalVolumeKg: null, distanceKm: null, durationSeconds: null, averageHeartRate: null,
    maxHeartRate: null, notes: '', sets
  };
}

describe('rest coach line', () => {
  it('reports a finished exercise with the weight it was done at', () => {
    expect(restCoachLine(log('Bench Press', [set(1, {}), set(2, {}), set(3, {})]), 0, 9))
      .toBe('Three sets of bench press done, at 20 kg.');
  });

  it('gives the range when the weight changed', () => {
    expect(restCoachLine(log('Squat', [set(1, { weightKg: 20 }), set(2, { weightKg: 22.5 })]), 0, 4))
      .toBe('Two sets of squat done, from 20 to 22.5 kg.');
  });

  it('reports the time of timed sets', () => {
    expect(restCoachLine(log('Plank', [set(1, { reps: null, weightKg: null, durationSeconds: 45 })]), 0, 2))
      .toBe('One set of plank done, 45 sec each.');
  });

  it('reports the sets left when the exercise is not finished', () => {
    expect(restCoachLine(log('Bench Press', [set(1, {})]), 2, 2)).toBe('Two sets left in this workout.');
    expect(restCoachLine(log('Bench Press', [set(1, {})]), 2, 1)).toBe('One set left in this workout.');
  });

  it('says so when nothing is left, and never gives advice', () => {
    expect(restCoachLine(null, 0, 0)).toBe('Every set of this workout is done.');
  });

  it('asks about the exercise on screen', () => {
    expect(restCoachQuestion('Bench Press')).toBe('How did my bench press sets go?');
  });
});
