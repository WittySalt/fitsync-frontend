import { E1rmPoint, LoadWeek, TRAINING_KINDS, TrainingKind, TrainingLoad, WeekValue } from '../training.models';
import { addDays, daysBetween, grouped, hm, kg, shortDate } from '../training-format';

/**
 * Pure geometry for the Training charts. Each function returns numbers and strings the templates
 * bind to SVG attributes, so the drawing is tested without a browser and no markup is built from
 * strings.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface TextMark extends Pt {
  text: string;
  anchor: 'start' | 'middle' | 'end';
}

export interface GridLine {
  y: number;
  label: string;
}

const r1 = (value: number): number => Math.round(value * 10) / 10;

/** A rough width of a label in the board's Inter at the given size, enough to make room for it. */
export function textWidth(text: string, size = 11, bold = false): number {
  return text.length * size * (bold ? 0.6 : 0.56);
}

const polyline = (points: readonly Pt[]): string => points.map((point) => `${r1(point.x)},${r1(point.y)}`).join(' ');

// ---------------------------------------------------------------- the small trend

export interface SmallTrend {
  width: number;
  height: number;
  line: string;
  first: Pt;
  last: Pt;
  start: TextMark;
  end: TextMark;
  target: number | null;
}

/** A small line with its start value on the left and its end value on the right (board 18a). */
export function smallTrend(values: readonly number[], width: number, height: number, start: string, end: string, target: number | null = null): SmallTrend | null {
  if (values.length < 2) {
    return null;
  }
  const left = textWidth(start) + 8;
  const right = textWidth(end, 11, true) + 8;
  const all = target === null ? [...values] : [...values, target];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const x = (index: number): number => left + ((width - left - right) * index) / (values.length - 1);
  const y = (value: number): number => height - 6 - ((height - 12) * (value - lo)) / (hi - lo || 1);
  const points = values.map((value, index) => ({ x: r1(x(index)), y: r1(y(value)) }));
  const first = points[0];
  const last = points[points.length - 1];
  return {
    width,
    height,
    line: polyline(points),
    first,
    last,
    start: { x: r1(left - 6), y: first.y, text: start, anchor: 'end' },
    end: { x: r1(width - right + 6), y: last.y, text: end, anchor: 'start' },
    target: target === null ? null : r1(y(target))
  };
}

// ---------------------------------------------------------------- the cumulative step chart

export interface StepChart {
  width: number;
  height: number;
  grid: GridLine[];
  x0: number;
  x1: number;
  d: string;
  end: Pt;
  endLabel: string;
  from: TextMark;
  to: TextMark;
}

/** A top for minute charts that lands on whole half hours: 5 h, 2.5 h. */
export function minutesTop(max: number): number {
  return Math.max(60, Math.ceil(max / 60) * 60);
}

function hourLabel(minutes: number): string {
  if (minutes === 0) {
    return '0';
  }
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

/** Total time rising with each session: flat between sessions, a step up on each (board 18a). */
export function stepChart(points: readonly { date: string; minutes: number }[], from: string, to: string, top: number, width = 300, height = 84): StepChart {
  const x0 = 30;
  const x1 = width - 70;
  const plotTop = 8;
  const bottom = height - 18;
  const span = Math.max(1, daysBetween(from, addDays(to, 1)));
  const x = (date: string): number => x0 + ((x1 - x0) * Math.min(span, Math.max(0, daysBetween(from, date)))) / span;
  const y = (minutes: number): number => bottom - ((bottom - plotTop) * Math.min(minutes, top)) / top;
  const grid = [0, top / 2, top].map((minutes) => ({ y: r1(y(minutes)), label: hourLabel(minutes) }));
  let total = 0;
  let d = `M${r1(x0)} ${r1(y(0))}`;
  for (const point of [...points].sort((a, b) => a.date.localeCompare(b.date))) {
    total += point.minutes;
    d += ` H${r1(x(point.date))} V${r1(y(total))}`;
  }
  d += ` H${r1(x1)}`;
  return {
    width,
    height,
    grid,
    x0,
    x1,
    d,
    end: { x: r1(x1), y: r1(y(total)) },
    endLabel: hm(total),
    from: { x: x0, y: height - 3, text: shortDate(from), anchor: 'start' },
    to: { x: x1, y: height - 3, text: shortDate(to), anchor: 'end' }
  };
}

// ---------------------------------------------------------------- one lift, or one exercise series

export interface SeriesDot extends Pt {
  record: boolean;
  label: string;
}

export interface SeriesChart {
  width: number;
  height: number;
  x0: number;
  x1: number;
  bottom: number;
  grid: GridLine[];
  line: string;
  area: string;
  dots: SeriesDot[];
  first: TextMark;
  last: TextMark;
  dates: TextMark[];
  /** The dashed best-before line and its key in the corner, when a best before is known. */
  before: { y: number; label: string } | null;
}

/**
 * The series of one lift (board 18a, lift card) or one exercise (17b): grid lines in kg, the green
 * line with a soft area, a filled dark dot on each record, the first and the last value written
 * beside their points, and the best before the period as a dashed line.
 */
export function seriesChart(
  points: readonly E1rmPoint[],
  options: { width?: number; height?: number; bestBefore?: number | null; unit?: string; compact?: boolean } = {}
): SeriesChart | null {
  if (!points.length) {
    return null;
  }
  const width = options.width ?? 320;
  const height = options.height ?? 136;
  const unit = options.unit ?? 'kg';
  const bestBefore = options.bestBefore ?? null;
  const values = [...points.map((point) => point.value), ...(bestBefore !== null ? [bestBefore] : [])];
  const range = Math.max(...values) - Math.min(...values);
  const step = range <= 20 ? 5 : range <= 50 ? 10 : range <= 200 ? 25 : Math.pow(10, Math.floor(Math.log10(range)));
  const lo = Math.max(0, Math.floor((Math.min(...values) - step * 0.6) / step) * step);
  const hi = Math.ceil((Math.max(...values) + step * 0.6) / step) * step;
  const x0 = 50;
  const x1 = width - 6;
  const plotTop = 28;
  const bottom = height - 20;
  const firstDate = points[0].date;
  const span = daysBetween(firstDate, points[points.length - 1].date);
  const x = (date: string): number => (span > 0 ? x0 + ((x1 - x0) * daysBetween(firstDate, date)) / span : (x0 + x1) / 2);
  const y = (value: number): number => plotTop + ((bottom - plotTop) * (hi - value)) / (hi - lo || 1);
  const label = (value: number): string => (unit === 'kg' ? `${kg(value)} kg` : `${grouped(value)}${unit ? ` ${unit}` : ''}`);
  const grid: GridLine[] = [];
  for (let value = lo; value <= hi + 0.001; value += step) {
    grid.push({ y: r1(y(value)), label: label(value) });
  }
  const dots = points.map((point) => ({ x: r1(x(point.date)), y: r1(y(point.value)), record: point.isRecord, label: `${shortDate(point.date)}, ${label(point.value)}${point.isRecord ? ', a new record' : ''}` }));
  const line = polyline(dots);
  const area = `${r1(dots[0].x)},${bottom} ${line} ${r1(dots[dots.length - 1].x)},${bottom}`;
  const before = bestBefore !== null ? { y: r1(y(bestBefore)), label: `best before, ${label(bestBefore)}` } : null;
  // A value is written above its point, unless the dashed line runs through that spot.
  const labelY = (py: number): number => (before && py - 20 < before.y && before.y < py - 6 ? py + 17 : py - 9);
  const short = (value: number): string => (unit === 'kg' ? kg(value) : grouped(value));
  const first = dots[0];
  const last = dots[dots.length - 1];
  const dateCount = options.compact ? 3 : 4;
  const dates: TextMark[] = [];
  if (span > 0) {
    for (let index = 0; index < dateCount; index += 1) {
      const date = addDays(firstDate, Math.round((span * index) / dateCount));
      dates.push({ x: r1(x(date)), y: height - 4, text: shortDate(date), anchor: index === 0 ? 'start' : 'middle' });
    }
  }
  dates.push({ x: span > 0 ? x1 : r1(x(firstDate)), y: height - 4, text: shortDate(points[points.length - 1].date), anchor: span > 0 ? 'end' : 'middle' });
  return {
    width,
    height,
    x0,
    x1,
    bottom,
    grid,
    line,
    area,
    dots,
    first: { x: first.x + 2, y: r1(labelY(first.y)), text: short(points[0].value), anchor: 'start' },
    last: { x: last.x - 2, y: r1(labelY(last.y)), text: short(points[points.length - 1].value), anchor: 'end' },
    dates,
    before
  };
}

// ---------------------------------------------------------------- training load

export interface LoadBar {
  kind: TrainingKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LoadColumn {
  weekStart: string;
  bars: LoadBar[];
  label: TextMark | null;
  current: boolean;
  total: number;
  estimated: boolean;
}

export interface LoadChart {
  width: number;
  height: number;
  x0: number;
  grid: GridLine[];
  columns: LoadColumn[];
  fitness: string;
  fatigue: string;
  soFar: TextMark | null;
}

function loadTop(weeks: readonly LoadWeek[], lines: readonly WeekValue[]): number {
  const max = Math.max(1, ...weeks.map((week) => week.total), ...lines.map((point) => point.value));
  const step = max <= 400 ? 100 : max <= 2000 ? 500 : 1000;
  return Math.ceil(max / step) * step;
}

/**
 * Weekly load stacked by kind, the fitness line (six-week mean) and the dashed fatigue line (last
 * week), with "this week so far" under a week that has not ended (board 18a).
 */
export function loadChart(load: TrainingLoad, today: string, width = 640, height = 230, compact = false): LoadChart | null {
  const weeks = load.weeks;
  if (!weeks.length) {
    return null;
  }
  const top = loadTop(weeks, [...load.fitness, ...load.fatigue]);
  const x0 = 40;
  const plotTop = 24;
  const plotBottom = height - 34;
  const slot = (width - x0) / weeks.length;
  const y = (value: number): number => plotTop + (plotBottom - plotTop) * (1 - value / top);
  const grid = [0, top / 3, (top * 2) / 3, top].map((value) => ({ y: r1(y(value)), label: grouped(value) }));
  const index = new Map(weeks.map((week, at) => [week.weekStart, at]));
  const columns = weeks.map((week, at) => {
    const x = x0 + slot * at + slot * 0.22;
    const barWidth = slot * 0.56;
    const current = addDays(week.weekStart, 6) >= today && week.weekStart <= today;
    let base = y(0);
    const bars: LoadBar[] = [];
    for (const kind of TRAINING_KINDS) {
      const value = week.byKind[kind];
      if (!value) {
        continue;
      }
      const h = ((plotBottom - plotTop) * Math.min(value, top)) / top;
      base -= h;
      bars.push({ kind, x: r1(x), y: r1(base), width: r1(barWidth), height: r1(Math.max(1, h - 1.5)) });
    }
    const last = at === weeks.length - 1;
    const showLabel = !compact || at % 2 === 1 || weeks.length <= 4;
    const label: TextMark | null = showLabel
      ? compact && last
        ? { x: width, y: height - 18, text: shortDate(week.weekStart), anchor: 'end' }
        : { x: r1(x + barWidth / 2), y: height - 18, text: shortDate(week.weekStart), anchor: 'middle' }
      : null;
    return { weekStart: week.weekStart, bars, label, current, total: week.total, estimated: week.estimated };
  });
  const line = (points: readonly WeekValue[]): string =>
    polyline(points.filter((point) => index.has(point.weekStart)).map((point) => ({ x: x0 + slot * (index.get(point.weekStart) ?? 0) + slot / 2, y: y(Math.min(point.value, top)) })));
  const lastColumn = columns[columns.length - 1];
  const soFar: TextMark | null = lastColumn.current
    ? compact
      ? { x: width, y: height - 4, text: 'this week so far', anchor: 'end' }
      : { x: r1(x0 + slot * (columns.length - 1) + slot / 2), y: height - 4, text: 'this week so far', anchor: 'middle' }
    : null;
  return { width, height, x0, grid, columns, fitness: line(load.fitness), fatigue: line(load.fatigue), soFar };
}

/** Where the form marker sits on the tired-to-fresh scale, from fitness minus fatigue. */
export function formPosition(form: string | null, fitness: number | null, fatigue: number | null): number {
  if (fitness !== null && fatigue !== null && fitness > 0) {
    const ratio = (fitness - fatigue) / fitness;
    return Math.round(Math.min(95, Math.max(5, 50 + ratio * 100)));
  }
  return form === 'TIRED' ? 15 : form === 'FRESH' ? 85 : 50;
}
