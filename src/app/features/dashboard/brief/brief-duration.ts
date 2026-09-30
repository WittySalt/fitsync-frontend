/**
 * Formats a duration in minutes the way the coach brief board does: "50 min", "2 h 50 min", or
 * "2 h" when the minutes component is zero. Invalid input renders nothing rather than "0 min",
 * since a missing duration should not read as an empty workout.
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) {
    return '';
  }

  const wholeMinutes = Math.round(minutes);
  if (wholeMinutes < 60) {
    return `${wholeMinutes} min`;
  }

  const hours = Math.floor(wholeMinutes / 60);
  const remainingMinutes = wholeMinutes % 60;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
}

/** Formats a distance in kilometres to at most two decimal places, dropping trailing zeros: 5.75
 *  stays "5.75 km", 5 stays "5 km". Invalid input renders nothing, matching formatDuration(). */
export function formatKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km) || km < 0) {
    return '';
  }
  const trimmed = km.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${trimmed} km`;
}

/** Formats a running pace given in seconds per kilometre as "M:SS", e.g. 365 becomes "6:05". The
 *  caller supplies the "per km" that follows, since that wording changes with the sentence. */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm < 0) {
    return '';
  }
  const wholeSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
