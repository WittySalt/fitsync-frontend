import { CoachReading, ReadingFact } from '../../../core/coach/coach.models';

/** One question offered under a pinned reading. */
export interface ReadingQuestion {
  text: string;
  /** True when answering this question takes the drafting path rather than the chat loop. */
  makesDraft: boolean;
}

const BUILD_QUESTION: ReadingQuestion = { text: 'Build a session for today', makesDraft: true };

/** Nouns that read awkwardly with a bare "s"; every other group noun is left as it is. */
const IRREGULAR_PLURALS: Record<string, string> = {
  leg: 'legs',
  arm: 'arms',
  shoulder: 'shoulders',
  glute: 'glutes'
};

/**
 * The group a "Sessions with {group} work" label names, pluralized for a sentence. Any label that
 * does not have that shape names no group, and the candidate built from it is skipped.
 */
function muscleGroupFrom(label: string): string | null {
  const match = /^Sessions with (.+) work$/.exec(label);
  if (!match) {
    return null;
  }
  const noun = match[1];
  return IRREGULAR_PLURALS[noun] ?? noun;
}

/** A day-off question, from a fact that says every session trained the same muscle group. */
function dayOffQuestion(facts: ReadingFact[]): ReadingQuestion | null {
  const fact = facts.find((f) => f.key === 'MOST_TRAINED' && f.note === 'Every one');
  const group = fact ? muscleGroupFrom(fact.label) : null;
  return group ? { text: `Should my ${group} get a day off?`, makesDraft: false } : null;
}

/** A next-lift question, from a fact that says the load moved per session rose. */
function nextLiftQuestion(facts: ReadingFact[]): ReadingQuestion | null {
  const fact = facts.find((f) => f.key === 'VOLUME_PER_SESSION' && f.note.startsWith('Up'));
  return fact ? { text: 'What should I lift next time?', makesDraft: false } : null;
}

/** A beat-the-record question, from a personal record fact. */
function beatRecordQuestion(facts: ReadingFact[]): ReadingQuestion | null {
  const fact = facts.find((f) => f.key === 'RECORD');
  if (!fact) {
    return null;
  }
  const named = / record$/.test(fact.label);
  return { text: named ? `What would beat my ${fact.label}?` : 'What would beat this record?', makesDraft: false };
}

/** A breakfast question, from a fact about the protein eaten at breakfast. */
function breakfastQuestion(facts: ReadingFact[]): ReadingQuestion | null {
  return facts.some((f) => f.key === 'PROTEIN_BREAKFAST') ? { text: 'What did I eat for breakfast last week?', makesDraft: false } : null;
}

/** A target question, from the fact about the protein eaten per day. */
function proteinTargetQuestion(facts: ReadingFact[]): ReadingQuestion | null {
  return facts.some((f) => f.key === 'PROTEIN_PER_DAY') ? { text: 'How does my protein compare with my target?', makesDraft: false } : null;
}

/** A weight question, from the fact about the weekly rate of change. */
function weightMovedQuestion(facts: ReadingFact[]): ReadingQuestion | null {
  return facts.some((f) => f.key === 'WEEKLY_RATE') ? { text: 'How has my weight moved this month?', makesDraft: false } : null;
}

/** A goal-date question, from the fact about the goal weight. */
function goalDateQuestion(facts: ReadingFact[]): ReadingQuestion | null {
  return facts.some((f) => f.key === 'GOAL') ? { text: 'When do I reach my goal at this rate?', makesDraft: false } : null;
}

/**
 * The follow-up questions offered under a pinned reading.
 *
 * Pure and model-free, so a reading can offer questions the moment it is pinned rather than after a
 * round trip. Up to three candidates come from the reading's own facts, tried in a fixed order; the
 * build question is always available on the workout surface and is kept even when it would be a
 * fourth, because it is the one question the user can act on without asking the coach anything.
 */
export function questionsFor(reading: CoachReading): ReadingQuestion[] {
  const candidates = [
    dayOffQuestion(reading.facts),
    nextLiftQuestion(reading.facts),
    beatRecordQuestion(reading.facts),
    breakfastQuestion(reading.facts),
    proteinTargetQuestion(reading.facts),
    weightMovedQuestion(reading.facts),
    goalDateQuestion(reading.facts)
  ].filter(
    (question): question is ReadingQuestion => question !== null
  );

  if (reading.surface !== 'WORKOUT') {
    return candidates.slice(0, 3);
  }
  if (candidates.length > 2) {
    return [...candidates.slice(0, 2), BUILD_QUESTION];
  }
  return [...candidates, BUILD_QUESTION];
}
