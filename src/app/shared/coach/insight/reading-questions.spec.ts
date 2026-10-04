import { CoachReading, ReadingFact } from '../../../core/coach/coach.models';
import { questionsFor } from './reading-questions';

function fact(overrides: Partial<ReadingFact>): ReadingFact {
  return { number: 1, key: '', label: '', value: '', unit: '', numericValue: null, note: '', detail: '', ...overrides };
}

function reading(facts: ReadingFact[]): CoachReading {
  return {
    surface: 'WORKOUT',
    status: 'READY',
    readingId: 'r1',
    period: 'THIS_WEEK',
    periodStart: null,
    periodEnd: null,
    facts,
    reading: null,
    lifts: []
  };
}

const BUILD_QUESTION = { text: 'Build a session for today', makesDraft: true };

/**
 * Every candidate follows a fixed shape read from one fact, so this spec pins that shape: the
 * label parsing and plurals for the day-off question, and the cap that always keeps the build
 * question among the three shown.
 */
describe('questionsFor', () => {
  it('offers a day-off question when every session trained the same group, using the label as written', () => {
    const questions = questionsFor(reading([fact({ number: 1, key: 'MOST_TRAINED', label: 'Sessions with core work', note: 'Every one' })]));
    expect(questions).toEqual([{ text: 'Should my core get a day off?', makesDraft: false }, BUILD_QUESTION]);
  });

  it('pluralizes leg, arm, shoulder and glute for the day-off question', () => {
    for (const [noun, plural] of Object.entries({ leg: 'legs', arm: 'arms', shoulder: 'shoulders', glute: 'glutes' })) {
      const questions = questionsFor(reading([fact({ key: 'MOST_TRAINED', label: `Sessions with ${noun} work`, note: 'Every one' })]));
      expect(questions[0]).withContext(noun).toEqual({ text: `Should my ${plural} get a day off?`, makesDraft: false });
    }
  });

  it('reads the day-off question from the numbers, so a reworded note changes nothing', () => {
    const questions = questionsFor(
      reading([fact({ key: 'MOST_TRAINED', label: 'Sessions with core work', value: '4', unit: 'of 4', numericValue: 4, note: 'All of them' })])
    );
    expect(questions[0]).toEqual({ text: 'Should my core get a day off?', makesDraft: false });
  });

  it('skips the day-off candidate when the group was not in every session', () => {
    const questions = questionsFor(
      reading([fact({ key: 'MOST_TRAINED', label: 'Sessions with core work', value: '3', unit: 'of 4', numericValue: 3, note: 'Every one' })])
    );
    expect(questions).toEqual([BUILD_QUESTION]);
  });

  it('falls back to neutral wording when the label names no group', () => {
    const questions = questionsFor(reading([fact({ key: 'MOST_TRAINED', label: 'Core sessions', note: '' })]));
    expect(questions[0]).toEqual({ text: 'Should my most-trained muscle get a day off?', makesDraft: false });
  });

  it('offers a next-lift question without reading the note, and skips it when the load fell', () => {
    const rose = fact({ key: 'VOLUME_PER_SESSION', numericValue: 1923, detail: '1,700 kg the week before', note: 'Higher' });
    expect(questionsFor(reading([rose]))[0]).toEqual({ text: 'What should I lift next time?', makesDraft: false });

    const fell = fact({ key: 'VOLUME_PER_SESSION', numericValue: 1500, detail: '1,700 kg the week before', note: 'Up' });
    expect(questionsFor(reading([fell]))).toEqual([BUILD_QUESTION]);
  });

  it('offers the next-lift question when the fact carries no comparison to read', () => {
    expect(questionsFor(reading([fact({ key: 'VOLUME_PER_SESSION', note: 'Unchanged' })]))[0].text).toBe('What should I lift next time?');
  });

  it('offers the next-lift question from the best single fact too', () => {
    expect(questionsFor(reading([fact({ key: 'BEST_SINGLE', note: 'Up 12%' })]))[0].text).toBe('What should I lift next time?');
  });

  it('names the lift in the beat-the-record question', () => {
    const questions = questionsFor(reading([fact({ key: 'RECORD', label: 'Dumbbell Bench Press record' })]));
    expect(questions).toEqual([{ text: 'What would beat my Dumbbell Bench Press record?', makesDraft: false }, BUILD_QUESTION]);
  });

  it('offers a beat-the-record question when a record fact is present', () => {
    const questions = questionsFor(reading([fact({ key: 'RECORD' })]));
    expect(questions).toEqual([{ text: 'What would beat this record?', makesDraft: false }, BUILD_QUESTION]);
  });

  it('keeps the build question among the three when there are more than three candidates', () => {
    const questions = questionsFor(
      reading([
        fact({ key: 'MOST_TRAINED', label: 'Sessions with core work', note: 'Every one' }),
        fact({ key: 'VOLUME_PER_SESSION', note: 'Up 12%' }),
        fact({ key: 'RECORD' })
      ])
    );
    expect(questions).toEqual([
      { text: 'Should my core get a day off?', makesDraft: false },
      { text: 'What should I lift next time?', makesDraft: false },
      BUILD_QUESTION
    ]);
  });

  it('gives only the build question when no fact matches a candidate', () => {
    const questions = questionsFor(reading([fact({ key: 'SESSION_LENGTH', note: 'Unchanged' })]));
    expect(questions).toEqual([BUILD_QUESTION]);
  });

  it('offers no build question off the workout surface', () => {
    // Every reading today comes from the workout surface; a future surface reaches this branch,
    // so it is exercised directly here rather than left untested until one exists.
    const questions = questionsFor({ ...reading([fact({ key: 'RECORD' })]), surface: 'OTHER' as never });
    expect(questions).toEqual([{ text: 'What would beat this record?', makesDraft: false }]);
  });

  it('offers the questions of the nutrition and progress readings, none of which makes a draft', () => {
    const cases: [string, string, CoachReading['surface']][] = [
      ['PROTEIN_BREAKFAST', 'What did I eat for breakfast last week?', 'NUTRITION'],
      ['PROTEIN_PER_DAY', 'How does my protein compare with my target?', 'NUTRITION'],
      ['WEEKLY_RATE', 'How has my weight moved this month?', 'PROGRESS'],
      ['GOAL', 'When do I reach my goal at this rate?', 'PROGRESS']
    ];
    for (const [key, text, surface] of cases) {
      const questions = questionsFor({ ...reading([fact({ key })]), surface });
      expect(questions).withContext(key).toEqual([{ text, makesDraft: false }]);
    }
  });

  it('offers no build question on the nutrition surface and asks only what the facts support', () => {
    const questions = questionsFor({
      ...reading([fact({ key: 'PROTEIN_BREAKFAST' }), fact({ key: 'PROTEIN_PER_DAY' }), fact({ key: 'CALORIES_PER_DAY' })]),
      surface: 'NUTRITION'
    });
    expect(questions.map((question) => question.text)).toEqual([
      'What did I eat for breakfast last week?',
      'How does my protein compare with my target?'
    ]);
  });
});
