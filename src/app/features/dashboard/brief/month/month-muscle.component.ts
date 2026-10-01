import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { MonthDetailComponent } from './month-detail.component';
import { buildMuscleRows } from './month-muscle';
import { MonthViewState } from './month-view.state';

/** What the month says about the muscle group picked on the radar. */
@Component({
  selector: 'app-month-muscle',
  standalone: true,
  imports: [MonthDetailComponent],
  template: `<app-month-detail [heading]="heading()" backLabel="Show all muscles" [rows]="rows()" (back)="state.clearSelection(true)" />`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthMuscleComponent {
  protected readonly state = inject(MonthViewState);

  /** The group's code, such as CHEST. */
  readonly group = input.required<string>();

  private readonly muscle = computed(() => this.state.insight()?.muscles.find((entry) => entry.group === this.group()) ?? null);
  protected readonly heading = computed(() => `${this.muscle()?.label ?? this.group()} this month`);
  protected readonly rows = computed(() => {
    const insight = this.state.insight();
    return insight ? buildMuscleRows(insight.days, this.group(), insight.month, this.muscle()?.sessions) : [];
  });
}
