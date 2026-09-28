/**
 * Splits a reading's body into plain text and citation markers.
 *
 * The model writes a fact's number in square brackets after what it took from that fact. The panel
 * draws each marker as a small numbered badge, so the body is rendered piece by piece through
 * interpolation and never as markup.
 */
export type ReadingSegment = { kind: 'text'; text: string } | { kind: 'citation'; number: number };

const CITATION = /\s*\[(\d{1,2})\]/g;

export function readingSegments(body: string, factCount: number): ReadingSegment[] {
  const segments: ReadingSegment[] = [];
  let cursor = 0;

  for (const match of body.matchAll(CITATION)) {
    const number = Number(match[1]);
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ kind: 'text', text: body.slice(cursor, start) });
    }
    // A marker that points at no fact is dropped. The server checks this too, and the panel must
    // still never draw a badge that leads nowhere.
    if (number >= 1 && number <= factCount) {
      segments.push({ kind: 'citation', number });
    }
    cursor = start + match[0].length;
  }

  if (cursor < body.length) {
    segments.push({ kind: 'text', text: body.slice(cursor) });
  }
  return segments;
}
