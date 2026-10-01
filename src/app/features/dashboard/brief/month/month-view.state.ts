import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AccountDataService } from '../../../../core/account-data.service';
import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { MonthlyTrainingInsight } from '../../../../core/fitsync.models';
import { dateKeyInTimezone, daysInMonth, monthOfDate, shiftMonth } from './month-grid';

export type MonthLoadStatus = 'loading' | 'ready' | 'error';

/** The most weigh-ins one request may ask for, which is the limit the user service allows. */
const WEIGH_IN_LIMIT = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What the month view shows and where it is. The navigation, the calendar and the panel sit in
 * three places of the brief, so they share one instance that the brief provides and discards with
 * itself: the brief always opens in the week view and does not remember the month it showed.
 */
@Injectable()
export class MonthViewState implements OnDestroy {
  private readonly data = inject(FitSyncDataService);
  private readonly accounts = inject(AccountDataService);

  private timezone = 'UTC';
  private requests: Subscription[] = [];

  /** The month shown, as YYYY-MM. Empty until the view is opened. */
  readonly month = signal('');
  readonly status = signal<MonthLoadStatus>('loading');
  readonly insight = signal<MonthlyTrainingInsight | null>(null);
  readonly weighIns = signal<ReadonlySet<string>>(new Set<string>());

  // The reference date and the first session date come with every response. They are kept after a
  // month has loaded, so the arrows know their limits while the next month is still loading.
  private readonly bounds = signal<{ referenceDate: string; firstSessionDate: string | null } | null>(null);
  private readonly openedOn = signal('');

  readonly referenceDate = computed(() => this.bounds()?.referenceDate || this.openedOn());
  readonly firstSessionDate = computed(() => this.bounds()?.firstSessionDate ?? null);

  readonly canGoNext = computed(() => this.month() < monthOfDate(this.referenceDate()));
  readonly canGoPrevious = computed(() => this.month() > monthOfDate(this.firstSessionDate() ?? this.referenceDate()));

  /** Opens the view on the month that contains today and loads it. */
  open(timezone: string, todayKey: string): void {
    this.timezone = timezone;
    this.openedOn.set(todayKey);
    this.bounds.set(null);
    this.month.set(monthOfDate(todayKey));
    this.load();
  }

  step(delta: number): void {
    if ((delta < 0 && !this.canGoPrevious()) || (delta > 0 && !this.canGoNext())) {
      return;
    }
    this.month.set(shiftMonth(this.month(), delta));
    this.load();
  }

  load(): void {
    this.cancel();
    const month = this.month();
    this.status.set('loading');
    this.insight.set(null);
    this.weighIns.set(new Set<string>());

    this.requests.push(
      this.data.getMonthlyTrainingInsight(month, this.timezone).subscribe({
        next: (insight) => {
          this.bounds.set({ referenceDate: insight.referenceDate, firstSessionDate: insight.firstSessionDate });
          this.insight.set(insight);
          this.status.set('ready');
        },
        error: () => this.status.set('error')
      })
    );

    // The weigh-ins only add marks, so a failed request leaves the marks out and nothing else.
    const from = new Date(Date.parse(`${month}-01T00:00:00Z`) - DAY_MS).toISOString();
    const to = new Date(Date.parse(`${month}-${String(daysInMonth(month)).padStart(2, '0')}T00:00:00Z`) + 2 * DAY_MS).toISOString();
    this.requests.push(
      this.accounts.listBodyMetrics({ from, to, limit: WEIGH_IN_LIMIT }).subscribe({
        next: (metrics) => {
          const dates = new Set<string>();
          for (const metric of metrics ?? []) {
            const key = metric.weightKg != null ? dateKeyInTimezone(metric.measuredAt, this.timezone) : null;
            if (key) {
              dates.add(key);
            }
          }
          this.weighIns.set(dates);
        },
        error: () => this.weighIns.set(new Set<string>())
      })
    );
  }

  ngOnDestroy(): void {
    this.cancel();
  }

  // Leaving the month before its answer arrives must not let that answer draw over the next one.
  private cancel(): void {
    this.requests.forEach((request) => request.unsubscribe());
    this.requests = [];
  }
}
