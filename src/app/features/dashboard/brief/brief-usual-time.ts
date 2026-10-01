import { DayPeriod } from './brief-time';

/** The backend sends the usual start time as "HH:mm" in 24-hour time. */
const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Only a time at least this much later than now counts as "no rush". */
const MIN_LEAD_MINUTES = 60;

/** Minutes since midnight for an "HH:mm" time, or null when it is not one. */
export function clockMinutes(time: string | null | undefined): number | null {
  const match = typeof time === 'string' ? CLOCK_TIME.exec(time) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** "You usually train around 18:30, so there is no rush." for the morning and the afternoon, when
 *  the usual time is at least an hour away; otherwise null. The time is written as it was sent.
 *  Whether today's session is still open is for the caller to settle. */
export function usualTimeSentence(period: DayPeriod, usualStartTime: string | null, nowMinutes: number | null): string | null {
  if (period !== 'MORNING' && period !== 'AFTERNOON') {
    return null;
  }
  const usual = clockMinutes(usualStartTime);
  if (usual === null || nowMinutes === null || usual - nowMinutes < MIN_LEAD_MINUTES) {
    return null;
  }
  return `You usually train around ${usualStartTime}, so there is no rush.`;
}
