import { CoachCardContext, CoachCardKind } from '../../core/coach/coach.models';

/** The card context the Ask button sends; the coach's own type, under the name the pages use. */
export type ProgressCardContext = CoachCardContext;
export type ProgressCardKind = CoachCardKind;

/** The server's trend word on a summary line. Anything else is shown as it comes, in lower case. */
export type Trend = 'UP' | 'STEADY' | 'DOWN';

/** One point of a small chart: a date key (YYYY-MM-DD) or a short label, and its value. */
export interface SeriesPoint {
  label: string;
  value: number;
}

/** A rule-based finding with the series for its small chart (contract: highlights). */
export interface Highlight {
  code: string;
  title: string;
  series: SeriesPoint[];
  unit: string;
  context: string;
}

/** One line of a three-line summary: an optional bold figure, the rest, and a trend word in slate. */
export interface SummaryLine {
  figure?: string;
  text: string;
  trend: string;
}

/** One figure of the green hero, with what it is compared with underneath. */
export interface HeroStat {
  label: string;
  value: string;
  unit?: string;
  context?: string;
}

export interface JumpItem {
  id: string;
  label: string;
}

/** One week of a bar chart. Segments, when given, stack by key (STRENGTH, CARDIO, SPORT, MOBILITY). */
export interface WeekBar {
  label: string;
  value: number | null;
  segments?: { key: string; value: number }[];
  /** The week still under way, drawn lighter. */
  current?: boolean;
  /** Text over the bar in place of the value, for example "3 of 4". */
  valueLabel?: string;
}

export type DayState = 'MET' | 'MISSED' | 'NOT_LOGGED' | 'FUTURE';

export interface DotDay {
  date: string;
  state: DayState;
}

/** One rung of a strength ladder: a ratio of body weight and the level that starts there. */
export interface LadderRung {
  ratio: number;
  label: string;
}
