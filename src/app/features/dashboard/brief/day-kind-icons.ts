import { DayKind } from '../../../core/fitsync.models';
import { GlyphShape } from './muscle-icons';

/**
 * One glyph for each day kind, drawn on a 24 by 24 grid with a stroke and no fill, in the same
 * data form as the muscle glyphs: the template draws these with attribute bindings, never a
 * markup string.
 */
export const DAY_KIND_GLYPHS: Record<DayKind, GlyphShape[]> = {
  STRENGTH: [
    { tag: 'path', d: 'M6 7v10' },
    { tag: 'path', d: 'M18 7v10' },
    { tag: 'path', d: 'M3 10v4' },
    { tag: 'path', d: 'M21 10v4' },
    { tag: 'path', d: 'M6 12h12' }
  ],
  CARDIO: [
    {
      tag: 'path',
      d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
    },
    { tag: 'path', d: 'M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27' }
  ],
  MOBILITY: [
    { tag: 'circle', cx: 12, cy: 4.5, r: 1.75 },
    { tag: 'path', d: 'M4 9.5c2.7 1 5.3 1.5 8 1.5s5.3-.5 8-1.5' },
    { tag: 'path', d: 'M12 11v4.5' },
    { tag: 'path', d: 'M12 15.5l-4 5' },
    { tag: 'path', d: 'M12 15.5l4 5' }
  ],
  SPORT: [
    { tag: 'circle', cx: 12, cy: 12, r: 9 },
    { tag: 'path', d: 'M3 12h18' },
    { tag: 'path', d: 'M5.6 5.6c3 2.2 3 10.6 0 12.8' },
    { tag: 'path', d: 'M18.4 5.6c-3 2.2-3 10.6 0 12.8' }
  ],
  REST: [{ tag: 'path', d: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z' }],
  OPEN: [
    { tag: 'circle', cx: 12, cy: 12, r: 9 },
    { tag: 'path', d: 'M12 8v8' },
    { tag: 'path', d: 'M8 12h8' }
  ]
};

/** The four kinds that name an actual training day, as opposed to REST or OPEN, which describe a
 *  day without one. Used everywhere the brief needs to tell "training" from "not training". */
export const TRAINING_DAY_KINDS: DayKind[] = ['STRENGTH', 'CARDIO', 'MOBILITY', 'SPORT'];

export function isTrainingDayKind(kind: DayKind | null): boolean {
  return kind !== null && TRAINING_DAY_KINDS.includes(kind);
}
