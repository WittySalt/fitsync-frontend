import { MuscleGroupCode } from '../../../core/fitsync.models';

/**
 * One glyph for each muscle group, drawn on a 24 by 24 grid with a stroke and no fill.
 *
 * The shapes are data and the template draws them with attribute bindings, so no markup string is
 * ever handed to the page.
 */
export type GlyphShape =
  | { tag: 'path'; d: string }
  | { tag: 'circle'; cx: number; cy: number; r: number }
  | { tag: 'rect'; x: number; y: number; width: number; height: number; rx: number };

const TORSO = 'M4.5 6.5c2.5-.5 4-1.5 5-3 .7.8 1.5 1.2 2.5 1.2s1.8-.4 2.5-1.2c1 1.5 2.5 2.5 5 3-.2 4.5-1 8.5-2.5 12.5H7C5.5 15 4.7 11 4.5 6.5Z';

export const MUSCLE_GLYPHS: Record<MuscleGroupCode, GlyphShape[]> = {
  CHEST: [
    { tag: 'path', d: TORSO },
    { tag: 'path', d: 'M6.8 11.5c1.7 1.7 3.5 1.7 5.2 0 1.7 1.7 3.5 1.7 5.2 0' },
    { tag: 'path', d: 'M12 7.5v4' }
  ],
  BACK: [
    { tag: 'path', d: TORSO },
    { tag: 'path', d: 'M12 8v8' },
    { tag: 'path', d: 'M8.3 9.5c1.1 1.2 1.3 2.5.7 4' },
    { tag: 'path', d: 'M15.7 9.5c-1.1 1.2-1.3 2.5-.7 4' }
  ],
  LEGS: [
    { tag: 'path', d: 'M6.5 3.5h11l-1 17H13l-1-10.5-1 10.5H7.5Z' },
    { tag: 'path', d: 'M6.8 7.5h10.4' }
  ],
  GLUTES: [
    { tag: 'path', d: 'M5.5 5h13' },
    { tag: 'path', d: 'M5.5 5c-1.2 5.5-.4 10.5 2.5 13.5 2.2 0 3.6-1.5 4-4 .4 2.5 1.8 4 4 4 2.9-3 3.7-8 2.5-13.5' },
    { tag: 'path', d: 'M12 9v5.5' }
  ],
  CORE: [
    { tag: 'rect', x: 6.5, y: 3.75, width: 4.5, height: 4.5, rx: 1.5 },
    { tag: 'rect', x: 13, y: 3.75, width: 4.5, height: 4.5, rx: 1.5 },
    { tag: 'rect', x: 6.5, y: 9.75, width: 4.5, height: 4.5, rx: 1.5 },
    { tag: 'rect', x: 13, y: 9.75, width: 4.5, height: 4.5, rx: 1.5 },
    { tag: 'rect', x: 6.5, y: 15.75, width: 4.5, height: 4.5, rx: 1.5 },
    { tag: 'rect', x: 13, y: 15.75, width: 4.5, height: 4.5, rx: 1.5 }
  ],
  SHOULDERS: [
    { tag: 'circle', cx: 12, cy: 5, r: 2.5 },
    { tag: 'path', d: 'M3 19.5V16c0-3 2-5 5-5h8c3 0 5 2 5 5v3.5' },
    { tag: 'path', d: 'M8 11c-.6 2.2-.2 4 1 5.5' },
    { tag: 'path', d: 'M16 11c.6 2.2.2 4-1 5.5' }
  ],
  ARMS: [
    {
      tag: 'path',
      d: 'M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1'
    },
    { tag: 'path', d: 'M15 14a5 5 0 0 0-7.584 2' },
    { tag: 'path', d: 'M9.964 6.825C8.019 7.977 9.5 13 8 15' }
  ],
  CARDIO: [
    {
      tag: 'path',
      d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
    },
    { tag: 'path', d: 'M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27' }
  ],
  FULL_BODY: [
    { tag: 'circle', cx: 12, cy: 4.5, r: 2.25 },
    { tag: 'path', d: 'M5.5 10h13' },
    { tag: 'path', d: 'M12 8v7.5' },
    { tag: 'path', d: 'M12 15.5l-3.5 5.5' },
    { tag: 'path', d: 'M12 15.5l3.5 5.5' }
  ]
};
