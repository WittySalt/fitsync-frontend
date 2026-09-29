import { InjectionToken } from '@angular/core';

/** Injectable clock so components and specs can fix "now" instead of reading the real clock. */
export const BRIEF_NOW = new InjectionToken<() => Date>('BRIEF_NOW', {
  providedIn: 'root',
  factory: () => () => new Date()
});

export type DayPeriod = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

/** Resolves the wall-clock hour and minute for a Date in a given IANA timezone. */
function localHourMinute(now: Date, timezone: string): { hour: number; minute: number } {
  const formatter = safeFormatter(timezone);
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  // hourCycle h23 still prints "24" for midnight in some ICU builds; normalise to 0.
  return { hour: hour === 24 ? 0 : hour, minute };
}

/** Falls back to the device timezone when the given IANA name is not recognised. */
function safeFormatter(timezone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  }
}

export function dayPeriodFor(now: Date, timezone: string): DayPeriod {
  const { hour, minute } = localHourMinute(now, timezone);
  const minutesOfDay = hour * 60 + minute;
  if (minutesOfDay >= 5 * 60 && minutesOfDay < 12 * 60) {
    return 'MORNING';
  }
  if (minutesOfDay >= 12 * 60 && minutesOfDay < 17 * 60) {
    return 'AFTERNOON';
  }
  if (minutesOfDay >= 17 * 60 && minutesOfDay < 22 * 60) {
    return 'EVENING';
  }
  return 'NIGHT';
}

export function periodLabel(period: DayPeriod): string {
  switch (period) {
    case 'MORNING':
      return 'Morning';
    case 'AFTERNOON':
      return 'Afternoon';
    case 'EVENING':
      return 'Evening';
    default:
      return 'Night';
  }
}

export function clockLabel(now: Date, timezone: string): string {
  const { hour, minute } = localHourMinute(now, timezone);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function dateLabel(now: Date, timezone: string): string {
  const formatter = safeDateFormatter(timezone);
  // en-GB's short month for September renders "Sept" on current ICU data, but that has changed
  // across ICU versions before, so normalise explicitly rather than trust the runtime.
  const raw = formatter.format(now);
  return raw.replace(/\bSep\b/, 'Sept');
}

function safeDateFormatter(timezone: string): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: timezone });
  } catch {
    return new Intl.DateTimeFormat('en-GB', options);
  }
}
