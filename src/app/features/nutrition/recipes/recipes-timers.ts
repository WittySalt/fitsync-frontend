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
const COOKING_WORDS = 'cook|fry|fried|frying|bake|baked|baking|roast|simmer|boil|grill|rest|chill|steam|saut|stir|blend|knead|marinat|toast|brown|sear|poach|braise|broil';
const COOKING = new RegExp(`\\b(?:${COOKING_WORDS})\\w*`, 'i');
const EACH_SIDE = /\b(each side|per side|both sides)\b/i;
// "until crispy on both sides" says when the food is done, not that it is turned.
const UNTIL_CLAUSE = /\buntil\b[^,;.!?]*/gi;

function turnsEachSide(sentence: string): boolean {
  return EACH_SIDE.test(sentence.replace(UNTIL_CLAUSE, (clause) => clause.replace(/\b(?:on\s+)?both sides\b/gi, '')));
}
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
  return locate(text)?.timer ?? null;
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/);
}

/** The first timer of a text with the sentence it was found in. */
function locate(text: string): { timer: FoundTimer; sentence: string; phraseAt: number } | null {
  for (const sentence of sentencesOf(text)) {
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
        timer: {
          seconds: Math.round(low),
          maxSeconds: high !== null && high > low && high <= MAX_TIMER_SECONDS ? Math.round(high) : null,
          eachSide: turnsEachSide(sentence),
          phrase: match[0]
        },
        sentence,
        phraseAt: match.index ?? 0
      };
    }
  }
  return null;
}

// The words a timer's name is made of (section 8, `label`): the cooking verb nearest before the time.
const LABEL_VERB = new RegExp(`\\b(?:${COOKING_WORDS})\\w*`, 'gi');
const STOP_WORDS = new Set(['in', 'until', 'for', 'over', 'on', 'at', 'with', 'into', 'to', 'about']);
const NAME_WORDS = 4;
export const LABEL_MAX = 32;

/** Cuts a name to `max` characters on a word boundary; one long word is cut where it stands. */
export function clipName(name: string, max: number = LABEL_MAX): string {
  if (name.length <= max) {
    return name;
  }
  const head = name.slice(0, max);
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head).replace(/[\s,;:·-]+$/, '');
}

function isIng(word: string): boolean {
  return /ing$/i.test(word);
}

function capital(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The verb of a sentence and up to 4 words after it, stopping at a preposition (in, until, for,
 * over, on, at, with, into, to, about), at a comma or at the end: "Brown patties",
 * "Simmer the sauce". When nothing follows the verb, the verb alone is returned. Null when the
 * sentence has no cooking verb.
 */
function verbPhrase(sentence: string, phraseAt: number = sentence.length): { verb: string; rest: string } | null {
  const all = [...sentence.matchAll(LABEL_VERB)];
  const before = all.filter((candidate) => (candidate.index ?? 0) < phraseAt);
  let match: RegExpMatchArray | undefined = before[0];
  for (const candidate of before.slice(1)) {
    // "stirring" and other -ing forms never replace an earlier verb.
    if (!isIng(candidate[0])) {
      match = candidate;
    }
  }
  match ??= all[0];
  if (!match) {
    return null;
  }
  const words: string[] = [];
  for (const raw of sentence.slice((match.index ?? 0) + match[0].length).split(/\s+/).filter(Boolean)) {
    const word = raw.replace(/[.,;:!?)]+$/, '').replace(/^[(]+/, '');
    if (!word || STOP_WORDS.has(word.toLowerCase())) {
      break;
    }
    words.push(word);
    if (words.length === NAME_WORDS || /[,;:.!?]$/.test(raw)) {
      break;
    }
  }
  return { verb: capital(match[0]), rest: words.join(' ') };
}

/** What a step offers the name of a timer when the text has no verb phrase of its own. */
export interface LabelContext {
  /** The name of the first ingredient of the step, for "Bake · Pie". */
  ingredient?: string | null;
  title?: string | null;
  /** 1-based, for "Step 3 timer". */
  stepNumber: number;
}

function fromPhrase(phrase: { verb: string; rest: string }, ingredient: string | null | undefined): string {
  if (phrase.rest) {
    return `${phrase.verb} ${phrase.rest}`;
  }
  const name = ingredient?.trim();
  return name ? `${phrase.verb} · ${name}` : phrase.verb;
}

/**
 * The name of the timer a step's text has, worked out by the rules of API contract section 8: the
 * verb phrase of the timer's sentence, else the step title, else "Step N timer", cut to 32
 * characters. Null when the text names no timer. The server sends the same name as `label`.
 */
export function timerLabel(text: string, context: LabelContext): string | null {
  const found = locate(text);
  return found ? labelOf(found.sentence, found.phraseAt, context) : null;
}

/** The name for the timer whose phrase is written in `text`, for a timer the server found. */
export function labelForPhrase(text: string, phrase: string, context: LabelContext): string {
  const sentence = sentencesOf(text).find((candidate) => phrase !== '' && candidate.toLowerCase().includes(phrase.toLowerCase()));
  if (sentence) {
    return labelOf(sentence, sentence.toLowerCase().indexOf(phrase.toLowerCase()), context);
  }
  const found = locate(text);
  return found ? labelOf(found.sentence, found.phraseAt, context) : labelOf(text, text.length, context);
}

function labelOf(sentence: string, phraseAt: number, context: LabelContext): string {
  const phrase = verbPhrase(sentence, phraseAt);
  const base = phrase ? fromPhrase(phrase, context.ingredient) : context.title?.trim() || `Step ${context.stepNumber} timer`;
  return clipName(base);
}

/** A second name alike in the same step gets " · 2", a third " · 3". */
export function uniqueLabel(label: string, taken: readonly string[]): string {
  if (!taken.includes(label)) {
    return label;
  }
  let n = 2;
  while (taken.includes(`${label} · ${n}`)) {
    n++;
  }
  return `${label} · ${n}`;
}

/**
 * The name "+ Add a timer" starts with: the verb phrase of the step's own text, else its title.
 * Null when the step has neither.
 */
export function suggestTimerName(text: string, context: Pick<LabelContext, 'ingredient' | 'title'>): string | null {
  for (const sentence of sentencesOf(text)) {
    const phrase = verbPhrase(sentence);
    if (phrase) {
      return clipName(fromPhrase(phrase, context.ingredient));
    }
  }
  const title = context.title?.trim();
  return title ? clipName(title) : null;
}

/** "A 5 min timer was found", or "A 3 to 4 min timer was found" for a range. */
export function timerFoundText(timer: FoundTimer): string {
  const time = timer.maxSeconds !== null ? rangeText(timer.seconds, timer.maxSeconds) : durationText(timer.seconds);
  return `A ${time} timer was found`;
}
