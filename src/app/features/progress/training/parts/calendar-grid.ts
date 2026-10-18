import { CalendarDay, TrainingKind } from '../training.models';
import { addDays, daysBetween, mondayOf, monthLabel, rangeLabel, shortDate, weekdayOf } from '../training-format';

export interface CalendarCell {
  date: string;
  label: string;
  state: 'trained' | 'rest' | 'outside';
  kind: TrainingKind | null;
  record: boolean;
  sessionId: string | null;
  aria: string;
}

export interface CalendarPage {
  title: string;
  cells: CalendarCell[];
  pages: number;
}

const KIND_WORDS: Record<TrainingKind, string> = { STRENGTH: 'strength', CARDIO: 'cardio', SPORT: 'sport', MOBILITY: 'mobility' };

/** Up to six weeks show as one page over the period; anything longer pages by month. */
export const ONE_PAGE_DAYS = 42;

function byDate(days: readonly CalendarDay[]): Map<string, CalendarDay> {
  const map = new Map<string, CalendarDay>();
  for (const day of days) {
    const seen = map.get(day.date);
    map.set(day.date, seen ? { ...seen, minutes: seen.minutes + day.minutes, record: seen.record || day.record, sessionId: seen.sessionId ?? day.sessionId } : day);
  }
  return map;
}

/** The first day of every month the period touches. */
function months(from: string, to: string): string[] {
  const firstDays: string[] = [];
  let month = `${from.slice(0, 7)}-01`;
  while (month <= to) {
    firstDays.push(month);
    const [year, monthNumber] = month.split('-').map(Number);
    month = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  }
  return firstDays;
}

export function pageCount(from: string, to: string): number {
  return daysBetween(from, to) + 1 <= ONE_PAGE_DAYS ? 1 : months(from, to).length;
}

/**
 * The Home month view's calendar laid over the period: Monday to Sunday rows, days outside the
 * period faded, a trained day filled with its kind's glyph and a small dark dot on a record day.
 * `page` counts from 0; the default is the last page, the one that holds today.
 */
export function calendarPage(from: string, to: string, days: readonly CalendarDay[], page?: number): CalendarPage {
  const pages = pageCount(from, to);
  const index = Math.min(pages - 1, Math.max(0, page ?? pages - 1));
  let first: string;
  let last: string;
  let title: string;
  if (pages === 1) {
    first = from;
    last = to;
    title = rangeLabel(from, to);
  } else {
    const month = months(from, to)[index];
    // 32 days on always lands in the next month; its first day less one is this month's last.
    const monthEnd = addDays(addDays(month, 32).slice(0, 8) + '01', -1);
    first = month;
    last = monthEnd;
    title = monthLabel(month);
  }
  const start = mondayOf(first);
  const end = addDays(mondayOf(last), 6);
  const known = byDate(days);
  const cells: CalendarCell[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const inside = date >= from && date <= to && date >= first && date <= last;
    const entry = inside ? known.get(date) : undefined;
    const day = Number(date.slice(8));
    const label = day === 1 && pages === 1 ? shortDate(date) : String(day);
    const state = entry ? 'trained' : inside ? 'rest' : 'outside';
    const aria = entry
      ? `${shortDate(date)}, ${KIND_WORDS[entry.kind]}, ${entry.minutes} min${entry.record ? ', a new record' : ''}`
      : `${shortDate(date)}, ${inside ? 'no training' : 'outside the period'}`;
    cells.push({ date, label, state, kind: entry?.kind ?? null, record: entry?.record ?? false, sessionId: entry?.sessionId ?? null, aria });
  }
  return { title, cells, pages };
}

export interface LogStats {
  daysTrained: string;
  longestBreak: string;
  mostRegular: string;
  neverTrained: string;
}

const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function joinDays(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The four figures beside the calendar: days trained, the longest break, the most regular and the never-trained weekdays. */
export function logStats(from: string, to: string, days: readonly CalendarDay[]): LogStats | null {
  const trained = [...new Set(days.map((day) => day.date).filter((date) => date >= from && date <= to))].sort((a, b) => a.localeCompare(b));
  if (!trained.length) {
    return null;
  }
  const total = daysBetween(from, to) + 1;
  let longest = 0;
  for (let index = 1; index < trained.length; index += 1) {
    longest = Math.max(longest, daysBetween(trained[index - 1], trained[index]) - 1);
  }
  const counts = [0, 0, 0, 0, 0, 0, 0];
  trained.forEach((date) => (counts[weekdayOf(date)] += 1));
  const top = Math.max(...counts);
  const regular = counts.map((count, index) => (count === top ? SHORT_DAYS[index] : null)).filter((name): name is string => name !== null);
  const never = counts.map((count, index) => (count === 0 ? LONG_DAYS[index] : null)).filter((name): name is string => name !== null);
  return {
    daysTrained: `${trained.length} of ${total}`,
    longestBreak: `${longest} ${longest === 1 ? 'day' : 'days'}`,
    mostRegular: regular.length > 3 ? 'no one day' : joinDays(regular),
    neverTrained: total >= 28 && never.length ? joinDays(never) : 'none'
  };
}
