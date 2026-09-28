import { readingSegments } from './reading-text';

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

  it('keeps two markers that follow each other', () => {
    expect(readingSegments('Both rose [1] [3].', 4)).toEqual([
      { kind: 'text', text: 'Both rose' },
      { kind: 'citation', number: 1 },
      { kind: 'citation', number: 3 },
      { kind: 'text', text: '.' }
    ]);
  });

  it('drops a marker that points at no fact', () => {
    expect(readingSegments('A claim [7] here.', 4)).toEqual([
      { kind: 'text', text: 'A claim' },
      { kind: 'text', text: ' here.' }
    ]);
    expect(readingSegments('A claim [0].', 4)).toEqual([
      { kind: 'text', text: 'A claim' },
      { kind: 'text', text: '.' }
    ]);
  });

  it('leaves other brackets alone', () => {
    expect(readingSegments('Sets [heavy] and [123] stay.', 4)).toEqual([{ kind: 'text', text: 'Sets [heavy] and [123] stay.' }]);
  });

  it('handles an empty body', () => {
    expect(readingSegments('', 4)).toEqual([]);
  });
});
