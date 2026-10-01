import { DayKind, MonthDayInsight, MonthMuscleInsight, MuscleGroupCode } from '../../../../core/fitsync.models';
import { isTrainingDayKind } from '../day-kind-icons';
import { GlyphShape, MUSCLE_GLYPHS } from '../muscle-icons';
import { monthNameOf } from './month-grid';
import { TROPHY, capital, listDays, plural, word } from './month-observations';
import { TextRow } from './month-rows';

const MAX_LISTED_DATES = 6;

const KIND_ORDER: DayKind[] = ['STRENGTH', 'CARDIO', 'MOBILITY', 'SPORT'];

// Two arrows that point apart, for the gap between two days.
const GAP: GlyphShape[] = [
  { tag: 'path', d: 'M3 12h18' },
  { tag: 'path', d: 'M7 8l-4 4 4 4' },
  { tag: 'path', d: 'M17 8l4 4-4 4' }
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The days of the month that trained a group, in date order. A day counts once, however many of
 *  its sessions trained the group, and only a training day counts. */
export function daysOfGroup(days: readonly MonthDayInsight[], group: string): MonthDayInsight[] {
  return days.filter((day) => isTrainingDayKind(day.kind) && day.muscles.includes(group)).sort((a, b) => a.date.localeCompare(b.date));
}

/** The title of the radar while a group is picked: "Chest, 8 sessions". */
export function muscleChartTitle(muscle: MonthMuscleInsight): string {
  return `${muscle.label}, ${muscle.sessions} ${plural(muscle.sessions, 'session', 'sessions')}`;
}

function dayNumber(date: string): number {
  return Number(date.slice(8, 10));
}

function kindsLine(days: readonly MonthDayInsight[]): string {
  const kinds = KIND_ORDER.filter((kind) => days.some((day) => day.kind === kind)).map((kind) => kind.toLowerCase());
  return kinds.length === 1 ? kinds[0] : `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}`;
}

function datesLine(days: readonly MonthDayInsight[], month: string): string {
  const numbers = days.map((day) => dayNumber(day.date));
  return numbers.length > MAX_LISTED_DATES
    ? `From ${numbers[0]} to ${numbers[numbers.length - 1]} ${monthNameOf(month)}.`
    : `${listDays(numbers)} ${monthNameOf(month)}.`;
}

// The headline has to fit one line at the width of the panel's column, which holds about forty
// characters. "Eight sessions across strength and cardio days." does not, so a month of mixed days
// names the kinds right after the count, and three or more kinds are counted instead of named.
function spreadOf(days: readonly MonthDayInsight[]): string {
  const kinds = new Set(days.map((day) => day.kind));
  if (kinds.size === 1) {
    return `all on ${kindsLine(days)} days`;
  }
  return kinds.size === 2 ? kindsLine(days) : `on ${word(kinds.size)} kinds of day`;
}

function sessionsRow(days: readonly MonthDayInsight[], total: number, month: string, group: string): TextRow {
  return {
    id: 'sessions',
    headline: `${capital(word(total))} ${plural(total, 'session', 'sessions')}, ${spreadOf(days)}.`,
    note: datesLine(days, month),
    glyph: MUSCLE_GLYPHS[group as MuscleGroupCode] ?? GAP
  };
}

function gapRow(days: readonly MonthDayInsight[]): TextRow | null {
  if (days.length < 2) {
    return null;
  }
  const gaps: number[] = [];
  for (let index = 1; index < days.length; index += 1) {
    gaps.push(Math.round((Date.parse(`${days[index].date}T00:00:00Z`) - Date.parse(`${days[index - 1].date}T00:00:00Z`)) / DAY_MS));
  }
  const average = Math.max(1, Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length));
  const longest = Math.max(...gaps);
  return {
    id: 'gap',
    headline: `${capital(word(average))} ${plural(average, 'day', 'days')} apart on average.`,
    note: `The longest gap was ${word(longest)} ${plural(longest, 'day', 'days')}.`,
    glyph: GAP
  };
}

function recordsRow(days: readonly MonthDayInsight[], month: string): TextRow | null {
  const records = days.filter((day) => day.record);
  if (records.length === 0) {
    return null;
  }
  const numbers = records.map((day) => dayNumber(day.date));
  return {
    id: 'records',
    headline: `${capital(word(records.length))} of these days set a record.`,
    // A long list would not fit the line, so only a short one is written out.
    note: numbers.length <= MAX_LISTED_DATES ? `${listDays(numbers)} ${monthNameOf(month)}.` : '',
    glyph: TROPHY
  };
}

/** What the month says about one muscle group, in at most three lines: how often it was trained and
 *  on which days, how far apart those days lay and which of them set a record. The count is the
 *  group's session count of the month when it is known. */
export function buildMuscleRows(days: readonly MonthDayInsight[], group: string, month: string, sessions?: number): TextRow[] {
  const trained = daysOfGroup(days, group);
  if (trained.length === 0) {
    return [];
  }
  const rows: (TextRow | null)[] = [
    sessionsRow(trained, Math.max(sessions ?? 0, trained.length), month, group),
    gapRow(trained),
    recordsRow(trained, month)
  ];
  return rows.filter((row): row is TextRow => row !== null);
}
