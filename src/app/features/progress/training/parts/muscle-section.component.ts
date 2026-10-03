import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { MuscleFigureComponent } from '../../../../shared/charts/muscle-figure/muscle-figure.component';
import { HEAT_KEY, MUSCLE_GROUPS, formatSets, groupLabel, heatLevel } from '../../../../shared/charts/muscle-figure/muscle-figure';
import { SectionCardComponent } from '../../../../shared/progress';
import { MuscleSets } from '../training.models';
import { MuscleGroupDetailComponent } from './muscle-group-detail.component';

export const COUNT_NOTE = 'A set counts once for its main muscle group and half for a secondary one.';

const AXIS_TOP = 25;

/**
 * Hard sets a week by group: the figure, front and back, beside the list of groups against the
 * usual 10 to 20. Tapping a region or a row lists the exercises that trained its group.
 */
@Component({
  selector: 'app-muscle-section',
  imports: [MuscleFigureComponent, MuscleGroupDetailComponent, SectionCardComponent],
  templateUrl: './muscle-section.component.html',
  styleUrl: './muscle-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MuscleSectionComponent {
  readonly muscles = input.required<MuscleSets>();
  readonly card = input<CoachCardContext | null>(null);

  protected readonly selected = signal<string | null>(null);
  protected readonly note = COUNT_NOTE;
  protected readonly key = HEAT_KEY;
  protected readonly ticks = [0, 6, 10, 20].map((value) => ({ value, at: (value / AXIS_TOP) * 100 }));

  protected readonly hasData = computed(() => this.muscles().groups.some((group) => group.setsPerWeek > 0));

  protected readonly sets = computed<Record<string, number>>(() =>
    Object.fromEntries(this.muscles().groups.map((group) => [group.group, group.setsPerWeek]))
  );

  protected readonly rows = computed(() => {
    const known = new Map(this.muscles().groups.map((group) => [group.group, group]));
    return MUSCLE_GROUPS.map((code) => {
      const value = known.get(code)?.setsPerWeek ?? 0;
      return { group: code, label: groupLabel(code), value, text: `${formatSets(value)} sets`, width: (Math.min(value, AXIS_TOP) / AXIS_TOP) * 100, level: heatLevel(value) };
    }).sort((a, b) => b.value - a.value);
  });

  protected readonly band = computed(() => {
    const range = this.muscles().usualRange;
    return { left: (range.low / AXIS_TOP) * 100, width: ((range.high - range.low) / AXIS_TOP) * 100 };
  });

  protected readonly pickedSets = computed(() => this.muscles().groups.find((entry) => entry.group === this.selected()) ?? null);

  protected toggle(group: string): void {
    this.selected.update((current) => (current === group ? null : group));
  }
}
