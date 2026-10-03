import { SummaryLine } from '../../../shared/progress/progress.models';
import { liftChangePct } from '../training/lift-math';
import { ActivityCard, CalendarDay, Lift, SeriesPoint, TrainingProgress } from '../training/training.models';
import { addDays, hm, kg, mondayOf, plural, shortDate, signedPct } from '../training/training-format';

export interface LiftRow {
  key: string;
  name: string;
  start: string;
  end: string;
  change: string;
  points: SeriesPoint[];
}

/** A lift of the card: est. best single from the first to the latest session, and its change. */
export function liftRow(lift: Lift): LiftRow | null {
  if (lift.e1rm.length < 2) {
    return null;
  }
  const first = lift.e1rm[0].value;
  const last = lift.e1rm[lift.e1rm.length - 1].value;
  const pct = liftChangePct(lift);
  return {
    key: lift.exerciseId || lift.name,
    name: lift.name,
    start: kg(first),
    end: `${kg(last)} kg`,
    change: pct === null ? '' : signedPct(pct),
    points: lift.e1rm.map((point) => ({ label: point.date, value: point.value }))
  };
}

export function daysTrained(progress: TrainingProgress): number {
  return new Set(progress.calendar.map((day) => day.date)).size;
}

export function recordCount(progress: TrainingProgress): number {
  return progress.hero.records.value ?? progress.records.length;
}

/** "14 days" and "Trained in these 4 weeks, 7 new records". */
export function trainingHeadline(progress: TrainingProgress, periodWords: string): { figure: string; caption: string } {
  const records = recordCount(progress);
  const base = `Trained in ${periodWords}`;
  return {
    figure: plural(daysTrained(progress), 'day'),
    caption: records > 0 ? `${base}, ${records === 1 ? '1 new record' : `${records} new records`}` : base
  };
}

export interface ActivityRow {
  key: string;
  name: string;
  kind: string;
  meta: string;
  lines: SummaryLine[];
}

function meta(activity: ActivityCard): string {
  return `${plural(activity.sessions, 'session')} · ${hm(activity.minutes)}`;
}

/** Strength with its two lifts as "start → now" and the change; the others with the first line the server wrote. */
export function activityRows(progress: TrainingProgress): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const lifts = progress.lifts
    .map(liftRow)
    .filter((row): row is LiftRow => row !== null)
    .slice(0, 2);
  const strength = progress.activities.find((activity) => activity.kind === 'STRENGTH');
  if (strength || lifts.length) {
    rows.push({
      key: strength?.key ?? 'STRENGTH',
      name: 'Strength',
      kind: 'STRENGTH',
      meta: strength ? meta(strength) : '',
      lines: lifts.length ? lifts.map((row) => ({ figure: row.name, text: `${row.start} → ${row.end}`, trend: row.change })) : (strength?.summary.slice(0, 2) ?? [])
    });
  }
  for (const activity of progress.activities.filter((item) => item.kind !== 'STRENGTH').slice(0, 2)) {
    rows.push({ key: activity.key, name: activity.name, kind: activity.kind, meta: meta(activity), lines: activity.summary.slice(0, 1) });
  }
  return rows;
}

// ---------------------------------------------------------------- the 28-day log strip

export interface LogCell {
  date: string;
  x: number;
  y: number;
  kind: string | null;
  record: boolean;
  future: boolean;
}

export interface LogGeometry {
  pitch: number;
  radius: number;
  cells: LogCell[];
  weeks: { label: string; y: number }[];
  initials: string[];
  keyY: number;
  height: number;
}

const LABEL_COLUMN = 48;
const HEAD = 24;

/** Four week rows, Monday to Sunday, the last row holding `to`; sized to the width it is drawn at. */
export function logGeometry(to: string, days: readonly CalendarDay[], width: number): LogGeometry {
  const first = mondayOf(addDays(to, -21));
  const pitch = Math.max(20, Math.floor((width - LABEL_COLUMN) / 7));
  const byDate = new Map<string, CalendarDay>();
  for (const day of days) {
    const seen = byDate.get(day.date);
    byDate.set(day.date, seen ? { ...seen, record: seen.record || day.record } : day);
  }
  const cells: LogCell[] = [];
  const weeks: { label: string; y: number }[] = [];
  for (let row = 0; row < 4; row += 1) {
    const monday = addDays(first, row * 7);
    const y = HEAD + row * pitch + pitch / 2;
    weeks.push({ label: shortDate(monday), y });
    for (let column = 0; column < 7; column += 1) {
      const date = addDays(monday, column);
      const entry = byDate.get(date);
      cells.push({ date, x: LABEL_COLUMN + column * pitch + pitch / 2, y, kind: entry?.kind ?? null, record: entry?.record ?? false, future: date > to });
    }
  }
  const keyY = HEAD + 4 * pitch + 20;
  return { pitch, radius: Math.min(11, pitch / 2 - 3), cells, weeks, initials: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], keyY, height: keyY + 8 };
}
