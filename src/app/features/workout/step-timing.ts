/** How long one step of the guide stays on screen while a set runs. */
export const STEP_BASE_MS = 2000;
export const STEP_WORDS_PER_SECOND = 3;
export const STEP_MIN_MS = 5000;
export const STEP_MAX_MS = 10_000;
/** A step never gets less than this, even when a short set is shared out evenly. */
export const STEP_FLOOR_MS = 3000;

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** The reading time of a step: words / 3 seconds plus 2 seconds, kept between 5 and 10 seconds. */
export function stepReadingMs(text: string): number {
  const ms = (wordCount(text) / STEP_WORDS_PER_SECOND) * 1000 + STEP_BASE_MS;
  return Math.min(STEP_MAX_MS, Math.max(STEP_MIN_MS, ms));
}

/**
 * How long a step stays while a set runs: its reading time, unless the planned length of the set
 * shared by the steps is shorter, then the set length is split evenly (never under 3 seconds).
 * A set of unknown length (0) uses the reading time.
 */
export function stepDwellMs(text: string, setSeconds = 0, stepCount = 1): number {
  const reading = stepReadingMs(text);
  if (setSeconds <= 0 || stepCount < 1) {
    return reading;
  }
  const even = (setSeconds * 1000) / stepCount;
  return even < reading ? Math.max(STEP_FLOOR_MS, even) : reading;
}
