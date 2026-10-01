import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { monthTitle } from './month-grid';
import { MonthViewState } from './month-view.state';

/** The month's name between the two arrows that turn to the month before and the one after. It
 *  takes the place of the week view's label, in the row that also holds the week and month switch. */
@Component({
  selector: 'app-month-nav',
  standalone: true,
  templateUrl: './month-nav.component.html',
  styleUrl: './month-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthNavComponent {
  protected readonly state = inject(MonthViewState);
  protected readonly title = computed(() => monthTitle(this.state.month()));
}
