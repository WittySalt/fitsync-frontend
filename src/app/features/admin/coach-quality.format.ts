import { CoachModelCount, CoachReadingCount, CoachToolStat } from './admin-api.service';

export type PeriodDays = 7 | 30 | 90;

export const PERIOD_OPTIONS: readonly { days: PeriodDays; label: string }[] = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' }
];

export interface ReadingRow {
  label: string;
  accepted: number;
  rejected: number;
}

/** A whole percent of the total, and 0 when there is no total to divide by. */
export function sharePercent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Milliseconds as seconds with one decimal, for example "2.6 s". */
export function formatSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

/** Whole milliseconds, for example "14 ms". */
export function formatMilliseconds(milliseconds: number): string {
  return `${Math.round(milliseconds)} ms`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The line under the time to answer: how many answers passed and which models wrote them. */
export function passedAnswersLine(passed: number, models: CoachModelCount[]): string {
  if (passed <= 0) {
    return 'No passed answers in this period.';
  }
  const names = models
    .filter((model) => model.model && model.count > 0)
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model))
    .map((model) => model.model);
  const answers = plural(passed, 'passed answer', 'passed answers');
  if (names.length === 0) {
    return answers;
  }
  if (names.length === 1) {
    return `${answers}, all from ${names[0]}`;
  }
  return names.length === 2 ? `${answers}, from ${names[0]} and ${names[1]}` : `${answers}, from ${names.length} models`;
}

/** The note in the tool table header, for example "84 calls, none failed". */
export function toolCallsNote(tools: CoachToolStat[]): string {
  const calls = tools.reduce((sum, tool) => sum + tool.calls, 0);
  const failed = tools.reduce((sum, tool) => sum + tool.failed, 0);
  return `${plural(calls, 'call', 'calls')}, ${failed === 0 ? 'none failed' : `${failed} failed`}`;
}

function capitalise(value: string): string {
  const spaced = value.toLowerCase().replace(/_/g, ' ').trim();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : '';
}

function sourceLabel(source: string): string {
  switch (source.toUpperCase()) {
    case 'MODEL':
      return 'coach model';
    case 'RULES':
      return 'fixed rules';
    default:
      return source.toLowerCase().replace(/_/g, ' ').trim();
  }
}

/** "Workout, coach model" from a surface and a source. */
export function readingLabel(surface: string, source: string): string {
  return [capitalise(surface), sourceLabel(source)].filter(Boolean).join(', ');
}

/**
 * One row per page and writer, with the accepted and the rejected count side by side. Outcomes other
 * than those two are left out, and so is a row that has neither.
 */
export function pivotReadings(readings: CoachReadingCount[]): ReadingRow[] {
  const rows = new Map<string, ReadingRow>();
  for (const reading of readings) {
    const outcome = reading.outcome.toUpperCase();
    if (outcome !== 'ACCEPTED' && outcome !== 'REJECTED') {
      continue;
    }
    const label = readingLabel(reading.surface, reading.source);
    const row = rows.get(label) ?? { label, accepted: 0, rejected: 0 };
    if (outcome === 'ACCEPTED') {
      row.accepted += reading.count;
    } else {
      row.rejected += reading.count;
    }
    rows.set(label, row);
  }
  return [...rows.values()].filter((row) => row.accepted + row.rejected > 0).sort((a, b) => a.label.localeCompare(b.label));
}

export function readingsNote(rows: ReadingRow[]): string {
  return plural(
    rows.reduce((sum, row) => sum + row.accepted + row.rejected, 0),
    'reading',
    'readings'
  );
}

/** The calendar date key (YYYY-MM-DD) of an instant in a timezone; an unknown timezone falls back to UTC. */
export function dateKeyInZone(now: Date, timezone: string): string {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: timezone });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' });
  }
  const parts = formatter.formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function addDaysToKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The range that ends today and covers the given number of days, both ends included. */
export function rangeEndingToday(days: PeriodDays, now: Date, timezone: string): { from: string; to: string } {
  const to = dateKeyInZone(now, timezone);
  return { from: addDaysToKey(to, -(days - 1)), to };
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
