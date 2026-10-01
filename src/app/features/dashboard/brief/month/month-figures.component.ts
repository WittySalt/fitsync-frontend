import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { MonthFigure } from './month-figures';

/** The six figures of the month panel in a grid. Each is one labelled group, so a screen reader
 *  hears "17 sessions, 15 last month" and not the arrow and the loose numbers around it. */
@Component({
  selector: 'app-month-figures',
  standalone: true,
  templateUrl: './month-figures.component.html',
  styleUrl: './month-figures.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthFiguresComponent {
  readonly figures = input.required<readonly MonthFigure[]>();
}
