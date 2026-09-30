import { dateRange, shortDate } from '../../shared/coach/insight/slope-chart.geometry';
import { CoachDailyCount } from './admin-api.service';

export type SegmentKind = 'passed' | 'rejected' | 'refused' | 'unavailable';

export interface BarSegment {
  kind: SegmentKind;
  count: number;
  heightPx: number;
}

export interface DayBar {
  date: string;
  /** "24 Sept". */
  label: string;
  /** Whether the date is printed under this bar; long ranges print every seventh. */
  showLabel: boolean;
  total: number;
  /** Bottom to top: passed, rejected, refused, unavailable. */
  segments: BarSegment[];
}

export const CHART_HEIGHT_PX = 168;
const MIN_SEGMENT_PX = 3;
const LABEL_EVERY = 7;

/** Heights are proportional to the largest daily total; a segment with answers is never thinner than a visible line. */
export function buildDayBars(daily: CoachDailyCount[], chartHeightPx: number = CHART_HEIGHT_PX): DayBar[] {
  const largest = Math.max(0, ...daily.map((day) => day.answers));
  const labelEveryDay = daily.length <= LABEL_EVERY;
  return daily.map((day, index) => {
    const parts: [SegmentKind, number][] = [
      ['passed', day.passed],
      ['rejected', day.rejected],
      ['refused', day.refused],
      ['unavailable', day.modelUnavailable]
    ];
    return {
      date: day.date,
      label: shortDate(day.date),
      showLabel: labelEveryDay || index % LABEL_EVERY === 0,
      total: day.answers,
      segments: parts
        .filter(([, count]) => count > 0)
        .map(([kind, count]) => ({
          kind,
          count,
          heightPx: Math.max(MIN_SEGMENT_PX, Math.round((count / largest) * chartHeightPx))
        }))
    };
  });
}

/** The chart in words, for readers who cannot see it. */
export function chartAltText(bars: DayBar[]): string {
  if (bars.length === 0) {
    return 'Answers by day: no days in this period.';
  }
  return `Answers by day: ${bars.map((bar) => `${bar.label} ${bar.total}`).join(', ')}.`;
}

/** The dates the chart covers, for example "24 to 30 Sept". */
export function chartRangeLabel(bars: DayBar[]): string {
  return dateRange(bars[0]?.date ?? null, bars[bars.length - 1]?.date ?? null);
}

/** The width of a rule bar as a percent of the largest count in its list. */
export function barWidthPercent(count: number, largest: number): number {
  return largest > 0 ? Math.min(100, Math.max(0, (count / largest) * 100)) : 0;
}

export function largestCount(rows: { count: number }[]): number {
  return Math.max(0, ...rows.map((row) => row.count));
}
