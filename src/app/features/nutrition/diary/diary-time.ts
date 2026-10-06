import { dayBoundsInZone } from '../../../core/zone-time';
import { MealSlot } from '../../dashboard/today/today-meals';

const pad = (value: number): string => String(value).padStart(2, '0');

/** A local calendar date as "YYYY-MM-DD". */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of an "YYYY-MM-DD" date. An unreadable date gives today. */
export function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** The seven dates of the week that holds `iso`, Monday first. */
export function weekOf(iso: string): string[] {
  const date = parseIsoDate(iso);
  const sinceMonday = (date.getDay() + 6) % 7;
  const monday = addDays(iso, -sinceMonday);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** The first and last instant of a calendar day in the user's zone, as ISO strings the meals endpoint takes. */
export function dayBounds(iso: string, timezone: string): { from: string; to: string } {
  const { from, to } = dayBoundsInZone(iso, timezone);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * The meal a drink logged at this moment belongs to: before 10:30 breakfast, before 15:00 lunch,
 * before 21:00 dinner, otherwise a snack. These are the windows the API contract names.
 */
export function mealTypeByClock(moment: Date): MealSlot {
  const minutes = moment.getHours() * 60 + moment.getMinutes();
  if (minutes < 10 * 60 + 30) {
    return 'BREAKFAST';
  }
  if (minutes < 15 * 60) {
    return 'LUNCH';
  }
  return minutes < 21 * 60 ? 'DINNER' : 'SNACK';
}

/** The moment at a local "HH:mm" clock time on a local date. */
export function atClock(iso: string, clock: string): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  const date = parseIsoDate(iso);
  if (match) {
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  }
  return date;
}

/** "HH:mm" in the viewer's time zone, or an empty string for a value that is not a time. */
export function clockText(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '' : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short' });

const WEEKDAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

/** "Tuesday", for the day line of a past day with nothing logged. */
export function weekdayName(iso: string): string {
  return WEEKDAY_LONG.format(parseIsoDate(iso));
}

/** "Friday 2 Oct". */
export function dayLabel(iso: string): string {
  const date = parseIsoDate(iso);
  return `${WEEKDAY.format(date)} ${date.getDate()} ${MONTH.format(date)}`;
}

/** "28 Sept to 4 Oct". */
export function rangeLabel(first: string, last: string): string {
  const from = parseIsoDate(first);
  const to = parseIsoDate(last);
  return `${from.getDate()} ${MONTH.format(from)} to ${to.getDate()} ${MONTH.format(to)}`;
}
