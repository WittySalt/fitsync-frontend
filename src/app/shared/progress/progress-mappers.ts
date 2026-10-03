import { DayState, DotDay, Highlight, SeriesPoint, SummaryLine } from './progress.models';

/**
 * Defensive readers for the Progress endpoints. The backend is built alongside the pages, so a field
 * may be missing or of the wrong type; each reader gives null or an empty list rather than a guess,
 * and the page shows "not enough data yet" for what is missing.
 */
export type Wire = Record<string, unknown>;

export function obj(value: unknown): Wire | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Wire) : null;
}

export function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function bool(value: unknown): boolean {
  return value === true;
}

/** A list of objects, each read by `read`; entries that read as null are dropped. */
export function list<T>(value: unknown, read: (item: Wire) => T | null): T[] {
  return arr(value)
    .map((item) => {
      const wire = obj(item);
      return wire ? read(wire) : null;
    })
    .filter((item): item is T => item !== null);
}

/** `{value, previous}` with either side null when absent. */
export function compared<T>(value: unknown, read: (raw: unknown) => T | null): { value: T | null; previous: T | null } {
  const wire = obj(value);
  return { value: read(wire?.['value']), previous: read(wire?.['previous']) };
}

export function mapSeries(value: unknown, labelKey = 'label', valueKey = 'value'): SeriesPoint[] {
  return list(value, (item) => {
    const label = str(item[labelKey]);
    const point = num(item[valueKey]);
    return label !== null && point !== null ? { label, value: point } : null;
  });
}

/** Highlights: code and title are required, the rest is optional. At most four are kept. */
export function mapHighlights(value: unknown): Highlight[] {
  return list(value, (item) => {
    const code = str(item['code']);
    const title = str(item['title']);
    if (!code || !title) {
      return null;
    }
    return { code, title, series: mapSeries(item['series']), unit: str(item['unit']) ?? '', context: str(item['context']) ?? '' };
  }).slice(0, 4);
}

/** The server's summary lines, `{text, trend}`, as lines without a separate bold figure. */
export function mapSummaryLines(value: unknown): SummaryLine[] {
  return list(value, (item) => {
    const text = str(item['text']);
    return text ? { text, trend: str(item['trend']) ?? '' } : null;
  }).slice(0, 3);
}

const DAY_STATES: readonly DayState[] = ['MET', 'MISSED', 'NOT_LOGGED', 'FUTURE'];

export function mapDotDays(value: unknown): DotDay[] {
  return list(value, (item) => {
    const date = str(item['date']);
    const state = DAY_STATES.find((candidate) => candidate === item['state']);
    return date && state ? { date, state } : null;
  });
}
