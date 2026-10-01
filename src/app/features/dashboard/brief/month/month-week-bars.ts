import { MonthWeekInsight } from '../../../../core/fitsync.models';
import { monthNameOf } from './month-grid';

export const BARS_WIDTH = 320;
export const BARS_HEIGHT = 140;
const PLOT_LEFT = 8;
const PLOT_RIGHT = BARS_WIDTH - 8;
const BASE_Y = 118;
const TOP_Y = 24;
const MAX_BAR_WIDTH = 40;

export type WeekKind = 'strength' | 'cardio' | 'mobility' | 'sport' | 'other';

/** The kinds from the bottom of a bar to its top. */
export const WEEK_KINDS: readonly WeekKind[] = ['strength', 'cardio', 'mobility', 'sport', 'other'];

export interface WeekSegment {
  kind: WeekKind;
  count: number;
  y: number;
  height: number;
}

export interface WeekBar {
  weekStart: string;
  /** The day of the month on which the week's first day inside the month falls. */
  label: string;
  sessions: number;
  complete: boolean;
  x: number;
  width: number;
  /** Where the count above the bar sits. */
  centre: number;
  countY: number;
  segments: WeekSegment[];
}

export interface WeekBarsGeometry {
  width: number;
  height: number;
  baseY: number;
  max: number;
  bars: WeekBar[];
  /** The kinds that appear in at least one bar, for the legend. */
  kinds: WeekKind[];
}

const round = (value: number): number => Math.round(value * 10) / 10;

function dayOfMonth(date: string): string {
  return String(Number(date.slice(8, 10)));
}

/** The stacked bars, one for each week of the month. */
export function buildWeekBars(weeks: readonly MonthWeekInsight[], monthStart: string): WeekBarsGeometry | null {
  if (weeks.length === 0) {
    return null;
  }
  const max = Math.max(1, ...weeks.map((week) => week.sessions));
  const slot = (PLOT_RIGHT - PLOT_LEFT) / weeks.length;
  const width = round(Math.min(MAX_BAR_WIDTH, slot * 0.6));
  const unit = (BASE_Y - TOP_Y) / max;
  const present = new Set<WeekKind>();

  const bars = weeks.map((week, index): WeekBar => {
    const counts: Record<WeekKind, number> = {
      strength: week.strengthSessions,
      cardio: week.cardioSessions,
      mobility: week.mobilitySessions,
      sport: week.sportSessions,
      other: Math.max(0, week.sessions - week.strengthSessions - week.cardioSessions - week.mobilitySessions - week.sportSessions)
    };
    let top = BASE_Y;
    const segments: WeekSegment[] = [];
    for (const kind of WEEK_KINDS) {
      const count = counts[kind];
      if (count > 0) {
        const height = round(count * unit);
        top = round(top - height);
        segments.push({ kind, count, y: top, height });
        present.add(kind);
      }
    }
    const centre = round(PLOT_LEFT + slot * index + slot / 2);
    return {
      weekStart: week.weekStart,
      label: dayOfMonth(week.weekStart < monthStart ? monthStart : week.weekStart),
      sessions: week.sessions,
      complete: week.complete,
      x: round(centre - width / 2),
      width,
      centre,
      countY: round(top - 6),
      segments
    };
  });

  return { width: BARS_WIDTH, height: BARS_HEIGHT, baseY: BASE_Y, max, bars, kinds: WEEK_KINDS.filter((kind) => present.has(kind)) };
}

/** The chart in words, for a screen reader. */
export function describeWeekBars(weeks: readonly MonthWeekInsight[], monthStart: string, month: string): string {
  const name = monthNameOf(month);
  const parts = weeks.map((week) => {
    const first = dayOfMonth(week.weekStart < monthStart ? monthStart : week.weekStart);
    const sessions = `${week.sessions} ${week.sessions === 1 ? 'session' : 'sessions'}`;
    return `week of ${first} ${name}, ${sessions}`;
  });
  return `Sessions by week: ${parts.join('; ')}`;
}
