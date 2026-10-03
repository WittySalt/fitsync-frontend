import { ReadingFact } from '../../../core/coach/coach.models';

/** The first sentence of a text, with its full stop. A stop inside a number (22.5) does not end it. */
export function firstSentence(text: string): string {
  const clean = text.trim();
  if (!clean) {
    return '';
  }
  const match = /^(.*?[.!?])(\s|$)/.exec(clean);
  const sentence = match ? match[1] : clean;
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/** The coach line for a card: the first sentence of the `detail` (else the `note`) of the first fact that cites it. */
export function coachLineFor(facts: readonly ReadingFact[], card: 'TRAINING' | 'FOOD'): string {
  for (const fact of facts) {
    if (fact.card !== card) {
      continue;
    }
    const sentence = firstSentence(fact.detail || fact.note || '');
    if (sentence) {
      return sentence.charAt(0).toUpperCase() + sentence.slice(1);
    }
  }
  return '';
}
