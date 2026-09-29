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

  it('skips the day-off candidate when the label does not have the expected shape', () => {
    const questions = questionsFor(reading([fact({ key: 'MOST_TRAINED', label: 'Core sessions', note: 'Every one' })]));
    expect(questions).toEqual([BUILD_QUESTION]);
  });

  it('skips the day-off candidate when the note is not "Every one"', () => {
    const questions = questionsFor(reading([fact({ key: 'MOST_TRAINED', label: 'Sessions with core work', note: '3 of 4' })]));
    expect(questions).toEqual([BUILD_QUESTION]);
  });

  it('offers a next-lift question when the load moved per session rose', () => {
    const questions = questionsFor(reading([fact({ key: 'VOLUME_PER_SESSION', note: 'Up 12%' })]));
    expect(questions).toEqual([{ text: 'What should I lift next time?', makesDraft: false }, BUILD_QUESTION]);
  });

  it('skips the next-lift candidate when the volume note does not start with Up', () => {
    const questions = questionsFor(reading([fact({ key: 'VOLUME_PER_SESSION', note: 'Unchanged' })]));
    expect(questions).toEqual([BUILD_QUESTION]);
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
});
