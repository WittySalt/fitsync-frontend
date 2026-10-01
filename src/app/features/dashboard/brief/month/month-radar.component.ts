import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output } from '@angular/core';

import { MonthMuscleInsight } from '../../../../core/fitsync.models';
import { BarsGeometry, RadarGeometry, buildMuscleChart, describeMuscles } from './month-radar';

/** The month's sessions by muscle group: a radar from three groups on, bars below that. Each
 *  group is a button that picks the group, or lets go of it when it is picked already. */
@Component({
  selector: 'app-month-radar',
  standalone: true,
  templateUrl: './month-radar.component.html',
  styleUrl: './month-radar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthRadarComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly muscles = input.required<readonly MonthMuscleInsight[]>();
  /** The code of the group that is picked, if any. */
  readonly selected = input<string | null>(null);
  readonly groupSelected = output<string>();

  private readonly chart = computed(() => buildMuscleChart(this.muscles()));
  protected readonly radar = computed<RadarGeometry | null>(() => {
    const chart = this.chart();
    return chart?.mode === 'radar' ? chart : null;
  });
  protected readonly bars = computed<BarsGeometry | null>(() => {
    const chart = this.chart();
    return chart?.mode === 'bars' ? chart : null;
  });
  protected readonly description = computed(() => describeMuscles(this.muscles()));

  protected sessionsOf(group: string): string {
    const muscle = this.muscles().find((entry) => entry.group === group);
    return muscle ? `${muscle.label}, ${muscle.sessions} ${muscle.sessions === 1 ? 'session' : 'sessions'}` : group;
  }

  protected press(group: string, event?: Event): void {
    event?.preventDefault();
    this.groupSelected.emit(group);
  }

  /** Puts the focus on the label of a group, for the button that lets go of the pick. */
  focusGroup(group: string): void {
    this.host.nativeElement.querySelector<SVGGElement>(`[data-group="${group}"]`)?.focus();
  }
}
