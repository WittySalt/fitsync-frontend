import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';

import { AccountDataService } from '../../../../core/account-data.service';
import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { MonthlyTrainingInsight } from '../../../../core/fitsync.models';
import { monthInsight } from './month-fixtures.spec';
import { MonthPanelComponent } from './month-panel.component';
import { MonthViewState } from './month-view.state';

describe('MonthPanelComponent', () => {
  let fixture: ComponentFixture<MonthPanelComponent>;
  let data: jasmine.SpyObj<FitSyncDataService>;

  function open(): void {
    TestBed.inject(MonthViewState).open('Asia/Singapore', '2026-09-27');
    fixture = TestBed.createComponent(MonthPanelComponent);
    fixture.detectChanges();
  }

  function text(selector: string): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector)).map((node) => node.textContent?.trim() ?? '');
  }

  function totals(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.total')).map(
      (total) => `${total.querySelector('.number')?.textContent?.trim()} ${total.querySelector('.caption')?.textContent?.trim()}`
    );
  }

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMonthlyTrainingInsight']);
    data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight()));
    const accounts = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['listBodyMetrics']);
    accounts.listBodyMetrics.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        MonthViewState,
        { provide: FitSyncDataService, useValue: data },
        { provide: AccountDataService, useValue: accounts }
      ]
    });
  });

  it('shows the month, where the figures start and the two totals', () => {
    open();
    expect(text('.title')).toEqual(['September 2026']);
    expect(text('.since')).toEqual(['Since 3 Aug']);
    expect(totals()).toEqual(['16 sessions', '13 h trained']);
  });

  it('leaves the starting line out when there is no first session', () => {
    data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight({ firstSessionDate: null })));
    open();
    expect(text('.since')).toEqual([]);
  });

  it('shows the totals as zero for an empty month, and a single session in the singular', () => {
    data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight({ days: [], totals: { sessions: 0, minutes: 0, records: 0, longestStreakDays: 0 } })));
    open();
    expect(totals()).toEqual(['0 sessions', '0 min trained']);

    data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight({ totals: { sessions: 1, minutes: 170, records: 0, longestStreakDays: 1 } })));
    TestBed.inject(MonthViewState).load();
    fixture.detectChanges();
    expect(totals()).toEqual(['1 session', '2 h 50 min trained']);
  });

  it('shows only the title while the month loads', () => {
    data.getMonthlyTrainingInsight.and.returnValue(new Subject<MonthlyTrainingInsight>() as Observable<MonthlyTrainingInsight>);
    open();
    expect(text('.title')).toEqual(['September 2026']);
    expect(text('.total')).toEqual([]);
  });
});
