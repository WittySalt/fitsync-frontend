import { MonthMuscleInsight } from '../../../../core/fitsync.models';
import { MUSCLE_GROUPS, groupLabel } from '../../../../shared/charts/muscle-figure/muscle-figure';
import { liftChangePct } from '../lift-math';
import { ActivityCard, Lift, MuscleSets, RecordEntry, TrainingProgress } from '../training.models';
import { daysBetween, hm, kg, plural, shortDate, signedPct } from '../training-format';

export interface LiftRow {
  key: string;
  name: string;
  sub: string;
  values: number[];
  start: string;
  end: string;
  change: string;
}

/** A lift of the card: est. best single from the first to the latest session, and its change. */
export function liftRow(lift: Lift): LiftRow | null {
  if (lift.e1rm.length < 2) {
    return null;
  }
  const first = lift.e1rm[0].value;
  const last = lift.e1rm[lift.e1rm.length - 1].value;
  const records = lift.e1rm.filter((point) => point.isRecord).length;
  const pct = liftChangePct(lift);
  return {
    key: lift.exerciseId || lift.name,
    name: lift.name,
    sub: `est. best single, ${plural(records, 'record')}`,
    values: lift.e1rm.map((point) => point.value),
    start: kg(first),
    end: `${kg(last)} kg`,
    change: pct === null ? '' : signedPct(pct)
  };
}

/**
 * The radar's figures. Sessions that touched each area when the backend counts them; until then
 * the hard sets a week stand in, and the caption says which it is.
 */
export function radarFigures(muscles: MuscleSets): { muscles: MonthMuscleInsight[]; caption: string } {
  const bySessions = muscles.groups.some((group) => group.sessions !== null);
  const known = new Map(muscles.groups.map((group) => [group.group, group]));
  const list = MUSCLE_GROUPS.map((code) => {
    const group = known.get(code);
    const count = group ? (bySessions ? (group.sessions ?? 0) : Math.round(group.setsPerWeek)) : 0;
    return { group: code, label: groupLabel(code), sessions: count };
  }).filter((entry) => entry.sessions > 0);
  return { muscles: list, caption: bySessions ? 'Sessions touching each area' : 'Hard sets a week in each area' };
}

export function daysTrainedLine(progress: TrainingProgress): string {
  const days = new Set(progress.calendar.map((day) => day.date)).size;
  const weeks = Math.max(1, Math.round((daysBetween(progress.period.from, progress.period.to) + 1) / 7));
  return `${plural(days, 'day')} trained in ${plural(weeks, 'week')}`;
}

export function activityLine(activity: ActivityCard): string {
  return `${plural(activity.sessions, 'session')} · ${hm(activity.minutes)}`;
}

/** "4 new personal records in these 4 weeks. The latest: deadlift, est. best single 93.3 kg on 2 Oct." */
export function recordsLine(records: readonly RecordEntry[], periodWords: string): string {
  if (!records.length) {
    return '';
  }
  const latest = records[0];
  const amount = latest.unit === 'kg' ? `est. best single ${kg(latest.value)} kg` : `${kg(latest.value)} ${latest.unit}`;
  return `${records.length === 1 ? '1 new personal record' : `${records.length} new personal records`} in ${periodWords}. The latest: ${latest.name.toLowerCase()}, ${amount} on ${shortDate(latest.date)}.`;
}
