import { ReadingSegment, readingSegments } from './reading-text';

function citations(segments: ReadingSegment[]): number[] {
  return segments.flatMap((segment) => (segment.kind === 'citation' ? [segment.number] : []));
}

function plain(segments: ReadingSegment[]): string {
  return segments.map((segment) => (segment.kind === 'text' ? segment.text : `(${segment.number})`)).join('');
}

describe('readingSegments', () => {
  it('returns the whole body as text when there is no citation', () => {
    expect(readingSegments('Your week was steady.', 4)).toEqual([{ kind: 'text', text: 'Your week was steady.' }]);
  });

  it('turns each marker into a citation and keeps the punctuation after it', () => {
    expect(readingSegments('You moved 1,923 kg a session [1], and each took 50 min [2].', 4)).toEqual([
      { kind: 'text', text: 'You moved 1,923 kg a session' },
      { kind: 'citation', number: 1 },
      { kind: 'text', text: ', and each took 50 min' },
      { kind: 'citation', number: 2 },
      { kind: 'text', text: '.' }
    ]);
  });

  it('keeps two different markers that follow each other', () => {
    expect(readingSegments('Both rose [1] [3].', 4)).toEqual([
      { kind: 'text', text: 'Both rose' },
      { kind: 'citation', number: 1 },
      { kind: 'citation', number: 3 },
      { kind: 'text', text: '.' }
    ]);
  });

  it('keeps only the first marker for a fact within one sentence', () => {
    const segments = readingSegments('Your sessions moved 1,923 kg [1] in 50 min [2], with the weight up 12% [1] from the prior week.', 4);
    expect(citations(segments)).toEqual([1, 2]);
    expect(plain(segments)).toBe('Your sessions moved 1,923 kg(1) in 50 min(2), with the weight up 12% from the prior week.');
  });

  it('joins the text on both sides of a dropped marker into one piece', () => {
    expect(readingSegments('A bench press of 22.5 kg [3], up from 20 kg [3], on Monday.', 4)).toEqual([
      { kind: 'text', text: 'A bench press of 22.5 kg' },
      { kind: 'citation', number: 3 },
      { kind: 'text', text: ', up from 20 kg, on Monday.' }
    ]);
  });

  it('shows a fact again in the next sentence', () => {
    const segments = readingSegments('You moved 1,923 kg [1]. That is up 12% [1] on the week before.', 4);
    expect(citations(segments)).toEqual([1, 1]);
    expect(plain(segments)).toBe('You moved 1,923 kg(1). That is up 12%(1) on the week before.');
  });

  it('does not take the point in a decimal for the end of a sentence', () => {
    const segments = readingSegments('A press of 22.5 kg [3] beat 20.5 kg [3] from before.', 4);
    expect(citations(segments)).toEqual([3]);
  });

  it('reduces the six markers of a real model reading to four', () => {
    const body =
      'Your sessions moved 1,923 kg [1] in 50 min [2], with the weight up 12% [1] from the prior week. ' +
      'Monday brought a dumbbell bench press of 22.5 kg [3], up from 20 kg [3], and all 4 of your sessions [4] included core work.';
    const segments = readingSegments(body, 4);
    expect(citations(segments)).toEqual([1, 2, 3, 4]);
    expect(plain(segments)).toBe(
      'Your sessions moved 1,923 kg(1) in 50 min(2), with the weight up 12% from the prior week. ' +
        'Monday brought a dumbbell bench press of 22.5 kg(3), up from 20 kg, and all 4 of your sessions(4) included core work.'
    );
  });

  it('drops a marker that points at no fact', () => {
    expect(readingSegments('A claim [7] here.', 4)).toEqual([{ kind: 'text', text: 'A claim here.' }]);
    expect(readingSegments('A claim [0].', 4)).toEqual([{ kind: 'text', text: 'A claim.' }]);
  });

  it('leaves other brackets alone', () => {
    expect(readingSegments('Sets [heavy] and [123] stay.', 4)).toEqual([{ kind: 'text', text: 'Sets [heavy] and [123] stay.' }]);
  });

  it('handles an empty body', () => {
    expect(readingSegments('', 4)).toEqual([]);
  });
});
