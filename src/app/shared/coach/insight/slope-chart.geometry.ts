import { LiftProgress } from '../../../core/coach/coach.models';

/**
 * Geometry for the slope chart in a reading, kept free of Angular so every number can be tested.
 *
 * Each lift is one line from its top set weight in an earlier session to the one in the latest
 * session. The chart is drawn on a fixed 540 by 128 grid and scaled by its container.
 */

export const SLOPE_WIDTH = 540;
export const SLOPE_HEIGHT = 128;
export const SLOPE_LEFT_X = 200;
export const SLOPE_RIGHT_X = 400;

const PLOT_TOP = 30;
const PLOT_BOTTOM = 112;
const LABEL_GAP = 15;
const LABEL_TOP = 28;
const LABEL_BOTTOM = 122;
const MAX_LIFTS = 3;
const MAX_NAME_LENGTH = 22;

export interface SlopeLine {
  name: string;
  fullName: string;
  fromY: number;
  toY: number;
  fromLabelY: number;
  toLabelY: number;
  fromText: string;
  toText: string;
  changeText: string;
  rising: boolean;
}

export interface SlopeChart {
  lines: SlopeLine[];
  fromHeading: string;
  toHeading: string;
  description: string;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A weight with at most one decimal and no trailing zero, so 22.5 stays and 20.0 becomes 20. */
export function formatKg(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export function shortName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length <= MAX_NAME_LENGTH ? trimmed : `${trimmed.slice(0, MAX_NAME_LENGTH - 1).trimEnd()}…`;
}

/** "16 Sept" from a date key. The key is read as a calendar date and is never moved by a timezone. */
export function shortDate(key: string): string {
  const date = new Date(`${key}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date).replace(/\bSep\b/, 'Sept');
}

/**
 * The days between two date keys as one phrase: "21 to 27 Sept" inside a month, "28 Sept to 4 Oct"
 * across two, and "28 Sept" for a single day. Empty when either key is not a date.
 */
export function dateRange(from: string | null, to: string | null): string {
  const start = from ? shortDate(from) : '';
  const end = to ? shortDate(to) : '';
  if (!start || !end) {
    return '';
  }
  if (start === end) {
    return start;
  }
  const [startDay, startMonth] = start.split(' ');
  const [, endMonth] = end.split(' ');
  return startMonth === endMonth ? `${startDay} to ${end}` : `${start} to ${end}`;
}

export function changeText(from: number, to: number): string {
  if (from <= 0 || to === from) {
    return '';
  }
  const percent = Math.round((Math.abs(to - from) * 1000) / from) / 10;
  return `${to > from ? 'up' : 'down'} ${percent}%`;
}

/**
 * Moves labels apart until neighbours are one line of text away from each other.
 *
 * Two lifts can start or end at nearly the same weight, and their labels would then be printed on
 * top of each other. The points stay where the values put them. Only the labels move.
 */
export function spreadLabels(positions: number[]): number[] {
  const order = positions.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < order.length; i += 1) {
    order[i].y = Math.max(order[i].y, order[i - 1].y + LABEL_GAP);
  }
  const overflow = order.length ? order[order.length - 1].y - LABEL_BOTTOM : 0;
  if (overflow > 0) {
    order[order.length - 1].y -= overflow;
    for (let i = order.length - 2; i >= 0; i -= 1) {
      order[i].y = Math.min(order[i].y, order[i + 1].y - LABEL_GAP);
    }
  }
  const result = new Array<number>(positions.length);
  order.forEach((entry) => {
    result[entry.index] = round(Math.max(entry.y, LABEL_TOP));
  });
  return result;
}

function heading(dates: string[], fallback: string): string {
  const distinct = Array.from(new Set(dates.filter(Boolean)));
  return distinct.length === 1 ? shortDate(distinct[0]) || fallback : fallback;
}

export function slopeChart(lifts: LiftProgress[]): SlopeChart | null {
  const shown = lifts.filter((lift) => lift.fromKg > 0 && lift.toKg > 0).slice(0, MAX_LIFTS);
  if (!shown.length) {
    return null;
  }

  const values = shown.flatMap((lift) => [lift.fromKg, lift.toKg]);
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const span = highest - lowest;
  // One lift that did not move would divide by zero. It is drawn as a level line in the middle.
  const yFor = (value: number): number =>
    span === 0 ? round((PLOT_TOP + PLOT_BOTTOM) / 2) : round(PLOT_BOTTOM - ((value - lowest) / span) * (PLOT_BOTTOM - PLOT_TOP));

  const fromYs = shown.map((lift) => yFor(lift.fromKg));
  const toYs = shown.map((lift) => yFor(lift.toKg));
  // A label's y is its baseline, so 4 units below the point centres 12px text on it.
  const fromLabels = spreadLabels(fromYs.map((y) => y + 4));
  const toLabels = spreadLabels(toYs.map((y) => y + 4));

  const lines = shown.map((lift, index) => ({
    name: shortName(lift.exerciseName),
    fullName: lift.exerciseName.trim(),
    fromY: fromYs[index],
    toY: toYs[index],
    fromLabelY: fromLabels[index],
    toLabelY: toLabels[index],
    fromText: `${formatKg(lift.fromKg)} kg`,
    toText: `${formatKg(lift.toKg)} kg`,
    changeText: changeText(lift.fromKg, lift.toKg),
    rising: lift.toKg > lift.fromKg
  }));

  const fromHeading = heading(shown.map((lift) => lift.fromDate), 'Earlier');
  const toHeading = heading(shown.map((lift) => lift.toDate), 'Latest');
  const sentences = lines.map((line) => `${line.fullName} ${line.fromText} to ${line.toText}`).join(', ');

  return {
    lines,
    fromHeading,
    toHeading,
    description: `Top set weight for ${lines.length === 1 ? 'one lift' : `${lines.length} lifts`}, ${fromHeading} against ${toHeading}. ${sentences}.`
  };
}
