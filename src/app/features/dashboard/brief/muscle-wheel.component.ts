import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MuscleGroupCode } from '../../../core/fitsync.models';
import { numberWord } from './brief-copy';
import { GlyphShape, MUSCLE_GLYPHS } from './muscle-icons';
import { WHEEL_CENTRE, WHEEL_HEIGHT, WHEEL_WIDTH, wheelShapes } from './muscle-wheel.geometry';

export interface MuscleWheelSector {
  code: MuscleGroupCode;
  label: string;
  sessions: number;
  trainedYesterday: boolean;
}

/**
 * The muscle wheel on the brief's dark panel.
 *
 * Each sector is one muscle group and each ring is one session that trained it this week. The ring
 * added yesterday is white, so what is still recovering can be read without a sentence. The wheel
 * only draws what it is given. Which groups belong on it is decided by the caller.
 */
@Component({
  selector: 'app-muscle-wheel',
  standalone: true,
  templateUrl: './muscle-wheel.component.html',
  styleUrl: './muscle-wheel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MuscleWheelComponent {
  readonly sectors = input.required<MuscleWheelSector[]>();
  readonly completed = input(0);
  readonly target = input<number | null>(null);

  readonly viewBox = `0 0 ${WHEEL_WIDTH} ${WHEEL_HEIGHT}`;
  readonly centre = WHEEL_CENTRE;

  readonly shapes = computed(() => wheelShapes(this.sectors()));

  readonly hasYesterday = computed(() => this.sectors().some((sector) => sector.trainedYesterday && sector.sessions > 0));

  readonly description = computed(() => {
    const sectors = this.sectors();
    if (!sectors.length) {
      return 'No muscle groups to show yet.';
    }
    const counts = sectors.map((sector) => `${sector.label.toLowerCase()} ${numberWord(sector.sessions)}`).join(', ');
    const sentence = counts.charAt(0).toUpperCase() + counts.slice(1);
    return `Sessions this week for each muscle group. ${sentence}.`;
  });

  glyph(code: MuscleGroupCode): GlyphShape[] {
    return MUSCLE_GLYPHS[code];
  }

  sessionsLabel(sessions: number): string {
    return sessions === 1 ? '1 session' : `${sessions} sessions`;
  }
}
