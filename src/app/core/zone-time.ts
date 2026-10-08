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

/**
 * The calendar day a stored value falls on in the zone, as YYYY-MM-DD. A plain date is already a day
 * and stays as it is. A value with a time is an instant, so its day is read in the zone; a time with
 * no offset is taken as UTC, the way the server writes instants. Empty when the value is not a date.
 */
export function dateKeyOf(value: string | null | undefined, timezone: string): string {
  const text = (value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    return '';
  }
  const instant = new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);
  return Number.isNaN(instant.getTime()) ? '' : dateKeyInZone(instant, timezone);
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
  // The formatted wall clock has no milliseconds, so the instant is cut to whole seconds as well.
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant a calendar day starts in the zone. */
export function startOfDayInZone(dayKey: string, timezone: string): Date {
  const zone = profileTimezone(timezone);
  const [year, month, day] = dayKey.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day);
  // The offset at UTC midnight can differ from the offset at local midnight when a DST change
  // falls in between, so the offset is read a second time at the first estimate.
  const first = guess - offsetMs(new Date(guess), zone);
  return new Date(guess - offsetMs(new Date(first), zone));
}

/** The first and last millisecond of a calendar day in the zone. */
export function dayBoundsInZone(dayKey: string, timezone: string): { from: Date; to: Date } {
  const [year, month, day] = dayKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { from: startOfDayInZone(dayKey, timezone), to: new Date(startOfDayInZone(next, timezone).getTime() - 1) };
}

/** An instant as the zone's wall clock, "YYYY-MM-DDTHH:mm", the text a datetime-local input takes. */
export function wallTimeInZone(instant: Date, timezone: string): string {
  return new Date(instant.getTime() + offsetMs(instant, profileTimezone(timezone))).toISOString().slice(0, 16);
}

/** The instant a wall-clock time ("YYYY-MM-DDTHH:mm", as a datetime-local input gives it) means in the zone. */
export function instantFromWallTime(wallTime: string, timezone: string): Date {
  const zone = profileTimezone(timezone);
  const guess = Date.parse(`${wallTime}Z`);
  if (Number.isNaN(guess)) {
    return new Date(Number.NaN);
  }
  // Same two-step read as startOfDayInZone, so a time just after a DST change gets its own offset.
  const first = guess - offsetMs(new Date(guess), zone);
  return new Date(guess - offsetMs(new Date(first), zone));
}
