import { textWidth } from './progress-format';

/** The three periods of the Progress pages, as the axis sees them. */
export type AxisPeriod = '4w' | '3m' | '1y';

export type LabelAnchor = 'start' | 'middle' | 'end';

/** A text on an axis at an x position, with the side of x it grows towards. */
export interface PlacedLabel {
  x: number;
  text: string;
  anchor: LabelAnchor;
  /** A label that must stay if there is any way to keep it (month names over week dates). */
  keep?: boolean;
}

export interface AxisLabel {
  index: number;
  text: string;
  month: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const DAY = 86_400_000;

function parts(key: string): [number, number, number] {
  const [year, month, day] = key.split('-').map(Number);
  return [year, month, day];
}

function utc(key: string): number {
  const [year, month, day] = parts(key);
  return Date.UTC(year, month - 1, day);
}

function keyOf(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function dayMonth(key: string): string {
  const [, month, day] = parts(key);
  return `${day} ${MONTHS[month - 1]}`;
}

/** "Oct", or "Jan 2027" for January so a new year is named where it starts. */
export function monthName(key: string): string {
  const [year, month] = parts(key);
  return month === 1 ? `${MONTHS[0]} ${year}` : MONTHS[month - 1];
}

/** The period a run of weeks stands for: about four weeks, about three months, or about a year. */
export function periodForWeeks(count: number): AxisPeriod {
  return count <= 6 ? '4w' : count <= 20 ? '3m' : '1y';
}

/** True when the week starting at `index` is the first one of its month in the run. */
function startsMonth(weekStarts: readonly string[], index: number): boolean {
  return index > 0 && parts(weekStarts[index])[1] !== parts(weekStarts[index - 1])[1];
}

/**
 * Which weeks of a weekly chart get a label, and what it says. Four weeks label every week; three
 * months label every second week, counted back from the last, with the month's name where a month
 * starts; a year labels month starts only.
 */
export function weekAxisLabels(weekStarts: readonly string[], period: AxisPeriod): AxisLabel[] {
  const last = weekStarts.length - 1;
  const labels: AxisLabel[] = [];
  weekStarts.forEach((weekStart, index) => {
    const month = startsMonth(weekStarts, index);
    if (period === '4w') {
      labels.push({ index, text: dayMonth(weekStart), month: false });
    } else if (period === '3m') {
      if (month) {
        labels.push({ index, text: monthName(weekStart), month: true });
      } else if ((last - index) % 2 === 0) {
        labels.push({ index, text: dayMonth(weekStart), month: false });
      }
    } else if (month) {
      labels.push({ index, text: monthName(weekStart), month: true });
    }
  });
  return labels;
}

function box(label: PlacedLabel, size: number): [number, number] {
  const width = textWidth(label.text, size);
  if (label.anchor === 'start') {
    return [label.x, label.x + width];
  }
  return label.anchor === 'end' ? [label.x - width, label.x] : [label.x - width / 2, label.x + width / 2];
}

/**
 * Drops every label that would touch the one before it, left to right. Labels marked `keep` are
 * placed first, so a month name wins over a week date beside it. The result is in x order.
 */
export function dropColliding<T extends PlacedLabel>(labels: readonly T[], size = 12, gap = 6): T[] {
  const ordered = [...labels].sort((a, b) => a.x - b.x);
  const accepted: T[] = [];
  const fits = (label: T): boolean => {
    const [from, to] = box(label, size);
    return accepted.every((other) => {
      const [otherFrom, otherTo] = box(other, size);
      return to + gap <= otherFrom || from >= otherTo + gap;
    });
  };
  for (const label of [...ordered.filter((item) => item.keep), ...ordered.filter((item) => !item.keep)]) {
    if (fits(label)) {
      accepted.push(label);
    }
  }
  return accepted.sort((a, b) => a.x - b.x);
}

/** Week labels placed at the x of each week, with the collision rule applied. */
export function weekLabelMarks(weekStarts: readonly string[], xOf: (index: number) => number, period: AxisPeriod = periodForWeeks(weekStarts.length)): PlacedLabel[] {
  return dropColliding(weekAxisLabels(weekStarts, period).map((label) => ({ x: xOf(label.index), text: label.text, anchor: 'middle' as const, keep: label.month })));
}

/**
 * Labels for a chart with one point per calendar month: each point is named by its month ("Sept",
 * "Jan 2027" where a year starts) and a label that would touch the one before is dropped, with the
 * newest point kept first so "so far" is always named, and a January keeps its year.
 */
export function monthPointMarks(monthStarts: readonly string[], xOf: (index: number) => number): PlacedLabel[] {
  const last = monthStarts.length - 1;
  return dropColliding(monthStarts.map((key, index) => ({ x: xOf(index), text: monthName(key), anchor: 'middle' as const, keep: index === last || parts(key)[1] === 1 })));
}

/**
 * Labels for a time axis that runs over dates: weekly Mondays up to five weeks, every second Monday
 * up to about three months (month names at month starts), and month starts beyond.
 */
export function timeAxisLabels(from: string, to: string, xOf: (key: string) => number): PlacedLabel[] {
  const span = Math.round((utc(to) - utc(from)) / DAY);
  const labels: PlacedLabel[] = [];
  // Label every Monday, every second one, or (0) none, leaving a long span to the month names below.
  const every = span <= 35 ? 1 : span <= 110 ? 2 : 0;
  if (every) {
    // Mondays, counted back from the last one so the newest week is always named.
    const lastMonday = utc(to) - ((new Date(utc(to)).getUTCDay() + 6) % 7) * DAY;
    for (let step = 0, time = lastMonday; time >= utc(from); step += 1, time -= 7 * DAY) {
      if (step % every === 0) {
        const key = keyOf(time);
        labels.push({ x: xOf(key), text: dayMonth(key), anchor: 'middle' });
      }
    }
  }
  if (span > 35) {
    const [year, month] = parts(from);
    let cursor = Date.UTC(year, month - 1, 1);
    while (cursor <= utc(to)) {
      if (cursor >= utc(from)) {
        const key = keyOf(cursor);
        labels.push({ x: xOf(key), text: monthName(key), anchor: 'middle', keep: true });
      }
      const next = new Date(cursor);
      cursor = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1);
    }
  }
  return dropColliding(labels);
}

/**
 * A series starts at its first week with data: weeks before it are not drawn. A run with no data
 * at all stays as it is, so the chart can say so.
 */
export function fromFirstData<T>(weeks: readonly T[], hasData: (week: T) => boolean): T[] {
  const first = weeks.findIndex(hasData);
  return first <= 0 ? [...weeks] : weeks.slice(first);
}
