import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AccountDataService } from '../../../../core/account-data.service';
import { AnalyticsApiService } from '../../../../core/analytics-api.service';
import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { MonthlyTrainingInsight } from '../../../../core/fitsync.models';
import { analyticsStub, monthInsight } from './month-fixtures.spec';
import { MonthNavComponent } from './month-nav.component';
import { MonthViewState } from './month-view.state';
import { UserTimezoneService } from '../../../../core/user-timezone.service';

describe('MonthNavComponent', () => {
  let fixture: ComponentFixture<MonthNavComponent>;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let state: MonthViewState;
  let response: MonthlyTrainingInsight;

  function arrow(label: string): HTMLButtonElement {
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    if (!button) {
      throw new Error(`No ${label} button`);
    }
    return button;
  }

  function title(): string {
    return (fixture.nativeElement as HTMLElement).querySelector('.title')?.textContent?.trim() ?? '';
  }

  function open(): void {
    state = TestBed.inject(MonthViewState);
    TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
    state.open('2026-09-27');
    fixture = TestBed.createComponent(MonthNavComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    response = monthInsight();
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMonthlyTrainingInsight']);
    data.getMonthlyTrainingInsight.and.callFake((month: string) =>
      of({ ...response, month, monthStart: `${month}-01`, monthEnd: `${month}-28` })
    );
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
  });

  it('shows the month and the year between the two arrows', () => {
    open();
    expect(title()).toBe('September 2026');
    expect(data.getMonthlyTrainingInsight).toHaveBeenCalledOnceWith('2026-09');
  });

  it('disables the next arrow on the month of the reference date', () => {
    open();
    expect(arrow('Next month').disabled).toBeTrue();
    expect(arrow('Previous month').disabled).toBeFalse();
  });

  it('disables the previous arrow on the month of the first session', () => {
    open();
    arrow('Previous month').click();
    fixture.detectChanges();
    expect(title()).toBe('August 2026');
    expect(arrow('Previous month').disabled).toBeTrue();
    expect(arrow('Next month').disabled).toBeFalse();
  });

  it('disables the previous arrow on the current month when there is no first session yet', () => {
    response = monthInsight({ firstSessionDate: null });
    open();
    expect(arrow('Previous month').disabled).toBeTrue();
    expect(arrow('Next month').disabled).toBeTrue();
  });

  it('loads the month it turns to with the right month parameter, and the month it comes back to', () => {
    response = monthInsight({ firstSessionDate: '2026-06-10' });
    open();
    arrow('Previous month').click();
    fixture.detectChanges();
    expect(data.getMonthlyTrainingInsight.calls.mostRecent().args).toEqual(['2026-08']);
    arrow('Previous month').click();
    fixture.detectChanges();
    expect(data.getMonthlyTrainingInsight.calls.mostRecent().args).toEqual(['2026-07']);
    arrow('Next month').click();
    fixture.detectChanges();
    expect(data.getMonthlyTrainingInsight.calls.mostRecent().args).toEqual(['2026-08']);
    expect(title()).toBe('August 2026');
  });

  it('crosses a year when it turns back from January', () => {
    response = monthInsight({ firstSessionDate: '2025-11-02', referenceDate: '2026-01-15' });
    state = TestBed.inject(MonthViewState);
    TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
    state.open('2026-01-15');
    fixture = TestBed.createComponent(MonthNavComponent);
    fixture.detectChanges();
    arrow('Previous month').click();
    fixture.detectChanges();
    expect(title()).toBe('December 2025');
    expect(data.getMonthlyTrainingInsight.calls.mostRecent().args[0]).toBe('2025-12');
  });

  it('ignores a step past either limit', () => {
    open();
    state.step(1);
    expect(state.month()).toBe('2026-09');
    state.step(-1);
    state.step(-1);
    expect(state.month()).toBe('2026-08');
    expect(data.getMonthlyTrainingInsight).toHaveBeenCalledTimes(2);
  });
});
