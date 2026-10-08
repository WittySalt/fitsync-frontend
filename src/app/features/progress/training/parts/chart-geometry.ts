import { PlacedLabel, dropColliding, fromFirstData, timeAxisLabels, weekLabelMarks } from '../../../../shared/progress/chart-axis';
import { textWidth } from '../../../../shared/progress/progress-format';
import { E1rmPoint, LoadWeek, TRAINING_KINDS, TrainingKind, TrainingLoad, WeekValue } from '../training.models';
import { addDays, daysBetween, grouped, kg, shortDate } from '../training-format';

/**
 * Pure geometry for the Training charts. Each function returns numbers and strings the templates
 * bind to SVG attributes, so the drawing is tested without a browser and no markup is built from
 * strings. Every chart is drawn at the pixel width it is given, so text is never scaled.
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

const polyline = (points: readonly Pt[]): string => points.map((point) => `${r1(point.x)},${r1(point.y)}`).join(' ');

/** The width the axis labels on the left need, at the chart text size. */
export function axisGutter(labels: readonly string[]): number {
  return Math.ceil(Math.max(...labels.map((label) => textWidth(label, 12)), 12)) + 14;
}

// ---------------------------------------------------------------- minute scales

/** A top for minute charts that lands on a whole hour, never under one hour. */
export function minutesTop(max: number): number {
  return Math.max(60, Math.ceil(max / 60) * 60);
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
 * beside their points, and the best before the period as a dashed line. The start and end dates
 * are always written; dates between them follow the length of the series and are left out when
 * they would touch another.
 */
export function seriesChart(
  points: readonly E1rmPoint[],
  options: { width?: number; height?: number; bestBefore?: number | null; unit?: string } = {}
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
  const label = (value: number): string => (unit === 'kg' ? `${kg(value)} kg` : `${grouped(value)}${unit ? ` ${unit}` : ''}`);
  const gridValues: number[] = [];
  for (let value = lo; value <= hi + 0.001; value += step) {
    gridValues.push(value);
  }
  const x0 = axisGutter(gridValues.map(label));
  const x1 = width - 8;
  const plotTop = 28;
  const bottom = height - 26;
  const firstDate = points[0].date;
  const lastDate = points[points.length - 1].date;
  const span = daysBetween(firstDate, lastDate);
  const x = (date: string): number => (span > 0 ? x0 + ((x1 - x0) * daysBetween(firstDate, date)) / span : (x0 + x1) / 2);
  const y = (value: number): number => plotTop + ((bottom - plotTop) * (hi - value)) / (hi - lo || 1);
  const grid: GridLine[] = gridValues.map((value) => ({ y: r1(y(value)), label: label(value) }));
  const dots = points.map((point) => ({ x: r1(x(point.date)), y: r1(y(point.value)), record: point.isRecord, label: `${shortDate(point.date)}, ${label(point.value)}${point.isRecord ? ', a new record' : ''}` }));
  const line = polyline(dots);
  const area = `${r1(dots[0].x)},${bottom} ${line} ${r1(dots[dots.length - 1].x)},${bottom}`;
  const before = bestBefore !== null ? { y: r1(y(bestBefore)), label: `best before, ${label(bestBefore)}` } : null;
  // A value is written above its point, unless the dashed line runs through that spot.
  const labelY = (py: number): number => (before && py - 20 < before.y && before.y < py - 6 ? py + 18 : py - 9);
  const short = (value: number): string => (unit === 'kg' ? kg(value) : grouped(value));
  const first = dots[0];
  const last = dots[dots.length - 1];
  const placed: PlacedLabel[] =
    span > 0
      ? [
          { x: x0, text: shortDate(firstDate), anchor: 'start', keep: true },
          { x: x1, text: shortDate(lastDate), anchor: 'end', keep: true },
          ...timeAxisLabels(firstDate, lastDate, x)
        ]
      : [{ x: r1(x(firstDate)), text: shortDate(lastDate), anchor: 'middle', keep: true }];
  const dates: TextMark[] = dropColliding(placed).map((mark) => ({ x: r1(mark.x), y: height - 6, text: mark.text, anchor: mark.anchor }));
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
  /** Week dates or month names under the bars, none touching the one before. */
  labels: TextMark[];
  fitness: string;
  fatigue: string;
  /** True when the last week has not ended; the chart's key says that bar is lighter. */
  hasCurrent: boolean;
}

function loadTop(weeks: readonly LoadWeek[], lines: readonly WeekValue[]): number {
  const max = Math.max(1, ...weeks.map((week) => week.total), ...lines.map((point) => point.value));
  const step = max <= 400 ? 100 : max <= 2000 ? 500 : 1000;
  return Math.ceil(max / step) * step;
}

/**
 * Weekly load stacked by kind, the fitness line (six-week mean) and the dashed fatigue line (last
 * week). The run starts at the first week with load; a week that has not ended is marked current.
 */
export function loadChart(load: TrainingLoad, today: string, width = 640, height = 230): LoadChart | null {
  const weeks = fromFirstData(load.weeks, (week) => week.total > 0);
  if (!weeks.length) {
    return null;
  }
  const fitnessLine = load.fitness.filter((point) => weeks.some((week) => week.weekStart === point.weekStart));
  const fatigueLine = load.fatigue.filter((point) => weeks.some((week) => week.weekStart === point.weekStart));
  const top = loadTop(weeks, [...fitnessLine, ...fatigueLine]);
  const gridValues = [0, top / 3, (top * 2) / 3, top];
  const x0 = axisGutter(gridValues.map(grouped));
  const plotTop = 24;
  const plotBottom = height - 30;
  const slot = (width - x0) / weeks.length;
  const y = (value: number): number => plotTop + (plotBottom - plotTop) * (1 - value / top);
  const grid = gridValues.map((value) => ({ y: r1(y(value)), label: grouped(value) }));
  const columnOf = new Map(weeks.map((week, at) => [week.weekStart, at]));
  const barWidth = Math.min(36, slot * 0.56);
  const columns = weeks.map((week, at) => {
    const x = x0 + slot * at + (slot - barWidth) / 2;
    const current = addDays(week.weekStart, 6) >= today && week.weekStart <= today;
    let base = y(0);
    const bars: LoadBar[] = [];
    for (const kind of TRAINING_KINDS) {
      const value = week.byKind[kind];
      if (!value) {
        continue;
      }
      const barHeight = ((plotBottom - plotTop) * Math.min(value, top)) / top;
      base -= barHeight;
      // 1.5 px off each segment leaves a hairline between the stacked kinds.
      bars.push({ kind, x: r1(x), y: r1(base), width: r1(barWidth), height: r1(Math.max(1, barHeight - 1.5)) });
    }
    return { weekStart: week.weekStart, bars, current, total: week.total, estimated: week.estimated };
  });
  const centre = (at: number): number => x0 + slot * at + slot / 2;
  const line = (points: readonly WeekValue[]): string =>
    polyline(points.map((point) => ({ x: centre(columnOf.get(point.weekStart) ?? 0), y: y(Math.min(point.value, top)) })));
  const labels: TextMark[] = weekLabelMarks(
    weeks.map((week) => week.weekStart),
    centre
  ).map((mark) => ({ x: r1(mark.x), y: height - 8, text: mark.text, anchor: mark.anchor }));
  return { width, height, x0, grid, columns, labels, fitness: line(fitnessLine), fatigue: line(fatigueLine), hasCurrent: columns[columns.length - 1].current };
}

/** Where the form marker sits on the tired-to-fresh scale, from fitness minus fatigue. */
export function formPosition(form: string | null, fitness: number | null, fatigue: number | null): number {
  if (fitness !== null && fatigue !== null && fitness > 0) {
    const ratio = (fitness - fatigue) / fitness;
    return Math.round(Math.min(95, Math.max(5, 50 + ratio * 100)));
  }
  return form === 'TIRED' ? 15 : form === 'FRESH' ? 85 : 50;
}
