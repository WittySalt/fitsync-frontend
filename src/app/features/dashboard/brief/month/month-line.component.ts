import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';

import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { monthNameOf } from './month-grid';
import { isDismissed, monthToOffer, writeDismissedMonth } from './month-line';

/** One quiet line under the greeting on the first days of a month, which offers the month that has
 *  just ended when it had a session. It asks for that month only on those days, and only while the
 *  line has not been set aside, and a failed request simply leaves the line out. */
@Component({
  selector: 'app-month-line',
  standalone: true,
  templateUrl: './month-line.component.html',
  styleUrl: './month-line.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthLineComponent {
  private readonly data = inject(FitSyncDataService);
  private request: Subscription | null = null;

  /** Today as YYYY-MM-DD in the timezone of the person. */
  readonly todayKey = input.required<string>();
  readonly timezone = input.required<string>();
  /** False while the month view is open, which has no room for the line. */
  readonly shown = input(true);

  /** Asked for when the person wants to see the month, with the month as YYYY-MM. */
  readonly seeMonth = output<string>();

  // The month on offer once it is known to hold a session and has not been set aside.
  private readonly offered = signal<string | null>(null);

  protected readonly month = computed(() => (this.shown() ? this.offered() : null));
  protected readonly monthName = computed(() => monthNameOf(this.month() ?? ''));

  constructor() {
    effect(() => {
      const candidate = monthToOffer(this.todayKey());
      const timezone = this.timezone();
      untracked(() => this.check(candidate, timezone));
    });
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  protected see(): void {
    const month = this.offered();
    if (month) {
      this.settle(month);
      this.seeMonth.emit(month);
    }
  }

  protected dismiss(): void {
    const month = this.offered();
    if (month) {
      this.settle(month);
    }
  }

  private settle(month: string): void {
    writeDismissedMonth(month);
    this.offered.set(null);
  }

  private check(candidate: string | null, timezone: string): void {
    this.request?.unsubscribe();
    this.request = null;
    this.offered.set(null);
    if (!candidate || isDismissed(candidate)) {
      return;
    }
    this.request = this.data.getMonthlyTrainingInsight(candidate, timezone).subscribe({
      next: (insight) => this.offered.set(insight.totals.sessions > 0 ? candidate : null),
      error: () => this.offered.set(null)
    });
  }
}
