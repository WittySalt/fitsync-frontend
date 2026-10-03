/**
 * Calendar days in a named timezone. The browser's own zone is only a fallback: the profile's zone
 * decides what "today" is, so a person travelling sees the same day on every block of a page.
 */

/** The zone this browser reports, or Asia/Singapore where it reports none. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore';
  } catch {
    return 'Asia/Singapore';
  }
}

/** The zone to use for a profile: its own when it is a real zone name, otherwise the browser's. */
export function profileTimezone(timezone: string | null | undefined): string {
  if (timezone) {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
      return timezone;
    } catch {
      // An unknown zone name falls through to the browser's zone.
    }
  }
  return browserTimezone();
}

/** The calendar day of an instant in the zone, as YYYY-MM-DD. */
export function dateKeyInZone(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: profileTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(instant);
  const part = (type: string): string => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** How far the zone's wall clock is ahead of UTC at an instant, in milliseconds. */
function offsetMs(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(instant);
  const part = (type: string): number => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant a calendar day starts in the zone. */
export function startOfDayInZone(dayKey: string, timezone: string): Date {
  const zone = profileTimezone(timezone);
  const [year, month, day] = dayKey.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - offsetMs(new Date(guess), zone);
  return new Date(guess - offsetMs(new Date(first), zone));
}

/** The first and last millisecond of a calendar day in the zone. */
export function dayBoundsInZone(dayKey: string, timezone: string): { from: Date; to: Date } {
  const [year, month, day] = dayKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { from: startOfDayInZone(dayKey, timezone), to: new Date(startOfDayInZone(next, timezone).getTime() - 1) };
}
