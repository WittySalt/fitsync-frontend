import { ProgressInsight } from '../../../core/fitsync.models';
import { formatKg, shortDate } from './slope-chart.geometry';

/**
 * Geometry for the weight chart in a progress reading, kept free of Angular so every number can be
 * tested. The weight series is a line over time, the goal is a dashed level line, and the pace so
 * far is continued as a dashed line from the latest weight. The drawing uses the same 540 by 128
 * grid as the slope chart.
 */

export const WEIGHT_WIDTH = 540;
export const WEIGHT_HEIGHT = 128;

export const WEIGHT_PLOT_LEFT = 16;
export const WEIGHT_PLOT_RIGHT = 512;
const PLOT_TOP = 22;
const PLOT_BOTTOM = 94;
const AXIS_Y = 116;
const PAD_KG = 0.5;
const DAY_MS = 86_400_000;
const CAP_DAYS = 180;
const CAPPED_MIN_AHEAD_DAYS = 30;
const ARROW_LENGTH = 9;
const ARROW_HALF_ANGLE = (28 * Math.PI) / 180;
const TEXT_WIDTH_PER_CHARACTER = 7;
const LABEL_GAP = 8;
const LABEL_TOP = 12;

export type LabelAnchor = 'start' | 'middle' | 'end';

export interface AxisLabel {
  x: number;
  y: number;
  text: string;
  anchor: LabelAnchor;
}

export interface WeightProjectionChart {
  /** The series as the points of a polyline. */
  line: string;
  latest: { x: number; y: number; text: string; labelX: number; labelY: number; anchor: LabelAnchor };
  goal: { y: number; text: string; labelX: number; labelY: number } | null;
  projection: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    /** The path of an arrow head when the goal is too far away to reach inside the drawing. */
    arrow: string | null;
    /** True when the continuation reaches the goal line, so its end is marked with a dot. */
    reachesGoal: boolean;
  } | null;
  axisLabels: AxisLabel[];
  /** Latest weight, goal and projected date as plain pairs, for the list drawn in narrow panels. */
  summary: { label: string; value: string }[];
  description: string;
}

interface Point {
  day: number;
  date: string;
  weightKg: number;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function dayOf(key: string | null): number | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return null;
  }
  const time = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(time) ? null : time / DAY_MS;
}

/** "10 Jan", with the year added when it differs from the reference year, as in "10 Jan 2027". */
export function dateLabel(key: string, referenceYear: string): string {
  const text = shortDate(key);
  return text && key.slice(0, 4) !== referenceYear ? `${text} ${key.slice(0, 4)}` : text;
}

function arrowHead(x1: number, y1: number, x2: number, y2: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const wing = (turn: number): string =>
    `${round(x2 - ARROW_LENGTH * Math.cos(angle + turn))} ${round(y2 - ARROW_LENGTH * Math.sin(angle + turn))}`;
  return `M ${wing(ARROW_HALF_ANGLE)} L ${round(x2)} ${round(y2)} L ${wing(-ARROW_HALF_ANGLE)}`;
}

function extent(label: AxisLabel): [number, number] {
  const width = label.text.length * TEXT_WIDTH_PER_CHARACTER;
  if (label.anchor === 'start') {
    return [label.x, label.x + width];
  }
  return label.anchor === 'end' ? [label.x - width, label.x] : [label.x - width / 2, label.x + width / 2];
}

/**
 * Keeps the labels that fit. The candidates come in order of importance: the projected date, then
 * the latest date, then the first. A label that would print on top of a more important one is left
 * out, so no two ever overlap.
 */
function spreadAxisLabels(candidates: AxisLabel[]): AxisLabel[] {
  const kept: AxisLabel[] = [];
  for (const label of candidates) {
    const [from, to] = extent(label);
    const clashes = kept.some((other) => {
      const [otherFrom, otherTo] = extent(other);
      return from < otherTo + LABEL_GAP && otherFrom < to + LABEL_GAP;
    });
    if (!clashes) {
      kept.push(label);
    }
  }
  return kept.sort((a, b) => a.x - b.x);
}

/**
 * The chart for a progress insight, or null when the series has fewer than two weights to join.
 *
 * The horizontal range ends at the projected date. When that date is more than 180 days after the
 * latest weight the goal is out of reach of a drawing this size: the continuation then runs to the
 * right edge along the same slope and ends in an arrow head, and the date is still written.
 */
export function weightProjection(insight: ProgressInsight): WeightProjectionChart | null {
  const points = insight.series
    .flatMap((entry): Point[] => {
      const day = dayOf(entry.date);
      return day !== null && Number.isFinite(entry.weightKg) ? [{ day, date: entry.date, weightKg: entry.weightKg }] : [];
    })
    .sort((a, b) => a.day - b.day);
  if (points.length < 2) {
    return null;
  }

  const first = points[0];
  const latest = points[points.length - 1];
  const goal = insight.goalWeightKg !== null && Number.isFinite(insight.goalWeightKg) ? insight.goalWeightKg : null;
  const projectedDay = goal === null ? null : dayOf(insight.projectedDate);
  const daysAhead = projectedDay !== null && projectedDay > latest.day ? projectedDay - latest.day : null;
  const projectedKey = daysAhead === null ? null : insight.projectedDate;
  const capped = daysAhead !== null && daysAhead > CAP_DAYS;

  // A capped projection gets as much room ahead as the history behind (at least 30 days), so the
  // series is not squeezed against the left edge by a goal months away.
  let endDay = latest.day;
  if (daysAhead !== null) {
    endDay = capped ? latest.day + Math.max(latest.day - first.day, CAPPED_MIN_AHEAD_DAYS) : latest.day + daysAhead;
  }
  const spanDays = Math.max(endDay - first.day, 1);
  const width = WEIGHT_PLOT_RIGHT - WEIGHT_PLOT_LEFT;
  const xFor = (day: number): number => round(WEIGHT_PLOT_LEFT + ((day - first.day) / spanDays) * width);

  const weights = points.map((point) => point.weightKg).concat(goal === null ? [] : [goal]);
  const low = Math.min(...weights) - PAD_KG;
  const high = Math.max(...weights) + PAD_KG;
  const yFor = (weight: number): number => round(PLOT_TOP + ((high - weight) / (high - low)) * (PLOT_BOTTOM - PLOT_TOP));

  const latestX = xFor(latest.day);
  const latestY = yFor(latest.weightKg);
  // Near the right edge the weight label would run off the drawing, so it goes to the point's left.
  const labelBeside = latestX > WEIGHT_PLOT_RIGHT - 70;
  const latestText = `${formatKg(latest.weightKg)} kg`;
  const goalY = goal === null ? null : yFor(goal);

  let projection: WeightProjectionChart['projection'] = null;
  if (daysAhead !== null && goalY !== null) {
    // The share of the way to the goal that fits in the drawing; 1 when not capped.
    const reach = (endDay - latest.day) / daysAhead;
    const endY = capped ? round(latestY + (goalY - latestY) * reach) : goalY;
    projection = {
      x1: latestX,
      y1: latestY,
      x2: WEIGHT_PLOT_RIGHT,
      y2: endY,
      arrow: capped ? arrowHead(latestX, latestY, WEIGHT_PLOT_RIGHT, endY) : null,
      reachesGoal: !capped
    };
  }

  const referenceYear = (insight.referenceDate ?? latest.date).slice(0, 4);
  const projectedText = projectedKey ? dateLabel(projectedKey, referenceYear) : '';
  const latestDateText = dateLabel(latest.date, referenceYear);

  const candidates: AxisLabel[] = [];
  if (projectedText) {
    candidates.push({ x: WEIGHT_PLOT_RIGHT, y: AXIS_Y, text: projectedText, anchor: 'end' });
  }
  candidates.push({
    x: latestX,
    y: AXIS_Y,
    text: latestDateText,
    anchor: latestX > WEIGHT_PLOT_RIGHT - 40 ? 'end' : 'middle'
  });
  candidates.push({ x: WEIGHT_PLOT_LEFT, y: AXIS_Y, text: dateLabel(first.date, referenceYear), anchor: 'start' });

  const summary = [{ label: 'Latest weight', value: latestText }];
  const sentences = [`Latest weight ${latestText} on ${latestDateText}.`];
  if (goal !== null) {
    summary.push({ label: 'Goal', value: `${formatKg(goal)} kg` });
    sentences.push(`Goal ${formatKg(goal)} kg.`);
  }
  if (projectedText) {
    summary.push({ label: 'Projected', value: projectedText });
    sentences.push(`At this pace the goal is reached around ${projectedText}.`);
  }

  return {
    line: points.map((point) => `${xFor(point.day)},${yFor(point.weightKg)}`).join(' '),
    latest: {
      x: latestX,
      y: latestY,
      text: latestText,
      labelX: labelBeside ? latestX - 10 : latestX + 10,
      labelY: latestY - 10 < LABEL_TOP ? latestY + 20 : latestY - 10,
      anchor: labelBeside ? 'end' : 'start'
    },
    goal:
      goal === null || goalY === null
        ? null
        : {
            y: goalY,
            text: `Goal ${formatKg(goal)} kg`,
            labelX: WEIGHT_PLOT_LEFT,
            labelY: goalY - 6 < LABEL_TOP ? goalY + 16 : goalY - 6
          },
    projection,
    axisLabels: spreadAxisLabels(candidates),
    summary,
    description: sentences.join(' ')
  };
}
