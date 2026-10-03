import { shortDateLabel } from '../date-label';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MINUS = '−';

export function isDateKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && DATE_KEY.test(value);
}

/** A number with grouping, for example 2,123, or 71.2 with one digit. */
export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** A signed number with a true minus sign: "+1.6", "−0.41", "0". */
export function signed(value: number, digits = 1): string {
  const text = formatNumber(Math.abs(value), digits);
  if (Number(text.replace(/,/g, '')) === 0) {
    return text;
  }
  return `${value < 0 ? MINUS : '+'}${text}`;
}

/** A date key as "6 Sept", or the label itself when it is not a date. */
export function pointLabel(label: string, reference: Date = new Date()): string {
  return isDateKey(label) ? shortDateLabel(label, reference) : label;
}

/** The trend word a summary line shows: the server's UP, STEADY or DOWN, or any word, in lower case. */
export function trendWord(trend: string | null | undefined): string {
  return (trend ?? '').trim().toLowerCase();
}

/** Minutes as "1 h 10", "45 min" or "2 h". */
export function hoursAndMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) {
    return `${rest} min`;
  }
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}

/** A day key moved by whole days, read as a calendar date. */
export function shiftDay(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The last `days` days ending on `today`, both ends included. */
export function lastDays(days: number, today: string): { from: string; to: string } {
  return { from: shiftDay(today, -(days - 1)), to: today };
}

/** Whole days from one key to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** A rough width of a text in a chart, so labels at the ends of a line have room. */
export function textWidth(text: string, size = 11, bold = false): number {
  return text.length * size * (bold ? 0.6 : 0.56);
}
