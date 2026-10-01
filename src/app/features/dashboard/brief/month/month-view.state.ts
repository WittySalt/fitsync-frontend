import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AccountDataService } from '../../../../core/account-data.service';
import { AnalyticsApiService } from '../../../../core/analytics-api.service';
import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { MonthlyTrainingInsight } from '../../../../core/fitsync.models';
import { dateKeyInTimezone, daysInMonth, monthOfDate, shiftMonth } from './month-grid';

export type MonthLoadStatus = 'loading' | 'ready' | 'error';

/** Where the badge dates stand. They are loaded once for the whole view, and a failed request
 *  leaves the badge figure out. */
export type BadgeLoadStatus = 'loading' | 'ready' | 'failed';

/** The first and the last weight of the shown month, from the weigh-ins inside it. */
export interface MonthWeights {
  first: number;
  last: number;
  count: number;
}

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
  private readonly analytics = inject(AnalyticsApiService);

  private timezone = 'UTC';
  private requests: Subscription[] = [];
  private badgeRequest: Subscription | null = null;
  private badgesInFlight = false;

  /** The month shown, as YYYY-MM. Empty until the view is opened. */
  readonly month = signal('');
  readonly status = signal<MonthLoadStatus>('loading');
  readonly insight = signal<MonthlyTrainingInsight | null>(null);
  readonly weighIns = signal<ReadonlySet<string>>(new Set<string>());
  readonly weights = signal<MonthWeights | null>(null);
  /** The dates, as YYYY-MM-DD in the person's timezone, on which a badge was earned. */
  readonly badgeDates = signal<readonly string[]>([]);
  readonly badgeStatus = signal<BadgeLoadStatus>('loading');

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
    this.loadBadges();
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
    this.weights.set(null);

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

    // The weigh-ins add the marks and the weight line of the observations, so a failed request leaves
    // those out and nothing else.
    const from = new Date(Date.parse(`${month}-01T00:00:00Z`) - DAY_MS).toISOString();
    const to = new Date(Date.parse(`${month}-${String(daysInMonth(month)).padStart(2, '0')}T00:00:00Z`) + 2 * DAY_MS).toISOString();
    this.requests.push(
      this.accounts.listBodyMetrics({ from, to, limit: WEIGH_IN_LIMIT }).subscribe({
        next: (metrics) => {
          const dates = new Set<string>();
          const inMonth: { time: number; weightKg: number }[] = [];
          for (const metric of metrics ?? []) {
            const key = metric.weightKg != null ? dateKeyInTimezone(metric.measuredAt, this.timezone) : null;
            if (key) {
              dates.add(key);
              if (monthOfDate(key) === month) {
                inMonth.push({ time: Date.parse(metric.measuredAt ?? ''), weightKg: metric.weightKg as number });
              }
            }
          }
          this.weighIns.set(dates);
          inMonth.sort((a, b) => a.time - b.time);
          this.weights.set(
            inMonth.length > 0
              ? { first: inMonth[0].weightKg, last: inMonth[inMonth.length - 1].weightKg, count: inMonth.length }
              : null
          );
        },
        error: () => {
          this.weighIns.set(new Set<string>());
          this.weights.set(null);
        }
      })
    );
  }

  // The badges do not depend on the month, so they are asked for once and kept while the brief
  // lives. Only a request that failed is asked again, when the view is opened the next time.
  private loadBadges(): void {
    if (this.badgeStatus() === 'ready' || this.badgesInFlight) {
      return;
    }
    this.badgeStatus.set('loading');
    this.badgesInFlight = true;
    this.badgeRequest = this.analytics.getAchievements().subscribe({
      next: (response) => {
        const dates: string[] = [];
        for (const badge of response.achievements) {
          const key = badge.unlocked ? dateKeyInTimezone(badge.unlockedAt, this.timezone) : null;
          if (key) {
            dates.push(key);
          }
        }
        this.badgeDates.set(dates);
        this.badgeStatus.set('ready');
        this.badgesInFlight = false;
      },
      error: () => {
        this.badgeDates.set([]);
        this.badgeStatus.set('failed');
        this.badgesInFlight = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.cancel();
    this.badgeRequest?.unsubscribe();
  }

  // Leaving the month before its answer arrives must not let that answer draw over the next one.
  private cancel(): void {
    this.requests.forEach((request) => request.unsubscribe());
    this.requests = [];
  }
}
