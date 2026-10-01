import { DayKind, MonthDayInsight } from '../../../../core/fitsync.models';
import { isTrainingDayKind } from '../day-kind-icons';
import { formatDuration } from '../brief-duration';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

// The short names are spelled out here, rather than taken from Intl, so that September reads
// "Sept" as it does on the date label above the headline, whatever the runtime's ICU data says.
const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The weekday initials of the header row, Monday first. */
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Cell heights, in pixels. A month of six rows shrinks its cells so the grid keeps the height of
 *  the usual five rows; the style sheet spreads the rows so the two heights come out equal. */
export const CELL_HEIGHT_DEFAULT = 45;
export const CELL_HEIGHT_SIX_ROWS = 36;

/** How a date is drawn: a day with training, a quiet empty day, a day yet to come, or a day from
 *  before the first session, which is left blank. Today is a separate flag, since today can be
 *  either a training day or an empty one. */
export type MonthCellState = 'trained' | 'empty' | 'future' | 'before';

export interface MonthCell {
  dateKey: string;
  day: number;
  state: MonthCellState;
  today: boolean;
  /** The training kind of a trained day, otherwise null. */
  kind: DayKind | null;
  minutes: number;
  record: boolean;
  weighIn: boolean;
  ariaLabel: string;
}

export interface MonthRow {
  /** Seven entries, Monday first, with null for the blank cells outside the month. */
  cells: (MonthCell | null)[];
  /** True for the week that contains the reference date. */
  current: boolean;
}

export interface MonthGrid {
  rows: MonthRow[];
  cellHeight: number;
  /** True when the month holds a date before the first session, which the legend then explains. */
  hasBefore: boolean;
}

export interface MonthGridInput {
  /** The month as YYYY-MM. */
  month: string;
  days: readonly MonthDayInsight[];
  /** The dates of the month that have a weigh-in, as YYYY-MM-DD. */
  weighIns: ReadonlySet<string>;
  referenceDate: string;
  firstSessionDate: string | null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [year, monthNumber] = month.split('-').map(Number);
  return { year, monthIndex: monthNumber - 1 };
}

/** The calendar day count of a month, which does not depend on any timezone. */
export function daysInMonth(month: string): number {
  const { year, monthIndex } = parseMonth(month);
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** The month of a YYYY-MM-DD date, as YYYY-MM. */
export function monthOfDate(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** The month that lies `delta` months from the given one, as YYYY-MM. */
export function shiftMonth(month: string, delta: number): string {
  const { year, monthIndex } = parseMonth(month);
  const shifted = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}

/** The name of a month without the year, such as "September". */
export function monthNameOf(month: string): string {
  return MONTH_NAMES[parseMonth(month).monthIndex] ?? '';
}

export function monthTitle(month: string): string {
  const { year, monthIndex } = parseMonth(month);
  return `${MONTH_NAMES[monthIndex] ?? ''} ${year}`;
}

/** The weekday of a date with Monday as 0 and Sunday as 6. */
export function weekdayIndex(dateKey: string): number {
  return (new Date(`${dateKey}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** A date in words for a screen reader, such as "Thursday 3 September". */
export function describeDate(dateKey: string): string {
  const [, monthNumber, day] = dateKey.split('-').map(Number);
  return `${WEEKDAY_NAMES[weekdayIndex(dateKey)]} ${day} ${MONTH_NAMES[monthNumber - 1]}`;
}

/** A date in short form, such as "3 Aug". */
export function shortDate(dateKey: string): string {
  const [, monthNumber, day] = dateKey.split('-').map(Number);
  return `${day} ${MONTH_SHORT_NAMES[monthNumber - 1]}`;
}

/** The calendar day of an instant in the given timezone, as YYYY-MM-DD, so that a weigh-in made
 *  late in the evening lands on the date the person saw on their own clock. */
export function dateKeyInTimezone(instant: string | null | undefined, timezone: string): string | null {
  const date = new Date(instant ?? NaN);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: timezone });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', options);
  }
  const parts = formatter.formatToParts(date);
  const part = (type: string): string => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function ariaLabelFor(
  dateKey: string,
  state: MonthCellState,
  today: boolean,
  training: MonthDayInsight | null,
  weighIn: boolean
): string {
  const parts = [describeDate(dateKey)];
  if (today) {
    parts.push('today');
  }
  if (state === 'trained' && training) {
    parts.push(training.kind.toLowerCase());
    if (training.minutes > 0) {
      parts.push(formatDuration(training.minutes));
    }
    if (training.record) {
      parts.push('record');
    }
  } else if (state === 'before') {
    parts.push('before you joined');
  } else if (state === 'future') {
    parts.push('upcoming');
  } else {
    parts.push('nothing logged');
  }
  if (weighIn) {
    parts.push('weigh-in');
  }
  return parts.join(', ');
}

/** Lays one month out in weeks that start on Monday, with null for the blank cells before the
 *  first date and after the last, and works out the state of every date. */
export function buildMonthGrid(input: MonthGridInput): MonthGrid {
  const { month, referenceDate, firstSessionDate } = input;
  const trainingByDate = new Map<string, MonthDayInsight>();
  for (const day of input.days) {
    // A kind that is not a training kind (REST, or one the app does not know) would draw a glyph
    // that means something else, so only the four training kinds make a trained day.
    if (isTrainingDayKind(day.kind)) {
      trainingByDate.set(day.date, day);
    }
  }

  const total = daysInMonth(month);
  const lead = weekdayIndex(`${month}-01`);
  const rowCount = Math.ceil((lead + total) / 7);
  const rows: MonthRow[] = [];
  let hasBefore = false;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const cells: (MonthCell | null)[] = [];
    let current = false;
    for (let column = 0; column < 7; column += 1) {
      const day = rowIndex * 7 + column - lead + 1;
      if (day < 1 || day > total) {
        cells.push(null);
        continue;
      }
      const dateKey = `${month}-${pad(day)}`;
      const training = trainingByDate.get(dateKey) ?? null;
      const today = dateKey === referenceDate;
      let state: MonthCellState = 'empty';
      if (training) {
        state = 'trained';
      } else if (firstSessionDate !== null && dateKey < firstSessionDate) {
        state = 'before';
        hasBefore = true;
      } else if (referenceDate && dateKey > referenceDate) {
        state = 'future';
      }
      const weighIn = input.weighIns.has(dateKey);
      current = current || today;
      cells.push({
        dateKey,
        day,
        state,
        today,
        kind: training ? training.kind : null,
        minutes: training ? training.minutes : 0,
        record: training?.record === true,
        weighIn,
        ariaLabel: ariaLabelFor(dateKey, state, today, training, weighIn)
      });
    }
    rows.push({ cells, current });
  }

  return { rows, cellHeight: rowCount === 6 ? CELL_HEIGHT_SIX_ROWS : CELL_HEIGHT_DEFAULT, hasBefore };
}
