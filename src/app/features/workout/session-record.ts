import { WorkoutExerciseLog, WorkoutExerciseSetLog, WorkoutSessionDetail } from '../../core/fitsync.models';

/** How a set of a finished session went. */
export type SetState = 'done' | 'skipped' | 'open';

/** One cell of the set table: the value, and a quieter note beside it (such as the planned rest). */
export interface RecordCell {
  text: string;
  note?: string;
  muted?: boolean;
}

/** One set as its row of the table: its state and a cell for each column the exercise shows. */
export interface RecordRow {
  setNumber: number;
  state: SetState;
  done: RecordCell;
  rest: RecordCell | null;
  rpe: RecordCell | null;
  notes: RecordCell | null;
}

/** One exercise as its card: its summary line, which columns it shows, and its rows. */
export interface RecordExercise {
  key: string;
  sequence: number;
  name: string;
  summary: string;
  /** No set of it was done: the card is folded to one line. */
  untouched: boolean;
  doneHeading: string;
  columns: { rest: boolean; rpe: boolean; notes: boolean };
  rows: RecordRow[];
}

/** One figure of the row at the top of the session page. */
export interface RecordStat {
  label: string;
  value: string;
  unit: string;
  note: string;
}

/** The empty value, the same dash everywhere on the page. */
export const NONE = '—';

/** A planned rest is named beside the rest taken when they differ by a fifth and ten seconds. */
const REST_NOTE_SHARE = 0.2;
const REST_NOTE_SECONDS = 10;

export function setState(set: WorkoutExerciseSetLog): SetState {
  if (set.status === 'SKIPPED') {
    return 'skipped';
  }
  return set.logged || set.status === 'DONE' ? 'done' : 'open';
}

/** 0:41, 1:12, 12:05. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function amount(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** "10 × 20 kg", "12 reps", "0:45", "5.75 km": what one set did. */
export function setValues(set: WorkoutExerciseSetLog): string {
  if (set.reps != null && set.reps > 0) {
    return set.weightKg != null && set.weightKg > 0 ? `${set.reps} × ${amount(set.weightKg)} kg` : `${set.reps} reps`;
  }
  const parts: string[] = [];
  if (set.durationSeconds != null && set.durationSeconds > 0) {
    parts.push(clock(set.durationSeconds));
  }
  if (set.distanceKm != null && set.distanceKm > 0) {
    parts.push(`${amount(set.distanceKm)} km`);
  }
  return parts.join(' · ') || NONE;
}

/**
 * The rest after a set: the rest taken, with the plan beside it when they differ enough to matter;
 * the planned rest, quietly, for a set whose rest was not timed; nothing for a set not done.
 */
export function restCell(set: WorkoutExerciseSetLog, state: SetState): RecordCell {
  if (state !== 'done') {
    return { text: NONE, muted: true };
  }
  const taken = set.restTakenSeconds;
  const planned = set.restSeconds;
  if (taken != null) {
    const far = planned != null && planned > 0
      && Math.abs(taken - planned) >= REST_NOTE_SECONDS
      && Math.abs(taken - planned) / planned >= REST_NOTE_SHARE;
    return far ? { text: clock(taken), note: `${planned} planned` } : { text: clock(taken) };
  }
  return planned != null && planned > 0 ? { text: clock(planned), note: 'planned', muted: true } : { text: NONE, muted: true };
}

function exerciseSummary(log: WorkoutExerciseLog, done: WorkoutExerciseSetLog[]): string {
  const total = log.sets.length;
  if (!done.length) {
    return `0 of ${total} sets`;
  }
  const parts = [`${done.length} of ${total} ${total === 1 ? 'set' : 'sets'} done`];
  const reps = done.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  const volume = done.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightKg ?? 0), 0);
  const seconds = done.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0);
  const km = done.reduce((sum, set) => sum + (set.distanceKm ?? 0), 0);
  if (reps > 0) {
    parts.push(`${reps} reps`);
  }
  if (volume > 0) {
    parts.push(`${amount(volume)} kg`);
  }
  if (!reps && seconds > 0) {
    parts.push(`${clock(seconds)} ${km > 0 ? '' : 'held'}`.trim());
  }
  if (km > 0) {
    parts.push(`${amount(km)} km`);
  }
  return parts.join(' · ');
}

/** The exercises of a session as cards, in order, each with only the columns that hold something. */
export function recordExercises(session: WorkoutSessionDetail): RecordExercise[] {
  return [...session.exercises]
    .sort((a, b) => a.sequence - b.sequence)
    .map((log) => {
      const sets = [...log.sets].sort((a, b) => a.setNumber - b.setNumber);
      const done = sets.filter((set) => setState(set) === 'done');
      const timed = done.length > 0 && done.every((set) => !(set.reps && set.reps > 0));
      const rows = sets.map<RecordRow>((set) => {
        const state = setState(set);
        return {
          setNumber: set.setNumber,
          state,
          done: state === 'done'
            ? { text: setValues(set) }
            : { text: state === 'skipped' ? 'Skipped' : 'Not done', muted: true },
          rest: restCell(set, state),
          rpe: state === 'done' && set.perceivedExertion != null ? { text: String(set.perceivedExertion) } : { text: NONE, muted: true },
          notes: set.notes ? { text: set.notes } : { text: NONE, muted: true }
        };
      });
      const columns = {
        rest: sets.some((set) => setState(set) === 'done' && (set.restTakenSeconds != null || (set.restSeconds ?? 0) > 0)),
        rpe: sets.some((set) => set.perceivedExertion != null),
        notes: sets.some((set) => !!set.notes)
      };
      return {
        key: log.exerciseLogId || `${log.sequence}`,
        sequence: log.sequence,
        name: log.exerciseNameSnapshot,
        summary: exerciseSummary(log, done),
        untouched: sets.length > 0 && done.length === 0,
        doneHeading: timed ? 'Time' : 'Done',
        columns,
        rows: rows.map((row) => ({
          ...row,
          rest: columns.rest ? row.rest : null,
          rpe: columns.rpe ? row.rpe : null,
          notes: columns.notes ? row.notes : null
        }))
      };
    });
}

/** Sets of the session that were done. */
export function doneSetCount(session: WorkoutSessionDetail): number {
  return session.exercises.reduce((sum, log) => sum + log.sets.filter((set) => setState(set) === 'done').length, 0);
}

/** The figures at the top of the session page: time, sets, volume or distance, calories and effort. */
export function recordStats(session: WorkoutSessionDetail): RecordStat[] {
  const totalSets = session.exercises.reduce((sum, log) => sum + log.sets.length, 0);
  const volume = session.exercises.reduce(
    (sum, log) => sum + log.sets.filter((set) => setState(set) === 'done').reduce((inner, set) => inner + (set.reps ?? 0) * (set.weightKg ?? 0), 0),
    0
  );
  const stats: RecordStat[] = [
    {
      label: 'Duration',
      value: session.durationMinutes != null ? String(session.durationMinutes) : NONE,
      unit: session.durationMinutes != null ? 'min' : '',
      note: ''
    }
  ];
  if (totalSets > 0) {
    stats.push({ label: 'Sets', value: String(doneSetCount(session)), unit: `of ${totalSets}`, note: '' });
  }
  if (session.distanceKm != null && session.distanceKm > 0) {
    stats.push({ label: 'Distance', value: amount(session.distanceKm), unit: 'km', note: '' });
  } else if (volume > 0) {
    stats.push({ label: 'Volume', value: Math.round(volume).toLocaleString('en-US'), unit: 'kg', note: '' });
  }
  stats.push({
    label: 'Calories',
    value: session.caloriesBurned != null ? String(session.caloriesBurned) : NONE,
    unit: session.caloriesBurned != null ? 'kcal' : '',
    note: session.caloriesBurned != null && session.caloriesEstimated ? 'estimated' : ''
  });
  stats.push({
    label: 'Effort',
    value: session.perceivedExertion != null ? String(session.perceivedExertion) : NONE,
    unit: session.perceivedExertion != null ? 'of 10' : '',
    note: session.perceivedExertion != null && session.effortEstimated ? 'estimated' : ''
  });
  return stats;
}
