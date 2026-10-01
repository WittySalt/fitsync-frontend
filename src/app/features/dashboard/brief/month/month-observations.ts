import { MonthlyTrainingInsight, MuscleGroupCode } from '../../../../core/fitsync.models';
import { GlyphShape, MUSCLE_GLYPHS } from '../muscle-icons';
import { fullWeeks } from './month-figures';
import { monthNameOf, shiftMonth } from './month-grid';
import { MonthWeights } from './month-view.state';

export interface MonthObservation {
  id: string;
  headline: string;
  /** One line under the headline; empty when there is nothing more to say. */
  note: string;
  glyph: GlyphShape[];
}

export interface MonthObservationInput {
  insight: MonthlyTrainingInsight;
  weeklyTarget: number | null;
  weights: MonthWeights | null;
}

const MAX_OBSERVATIONS = 3;

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** A count in words up to twelve and in digits above. */
function word(count: number): string {
  return Number.isInteger(count) && count >= 0 && count < WORDS.length ? WORDS[count] : String(count);
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

// Glyphs on a 24 by 24 grid, drawn with a stroke like the rest of the brief's icons.
const TREND: GlyphShape[] = [
  { tag: 'path', d: 'M3 17l6-6 4 4 8-8' },
  { tag: 'path', d: 'M15 7h6v6' }
];
const TROPHY: GlyphShape[] = [
  { tag: 'path', d: 'M8 4h8v6a4 4 0 0 1-8 0Z' },
  { tag: 'path', d: 'M8 6H5a3 3 0 0 0 3 4' },
  { tag: 'path', d: 'M16 6h3a3 3 0 0 1-3 4' },
  { tag: 'path', d: 'M12 14v4' },
  { tag: 'path', d: 'M8.5 20h7' }
];
const SCALE: GlyphShape[] = [
  { tag: 'rect', x: 4, y: 4, width: 16, height: 16, rx: 4 },
  { tag: 'path', d: 'M8.5 9a5 5 0 0 1 7 0' },
  { tag: 'path', d: 'M12 9.5l1.5-2' }
];
const LINK: GlyphShape[] = [
  { tag: 'path', d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1' },
  { tag: 'path', d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' }
];
const PLUS: GlyphShape[] = [
  { tag: 'path', d: 'M12 5v14' },
  { tag: 'path', d: 'M5 12h14' }
];

function groupGlyph(code: string): GlyphShape[] {
  return MUSCLE_GLYPHS[code as MuscleGroupCode] ?? TREND;
}

function weeksObservation(input: MonthObservationInput): MonthObservation | null {
  const weeks = fullWeeks(input.insight);
  if (weeks.length < 2) {
    return null;
  }
  const target = input.weeklyTarget;
  if (target && target > 0 && weeks.every((week) => week.sessions >= target)) {
    return {
      id: 'weeks-on-goal',
      headline: `Every full week reached ${word(target)} ${plural(target, 'session', 'sessions')}.`,
      note: `${capital(word(weeks.length))} weeks on goal, one after another.`,
      glyph: LINK
    };
  }
  const rising = weeks[0].sessions > 0 && weeks.every((week, index) => index === 0 || week.sessions > weeks[index - 1].sessions);
  if (rising) {
    const parts = weeks.map((week, index) => (index === 0 ? `${word(week.sessions)} ${plural(week.sessions, 'session', 'sessions')}` : word(week.sessions)));
    return { id: 'weeks-rising', headline: 'Every week beat the last.', note: `${capital(parts.join(', then '))}.`, glyph: TREND };
  }
  return null;
}

function listDays(days: number[]): string {
  if (days.length === 1) {
    return String(days[0]);
  }
  return `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
}

function recordsObservation(input: MonthObservationInput): MonthObservation | null {
  const { insight } = input;
  const records = insight.totals.records;
  if (records < 1) {
    return null;
  }
  const days = insight.days
    .filter((day) => day.record)
    .map((day) => Number(day.date.slice(8, 10)))
    .sort((a, b) => a - b);
  return {
    id: 'records',
    headline: `${capital(word(records))} personal ${plural(records, 'record', 'records')} this month.`,
    note: days.length > 0 ? `On ${listDays(days)} ${monthNameOf(insight.month)}.` : '',
    glyph: TROPHY
  };
}

function weightObservation(input: MonthObservationInput): MonthObservation | null {
  const weights = input.weights;
  if (!weights || weights.count < 2) {
    return null;
  }
  const change = Math.round((weights.last - weights.first) * 10) / 10;
  if (Math.abs(change) < 0.1) {
    return null;
  }
  return {
    id: 'weight',
    headline: `Your weight is ${change < 0 ? 'down' : 'up'} ${Math.abs(change).toFixed(1)} kg.`,
    note: `From ${weights.first.toFixed(1)} to ${weights.last.toFixed(1)} kg this month.`,
    glyph: SCALE
  };
}

function streakObservation(input: MonthObservationInput): MonthObservation | null {
  const days = input.insight.totals.longestStreakDays;
  if (days < 3) {
    return null;
  }
  return {
    id: 'streak',
    headline: `${capital(word(days))} days in a row was your longest run.`,
    note: 'Your longest streak this month.',
    glyph: LINK
  };
}

function moreObservation(input: MonthObservationInput): MonthObservation | null {
  const { insight } = input;
  const previous = insight.previousTotals;
  if (!previous || insight.totals.sessions <= previous.sessions) {
    return null;
  }
  const more = insight.totals.sessions - previous.sessions;
  return {
    id: 'more',
    headline: `${capital(word(more))} more ${plural(more, 'session', 'sessions')} than ${monthNameOf(shiftMonth(insight.month, -1))}.`,
    note: `${insight.totals.sessions} this month, ${previous.sessions} last month.`,
    glyph: PLUS
  };
}

function leaderObservation(input: MonthObservationInput): MonthObservation | null {
  const muscles = input.insight.muscles.filter((muscle) => muscle.sessions > 0);
  if (muscles.length === 0) {
    return null;
  }
  const top = Math.max(...muscles.map((muscle) => muscle.sessions));
  const leaders = muscles.filter((muscle) => muscle.sessions === top);
  if (leaders.length > 2) {
    return null;
  }
  const names = leaders.map((muscle) => muscle.label).join(' and ');
  return {
    id: 'leader',
    headline: `${names} led the month.`,
    note: leaders.length === 1 ? `${top} ${plural(top, 'session', 'sessions')} trained it.` : `${top} ${plural(top, 'session', 'sessions')} trained each.`,
    glyph: groupGlyph(leaders[0].group)
  };
}

/** Up to three things the month shows, found in a fixed order and worded as praise for what was
 *  done. Nothing here says what is missing, compares the person with anyone else or asks for
 *  anything. */
export function buildMonthObservations(input: MonthObservationInput): MonthObservation[] {
  const candidates = [weeksObservation, recordsObservation, weightObservation, streakObservation, moreObservation, leaderObservation];
  const found: MonthObservation[] = [];
  for (const candidate of candidates) {
    const observation = candidate(input);
    if (observation) {
      found.push(observation);
      if (found.length === MAX_OBSERVATIONS) {
        break;
      }
    }
  }
  return found;
}
