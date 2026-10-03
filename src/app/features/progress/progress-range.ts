/** The days a page of Progress looks at, as two YYYY-MM-DD keys, both included. */
export interface DateRange {
  from: string;
  to: string;
}

export interface RangePreset {
  label: string;
  days: number;
}

/** The three ranges of the page. 90 days is the one it opens on. */
export const RANGE_PRESETS: readonly RangePreset[] = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 }
];

export const DEFAULT_RANGE_DAYS = 90;

/** A day key moved by whole days. The key is read as a calendar date, so no zone moves it. */
export function shiftKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The range that ends today and starts the given number of days before it. */
export function rangeForDays(days: number, today: string): DateRange {
  return { from: shiftKey(today, -days), to: today };
}

export function sameRange(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to;
}

/** A custom range is usable when both ends are dates and it does not run backwards. */
export function isValidRange(range: DateRange): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to) && range.from <= range.to;
}
