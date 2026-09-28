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
