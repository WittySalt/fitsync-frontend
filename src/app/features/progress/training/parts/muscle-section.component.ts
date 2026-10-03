import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { MuscleFigureComponent } from '../../../../shared/charts/muscle-figure/muscle-figure.component';
import { HEAT_KEY, MUSCLE_GROUPS, formatSets, groupLabel, heatLevel } from '../../../../shared/charts/muscle-figure/muscle-figure';
import { DetailSectionComponent } from '../../../../shared/progress';
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
  imports: [DetailSectionComponent, MuscleFigureComponent, MuscleGroupDetailComponent],
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

  /** The one sentence under the name: the group that got the most hard sets and the one that got the least. */
  protected readonly sentence = computed(() => {
    const rows = this.rows();
    const most = rows[0];
    const least = rows[rows.length - 1];
    if (!this.hasData() || !most || !least || most.group === least.group) {
      return 'Hard sets a week in each muscle group, once strength sets are logged.';
    }
    return `${most.label} got the most, ${most.text} a week, and ${least.label.toLowerCase()} the least at ${least.text}.`;
  });
  protected readonly ask = computed(
    () => `Which muscle groups am I under-training? The usual range is ${this.muscles().usualRange.low} to ${this.muscles().usualRange.high} hard sets a week. ${COUNT_NOTE}`
  );

  protected readonly pickedSets = computed(() => this.muscles().groups.find((entry) => entry.group === this.selected()) ?? null);

  protected toggle(group: string): void {
    this.selected.update((current) => (current === group ? null : group));
  }
}
