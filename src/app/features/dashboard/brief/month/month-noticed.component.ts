import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { MonthObservation } from './month-observations';
import { MonthRowsComponent } from './month-rows.component';

/** What the coach noticed this month, as up to three lines under the charts. */
@Component({
  selector: 'app-month-noticed',
  standalone: true,
  imports: [MonthRowsComponent],
  templateUrl: './month-noticed.component.html',
  styleUrl: './month-noticed.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthNoticedComponent {
  readonly observations = input.required<readonly MonthObservation[]>();
}
