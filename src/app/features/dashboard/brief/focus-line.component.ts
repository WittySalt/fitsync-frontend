import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MuscleGroupCode } from '../../../core/fitsync.models';
import { FOCUS_LINK, focusLine } from './brief-focus';
import { WheelSector } from './brief-muscles';
import { GlyphShape, MUSCLE_GLYPHS } from './muscle-icons';

/**
 * The quiet line under the muscle wheel on the brief's dark panel. It is drawn only when the
 * focus areas chosen at setup include muscle groups that have no sector on the wheel, states that
 * as a fact and offers a link to the plans, where the person decides. It never changes the plan.
 */
@Component({
  selector: 'app-focus-line',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './focus-line.component.html',
  styleUrl: './focus-line.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FocusLineComponent {
  readonly focusAreas = input<readonly string[]>([]);
  readonly sectors = input<readonly Pick<WheelSector, 'code'>[]>([]);

  readonly link = FOCUS_LINK;

  // No sector means no plan to compare with, so the line stays out and the starter plans show.
  readonly line = computed(() => {
    const sectors = this.sectors();
    return sectors.length ? focusLine(this.focusAreas(), sectors.map((sector) => sector.code)) : null;
  });

  glyph(code: MuscleGroupCode): GlyphShape[] {
    return MUSCLE_GLYPHS[code];
  }
}
