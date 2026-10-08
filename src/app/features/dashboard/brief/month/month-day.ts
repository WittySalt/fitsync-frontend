import { DayKind, MonthDayInsight, NutritionSummary } from '../../../../core/fitsync.models';
import { formatDuration } from '../brief-duration';
import { DAY_KIND_GLYPHS, isTrainingDayKind } from '../day-kind-icons';
import { GlyphShape } from '../muscle-icons';
import { describeDate } from './month-grid';
import { SCALE, TROPHY, capital, plural, word } from './month-observations';
import { PendingRow, RowItem } from './month-rows';

/** What the month view needs to know about one session of the chosen date. */
export interface DaySession {
  /** The start of the session, as an instant; empty when the service did not say. */
  startedAt: string;
  kind: DayKind | null;
}

/** Where a request of the chosen date stands. A request that failed is treated as one that found
 *  nothing, so its line is left out. */
export type DayLoad = 'loading' | 'done';

export interface DayInput {
  dateKey: string;
  timezone: string;
  /** The date of today, and of the first session ever, as the month's response states them. */
  referenceDate: string;
  firstSessionDate: string | null;
  /** The date's entry in the month's insight, or null when the insight has none. */
  day: MonthDayInsight | null;
  sessions: readonly DaySession[];
  /** The exercise names of the date's session, in order, when there was exactly one. */
  exercises: readonly string[];
  food: NutritionSummary | null;
  weightKg: number | null;
  sessionsLoad: DayLoad;
  foodLoad: DayLoad;
}

const MAX_ROWS = 3;
const MAX_EXERCISES = 4;
// The line under the headline has to fit one line at the width of the panel's column, which holds
// about forty characters of the small text, so names are added only while the sentence stays short.
const MAX_NOTE_LENGTH = 42;

const KIND_NAMES: Record<string, string> = {
  STRENGTH: 'Strength',
  CARDIO: 'Cardio',
  MOBILITY: 'Mobility',
  SPORT: 'Sport'
};

const BOWL: GlyphShape[] = [
  { tag: 'path', d: 'M3 11h18a9 9 0 0 1-18 0z' },
  { tag: 'path', d: 'M12 4v3' }
];

const wholeNumber = (value: number): string => Math.round(value).toLocaleString('en-US');

/** The time of an instant in the given timezone as HH:mm, or an empty string when it is unknown. */
export function clockTime(instant: string, timezone: string): string {
  const date = new Date(instant);
  if (!instant || Number.isNaN(date.getTime())) {
    return '';
  }
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: timezone });
  } catch {
    formatter = new Intl.DateTimeFormat('en-GB', options);
  }
  const parts = formatter.formatToParts(date);
  const part = (type: string): string => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')}`;
}

/** Names in running text: "Bench press, goblet squat, row and plank". The first word keeps a
 *  capital, a word written in capitals (EZ, DB) stays as it is and the rest is lowercase. */
export function exerciseSentence(names: readonly string[]): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  let sentence = '';
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name || seen.has(name.toLowerCase())) {
      continue;
    }
    seen.add(name.toLowerCase());
    const lowered = name.replace(/[A-Za-z]+/g, (token) => (token.length > 1 && token === token.toUpperCase() ? token : token.toLowerCase()));
    const next = [...kept, lowered];
    const list = next.length === 1 ? next[0] : `${next.slice(0, -1).join(', ')} and ${next[next.length - 1]}`;
    const candidate = `${capital(list)}.`;
    // The first name is always kept, however long it is.
    if (kept.length > 0 && candidate.length > MAX_NOTE_LENGTH) {
      break;
    }
    kept.push(lowered);
    sentence = candidate;
    if (kept.length === MAX_EXERCISES) {
      break;
    }
  }
  return sentence;
}

function kindsSentence(sessions: readonly DaySession[]): string {
  const kinds: string[] = [];
  for (const session of sessions) {
    const name = session.kind ? KIND_NAMES[session.kind] : undefined;
    if (name) {
      kinds.push(name);
    }
  }
  const distinct = Array.from(new Set(kinds));
  if (distinct.length === 0) {
    return '';
  }
  if (distinct.length === 1) {
    return `${kinds.length === 2 ? 'Both' : 'All'} ${distinct[0].toLowerCase()}.`;
  }
  return `${distinct.slice(0, -1).join(', ')} and ${distinct[distinct.length - 1].toLowerCase()}.`;
}

function trainingRow(input: DayInput): RowItem | null {
  const day = input.day;
  if (!day || !isTrainingDayKind(day.kind) || day.sessions < 1) {
    return null;
  }
  const length = formatDuration(day.minutes > 0 ? day.minutes : null);
  if (day.sessions >= 2) {
    return {
      id: 'training',
      headline: length ? `${capital(word(day.sessions))} sessions, ${length}.` : `${capital(word(day.sessions))} sessions.`,
      note: kindsSentence(input.sessions),
      glyph: DAY_KIND_GLYPHS[day.kind]
    };
  }
  const first = [...input.sessions].filter((session) => session.startedAt).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))[0];
  const time = first ? clockTime(first.startedAt, input.timezone) : '';
  const name = day.kind === 'SPORT' && day.label ? day.label : (KIND_NAMES[day.kind] ?? day.label);
  const parts = [name, length].filter(Boolean).join(', ');
  return {
    id: 'training',
    headline: time ? `${parts} at ${time}.` : `${parts}.`,
    note: exerciseSentence(input.exercises),
    glyph: DAY_KIND_GLYPHS[day.kind]
  };
}

function recordRow(input: DayInput): RowItem | null {
  // The session detail carries no flag for a record, so the line names none of its exercises.
  return input.day?.record && isTrainingDayKind(input.day.kind)
    ? { id: 'record', headline: 'A record on this day.', note: '', glyph: TROPHY }
    : null;
}

function foodRow(input: DayInput): RowItem | null {
  const food = input.food;
  if (!food || food.mealCount < 1) {
    return null;
  }
  const budget = food.targetCalories ?? 0;
  const inside = budget > 0 && food.totalCalories <= budget;
  const meals = `${capital(word(food.mealCount))} ${plural(food.mealCount, 'meal', 'meals')}`;
  return {
    id: 'food',
    headline: `${wholeNumber(food.totalCalories)} kcal and ${wholeNumber(food.totalProteinGrams)} g of protein.`,
    note: inside ? `${meals}, inside the ${wholeNumber(budget)} kcal budget.` : `${meals}.`,
    glyph: BOWL
  };
}

function weighInRow(input: DayInput): RowItem | null {
  return input.weightKg != null && Number.isFinite(input.weightKg)
    ? { id: 'weigh-in', headline: `Weighed ${input.weightKg.toFixed(1)} kg.`, note: '', glyph: SCALE }
    : null;
}

/** The one quiet sentence of a date with nothing to show. */
export function quietLine(input: Pick<DayInput, 'dateKey' | 'referenceDate' | 'firstSessionDate'>): string {
  if (input.referenceDate && input.dateKey > input.referenceDate) {
    return 'Still to come.';
  }
  if (input.firstSessionDate && input.dateKey < input.firstSessionDate) {
    return 'Before your first session.';
  }
  return 'Nothing logged on this day.';
}

/** A date written out, such as "Friday 25 September". */
export function dayHeading(dateKey: string): string {
  return describeDate(dateKey);
}

export interface DayRows {
  rows: RowItem[];
  /** The sentence of a date with nothing, empty while something is still loading or shown. */
  quiet: string;
}

const pending = (id: string): PendingRow => ({ id, pending: true });

/** The lines of a date, at most three, in the order training, record, food and weigh-in. A line
 *  whose request is still on its way is a skeleton row in its place. They state what happened:
 *  none says what is missing, compares the person with anyone else or asks for anything. */
export function buildDayRows(input: DayInput): DayRows {
  const day = input.day;
  const trained = !!day && isTrainingDayKind(day.kind) && day.sessions >= 1;
  const candidates: (RowItem | null)[] = [
    trained && input.sessionsLoad === 'loading' ? pending('training') : trainingRow(input),
    recordRow(input),
    input.foodLoad === 'loading' ? pending('food') : foodRow(input),
    weighInRow(input)
  ];
  const rows = candidates.filter((row): row is RowItem => row !== null).slice(0, MAX_ROWS);
  return { rows, quiet: rows.length === 0 ? quietLine(input) : '' };
}
