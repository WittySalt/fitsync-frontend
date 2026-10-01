import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { MonthObservation } from './month-observations';

/** What the coach noticed this month, as up to three lines under the charts. */
@Component({
  selector: 'app-month-noticed',
  standalone: true,
  templateUrl: './month-noticed.component.html',
  styleUrl: './month-noticed.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthNoticedComponent {
  readonly observations = input.required<readonly MonthObservation[]>();
}
