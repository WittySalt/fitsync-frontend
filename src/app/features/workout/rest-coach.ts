import { WorkoutExerciseLog } from '../../core/fitsync.models';
import { formatTargetDuration } from './player-targets';

const WORDS = ['no', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

function count(value: number): string {
  return value >= 1 && value <= 10 ? WORDS[value] : String(value);
}

function plural(value: number, noun: string): string {
  return `${count(value)} ${noun}${value === 1 ? '' : 's'}`;
}

function amount(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** What the logged sets of one exercise share, as a short tail: ", at 20 kg" or ", 45 sec each". */
function sharedTail(log: WorkoutExerciseLog): string {
  const done = log.sets.filter((set) => set.logged && set.status !== 'SKIPPED');
  const weights = new Set(done.map((set) => set.weightKg ?? 0).filter((value) => value > 0));
  if (weights.size === 1) {
    return `, at ${amount([...weights][0])} kg`;
  }
  if (weights.size > 1) {
    const sorted = [...weights].sort((a, b) => a - b);
    return `, from ${amount(sorted[0])} to ${amount(sorted[sorted.length - 1])} kg`;
  }
  const seconds = new Set(done.map((set) => set.durationSeconds ?? 0).filter((value) => value > 0));
  return seconds.size === 1 && done.every((set) => !set.reps) ? `, ${formatTargetDuration([...seconds][0])} each` : '';
}

/**
 * One line of fact for the rest screen, built from the workout itself. It says what has been done or
 * what is left, and never what the person should do next.
 */
export function restCoachLine(log: WorkoutExerciseLog | null, setsLeftInExercise: number, setsLeftInWorkout: number): string {
  if (log) {
    const done = log.sets.filter((set) => set.logged && set.status !== 'SKIPPED').length;
    if (done > 0 && setsLeftInExercise === 0) {
      return `${plural(done, 'set')} of ${log.exerciseNameSnapshot.toLowerCase()} done${sharedTail(log)}.`;
    }
  }
  if (setsLeftInWorkout > 0) {
    return `${plural(setsLeftInWorkout, 'set')} left in this workout.`;
  }
  return 'Every set of this workout is done.';
}

export function restCoachQuestion(exerciseName: string): string {
  return `How did my ${exerciseName.toLowerCase()} sets go?`;
}
