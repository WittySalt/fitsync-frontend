export const MIN_MINUTES = 1;
export const MAX_MINUTES = 12 * 60;

export interface ParsedDuration {
  /** The total in minutes, or null while the fields hold something that cannot be a time. */
  minutes: number | null;
  /** A short note for the person, empty when the fields are fine. */
  note: string;
}

/** A field of whole digits: blank is 0, anything else (a sign, a point, a letter) is not a number of hours or minutes. */
export function parseField(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return 0;
  }
  return /^\d{1,4}$/.test(trimmed) ? Number(trimmed) : null;
}

/** The two fields as one time. Minutes over 59 count as hours, so 0 h 90 min is 1 h 30 min. */
export function parseDuration(hoursText: string, minutesText: string): ParsedDuration {
  const hours = parseField(hoursText);
  const minutes = parseField(minutesText);
  if (hours === null || minutes === null) {
    return { minutes: null, note: 'Use whole numbers only.' };
  }
  const total = hours * 60 + minutes;
  if (total < MIN_MINUTES) {
    return { minutes: null, note: 'Choose at least 1 min.' };
  }
  if (total > MAX_MINUTES) {
    return { minutes: null, note: 'A timer can be 12 h at most.' };
  }
  return { minutes: total, note: '' };
}

/** A total in minutes as the two fields: 90 is 1 h and 30 min. */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  const whole = Math.max(0, Math.round(total));
  return { hours: Math.floor(whole / 60), minutes: whole % 60 };
}

/** Adds to a time and keeps it between 1 min and 12 h. */
export function addMinutes(total: number, add: number): number {
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(total + add)));
}

/**
 * The plus and minus step by 1 min under 10 min, 5 min under 1 h and 15 min above. Going down uses
 * the size of the minute below, so a step from 10 min lands on 9 and one from 60 lands on 55.
 */
export function nudge(total: number, direction: 1 | -1): number {
  const basis = direction === 1 ? total : total - 1;
  const size = basis < 10 ? 1 : basis < 60 ? 5 : 15;
  return addMinutes(total, direction * size);
}
