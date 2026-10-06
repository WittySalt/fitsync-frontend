/**
 * Splits a reading's body into plain text and citation markers.
 *
 * The model writes a fact's number in square brackets after what it took from that fact. The panel
 * draws each marker as a small numbered badge, so the body is rendered piece by piece through
 * interpolation and never as markup.
 *
 * A writer tends to mark every number, so one sentence can point at the same fact several times.
 * Within a sentence only the first marker for a fact is kept. The stored text is left as it is,
 * because the server checks the reading against every marker.
 */
export type ReadingSegment = { kind: 'text'; text: string } | { kind: 'citation'; number: number };

const CITATION = /\s*\[(\d{1,2})\]/g;

/** A full stop followed by a space or by the end of the text. The point in 22.5 is not one. */
const SENTENCE_END = /\.(\s|$)/;

export function readingSegments(body: string, factCount: number): ReadingSegment[] {
  const segments: ReadingSegment[] = [];
  let citedInSentence = new Set<number>();
  let cursor = 0;

  const addText = (text: string): void => {
    if (!text) {
      return;
    }
    const last = segments[segments.length - 1];
    if (last?.kind === 'text') {
      // A dropped marker leaves two pieces of text side by side, and they are joined again.
      last.text += text;
    } else {
      segments.push({ kind: 'text', text });
    }
    if (SENTENCE_END.test(text)) {
      citedInSentence = new Set<number>();
    }
  };

  for (const match of body.matchAll(CITATION)) {
    const number = Number(match[1]);
    const start = match.index ?? 0;
    addText(body.slice(cursor, start));
    // A marker that points at no fact is dropped. The server checks this too, and the panel must
    // still never draw a badge that leads nowhere.
    if (number >= 1 && number <= factCount && !citedInSentence.has(number)) {
      segments.push({ kind: 'citation', number });
      citedInSentence.add(number);
    }
    cursor = start + match[0].length;
  }

  addText(body.slice(cursor));
  return segments;
}

/** The same text with every citation marker removed, for a place that cannot draw badges. */
export function withoutCitations(text: string): string {
  return text.replace(CITATION, '');
}

const UNIT_NUMBER = /(\d+\.\d+)(\s*)(kg|kilograms?|kcal|calories|g|grams?)(?![\w/])/gi;

/**
 * Shows grams and kilocalories as whole numbers and kilograms with one decimal, whatever the text
 * carries: "29.15 grams" reads "29 grams", "74.26 kg" reads "74.3 kg". The server rounds too; this
 * keeps a longer figure from ever reaching the screen. Numbers with no unit are left alone.
 */
export function roundedNumbers(text: string): string {
  return text.replace(UNIT_NUMBER, (_match, figure: string, space: string, unit: string) => {
    const value = Number(figure);
    const shown = /^k(g|ilogram)/i.test(unit) ? String(Math.round(value * 10) / 10) : String(Math.round(value));
    return `${shown}${space}${unit}`;
  });
}
