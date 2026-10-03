import { CoachCardContext, CoachCardKind } from '../../core/coach/coach.models';
import { dateRangeLabel } from '../date-label';

/** The name of a pinned card in the coach's chip. */
export const CARD_LABELS: Record<CoachCardKind, string> = {
  GOAL: 'Goal',
  TRAINING: 'Training',
  FOOD: 'Food',
  STRENGTH: 'Strength',
  CARDIO: 'Cardio',
  SPORT: 'Sport',
  EXERCISE: 'Exercise'
};

/** The questions the coach offers for a pinned card, from boards 15d, 17b and 17c. */
const QUESTIONS: Record<CoachCardKind, string[]> = {
  GOAL: ['Am I on pace?', 'What changed this week?', 'Why does my food log differ from the scale?'],
  TRAINING: ['Which muscles have I trained least?', 'Why was last week full?', "How do this month's minutes compare?"],
  FOOD: ['Why has my protein drifted?', 'Am I eating enough for my goal?', 'Which nutrient should I work on?'],
  STRENGTH: ['When should I add weight?', 'How does my form look in the numbers?'],
  EXERCISE: ['When should I add weight?', 'How does my form look in the numbers?'],
  CARDIO: ['Should I eat more on training days?', 'Is it enough cardio?'],
  SPORT: ['Should I eat more on training days?', 'Is it enough cardio?']
};

/** What the composer says while a card is pinned. */
const PLACEHOLDERS: Record<CoachCardKind, string> = {
  GOAL: 'Ask about your goal',
  TRAINING: 'Ask about your training',
  FOOD: 'Ask about your food',
  STRENGTH: 'Ask about your strength',
  EXERCISE: 'Ask about this exercise',
  CARDIO: 'Ask about your cardio',
  SPORT: 'Ask about this sport'
};

export function cardQuestions(card: CoachCardContext): string[] {
  return QUESTIONS[card.kind] ?? [];
}

export function cardPlaceholder(card: CoachCardContext): string {
  return PLACEHOLDERS[card.kind] ?? 'Ask about this card';
}

/** "6 Sept to 3 Oct · from Progress", the line under the chip's name. */
export function cardPeriod(card: CoachCardContext): string {
  const days = dateRangeLabel(card.from, card.to);
  return days ? `${days} · from Progress` : 'from Progress';
}
