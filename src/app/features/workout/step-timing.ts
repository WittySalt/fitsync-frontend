/** How long one step of the guide stays on screen: 2.5 seconds, 0.3 seconds a word, and never under 4 seconds. */
export const STEP_BASE_MS = 2500;
export const STEP_WORD_MS = 300;
export const STEP_MIN_MS = 4000;

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function stepDwellMs(text: string): number {
  return Math.max(STEP_MIN_MS, STEP_BASE_MS + STEP_WORD_MS * wordCount(text));
}
