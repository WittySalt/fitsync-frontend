import { GlyphShape } from '../muscle-icons';

/** A line of the panel's lower part: an icon, a headline and one line under it. */
export interface TextRow {
  id: string;
  headline: string;
  /** One line under the headline; empty when there is nothing more to say. */
  note: string;
  glyph: GlyphShape[];
}

/** The place of a line whose data is still on its way. */
export interface PendingRow {
  id: string;
  pending: true;
}

export type RowItem = TextRow | PendingRow;

export function isPending(row: RowItem): row is PendingRow {
  return 'pending' in row;
}
