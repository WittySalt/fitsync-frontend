import { Footprint } from '../../../core/me.models';

export type CellState = 'future' | 'empty' | 'logged' | 'trained' | 'both';

export interface FootprintCell {
  date: string;
  state: CellState;
  today: boolean;
}

export interface FootprintColumn {
  /** The Monday of the week. */
  monday: string;
  cells: FootprintCell[];
}

export interface FootprintMonth {
  column: number;
  label: string;
}

export interface FootprintGrid {
  columns: FootprintColumn[];
  months: FootprintMonth[];
  /** The index of the column that holds today, or -1 when the membership starts after it. */
  todayColumn: number;
}

/** The grid is never narrower than a year of weeks; a longer membership scrolls. */
export const MIN_WEEKS = 52;
const DAY_MS = 86_400_000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toTime(key: string): number {
  return new Date(`${key}T00:00:00Z`).getTime();
}

function toKey(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** The Monday on or before a date key. */
export function mondayOf(key: string): string {
  const date = new Date(`${key}T00:00:00Z`);
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return toKey(date.getTime() - sinceMonday * DAY_MS);
}

/**
 * One column per week from the footprint's first Monday, seven cells each, Monday at the top. There
 * are at least 52 columns and as many more as the membership has weeks. A day after today is
 * `future`; a day the server did not send inside the range counts as empty.
 */
export function buildFootprintGrid(footprint: Footprint, today: string): FootprintGrid {
  if (!DATE_KEY.test(today)) {
    return { columns: [], months: [], todayColumn: -1 };
  }
  const first = DATE_KEY.test(footprint.from) ? mondayOf(footprint.from) : mondayOf(today);
  const todayMonday = mondayOf(today);
  const weeksToToday = Math.floor((toTime(todayMonday) - toTime(first)) / (7 * DAY_MS)) + 1;
  const weeks = Math.max(MIN_WEEKS, weeksToToday);
  const byDate = new Map(footprint.days.map((day) => [day.date, day]));

  const columns: FootprintColumn[] = [];
  const months: FootprintMonth[] = [];
  let lastMonth = -1;
  for (let week = 0; week < weeks; week++) {
    const mondayTime = toTime(first) + week * 7 * DAY_MS;
    const cells: FootprintCell[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const date = toKey(mondayTime + offset * DAY_MS);
      const day = byDate.get(date);
      const state: CellState =
        date > today ? 'future' : day?.trained && day.logged ? 'both' : day?.trained ? 'trained' : day?.logged ? 'logged' : 'empty';
      cells.push({ date, state, today: date === today });
    }
    const monday = toKey(mondayTime);
    const month = new Date(mondayTime).getUTCMonth();
    if (month !== lastMonth) {
      months.push({ column: week, label: MONTHS[month] });
      lastMonth = month;
    }
    columns.push({ monday, cells });
  }
  const todayColumn = columns.findIndex((column) => column.monday === todayMonday);
  return { columns, months, todayColumn };
}

/** The sentence a screen reader gets in place of the picture. */
export function footprintSummary(footprint: Footprint): string {
  const { workouts, daysLogged, badges } = footprint.totals;
  return `Your footprint since you joined: ${workouts} workouts, ${daysLogged} days with meals logged, ${badges} badges.`;
}
