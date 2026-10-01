import { ExerciseDetail, ExerciseInstruction } from '../../core/fitsync.models';

/** The text up to the first full stop, question mark or exclamation mark that ends a sentence. */
export function firstSentence(text: string | null | undefined): string {
  const trimmed = (text ?? '').replace(/\s+/g, ' ').trim();
  const match = /^(.+?[.!?])(\s|$)/.exec(trimmed);
  return (match ? match[1] : trimmed).trim();
}

/** A step that only tells the person to do the movement again says nothing the others do not. */
export function isRepeatStep(text: string): boolean {
  return /^(then\s+)?repeat\b/i.test(text.trim());
}

function fromInstructions(instructions: ExerciseInstruction[]): string[] {
  return [...instructions]
    .sort((a, b) => (a.stepNumber ?? Number.MAX_SAFE_INTEGER) - (b.stepNumber ?? Number.MAX_SAFE_INTEGER))
    .map((step) => firstSentence(step.text))
    .filter((text) => text.length > 0 && !isRepeatStep(text));
}

/**
 * The steps the carousel and the guide show. The short steps of the exercise come first; an exercise
 * without any gives its instructions instead, each cut to its first sentence.
 */
export function guideSteps(detail: Pick<ExerciseDetail, 'shortSteps' | 'instructions'> | null | undefined): string[] {
  if (!detail) {
    return [];
  }
  const short = (detail.shortSteps ?? []).map((step) => (typeof step === 'string' ? step.trim() : '')).filter(Boolean);
  return short.length ? short : fromInstructions(detail.instructions ?? []);
}
