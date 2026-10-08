import { CoachSurfaceCode } from '../../core/coach/coach.models';

export type HistoryGroup = 'Today' | 'This week' | 'Earlier';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

const SURFACE_LABELS: Record<CoachSurfaceCode, string> = {
  HOME: 'Home',
  WORKOUT: 'Workout',
  NUTRITION: 'Nutrition',
  PROGRESS: 'Progress',
  PROFILE: 'Profile'
};

export function surfaceLabel(surface: CoachSurfaceCode | null): string | null {
  return surface ? SURFACE_LABELS[surface] : null;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days from `then` back to `now` in the device's zone, or null when the time cannot be read. */
function daysAgo(iso: string | null, now: Date): { days: number; then: Date } | null {
  const then = iso ? new Date(iso) : null;
  if (!then || Number.isNaN(then.getTime())) {
    return null;
  }
  return { days: Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS), then };
}

/**
 * Which heading a conversation sits under: today, the rest of this calendar week (Monday to
 * Sunday), or earlier. A conversation with no readable time is earlier, because nothing says it is not.
 */
export function historyGroup(iso: string | null, now: Date = new Date()): HistoryGroup {
  const ago = daysAgo(iso, now);
  // A time ahead of the device clock (clock skew) is treated as today.
  if (!ago || ago.days < 0) {
    return ago ? 'Today' : 'Earlier';
  }
  if (ago.days === 0) {
    return 'Today';
  }
  // getDay() counts from Sunday; this counts days back to Monday, so Monday is 0 and Sunday 6.
  const sinceMonday = (now.getDay() + 6) % 7;
  return ago.days <= sinceMonday ? 'This week' : 'Earlier';
}

/** "Today 12:10", "Yesterday", "28 Sept", and "28 Sept 2025" for another year; empty when the time is unreadable. */
export function relativeWhen(iso: string | null, now: Date = new Date()): string {
  const ago = daysAgo(iso, now);
  if (!ago) {
    return '';
  }
  const { days, then } = ago;
  if (days <= 0) {
    const hh = String(then.getHours()).padStart(2, '0');
    const mm = String(then.getMinutes()).padStart(2, '0');
    return `Today ${hh}:${mm}`;
  }
  if (days === 1) {
    return 'Yesterday';
  }
  const day = `${then.getDate()} ${MONTHS[then.getMonth()]}`;
  return then.getFullYear() === now.getFullYear() ? day : `${day} ${then.getFullYear()}`;
}
