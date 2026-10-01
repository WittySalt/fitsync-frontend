import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AccountDataService } from '../../../../core/account-data.service';
import { AnalyticsApiService } from '../../../../core/analytics-api.service';
import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { analyticsStub, monthInsight, weighIn } from './month-fixtures.spec';
import { MonthViewState } from './month-view.state';

describe('MonthViewState badges and weights', () => {
  let state: MonthViewState;
  let accounts: jasmine.SpyObj<AccountDataService>;
  let analytics: jasmine.SpyObj<AnalyticsApiService>;

  beforeEach(() => {
    const data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMonthlyTrainingInsight']);
    data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight()));
    accounts = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['listBodyMetrics']);
    accounts.listBodyMetrics.and.returnValue(of([]));
    analytics = analyticsStub([
      { code: 'A', title: 'A', unlocked: true, unlockedAt: '2026-09-24T18:30:00Z', progress: 1 },
      { code: 'B', title: 'B', unlocked: false, unlockedAt: null, progress: 0.4 },
      { code: 'C', title: 'C', unlocked: true, unlockedAt: null, progress: 1 }
    ]);
    TestBed.configureTestingModule({
      providers: [
        MonthViewState,
        { provide: FitSyncDataService, useValue: data },
        { provide: AccountDataService, useValue: accounts },
        { provide: AnalyticsApiService, useValue: analytics }
      ]
    });
    state = TestBed.inject(MonthViewState);
  });

  it('reads the dates of the earned badges in the timezone of the person', () => {
    state.open('Asia/Singapore', '2026-09-27');
    expect(state.badgeStatus()).toBe('ready');
    expect(state.badgeDates()).toEqual(['2026-09-25']);
  });

  it('asks for the badges once, however often the month changes or the view is opened', () => {
    state.open('Asia/Singapore', '2026-09-27');
    state.step(-1);
    state.step(1);
    state.open('Asia/Singapore', '2026-09-27');
    expect(analytics.getAchievements).toHaveBeenCalledTimes(1);
  });

  it('treats a failed request as no badge figure and asks again at the next opening', () => {
    analytics.getAchievements.and.returnValue(throwError(() => new Error('offline')));
    state.open('Asia/Singapore', '2026-09-27');
    expect(state.badgeStatus()).toBe('failed');
    expect(state.badgeDates()).toEqual([]);

    analytics.getAchievements.and.returnValue(of({ achievements: [] }));
    state.open('Asia/Singapore', '2026-09-27');
    expect(analytics.getAchievements).toHaveBeenCalledTimes(2);
    expect(state.badgeStatus()).toBe('ready');
  });

  it('keeps the first and the last weight of the month from the one weigh-in request', () => {
    accounts.listBodyMetrics.and.returnValue(
      of([
        { ...weighIn('2026-09-20T02:00:00Z'), weightKg: 71.4 },
        { ...weighIn('2026-09-02T02:00:00Z'), weightKg: 72.5 },
        { ...weighIn('2026-09-26T02:00:00Z'), weightKg: 71.1 },
        { ...weighIn('2026-10-01T02:00:00Z'), weightKg: 60 },
        { ...weighIn('2026-09-10T02:00:00Z'), weightKg: null }
      ])
    );
    state.open('Asia/Singapore', '2026-09-27');
    expect(state.weights()).toEqual({ first: 72.5, last: 71.1, count: 3 });
    expect(accounts.listBodyMetrics).toHaveBeenCalledTimes(1);
  });

  it('has no weights without a weigh-in or when the request failed', () => {
    state.open('Asia/Singapore', '2026-09-27');
    expect(state.weights()).toBeNull();

    accounts.listBodyMetrics.and.returnValue(throwError(() => new Error('offline')));
    state.load();
    expect(state.weights()).toBeNull();
  });
});
