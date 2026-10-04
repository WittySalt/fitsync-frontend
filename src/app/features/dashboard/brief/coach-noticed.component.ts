import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BriefObservation } from './brief-observations';
import { DAY_KIND_GLYPHS } from './day-kind-icons';
import { GlyphShape, MUSCLE_GLYPHS } from './muscle-icons';

const TREND: GlyphShape[] = [
  { tag: 'path', d: 'M3 17l6-6 4 4 8-8' },
  { tag: 'path', d: 'M15 7h6v6' }
];

const WEEK: GlyphShape[] = [
  { tag: 'rect', x: 3.5, y: 5, width: 17, height: 15, rx: 3 },
  { tag: 'path', d: 'M3.5 10h17' },
  { tag: 'path', d: 'M8 3v4' },
  { tag: 'path', d: 'M16 3v4' }
];

/**
 * The three things the coach noticed, under the week strip.
 *
 * Each row is a measured fact and one sentence about it. The rows are observations. Nothing here
 * is a button, because the coach does not tell the user what to do.
 */
@Component({
  selector: 'app-coach-noticed',
  standalone: true,
  templateUrl: './coach-noticed.component.html',
  styleUrl: './coach-noticed.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachNoticedComponent {
  readonly observations = input.required<BriefObservation[]>();

  glyph(observation: BriefObservation): GlyphShape[] {
    if (observation.dayKind) {
      return DAY_KIND_GLYPHS[observation.dayKind];
    }
    if (observation.muscle) {
      return MUSCLE_GLYPHS[observation.muscle];
    }
    return observation.icon === 'strength' ? TREND : WEEK;
  }
}
