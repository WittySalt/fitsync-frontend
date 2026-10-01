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

describe('MonthViewState selection', () => {
  let state: MonthViewState;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let accounts: jasmine.SpyObj<AccountDataService>;

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMonthlyTrainingInsight']);
    data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight()));
    accounts = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['listBodyMetrics']);
    accounts.listBodyMetrics.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        MonthViewState,
        { provide: FitSyncDataService, useValue: data },
        { provide: AccountDataService, useValue: accounts },
        { provide: AnalyticsApiService, useValue: analyticsStub() }
      ]
    });
    state = TestBed.inject(MonthViewState);
    state.open('Asia/Singapore', '2026-09-27');
  });

  it('picks a date and lets go of it when it is picked again', () => {
    state.selectDay('2026-09-04');
    expect(state.selectedDate()).toBe('2026-09-04');
    state.selectDay('2026-09-03');
    expect(state.selectedDate()).toBe('2026-09-03');
    state.selectDay('2026-09-03');
    expect(state.selectedDate()).toBeNull();
  });

  it('picks a muscle group and lets go of it when it is picked again', () => {
    state.selectMuscle('CHEST');
    expect(state.selectedMuscle()).toBe('CHEST');
    state.selectMuscle('CHEST');
    expect(state.selectedMuscle()).toBeNull();
  });

  it('keeps one pick at a time, the later one replacing the earlier', () => {
    state.selectDay('2026-09-04');
    state.selectMuscle('CHEST');
    expect(state.selectedDate()).toBeNull();
    expect(state.selectedMuscle()).toBe('CHEST');
    state.selectDay('2026-09-05');
    expect(state.selectedMuscle()).toBeNull();
    expect(state.selectedDate()).toBe('2026-09-05');
  });

  it('lets go of the pick when the month changes or the view is opened again', () => {
    state.selectDay('2026-09-04');
    state.step(-1);
    expect(state.selectedDate()).toBeNull();
    state.selectMuscle('CHEST');
    state.open('Asia/Singapore', '2026-09-27');
    expect(state.selectedMuscle()).toBeNull();
  });

  it('lets go of the pick and, when asked, names where the focus should go back to', () => {
    state.selectDay('2026-09-04');
    state.clearSelection(true);
    expect(state.selectedDate()).toBeNull();
    expect(state.focusTarget()).toEqual({ kind: 'day', key: '2026-09-04' });
    state.selectMuscle('LEGS');
    state.clearSelection(true);
    expect(state.focusTarget()).toEqual({ kind: 'muscle', key: 'LEGS' });
  });

  it('does not ask for the focus when the pick is let go of without a button', () => {
    state.selectDay('2026-09-04');
    state.clearSelection();
    expect(state.focusTarget()).toBeNull();
  });

  it('keeps the weight of every weigh-in date, the latest of a date winning', () => {
    accounts.listBodyMetrics.and.returnValue(
      of([
        { ...weighIn('2026-09-20T02:00:00Z'), weightKg: 71.4 },
        { ...weighIn('2026-09-20T12:00:00Z'), weightKg: 71.2 },
        { ...weighIn('2026-09-02T02:00:00Z'), weightKg: 72.5 },
        { ...weighIn('2026-09-10T02:00:00Z'), weightKg: null }
      ])
    );
    state.load();
    expect(state.weightByDate().get('2026-09-20')).toBe(71.2);
    expect(state.weightByDate().get('2026-09-02')).toBe(72.5);
    expect(state.weightByDate().has('2026-09-10')).toBeFalse();
  });

  it('has no weights when the weigh-in request failed', () => {
    accounts.listBodyMetrics.and.returnValue(throwError(() => new Error('offline')));
    state.load();
    expect(state.weightByDate().size).toBe(0);
  });
});

describe('MonthViewState opened on a given month', () => {
  let state: MonthViewState;
  let data: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMonthlyTrainingInsight']);
    data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight({ month: '2026-09', referenceDate: '2026-10-02' })));
    const accounts = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['listBodyMetrics']);
    accounts.listBodyMetrics.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        MonthViewState,
        { provide: FitSyncDataService, useValue: data },
        { provide: AccountDataService, useValue: accounts },
        { provide: AnalyticsApiService, useValue: analyticsStub() }
      ]
    });
    state = TestBed.inject(MonthViewState);
  });

  it('shows the month it was asked for and loads that one', () => {
    state.open('Asia/Singapore', '2026-10-02', '2026-09');
    expect(state.month()).toBe('2026-09');
    expect(data.getMonthlyTrainingInsight).toHaveBeenCalledOnceWith('2026-09', 'Asia/Singapore');
  });

  it('keeps the limits of the arrows', () => {
    state.open('Asia/Singapore', '2026-10-02', '2026-09');
    expect(state.canGoNext()).toBeTrue();
    expect(state.canGoPrevious()).toBeTrue();
    state.step(1);
    expect(state.month()).toBe('2026-10');
    expect(state.canGoNext()).toBeFalse();
  });

  it('still opens on the month of today when none is given', () => {
    state.open('Asia/Singapore', '2026-10-02');
    expect(state.month()).toBe('2026-10');
  });
});
