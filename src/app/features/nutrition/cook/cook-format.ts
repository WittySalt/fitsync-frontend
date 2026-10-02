/** 99 seconds as "1:39", an hour and more as "1:15:00". */
export function clockText(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** A stage length in words: "30 sec", "3 min", "1 min 30 sec", "1 h 15 min". */
export function durationText(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} sec`);
  }
  return parts.join(' ');
}

/** "3 to 4 min" for a range in the recipe, empty when the recipe gives one time. */
export function rangeText(seconds: number, maxSeconds: number | null): string {
  if (maxSeconds === null || maxSeconds <= seconds) {
    return '';
  }
  if (seconds % 60 === 0 && maxSeconds % 60 === 0) {
    return `${seconds / 60} to ${maxSeconds / 60} min`;
  }
  return `${durationText(seconds)} to ${durationText(maxSeconds)}`;
}

/** "1 serving", "2 servings", "0.5 servings". */
export function servingsText(servings: number): string {
  const shown = Number.isInteger(servings) ? String(servings) : String(Math.round(servings * 100) / 100);
  return `${shown} ${servings === 1 ? 'serving' : 'servings'}`;
}

/** The grams of an ingredient: whole numbers from 10 g, one decimal below. */
export function gramsText(grams: number): string {
  if (grams <= 0) {
    return 'to taste';
  }
  const rounded = grams >= 10 ? Math.round(grams) : Math.round(grams * 10) / 10;
  return `${rounded} g`;
}
