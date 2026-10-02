import { durationText, rangeText } from '../cook/cook-format';

/** A time found in the text of a step, in the shape of API contract section 8 (`timers`). */
export interface FoundTimer {
  /** The lower end of a range, in seconds. */
  seconds: number;
  /** The upper end of a range, or null for one time. */
  maxSeconds: number | null;
  eachSide: boolean;
  /** The text as written. */
  phrase: string;
}

export const MIN_TIMER_SECONDS = 30;
export const MAX_TIMER_SECONDS = 3 * 3600;

// A cooking word in the sentence is what makes a time a timer (section 8). Endings such as -ing and -ed count.
const COOKING = /\b(cook|fry|fried|bake|baked|baking|roast|simmer|boil|grill|rest|chill|steam|saut[eé]|stir|blend|knead|marinat|toast)\w*/i;
const EACH_SIDE = /\b(each side|per side|both sides)\b/i;
const NUMBER = '(\\d+(?:\\.\\d+)?)';
const UNIT = '(hours?|hrs?|minutes?|mins?|seconds?|secs?)';
const DURATION = new RegExp(`${NUMBER}(?:\\s*(?:-|\\u2013|to)\\s*${NUMBER})?\\s*${UNIT}\\b(?:\\s*(?:and\\s*)?${NUMBER}\\s*(?:minutes?|mins?)\\b)?`, 'gi');

function factor(unit: string): number {
  const first = unit.charAt(0).toLowerCase();
  return first === 'h' ? 3600 : first === 'm' ? 60 : 1;
}

/**
 * The first timer a step's text names, worked out by the same rules the server uses (API contract
 * section 8, no model): a time from 30 seconds to 3 hours, such as "3-4 mins", "20 minutes",
 * "1 hour 15 mins" or "30 secs", counts when a cooking word is in the same sentence. A range gives
 * the lower end and the upper end, "each side", "per side" or "both sides" in the sentence sets
 * eachSide, and "overnight", more than 3 hours and days are ignored. The server's answer is the
 * one that counts once the recipe is saved; this is for showing "a timer was found" while typing.
 */
export function findTimer(text: string): FoundTimer | null {
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (!COOKING.test(sentence)) {
      continue;
    }
    DURATION.lastIndex = 0;
    for (const match of sentence.matchAll(DURATION)) {
      const unit = factor(match[3]);
      const extra = match[4] ? Number(match[4]) * 60 : 0;
      const low = Number(match[1]) * unit + extra;
      const high = match[2] ? Number(match[2]) * unit + extra : null;
      if (low < MIN_TIMER_SECONDS || low > MAX_TIMER_SECONDS) {
        continue;
      }
      return {
        seconds: Math.round(low),
        maxSeconds: high !== null && high > low && high <= MAX_TIMER_SECONDS ? Math.round(high) : null,
        eachSide: EACH_SIDE.test(sentence),
        phrase: match[0]
      };
    }
  }
  return null;
}

/** "A 5 min timer was found", or "A 3 to 4 min timer was found" for a range. */
export function timerFoundText(timer: FoundTimer): string {
  const time = timer.maxSeconds !== null ? rangeText(timer.seconds, timer.maxSeconds) : durationText(timer.seconds);
  return `A ${time} timer was found`;
}
