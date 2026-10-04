import { DraftDay } from './plan-draft';

export interface CardioHistory {
  distanceKm: number | null;
  minutes: number | null;
  startedAt: string;
}

/** 6.08 minutes a kilometre is "6:05". */
export function formatPace(minutesPerKm: number): string {
  if (!Number.isFinite(minutesPerKm) || minutesPerKm <= 0) {
    return '';
  }
  const total = Math.round(minutesPerKm * 60);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** "Last run: 5.75 km in 35 min, 6:05 a km, Tue 29 Sept", or the line for a person with no cardio yet. */
export function lastCardioLine(last: CardioHistory | null): string {
  if (!last) {
    return 'No runs logged yet';
  }
  const when = new Date(last.startedAt);
  const date = Number.isNaN(when.getTime())
    ? ''
    : when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const parts: string[] = [];
  if (last.distanceKm && last.minutes) {
    parts.push(`${trim(last.distanceKm)} km in ${last.minutes} min`);
    parts.push(`${formatPace(last.minutes / last.distanceKm)} a km`);
  } else if (last.minutes) {
    parts.push(`${last.minutes} min`);
  } else if (last.distanceKm) {
    parts.push(`${trim(last.distanceKm)} km`);
  }
  if (date) {
    parts.push(date);
  }
  return parts.length ? `Last run: ${parts.join(', ')}` : 'No runs logged yet';
}

/** The other two targets worked out from the chosen one and the day's minutes: "about 5 km at this pace". */
export function targetHint(day: Pick<DraftDay, 'targetKind' | 'targetValue' | 'minutes'>): string {
  const value = day.targetValue;
  const minutes = day.minutes;
  if (!value || value <= 0 || !minutes) {
    return '';
  }
  if (day.targetKind === 'PACE') {
    return `About ${trim(minutes / value)} km at this pace`;
  }
  if (day.targetKind === 'DISTANCE') {
    return `About ${formatPace(minutes / value)} a km over ${minutes} min`;
  }
  return '';
}

export const TARGET_UNITS = { MINUTES: 'min', DISTANCE: 'km', PACE: 'min per km' } as const;
