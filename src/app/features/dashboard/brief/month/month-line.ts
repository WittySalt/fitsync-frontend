import { monthOfDate, shiftMonth } from './month-grid';

/** The key under which the latest month whose line was set aside is kept, as YYYY-MM. */
export const MONTH_LINE_STORAGE_KEY = 'fitsync.month-line.dismissed';

/** The last day of a month on which the brief still offers the month before. */
const LAST_DAY_OFFERED = 3;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The month the line of the first days speaks of, as YYYY-MM: the one before the month of the given
 *  date on the first three days of that month, and nothing after them. */
export function monthToOffer(todayKey: string): string | null {
  const day = Number(todayKey.slice(8, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayKey) || day < 1 || day > LAST_DAY_OFFERED) {
    return null;
  }
  return shiftMonth(monthOfDate(todayKey), -1);
}

/** The latest month that was set aside, or null when none was or the storage cannot be read. */
export function readDismissedMonth(): string | null {
  try {
    const value = localStorage.getItem(MONTH_LINE_STORAGE_KEY);
    return value !== null && MONTH_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** Remembers that the line of a month is done with. A blocked storage only means that the line may
 *  show again, so a failed write is let go. */
export function writeDismissedMonth(month: string): void {
  try {
    const latest = readDismissedMonth();
    if (latest === null || latest < month) {
      localStorage.setItem(MONTH_LINE_STORAGE_KEY, month);
    }
  } catch {
    // The line may come back; that is all a blocked storage costs.
  }
}

/** True when the line of this month was set aside, or a later one was. */
export function isDismissed(month: string): boolean {
  const latest = readDismissedMonth();
  return latest !== null && latest >= month;
}
