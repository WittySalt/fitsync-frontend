import { WorkoutPlanDay } from '../../core/fitsync.models';

const SHORT_WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** The weekday of an instant in a timezone, 1 for Monday through 7 for Sunday. */
export function isoWeekdayIn(timezone: string, at: Date = new Date()): number {
  try {
    const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone || undefined }).format(at);
    const weekday = SHORT_WEEKDAYS[name];
    if (weekday) {
      return weekday;
    }
  } catch {
    // An unknown zone name falls back to the browser's own day below.
  }
  return ((at.getDay() + 6) % 7) + 1;
}

/** The weekday of a YYYY-MM-DD key, read as plain date parts so no timezone can shift it. */
export function isoWeekdayOfDateKey(dateKey: string): number | null {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) {
    return null;
  }
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}

/** The plan's day on a weekday, or null when the plan has none there. */
export function planDayOn(days: WorkoutPlanDay[] | null | undefined, weekday: number | null): WorkoutPlanDay | null {
  return weekday ? ((days ?? []).find((day) => day.dayOfWeek === weekday) ?? null) : null;
}

/** Today's day of a weekly plan, or the next one after it when today has none. Null for a plan without days. */
export function dayToStart(days: WorkoutPlanDay[] | null | undefined, todayWeekday: number): WorkoutPlanDay | null {
  const ahead = (day: WorkoutPlanDay) => (day.dayOfWeek - todayWeekday + 7) % 7;
  return [...(days ?? [])].sort((a, b) => ahead(a) - ahead(b))[0] ?? null;
}
