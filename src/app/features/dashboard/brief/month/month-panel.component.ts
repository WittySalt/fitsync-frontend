import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { formatDuration } from '../brief-duration';
import { monthTitle, shortDate } from './month-grid';
import { MonthViewState } from './month-view.state';

/** The body of the dark panel in the month view: the month, where the figures start, and the two
 *  totals. A later change fills the rest of the panel. */
@Component({
  selector: 'app-month-panel',
  standalone: true,
  templateUrl: './month-panel.component.html',
  styleUrl: './month-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthPanelComponent {
  private readonly state = inject(MonthViewState);

  protected readonly title = computed(() => monthTitle(this.state.month()));
  protected readonly since = computed(() => {
    const first = this.state.firstSessionDate();
    return first ? `Since ${shortDate(first)}` : null;
  });
  protected readonly totals = computed(() => {
    const insight = this.state.insight();
    if (!insight) {
      return null;
    }
    const { sessions, minutes } = insight.totals;
    return {
      sessions,
      sessionsLabel: sessions === 1 ? 'session' : 'sessions',
      duration: formatDuration(minutes)
    };
  });
}
