const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Turns a code such as STRENGTH or AUTH_PROVIDER into "Strength" or "Auth provider". */
export function titleCase(value: string): string {
  const words = value.trim().replace(/[_\s]+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * How long ago an instant was, in the largest whole unit: "3 min", "2 h" or "4 d".
 * Returns null when the text is not a date. An instant in the future counts as "0 min".
 */
export function relativeAge(instant: string, now: Date): string | null {
  const time = Date.parse(instant);
  if (Number.isNaN(time)) {
    return null;
  }
  const elapsed = Math.max(0, now.getTime() - time);
  if (elapsed < HOUR_MS) {
    return `${Math.floor(elapsed / MINUTE_MS)} min`;
  }
  if (elapsed < DAY_MS) {
    return `${Math.floor(elapsed / HOUR_MS)} h`;
  }
  return `${Math.floor(elapsed / DAY_MS)} d`;
}

/** The time of day on a 24 hour clock in the browser's timezone, for example "14:05". */
export function formatClock(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

/** The full local date and time of an instant, for a tooltip; null when the text is not a date. */
export function formatLocalDateTime(instant: string): string | null {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium', hourCycle: 'h23' }).format(date);
}

/** Whether the text is a calendar date key (YYYY-MM-DD) that is not later than the latest allowed key. */
export function isDateKeyUpTo(value: string, latest: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && value <= latest;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 120;

/** A light shape check so an obvious typo never leaves the browser; the server is the real check. */
export function looksLikeEmail(value: string): boolean {
  return value.length > 0 && value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);
}
