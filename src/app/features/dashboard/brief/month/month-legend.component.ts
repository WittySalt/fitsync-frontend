import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DayKind, MuscleGroupCode } from '../../../../core/fitsync.models';
import { DAY_KIND_GLYPHS } from '../day-kind-icons';
import { GlyphShape, MUSCLE_GLYPHS } from '../muscle-icons';

interface LegendKind {
  kind: DayKind;
  label: string;
}

/** The legend under the calendar. The four kinds of day are listed until a muscle group is picked
 *  on the radar; then the legend says what the solid and the pale days stand for. */
@Component({
  selector: 'app-month-legend',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './month-legend.component.html',
  styleUrl: './month-legend.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthLegendComponent {
  /** True when the month holds a date before the first session. */
  readonly hasBefore = input(false);
  /** The code and the name of the group that is picked, if any. */
  readonly group = input<string | null>(null);
  readonly groupLabel = input('');

  protected readonly legendKinds: LegendKind[] = [
    { kind: 'STRENGTH', label: 'Strength' },
    { kind: 'CARDIO', label: 'Cardio' },
    { kind: 'MOBILITY', label: 'Mobility' },
    { kind: 'SPORT', label: 'Sport' }
  ];

  protected readonly trainedLabel = computed(() => `Trained ${this.groupLabel().toLowerCase()}`);
  protected readonly groupGlyph = computed<GlyphShape[]>(() => MUSCLE_GLYPHS[this.group() as MuscleGroupCode] ?? DAY_KIND_GLYPHS.STRENGTH);
  protected readonly otherGlyph = DAY_KIND_GLYPHS.CARDIO;

  protected glyphFor(kind: DayKind): GlyphShape[] {
    return DAY_KIND_GLYPHS[kind];
  }
}
