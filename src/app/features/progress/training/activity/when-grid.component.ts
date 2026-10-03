import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { GRID_HOURS, whenCells } from './activity-geometry';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** When you train: weekdays by start hour, a cell filled once, darker twice or more. */
@Component({
  selector: 'app-when-grid',
  template: `
    <div class="grid" role="table" aria-label="Start time of each session, by weekday">
      <span role="presentation"></span>
      @for (hour of hours; track hour) {
        <span class="hour" role="columnheader">{{ hour }}:00</span>
      }
      @for (row of rows(); track $index) {
        <span class="day" role="rowheader" [attr.aria-label]="row.name">{{ row.name.charAt(0) }}</span>
        @for (count of row.cells; track $index) {
          <span role="cell" [class]="'cell ' + (count >= 2 ? 'many' : count === 1 ? 'once' : 'none')" [attr.aria-label]="row.name + ' ' + hours[$index] + ':00, ' + count + (count === 1 ? ' session' : ' sessions')"></span>
        }
      }
    </div>
    <div class="key" aria-hidden="true">
      <span><i class="cell once"></i>once</span>
      <span><i class="cell many"></i>twice or more</span>
    </div>
  `,
  styleUrl: './when-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhenGridComponent {
  readonly entries = input<readonly { weekday: number; hour: number; count: number }[]>([]);

  protected readonly hours = GRID_HOURS;
  protected readonly rows = computed(() => whenCells(this.entries()).map((cells, index) => ({ name: DAY_NAMES[index], cells })));
}
