import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { MonthRowsComponent } from './month-rows.component';
import { RowItem } from './month-rows';

/** The frame of what replaces the coach's notices when a date or a muscle group is picked: a
 *  heading with the button that goes back, and the lines. It keeps the height of three lines so
 *  the panel, and the page under it, does not move between the notices and this. */
@Component({
  selector: 'app-month-detail',
  standalone: true,
  imports: [MonthRowsComponent],
  templateUrl: './month-detail.component.html',
  styleUrl: './month-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthDetailComponent {
  readonly heading = input.required<string>();
  readonly backLabel = input.required<string>();
  readonly rows = input<readonly RowItem[]>([]);
  /** A single quiet sentence, shown when there are no lines. */
  readonly quiet = input('');
  readonly back = output<void>();
}
