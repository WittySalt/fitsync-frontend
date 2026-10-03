import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { MonthlyTrainingInsight } from '../../../../core/fitsync.models';
import { monthInsight } from './month-fixtures.spec';
import { MONTH_LINE_STORAGE_KEY, isDismissed, monthToOffer, readDismissedMonth, writeDismissedMonth } from './month-line';
import { MonthLineComponent } from './month-line.component';
import { UserTimezoneService } from '../../../../core/user-timezone.service';

describe('the first days of a month', () => {
  it('offers the month before on the first, the second and the third day', () => {
    expect(monthToOffer('2026-10-01')).toBe('2026-09');
    expect(monthToOffer('2026-10-03')).toBe('2026-09');
  });

  it('offers nothing from the fourth day on', () => {
    expect(monthToOffer('2026-10-04')).toBeNull();
    expect(monthToOffer('2026-10-31')).toBeNull();
  });

  it('crosses the turn of the year', () => {
    expect(monthToOffer('2027-01-02')).toBe('2026-12');
  });

  it('offers nothing for a date it cannot read', () => {
    expect(monthToOffer('')).toBeNull();
    expect(monthToOffer('not a date')).toBeNull();
  });
});

describe('the dismissed month in the storage', () => {
  beforeEach(() => localStorage.removeItem(MONTH_LINE_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(MONTH_LINE_STORAGE_KEY));

  it('keeps the latest month that was set aside', () => {
    writeDismissedMonth('2026-09');
    writeDismissedMonth('2026-08');
    expect(readDismissedMonth()).toBe('2026-09');
    expect(isDismissed('2026-09')).toBeTrue();
    expect(isDismissed('2026-08')).toBeTrue();
    expect(isDismissed('2026-10')).toBeFalse();
  });

  it('ignores a value that is not a month', () => {
    localStorage.setItem(MONTH_LINE_STORAGE_KEY, 'soon');
    expect(readDismissedMonth()).toBeNull();
    expect(isDismissed('2026-09')).toBeFalse();
  });

  it('lets a storage that throws pass, and then the line may show again', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    expect(() => writeDismissedMonth('2026-09')).not.toThrow();
    expect(readDismissedMonth()).toBeNull();
    expect(isDismissed('2026-09')).toBeFalse();
  });
});

describe('MonthLineComponent', () => {
  let fixture: ComponentFixture<MonthLineComponent>;
  let data: jasmine.SpyObj<FitSyncDataService>;

  function create(todayKey: string, answer: Observable<MonthlyTrainingInsight> = of(monthInsight({ month: '2026-09' }))): void {
    data.getMonthlyTrainingInsight.and.returnValue(answer);
    fixture = TestBed.createComponent(MonthLineComponent);
    fixture.componentRef.setInput('todayKey', todayKey);
    TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
    fixture.detectChanges();
  }

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const line = (): HTMLElement | null => root().querySelector('.line');
  const button = (label: string): HTMLButtonElement =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('.link')).find((entry) => entry.textContent?.trim() === label) as HTMLButtonElement;

  beforeEach(() => {
    localStorage.removeItem(MONTH_LINE_STORAGE_KEY);
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMonthlyTrainingInsight']);
    TestBed.configureTestingModule({ providers: [{ provide: FitSyncDataService, useValue: data }] });
  });

  afterEach(() => localStorage.removeItem(MONTH_LINE_STORAGE_KEY));

  it('says the month is complete and offers two buttons on the first day', () => {
    create('2026-10-01');
    expect(data.getMonthlyTrainingInsight).toHaveBeenCalledOnceWith('2026-09');
    expect(line()?.querySelector('.text')?.textContent?.trim()).toBe('September is complete.');
    const buttons = Array.from(root().querySelectorAll('button'));
    expect(buttons.map((entry) => entry.textContent?.trim())).toEqual(['See the month', 'Not now']);
    expect(buttons.every((entry) => entry.type === 'button')).toBeTrue();
  });

  it('still shows the line on the third day', () => {
    create('2026-10-03');
    expect(line()).not.toBeNull();
  });

  it('shows nothing and asks for nothing on the fourth day', () => {
    create('2026-10-04');
    expect(data.getMonthlyTrainingInsight).not.toHaveBeenCalled();
    expect(line()).toBeNull();
  });

  it('shows nothing when last month had no session', () => {
    create('2026-10-02', of(monthInsight({ month: '2026-09', totals: { sessions: 0, minutes: 0, records: 0, longestStreakDays: 0 } })));
    expect(line()).toBeNull();
  });

  it('shows nothing when the request fails', () => {
    create('2026-10-02', throwError(() => new Error('offline')));
    expect(line()).toBeNull();
  });

  it('does not ask again for a month that was set aside', () => {
    localStorage.setItem(MONTH_LINE_STORAGE_KEY, '2026-09');
    create('2026-10-02');
    expect(data.getMonthlyTrainingInsight).not.toHaveBeenCalled();
    expect(line()).toBeNull();
  });

  it('offers the next month again after an earlier one was set aside', () => {
    localStorage.setItem(MONTH_LINE_STORAGE_KEY, '2026-08');
    create('2026-10-02');
    expect(line()).not.toBeNull();
  });

  it('shows the line when the storage cannot be read', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    create('2026-10-02');
    expect(line()).not.toBeNull();
  });

  it('removes the line for good with Not now', () => {
    create('2026-10-02');
    button('Not now').click();
    fixture.detectChanges();
    expect(line()).toBeNull();
    expect(localStorage.getItem(MONTH_LINE_STORAGE_KEY)).toBe('2026-09');
  });

  it('removes the line even when the storage cannot be written', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    create('2026-10-02');
    button('Not now').click();
    fixture.detectChanges();
    expect(line()).toBeNull();
  });

  it('hands the month on with See the month and removes the line for it', () => {
    create('2026-10-02');
    const seen: string[] = [];
    fixture.componentInstance.seeMonth.subscribe((month) => seen.push(month));
    button('See the month').click();
    fixture.detectChanges();
    expect(seen).toEqual(['2026-09']);
    expect(line()).toBeNull();
    expect(localStorage.getItem(MONTH_LINE_STORAGE_KEY)).toBe('2026-09');
  });

  it('keeps the line out of sight while the month view is open, without asking again', () => {
    create('2026-10-02');
    fixture.componentRef.setInput('shown', false);
    fixture.detectChanges();
    expect(line()).toBeNull();
    fixture.componentRef.setInput('shown', true);
    fixture.detectChanges();
    expect(line()).not.toBeNull();
    expect(data.getMonthlyTrainingInsight).toHaveBeenCalledTimes(1);
  });
});
