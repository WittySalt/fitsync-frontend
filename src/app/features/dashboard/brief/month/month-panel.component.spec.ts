import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AccountDataService } from '../../../../core/account-data.service';
import { AnalyticsApiService } from '../../../../core/analytics-api.service';
import { AnalyticsAchievement } from '../../../../core/analytics.models';
import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { MonthlyTrainingInsight } from '../../../../core/fitsync.models';
import { analyticsStub, monthInsight, septemberInsight, weighIn } from './month-fixtures.spec';
import { MonthPanelComponent } from './month-panel.component';
import { MonthViewState } from './month-view.state';

function badge(code: string, unlockedAt: string | null): AnalyticsAchievement {
  return { code, title: code, unlocked: unlockedAt !== null, unlockedAt, progress: unlockedAt ? 1 : 0 };
}

describe('MonthPanelComponent', () => {
  let fixture: ComponentFixture<MonthPanelComponent>;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let accounts: jasmine.SpyObj<AccountDataService>;
  let analytics: jasmine.SpyObj<AnalyticsApiService>;

  function open(target: number | null = 4): void {
    TestBed.inject(MonthViewState).open('Asia/Singapore', '2026-09-27');
    fixture = TestBed.createComponent(MonthPanelComponent);
    fixture.componentRef.setInput('weeklyTarget', target);
    fixture.detectChanges();
  }

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function text(selector: string): string[] {
    return Array.from(root().querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function figures(): string[] {
    return Array.from(root().querySelectorAll('.figure')).map((figure) => figure.getAttribute('aria-label') ?? '');
  }

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMonthlyTrainingInsight']);
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight()));
    accounts = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['listBodyMetrics']);
    accounts.listBodyMetrics.and.returnValue(of([]));
    analytics = analyticsStub([badge('A', '2026-09-02T03:00:00Z'), badge('B', '2026-08-20T03:00:00Z'), badge('C', null)]);
    TestBed.configureTestingModule({
      providers: [
        MonthViewState,
        { provide: FitSyncDataService, useValue: data },
        { provide: AccountDataService, useValue: accounts },
        { provide: AnalyticsApiService, useValue: analytics }
      ]
    });
  });

  it('shows the month so far, the compared month and the six figures', () => {
    open();
    expect(text('.head .title')).toEqual(['September so far']);
    expect(text('.head .since')).toEqual(['Arrows compare with August.']);
    expect(figures()).toEqual([
      '17 sessions, 15 last month',
      '13 h 35 min trained, 12 h 15 min last month',
      '3 of 3 full weeks on goal',
      '6 personal records, 6 last month',
      '1 badge earned, 1 last month',
      'Longest streak 3 days, 3 last month'
    ]);
  });

  it('shows the arrows of the figures that changed and none for the equal ones', () => {
    open();
    const arrows = Array.from(root().querySelectorAll('.figure')).map((figure) => figure.querySelector('.compare')?.textContent?.trim() ?? '');
    expect(arrows).toEqual(['2', '1 h 20 min', '', '', '', '']);
    expect(root().querySelectorAll('.compare.up').length).toBe(2);
    expect(root().querySelectorAll('.compare svg[aria-hidden="true"]').length).toBe(2);
  });

  it('shows the figures in the same grid with the first month and says since when', () => {
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight({ firstSessionDate: '2026-09-13', previousTotals: null })));
    open();
    expect(text('.head .since')).toEqual(['Since you joined on 13 September.']);
    expect(root().querySelectorAll('.compare').length).toBe(0);
  });

  it('shows nothing under the title when there is neither a first month nor a month before', () => {
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight({ firstSessionDate: null, previousTotals: null })));
    open();
    expect(text('.head .since')).toEqual([]);
  });

  it('draws the radar with a labelled axis for each group trained and the bars of the weeks', () => {
    open();
    const radar = root().querySelector('app-month-radar svg');
    expect(radar?.getAttribute('role')).toBe('img');
    expect(radar?.getAttribute('aria-label')).toBe('Sessions by muscle group: Chest 8, Back 8, Core 13, Legs 8, Cardio 5');
    expect(Array.from(root().querySelectorAll('app-month-radar [data-group]')).map((node) => node.getAttribute('data-group'))).toEqual([
      'CHEST',
      'CORE',
      'LEGS',
      'BACK',
      'CARDIO'
    ]);
    expect(text('app-month-radar .label .name')).toEqual(['Chest', 'Core', 'Legs', 'Back', 'Cardio']);
    expect(text('app-month-radar .label .count')).toEqual(['8', '13', '8', '8', '5']);

    const bars = root().querySelector('app-month-week-bars svg');
    expect(bars?.getAttribute('role')).toBe('img');
    expect(bars?.getAttribute('aria-label')).toContain('week of 7 September, 4 sessions');
    expect(text('app-month-week-bars .week .count')).toEqual(['3', '4', '4', '4', '2']);
    expect(text('app-month-week-bars .week .day')).toEqual(['1', '7', '14', '21', '28']);
    expect(root().querySelectorAll('app-month-week-bars .week.open').length).toBe(1);
    expect(text('.chart-title')).toEqual(['By muscle group', 'By week']);
  });

  it('draws bars in place of the radar for two groups', () => {
    data.getMonthlyTrainingInsight.and.returnValue(
      of(septemberInsight({ muscles: [{ group: 'CHEST', label: 'Chest', sessions: 8 }, { group: 'BACK', label: 'Back', sessions: 4 }] }))
    );
    open();
    expect(root().querySelectorAll('app-month-radar polygon').length).toBe(0);
    expect(root().querySelectorAll('app-month-radar rect.bar').length).toBe(2);
  });

  it('says what the coach noticed, and nothing about what is missing', () => {
    open();
    expect(text('.noticed .title')).toEqual(['What your coach noticed this month']);
    expect(text('.noticed .headline')).toEqual([
      'Every full week reached four sessions.',
      'Six personal records this month.',
      'Three days in a row was your longest run.'
    ]);
  });

  it('takes the weight from the weigh-ins inside the month', () => {
    accounts.listBodyMetrics.and.returnValue(
      of([
        { ...weighIn('2026-09-26T02:00:00Z'), weightKg: 71.1 },
        { ...weighIn('2026-08-30T20:00:00Z'), weightKg: 99 },
        { ...weighIn('2026-09-02T02:00:00Z'), weightKg: 72.5 }
      ])
    );
    open();
    // The weigh-in of 99 kg falls on 31 August in Singapore, so it is not part of September.
    expect(text('.noticed .headline')[2]).toBe('Your weight is down 1.4 kg.');
    expect(text('.noticed .note')[2]).toBe('From 72.5 to 71.1 kg this month.');
    expect(accounts.listBodyMetrics).toHaveBeenCalledTimes(1);
  });

  it('shows zeros and no chart or observation for a month without sessions', () => {
    data.getMonthlyTrainingInsight.and.returnValue(
      of(monthInsight({ days: [], weeks: [], muscles: [], totals: { sessions: 0, minutes: 0, records: 0, longestStreakDays: 0 }, previousTotals: null }))
    );
    analytics.getAchievements.and.returnValue(of({ achievements: [] }));
    open(null);
    expect(figures()).toEqual(['0 sessions', '0 min trained', '0 full weeks trained', '0 personal records', '0 badges earned', 'Longest streak 0 days']);
    expect(root().querySelector('.charts')).toBeNull();
    expect(root().querySelector('app-month-noticed')).toBeNull();
  });

  it('keeps the charts out when there is nothing to chart but leaves the observations', () => {
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight({ muscles: [], weeks: [] })));
    open();
    expect(root().querySelector('.charts')).toBeNull();
    expect(text('.noticed .headline')[0]).toBe('Six personal records this month.');
  });

  it('shows blocks in the shape of the figures and the charts while the month loads', () => {
    data.getMonthlyTrainingInsight.and.returnValue(new Subject<MonthlyTrainingInsight>() as Observable<MonthlyTrainingInsight>);
    open();
    expect(text('.head .title')).toEqual(['September so far']);
    expect(root().querySelector('.loading')?.getAttribute('aria-busy')).toBe('true');
    expect(root().querySelectorAll('.block-figure').length).toBe(6);
    expect(root().querySelectorAll('.block-charts').length).toBe(1);
    expect(root().querySelector('.figure')).toBeNull();
  });

  it('keeps only the title when the month cannot be loaded', () => {
    data.getMonthlyTrainingInsight.and.returnValue(throwError(() => new Error('offline')));
    open();
    expect(text('.head .title')).toEqual(['September so far']);
    expect(root().querySelector('.loading')).toBeNull();
    expect(root().querySelector('.figure')).toBeNull();
    expect(root().querySelector('.charts')).toBeNull();
  });

  it('names a past month plainly', () => {
    TestBed.inject(MonthViewState).open('Asia/Singapore', '2026-09-27');
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight({ month: '2026-08', monthStart: '2026-08-01', monthEnd: '2026-08-31', previousTotals: null })));
    TestBed.inject(MonthViewState).step(-1);
    fixture = TestBed.createComponent(MonthPanelComponent);
    fixture.detectChanges();
    expect(text('.head .title')).toEqual(['August']);
  });

  describe('badges', () => {
    it('shows a dash while they load and the figure is back with a count once they have', () => {
      const pending = new Subject<{ achievements: AnalyticsAchievement[] }>();
      analytics.getAchievements.and.returnValue(pending);
      open();
      expect(text('[data-figure="badges"] .value')).toEqual(['–']);

      pending.next({ achievements: [badge('A', '2026-09-02T03:00:00Z')] });
      fixture.detectChanges();
      expect(text('[data-figure="badges"] .value')).toEqual(['1']);
    });

    it('leaves the figure out when the request failed, and the other five still fill the grid', () => {
      analytics.getAchievements.and.returnValue(throwError(() => new Error('offline')));
      open();
      expect(root().querySelector('[data-figure="badges"]')).toBeNull();
      expect(root().querySelectorAll('.figure').length).toBe(5);
    });
  });
});
