import { DayInsight, DayKind, WorkoutSession } from '../../../core/fitsync.models';
import { isTrainingDayKind } from './day-kind-icons';

export interface BriefDay {
  dateKey: string;
  weekday: string;
  state: 'trained' | 'rest' | 'today-open' | 'today-trained' | 'upcoming';
  minutes: number | null;
  kind: DayKind | null;
  /** The day's own label from the weekly insight (e.g. "Strength", "Badminton", "Rest"), used for
   *  today's caption. Null when the day was built from sessions alone, with no insight to draw on. */
  label: string | null;
  /** True for a later day the active plan or habit schedules a training kind for, but that has
   *  not happened yet. Drawn as its own "planned" tile rather than a plain upcoming day. */
  planned: boolean;
}

export interface BriefWeekRange {
  from: string;
  to: string;
  dateKeys: string[];
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Formats a Date as a YYYY-MM-DD calendar-day key in the given IANA timezone. */
function dateKeyOf(date: Date, timezone: string): string {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/** Treats a YYYY-MM-DD key as a UTC calendar date for pure day-arithmetic (no timezone shifts). */
function addDaysToKey(key: string, days: number): string {
  const asUtc = new Date(`${key}T00:00:00Z`);
  asUtc.setUTCDate(asUtc.getUTCDate() + days);
  return asUtc.toISOString().slice(0, 10);
}

/** Monday = 0 ... Sunday = 6, computed from the calendar key alone. */
function mondayFirstWeekdayIndex(key: string): number {
  const jsDay = new Date(`${key}T00:00:00Z`).getUTCDay(); // Sunday = 0 ... Saturday = 6
  return (jsDay + 6) % 7;
}

export function weekRange(now: Date, timezone: string): BriefWeekRange {
  const todayKey = dateKeyOf(now, timezone);
  const mondayKey = addDaysToKey(todayKey, -mondayFirstWeekdayIndex(todayKey));
  const dateKeys = Array.from({ length: 7 }, (_, index) => addDaysToKey(mondayKey, index));

  // Widen by one day on each side so any UTC/local offset cannot exclude a session that actually
  // falls inside the local week; buildWeek() filters back down to the exact dateKeys.
  const from = `${addDaysToKey(mondayKey, -1)}T00:00:00.000Z`;
  const to = `${addDaysToKey(dateKeys[6], 1)}T23:59:59.999Z`;

  return { from, to, dateKeys };
}

interface DaySessions {
  minutes: number | null;
  allCardio: boolean;
  hasSessions: boolean;
}

function emptyDaySessions(): DaySessions {
  return { minutes: null, allCardio: true, hasSessions: false };
}

function sessionDateKey(session: WorkoutSession, timezone: string): string | null {
  const value = session.completedAt || session.startedAt;
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return dateKeyOf(date, timezone);
}

export function buildWeek(sessions: WorkoutSession[], now: Date, timezone: string): BriefDay[] {
  const { dateKeys } = weekRange(now, timezone);
  const todayKey = dateKeyOf(now, timezone);

  const byDay = new Map<string, DaySessions>();
  for (const session of sessions) {
    if (session.status !== 'COMPLETED') {
      continue;
    }
    const key = sessionDateKey(session, timezone);
    if (!key || !dateKeys.includes(key)) {
      continue;
    }
    const entry = byDay.get(key) ?? emptyDaySessions();
    entry.hasSessions = true;
    if (session.durationMinutes != null) {
      entry.minutes = (entry.minutes ?? 0) + session.durationMinutes;
    }
    if (!(session.workoutType ?? '').toUpperCase().includes('CARDIO')) {
      entry.allCardio = false;
    }
    byDay.set(key, entry);
  }

  return dateKeys.map((key, index) => {
    const entry = byDay.get(key);
    const isToday = key === todayKey;
    const isPast = key < todayKey;

    let state: BriefDay['state'];
    if (entry?.hasSessions) {
      state = isToday ? 'today-trained' : 'trained';
    } else if (isToday) {
      state = 'today-open';
    } else if (isPast) {
      state = 'rest';
    } else {
      state = 'upcoming';
    }

    return {
      dateKey: key,
      weekday: WEEKDAY_LABELS[index],
      state,
      minutes: entry?.minutes ?? null,
      kind: entry?.hasSessions ? (entry.allCardio ? 'CARDIO' : 'STRENGTH') : null,
      label: null,
      planned: false
    };
  });
}

/** Builds the week strip straight from the weekly insight's seven `days`, when the backend sends
 *  them. buildWeek() remains the fallback for an insight that has no `days`. */
export function buildWeekFromInsight(days: DayInsight[], todayKey: string): BriefDay[] {
  return days.map((day) => {
    const isToday = day.date === todayKey;
    const isPast = day.date < todayKey;
    const isLater = day.date > todayKey;

    let state: BriefDay['state'];
    let planned = false;

    if (day.source === 'DONE') {
      state = isToday ? 'today-trained' : 'trained';
    } else if (isToday) {
      state = 'today-open';
    } else if (isLater && isTrainingDayKind(day.kind) && (day.source === 'PLAN' || day.source === 'HABIT')) {
      state = 'upcoming';
      planned = true;
    } else {
      // A past day that was scheduled but never done is drawn as a quiet rest day, not a missed
      // one: the coach does not point at what was not done. A later day that carries no schedule
      // stays upcoming with nothing to say about it yet.
      state = isPast ? 'rest' : 'upcoming';
    }

    return {
      dateKey: day.date,
      weekday: WEEKDAY_LABELS[mondayFirstWeekdayIndex(day.date)],
      state,
      minutes: day.minutes,
      // A past day that nothing is known about is reported as rest with no source. Calling it
      // rest would claim a decision the user never made, so it is kept as a day without a kind.
      kind: day.source === 'NONE' && day.kind === 'REST' ? 'OPEN' : day.kind,
      label: day.label,
      planned
    };
  });
}

export function completedSessionCount(sessions: WorkoutSession[], now: Date, timezone: string): number {
  const { dateKeys } = weekRange(now, timezone);
  return sessions.filter((session) => {
    if (session.status !== 'COMPLETED') {
      return false;
    }
    const key = sessionDateKey(session, timezone);
    return key != null && dateKeys.includes(key);
  }).length;
}
