import { BadgeNode, BadgePath, FootprintDay } from '../../core/me.models';
import { DAY_KIND_GLYPHS } from '../../features/dashboard/brief/day-kind-icons';
import { GlyphShape } from '../../features/dashboard/brief/muscle-icons';
import { shortDate } from '../coach/insight/slope-chart.geometry';

export type NodeState = 'earned' | 'next' | 'later';

export interface PathNode {
  node: BadgeNode;
  state: NodeState;
  /** The slot of the five-slot grid the node sits in, counted from 0. */
  slot: number;
}

/** Every path draws on the same five slots, so nodes line up from card to card. */
export const PATH_SLOTS = 5;

/** The circle a progress ring is drawn on, in the 64 by 64 units of a disc. */
export const RING_RADIUS = 29;

/**
 * The state of each node of a path. An earned node is filled. The first node that is not earned is
 * the next one, unless it lies further along the path and has not been started, in which case it
 * waits as a later node (nobody is "next" for a badge they have not begun).
 */
export function pathNodes(path: BadgePath): PathNode[] {
  let nextTaken = false;
  return path.nodes.slice(0, PATH_SLOTS).map((node, slot) => {
    if (node.earnedOn !== null) {
      return { node, slot, state: 'earned' as const };
    }
    if (!nextTaken && (slot === 0 || node.progress.current > 0)) {
      nextTaken = true;
      return { node, slot, state: 'next' as const };
    }
    nextTaken = true;
    return { node, slot, state: 'later' as const };
  });
}

/** The slot of the last earned node, or -1: the green line runs up to it. */
export function lineEarnedSlots(nodes: readonly PathNode[]): number {
  let last = -1;
  for (const entry of nodes) {
    if (entry.state === 'earned') {
      last = entry.slot;
    }
  }
  return last;
}

/** How far a badge is, from 0 to 1. */
export function ringUnit(node: BadgeNode): number {
  if (node.earnedOn !== null) {
    return 1;
  }
  const { current, target } = node.progress;
  return target > 0 ? Math.min(Math.max(current / target, 0), 1) : 0;
}

export function ringLength(node: BadgeNode, radius: number = RING_RADIUS): { circumference: number; length: number } {
  const circumference = 2 * Math.PI * radius;
  return { circumference, length: ringUnit(node) * circumference };
}

const MEAL: GlyphShape[] = [
  { tag: 'path', d: 'M7 3v7a2 2 0 0 0 2 2v9' },
  { tag: 'path', d: 'M11 3v7a2 2 0 0 1-2 2' },
  { tag: 'path', d: 'M17 3c-2 1.5-3 4-3 7 0 1.5 1 2 3 2v9' }
];
const CALENDAR: GlyphShape[] = [
  { tag: 'rect', x: 3, y: 5, width: 18, height: 16, rx: 3 },
  { tag: 'path', d: 'M8 3v4' },
  { tag: 'path', d: 'M16 3v4' },
  { tag: 'path', d: 'M3 10h18' }
];
const BOLT: GlyphShape[] = [{ tag: 'path', d: 'M13 2L4 14h7l-1 8 9-12h-7Z' }];
const TROPHY: GlyphShape[] = [
  { tag: 'path', d: 'M8 4h8v6a4 4 0 0 1-8 0Z' },
  { tag: 'path', d: 'M8 6H5a3 3 0 0 0 3 4' },
  { tag: 'path', d: 'M16 6h3a3 3 0 0 1-3 4' },
  { tag: 'path', d: 'M12 14v4' },
  { tag: 'path', d: 'M8 20h8' }
];
const REPEAT: GlyphShape[] = [
  { tag: 'path', d: 'M4 11V9a3 3 0 0 1 3-3h11' },
  { tag: 'path', d: 'M15 3l3 3-3 3' },
  { tag: 'path', d: 'M20 13v2a3 3 0 0 1-3 3H6' },
  { tag: 'path', d: 'M9 21l-3-3 3-3' }
];
const STAR: GlyphShape[] = [{ tag: 'path', d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z' }];
const CHECKS: GlyphShape[] = [
  { tag: 'path', d: 'M2 12l4 4 8-9' },
  { tag: 'path', d: 'M12 15l2 2 8-9' }
];
const DROP: GlyphShape[] = [{ tag: 'path', d: 'M12 3c3.5 4 6 7 6 10.5a6 6 0 0 1-12 0C6 10 8.5 7 12 3Z' }];
const BASKET: GlyphShape[] = [
  { tag: 'path', d: 'M3 10h18l-2 10H5Z' },
  { tag: 'path', d: 'M8 10l3-6' },
  { tag: 'path', d: 'M16 10l-3-6' }
];
const BENCH: GlyphShape[] = [
  { tag: 'path', d: 'M3 12h18' },
  { tag: 'path', d: 'M6 8v8' },
  { tag: 'path', d: 'M18 8v8' },
  { tag: 'path', d: 'M9 17v3' },
  { tag: 'path', d: 'M15 17v3' }
];

const GLYPHS: Record<string, GlyphShape[]> = {
  FIRST_WORKOUT: DAY_KIND_GLYPHS.STRENGTH,
  WORKOUTS_10: BOLT,
  WORKOUTS_50: TROPHY,
  WORKOUTS_100: TROPHY,
  FULL_WEEK: CALENDAR,
  FOUR_FULL_WEEKS: REPEAT,
  FIRST_RECORD: STAR,
  FIVE_RECORDS: STAR,
  BODYWEIGHT_BENCH: BENCH,
  FIRST_MEAL: MEAL,
  SEVEN_DAYS_LOGGED: CHECKS,
  THIRTY_DAYS_LOGGED: CHECKS,
  PROTEIN_WEEK: DROP,
  PROTEIN_MONTH: DROP,
  FIRST_COOK: BASKET,
  TEN_COOKS: BASKET,
  FIFTY_COOKS: BASKET
};

export function glyphFor(code: string): GlyphShape[] {
  return GLYPHS[code] ?? STAR;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

export function numberWord(value: number): string {
  return Number.isInteger(value) && value >= 0 && value < NUMBER_WORDS.length ? NUMBER_WORDS[value] : String(value);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CONSECUTIVE_DAY_CODES = new Set(['SEVEN_DAYS_LOGGED', 'THIRTY_DAYS_LOGGED']);
/** Past this many days the sentence stops naming them. */
const MAX_NAMED_DAYS = 3;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isRatio(node: BadgeNode): boolean {
  return /body|ratio|×/i.test(node.progress.unit);
}

/** What is left, in the badge's own unit, as a number the page can print. */
export function remaining(node: BadgeNode): number {
  const left = Math.max(node.progress.target - node.progress.current, 0);
  return isRatio(node) ? Math.round(left * 100) / 100 : Math.ceil(left - 1e-9);
}

function weekdayAfter(today: string, offset: number): string {
  const date = new Date(`${today}T00:00:00Z`);
  return WEEKDAYS[(date.getUTCDay() + offset) % 7];
}

/** "tomorrow and Thursday": the days still to log, counted from tomorrow. */
export function daysToLog(left: number, today: string): string {
  if (!DATE_KEY.test(today) || left < 1 || left > MAX_NAMED_DAYS) {
    return '';
  }
  const days = ['tomorrow', ...Array.from({ length: left - 1 }, (_, index) => weekdayAfter(today, index + 2))];
  return days.length === 1 ? days[0] : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
}

export interface GapLine {
  /** The bold part: "19 to go". */
  headline: string;
  /** What follows it, or empty: "about 5 weeks at your pace". */
  detail: string;
  /** The weekly pace the estimate used, or null. */
  pace: number | null;
}

/** The gap to a badge in its own unit. `fallbackPace` is the person's own sessions a week. */
export function gapLine(node: BadgeNode, today: string, fallbackPace: number | null): GapLine {
  if (!(node.progress.target > 0)) {
    // A badge the figures cannot measure yet (no record stored): nothing to count down.
    return { headline: '', detail: '', pace: null };
  }
  const left = remaining(node);
  if (isRatio(node)) {
    return { headline: `${node.progress.current.toFixed(2)} of ${node.progress.target.toFixed(2)}`, detail: '× body weight', pace: null };
  }
  const weeks = node.progress.unit === 'weeks';
  const headline = weeks ? `${left} ${left === 1 ? 'week' : 'weeks'} to go` : `${left} to go`;
  if (CONSECUTIVE_DAY_CODES.has(node.code)) {
    const named = daysToLog(left, today);
    return { headline, detail: named ? `log ${named}` : '', pace: null };
  }
  const pace = node.pace ?? (node.progress.unit === 'workouts' ? fallbackPace : null);
  if (pace && pace > 0 && left > 0) {
    const span = Math.max(Math.ceil(left / pace), 1);
    return { headline, detail: `about ${span} ${span === 1 ? 'week' : 'weeks'} at your pace`, pace };
  }
  return { headline, detail: '', pace: null };
}

/** The sentence on a next-up row: "19 to go · about 5 weeks at your pace". */
export function gapSentence(node: BadgeNode, today: string, fallbackPace: number | null): string {
  const gap = gapLine(node, today, fallbackPace);
  return gap.detail ? `${gap.headline} · ${gap.detail}` : gap.headline;
}

/** The line a gap sheet adds: "At four a week, about five weeks". Empty when there is no pace. */
export function paceSentence(node: BadgeNode, today: string, fallbackPace: number | null): string {
  const gap = gapLine(node, today, fallbackPace);
  if (!gap.pace) {
    return '';
  }
  const span = Math.max(Math.ceil(remaining(node) / gap.pace), 1);
  return `At ${numberWord(gap.pace)} a week, about ${numberWord(span)} ${span === 1 ? 'week' : 'weeks'}`;
}

/** The line under a next-up row: the gap, or for a first-time badge simply what it takes. */
export function nextUpLine(node: BadgeNode, today: string, fallbackPace: number | null): string {
  return node.progress.target <= 1 && node.how ? node.how : gapSentence(node, today, fallbackPace);
}

/** The line under a node that is neither earned nor next: "26 of 30", or its one-line description. */
export function laterLine(node: BadgeNode): string {
  if (isRatio(node)) {
    return `${node.progress.current.toFixed(2)} of ${node.progress.target.toFixed(2)} × body weight`;
  }
  if (node.progress.current > 0 && node.progress.target > 0) {
    return `${Math.round(node.progress.current)} of ${node.progress.target}`;
  }
  return node.how;
}

export function earnedLabel(node: BadgeNode): string {
  return node.earnedOn ? shortDate(node.earnedOn) : '';
}

export interface WeekCell {
  date: string;
  /** Day of the month, "21". */
  day: string;
  weekday: string;
  trained: boolean;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The seven days of the week that starts on `weekStart`, marked from the footprint. */
export function weekCells(weekStart: string, days: readonly FootprintDay[]): WeekCell[] {
  if (!DATE_KEY.test(weekStart)) {
    return [];
  }
  const trained = new Set(days.filter((entry) => entry.trained).map((entry) => entry.date));
  const base = new Date(`${weekStart}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base.getTime() + index * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    return { date: key, day: String(date.getUTCDate()), weekday: WEEKDAY_SHORT[index], trained: trained.has(key) };
  });
}

/** The evidence line of an earned badge: the server's own sentence, or one written from what is known. */
export function evidenceLine(node: BadgeNode, cells: readonly WeekCell[]): string {
  const sent = node.evidence?.line;
  if (sent) {
    return sent;
  }
  if (node.evidence?.weekStart) {
    const count = cells.filter((cell) => cell.trained).length;
    const week = shortDate(node.evidence.weekStart);
    return count > 0 ? `${count} ${count === 1 ? 'session' : 'sessions'} in the week of ${week}` : `The week of ${week}`;
  }
  return node.how;
}

export interface BadgeDoor {
  label: string;
  link: string;
  query?: Record<string, string>;
  fragment?: string;
}

/** Where a badge's evidence lives: the Training log for lifting, the Diary for food. Null for a theme this build does not know. */
export function doorFor(theme: string, state: 'earned' | 'next'): BadgeDoor | null {
  const code = theme.toUpperCase();
  const training = { link: '/progress/training', fragment: 'log' };
  if (code === 'SHOWING_UP') {
    return state === 'earned'
      ? { label: 'From your Training log', ...training }
      : { label: 'Your sessions', link: '/workout', query: { tab: 'history' } };
  }
  if (code === 'GETTING_STRONGER') {
    return { label: state === 'earned' ? 'From your Training log' : 'Your Training log', ...training };
  }
  if (code === 'EATING_WELL' || code === 'IN_THE_KITCHEN') {
    return { label: state === 'earned' ? 'From your Diary' : 'Your Diary', link: '/nutrition' };
  }
  return null;
}
