import { MonthWeekInsight, MonthlyTrainingInsight } from '../../../../core/fitsync.models';
import { formatDuration } from '../brief-duration';
import { monthNameOf, monthOfDate, shiftMonth } from './month-grid';

/** One piece of a figure: a number and the small unit that follows it, such as "13" and "h". */
export interface FigurePart {
  value: string;
  unit: string;
}

export interface FigureCompare {
  direction: 'up' | 'down';
  /** How far the figure is from last month's, written the way the figure is. */
  text: string;
}

export interface MonthFigure {
  id: 'sessions' | 'time' | 'weeks' | 'records' | 'badges' | 'streak';
  parts: FigurePart[];
  caption: string;
  /** The whole figure in words, for a screen reader. */
  label: string;
  compare: FigureCompare | null;
}

export type BadgeFigureState = 'loading' | 'ready' | 'failed';

export interface FigureInput {
  insight: MonthlyTrainingInsight;
  /** The sessions a week should reach, or null when there is no weekly goal. */
  weeklyTarget: number | null;
  /** The dates on which a badge was earned, in the person's timezone, as YYYY-MM-DD. */
  badgeDates: readonly string[];
  /** A dash stands for the badge figure while the badges load, and a failed request leaves it out. */
  badgeState: BadgeFigureState;
}

const EN_DASH = '–';

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** The weeks that lie wholly inside the month and are over. */
export function fullWeeks(insight: MonthlyTrainingInsight): MonthWeekInsight[] {
  return insight.weeks.filter((week) => week.complete && week.weekStart >= insight.monthStart && week.weekEnd <= insight.monthEnd);
}

function durationParts(minutes: number): FigurePart[] {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) {
    return [{ value: String(whole), unit: 'min' }];
  }
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0
    ? [{ value: String(hours), unit: 'h' }]
    : [
        { value: String(hours), unit: 'h' },
        { value: String(rest), unit: 'min' }
      ];
}

/** The distance from last month's figure. A month that is still running has had less time than
 *  the whole month before it, so there it is only shown once the figure is already ahead. */
function countCompare(
  current: number,
  previous: number | null,
  inProgress: boolean,
  write: (difference: number) => string
): FigureCompare | null {
  if (previous === null || current === previous || (inProgress && current < previous)) {
    return null;
  }
  return { direction: current > previous ? 'up' : 'down', text: write(Math.abs(current - previous)) };
}

/** How many badges were earned in a month (YYYY-MM). */
export function badgesInMonth(dates: readonly string[], month: string): number {
  return dates.filter((date) => monthOfDate(date) === month).length;
}

/** The six figures of the panel, in the order of the board. */
export function buildFigures(input: FigureInput): MonthFigure[] {
  const { insight } = input;
  const { totals } = insight;
  const previous = insight.previousTotals;
  const month = insight.month;
  const inProgress = monthOfDate(insight.referenceDate) === month;
  const figures: MonthFigure[] = [];

  // The words follow the arrow: last month's figure is read out only where an arrow is drawn.
  const withLast = (now: string, last: string, compare: FigureCompare | null): string =>
    compare === null ? now : `${now}, ${last} last month`;

  const sessionsCompare = countCompare(totals.sessions, previous?.sessions ?? null, inProgress, String);
  const timeCompare = countCompare(totals.minutes, previous?.minutes ?? null, inProgress, (difference) => formatDuration(difference));
  const recordsCompare = countCompare(totals.records, previous?.records ?? null, inProgress, String);
  const streakCompare = countCompare(totals.longestStreakDays, previous?.longestStreakDays ?? null, inProgress, String);

  figures.push({
    id: 'sessions',
    parts: [{ value: String(totals.sessions), unit: '' }],
    caption: plural(totals.sessions, 'session', 'sessions'),
    label: withLast(`${totals.sessions} ${plural(totals.sessions, 'session', 'sessions')}`, String(previous?.sessions ?? 0), sessionsCompare),
    compare: sessionsCompare
  });

  figures.push({
    id: 'time',
    parts: durationParts(totals.minutes),
    caption: 'trained',
    label: withLast(`${formatDuration(totals.minutes)} trained`, formatDuration(previous?.minutes ?? 0), timeCompare),
    compare: timeCompare
  });

  const full = fullWeeks(insight);
  const target = input.weeklyTarget;
  if (target && target > 0) {
    const onGoal = full.filter((week) => week.sessions >= target).length;
    figures.push(
      full.length === 0
        ? { id: 'weeks', parts: [{ value: EN_DASH, unit: '' }], caption: 'full weeks on goal', label: 'No full week in this month yet', compare: null }
        : {
            id: 'weeks',
            parts: [{ value: String(onGoal), unit: `of ${full.length}` }],
            caption: plural(full.length, 'full week on goal', 'full weeks on goal'),
            label: `${onGoal} of ${full.length} full ${plural(full.length, 'week', 'weeks')} on goal`,
            compare: null
          }
    );
  } else {
    const trained = full.filter((week) => week.sessions > 0).length;
    figures.push({
      id: 'weeks',
      parts: [{ value: String(trained), unit: '' }],
      caption: plural(trained, 'week trained', 'weeks trained'),
      label: `${trained} full ${plural(trained, 'week', 'weeks')} trained`,
      compare: null
    });
  }

  figures.push({
    id: 'records',
    parts: [{ value: String(totals.records), unit: '' }],
    caption: plural(totals.records, 'personal record', 'personal records'),
    label: withLast(`${totals.records} ${plural(totals.records, 'personal record', 'personal records')}`, String(previous?.records ?? 0), recordsCompare),
    compare: recordsCompare
  });

  if (input.badgeState === 'loading') {
    figures.push({ id: 'badges', parts: [{ value: EN_DASH, unit: '' }], caption: 'badges earned', label: 'Badges are loading', compare: null });
  } else if (input.badgeState === 'ready') {
    // A badge is earned once, so a month with fewer of them than the last is no step back and the
    // figure carries no comparison.
    const earned = badgesInMonth(input.badgeDates, month);
    figures.push({
      id: 'badges',
      parts: [{ value: String(earned), unit: '' }],
      caption: plural(earned, 'badge earned', 'badges earned'),
      label: `${earned} ${plural(earned, 'badge earned', 'badges earned')}`,
      compare: null
    });
  }

  const streak = totals.longestStreakDays;
  figures.push({
    id: 'streak',
    parts: [{ value: String(streak), unit: plural(streak, 'day', 'days') }],
    caption: 'longest streak',
    label: withLast(`Longest streak ${streak} ${plural(streak, 'day', 'days')}`, String(previous?.longestStreakDays ?? 0), streakCompare),
    compare: streakCompare
  });

  return figures;
}

/** The title: the month so far for the month that holds the reference date, else the month. */
export function headTitle(month: string, referenceDate: string): string {
  const name = monthNameOf(month);
  return monthOfDate(referenceDate) === month ? `${name} so far` : name;
}

/** The line under the title: where the figures start for the month of the first session,
 *  otherwise which month the arrows compare with when at least one arrow is drawn, otherwise
 *  nothing. */
export function headLine(month: string, firstSessionDate: string | null, hasArrows: boolean): string | null {
  if (firstSessionDate && monthOfDate(firstSessionDate) === month) {
    return `Since you joined on ${Number(firstSessionDate.slice(8, 10))} ${monthNameOf(month)}.`;
  }
  return hasArrows ? `Arrows compare with ${monthNameOf(shiftMonth(month, -1))}.` : null;
}
