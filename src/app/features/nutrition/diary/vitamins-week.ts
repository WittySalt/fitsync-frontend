import { NutrientDay, NutrientRow } from './diary.models';
import { rangeLabel, weekOf } from './diary-time';

const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The Monday to Sunday week that holds the selected day, the same week as the week card. */
export function weekRange(selected: string): { dates: string[]; monday: string; sunday: string } {
  const dates = weekOf(selected);
  return { dates, monday: dates[0], sunday: dates[6] };
}

/** The days of the week old enough for the average: those before today, so today joins tomorrow. A past week counts whole. */
export function averageWindow(dates: readonly string[], today: string): string[] {
  return dates.filter((date) => date < today);
}

/** The days of a nutrient that count: logged, with a known share, inside the window. */
export function countedDays(row: NutrientRow, dates: readonly string[], today: string): NutrientDay[] {
  const window = averageWindow(dates, today);
  return row.days.filter((day) => window.includes(day.date) && day.logged && day.share !== null);
}

/** The average share of the counted days, or null when no day counts. */
export function averageShare(days: readonly NutrientDay[]): number | null {
  return days.length === 0 ? null : days.reduce((sum, day) => sum + (day.share ?? 0), 0) / days.length;
}

/** How strong a square is drawn: 0.18 for nothing up to 1 for a full day. */
export function cellOpacity(share: number): number {
  return 0.18 + 0.82 * Math.min(Math.max(share, 0), 1);
}

/** One square: a day after today or one not logged is empty, a logged day has a share. */
export interface WeekCell {
  date: string;
  weekday: string;
  state: 'future' | 'empty' | 'value';
  today: boolean;
  share: number | null;
  reached: boolean;
  opacity: number;
}

export interface WeekRow {
  row: NutrientRow;
  cells: WeekCell[];
  /** Average share of the counted days, null when none count. */
  average: number | null;
  /** Whole percent of the average for the last column. */
  percent: number | null;
  /** Counted days below the daily amount. */
  short: number;
  counted: number;
}

/** One row per nutrient with data, lowest average first. A nutrient with no counted day goes last. */
export function weekRows(rows: readonly NutrientRow[], dates: readonly string[], today: string): WeekRow[] {
  const built = rows
    .filter((row) => row.averageAmount !== null)
    .map((row): WeekRow => {
      const counted = countedDays(row, dates, today);
      const average = averageShare(counted);
      const cells = dates.map((date, index): WeekCell => {
        const day = row.days.find((entry) => entry.date === date);
        const share = day?.logged === true ? day.share : null;
        return {
          date,
          weekday: NAMES[index],
          state: date > today ? 'future' : share === null ? 'empty' : 'value',
          today: date === today,
          share,
          reached: share !== null && share >= 1,
          opacity: cellOpacity(share ?? 0)
        };
      });
      return {
        row,
        cells,
        average,
        percent: average === null ? null : Math.round(average * 100),
        short: counted.filter((day) => (day.share ?? 0) < 1).length,
        counted: counted.length
      };
    });
  return built.sort((a, b) => (a.average ?? Infinity) - (b.average ?? Infinity));
}

/** The sentence about the lowest nutrient, or an empty string when no day counts. */
export function patternLine(lowest: WeekRow | undefined): string {
  if (!lowest || lowest.counted === 0) {
    return '';
  }
  if (lowest.short === 0) {
    return 'Every vitamin and mineral here was reached on the days counted.';
  }
  const name = lowest.row.displayName;
  const head = lowest.short === lowest.counted ? `${name} was short on every day this week.` : `${name} was short on ${lowest.short} of ${lowest.counted} days this week.`;
  return lowest.row.richestUsualFood ? `${head} Among foods you often eat, ${lowest.row.richestUsualFood.toLowerCase()} has the most.` : head;
}

/** The note under the week: its dates, which days the average counts, and whose daily amounts these are. */
export function weekNote(dates: readonly string[], today: string, referenceLabel: string | null): string {
  const window = averageWindow(dates, today);
  let counts: string;
  if (window.length === 0) {
    counts = today < dates[0] ? 'This week has not started yet.' : 'Nothing is in the average yet, and today joins it tomorrow.';
  } else if (window.length === 1) {
    counts = `Only ${NAMES[0]} is in the average so far, so it will move as the week fills.`;
  } else {
    counts = `The average counts ${NAMES[0]} to ${NAMES[window.length - 1]}${window.length === 7 ? '.' : '; today joins it tomorrow.'}`;
  }
  const reference = `Daily amounts ${referenceLabel ? referenceLabel + ', from' : 'are from'} the US National Institutes of Health.`;
  return `${rangeLabel(dates[0], dates[6])}. ${counts} ${reference}`;
}
