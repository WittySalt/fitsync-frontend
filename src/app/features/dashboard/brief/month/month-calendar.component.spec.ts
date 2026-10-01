import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AccountDataService } from '../../../../core/account-data.service';
import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { MonthlyTrainingInsight } from '../../../../core/fitsync.models';
import { MonthCalendarComponent } from './month-calendar.component';
import { monthInsight, weighIn } from './month-fixtures.spec';
import { MonthViewState } from './month-view.state';

describe('MonthCalendarComponent', () => {
  let fixture: ComponentFixture<MonthCalendarComponent>;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let accounts: jasmine.SpyObj<AccountDataService>;
  let state: MonthViewState;

  function open(): void {
    state = TestBed.inject(MonthViewState);
    state.open('Asia/Singapore', '2026-09-27');
    fixture = TestBed.createComponent(MonthCalendarComponent);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function cell(dateKey: string): HTMLButtonElement {
    const found = element().querySelector<HTMLButtonElement>(`[data-date="${dateKey}"]`);
    if (!found) {
      throw new Error(`No cell for ${dateKey}`);
    }
    return found;
  }

  function legendLabels(): string[] {
    return Array.from(element().querySelectorAll('.legend li')).map((item) => item.textContent?.trim() ?? '');
  }

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMonthlyTrainingInsight']);
    data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight()));
    accounts = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['listBodyMetrics']);
    accounts.listBodyMetrics.and.returnValue(of([weighIn('2026-09-05T02:00:00Z')]));
    TestBed.configureTestingModule({
      providers: [
        MonthViewState,
        { provide: FitSyncDataService, useValue: data },
        { provide: AccountDataService, useValue: accounts }
      ]
    });
  });

  it('draws one button for each date and a blank cell around them', () => {
    open();
    expect(element().querySelectorAll('button.cell').length).toBe(30);
    expect(element().querySelectorAll('.cell.blank').length).toBe(5);
    expect(Array.from(element().querySelectorAll('.weekdays span')).map((node) => node.textContent?.trim()).join('')).toBe('MTWTFSS');
  });

  it('draws a training day with its glyph on the trained tile', () => {
    open();
    const trained = cell('2026-09-04');
    expect(trained.classList).toContain('trained');
    expect(trained.querySelector('svg.glyph')).not.toBeNull();
    expect(cell('2026-09-06').querySelector('svg.glyph')).toBeNull();
  });

  it('gives the cells the state they are drawn in', () => {
    open();
    expect(cell('2026-09-27').classList).toContain('trained');
    expect(cell('2026-09-27').classList).toContain('today');
    expect(cell('2026-09-10').classList).toContain('empty');
    expect(cell('2026-09-28').classList).toContain('future');
  });

  it('draws the dates before the first session as blank cells', () => {
    data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight({ firstSessionDate: '2026-09-13' })));
    open();
    expect(cell('2026-09-12').classList).toContain('before');
    expect(cell('2026-09-13').classList).toContain('empty');
  });

  it('puts a band behind the row of the reference date only', () => {
    open();
    const bands = element().querySelectorAll('.row.current');
    expect(bands.length).toBe(1);
    expect(bands[0].contains(cell('2026-09-27'))).toBeTrue();
  });

  it('names each date for a screen reader', () => {
    open();
    expect(cell('2026-09-03').getAttribute('aria-label')).toBe('Thursday 3 September, cardio, 35 min, record');
    expect(cell('2026-09-10').getAttribute('aria-label')).toBe('Thursday 10 September, nothing logged');
    expect(cell('2026-09-04').getAttribute('aria-label')).toBe('Friday 4 September, strength, 50 min');
  });

  describe('marks', () => {
    it('shows a scale mark on a weigh-in and a trophy on a record, and both side by side', () => {
      accounts.listBodyMetrics.and.returnValue(of([weighIn('2026-09-05T02:00:00Z'), weighIn('2026-09-03T02:00:00Z')]));
      open();
      expect(cell('2026-09-05').querySelectorAll('.mark').length).toBe(1);
      expect(cell('2026-09-05').querySelector('.mark-weigh-in')).not.toBeNull();
      expect(cell('2026-09-04').querySelector('.marks')).toBeNull();
      const both = cell('2026-09-03');
      expect(both.querySelector('.mark-weigh-in')).not.toBeNull();
      expect(both.querySelector('.mark-record')).not.toBeNull();
      expect(both.getAttribute('aria-label')).toBe('Thursday 3 September, cardio, 35 min, record, weigh-in');
    });

    it('leaves the weigh-in marks out when that request fails, and keeps the rest', () => {
      accounts.listBodyMetrics.and.returnValue(throwError(() => new Error('offline')));
      open();
      expect(element().querySelector('.mark-weigh-in')).toBeNull();
      expect(element().querySelector('.mark-record')).not.toBeNull();
      expect(element().querySelector('.state')).toBeNull();
    });

    it('reads a weigh-in on the date of the timezone of the brief', () => {
      // 17:30 UTC on the 4th is 01:30 on the 5th in Singapore.
      accounts.listBodyMetrics.and.returnValue(of([weighIn('2026-09-04T17:30:00Z')]));
      open();
      expect(cell('2026-09-05').querySelector('.mark-weigh-in')).not.toBeNull();
      expect(cell('2026-09-04').querySelector('.mark-weigh-in')).toBeNull();
    });
  });

  describe('legend', () => {
    it('lists six items when no date comes before the first session', () => {
      open();
      expect(legendLabels()).toEqual(['Strength', 'Cardio', 'Mobility', 'Sport', 'Weigh-in', 'Record']);
    });

    it('adds a seventh item when the month holds dates before the first session', () => {
      data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight({ firstSessionDate: '2026-09-13' })));
      open();
      expect(legendLabels()).toEqual(['Strength', 'Cardio', 'Mobility', 'Sport', 'Weigh-in', 'Record', 'Before you joined']);
    });
  });

  describe('keyboard', () => {
    function press(target: HTMLElement, key: string): void {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    }

    it('keeps only today in the tab order at first', () => {
      open();
      const tabbable = Array.from(element().querySelectorAll<HTMLButtonElement>('button.cell')).filter((button) => button.tabIndex === 0);
      expect(tabbable.map((button) => button.dataset['date'])).toEqual(['2026-09-27']);
    });

    it('moves a day with the left and right arrows and a week with the up and down arrows', () => {
      open();
      press(cell('2026-09-10'), 'ArrowRight');
      expect(document.activeElement).toBe(cell('2026-09-11'));
      press(cell('2026-09-11'), 'ArrowLeft');
      press(cell('2026-09-10'), 'ArrowDown');
      expect(document.activeElement).toBe(cell('2026-09-17'));
      press(cell('2026-09-17'), 'ArrowUp');
      expect(document.activeElement).toBe(cell('2026-09-10'));
    });

    it('goes to the ends of the week with Home and End', () => {
      open();
      // 10 September 2026 is a Thursday: the week runs from the 7th to the 13th.
      press(cell('2026-09-10'), 'Home');
      expect(document.activeElement).toBe(cell('2026-09-07'));
      press(cell('2026-09-07'), 'End');
      expect(document.activeElement).toBe(cell('2026-09-13'));
    });

    it('stays on the first and last dates of the month', () => {
      open();
      cell('2026-09-01').focus();
      press(cell('2026-09-01'), 'ArrowLeft');
      expect(document.activeElement).toBe(cell('2026-09-01'));
      cell('2026-09-30').focus();
      press(cell('2026-09-30'), 'ArrowDown');
      press(cell('2026-09-30'), 'ArrowRight');
      expect(document.activeElement).toBe(cell('2026-09-30'));
    });

    it('clips Home and End to the month', () => {
      open();
      press(cell('2026-09-02'), 'Home');
      expect(document.activeElement).toBe(cell('2026-09-01'));
      press(cell('2026-09-29'), 'End');
      expect(document.activeElement).toBe(cell('2026-09-30'));
    });

    it('ignores other keys', () => {
      open();
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
      cell('2026-09-10').dispatchEvent(event);
      expect(event.defaultPrevented).toBeFalse();
    });

    it('moves the tab stop with the focus', () => {
      open();
      cell('2026-09-10').focus();
      fixture.detectChanges();
      expect(cell('2026-09-10').tabIndex).toBe(0);
      expect(cell('2026-09-27').tabIndex).toBe(-1);
    });
  });

  it('emits the date of a cell when it is pressed and changes nothing else', () => {
    open();
    const emitted: string[] = [];
    fixture.componentInstance.daySelected.subscribe((date) => emitted.push(date));
    cell('2026-09-04').click();
    fixture.detectChanges();
    expect(emitted).toEqual(['2026-09-04']);
    expect(state.month()).toBe('2026-09');
  });

  describe('states', () => {
    it('keeps the size of the grid with skeleton cells while the month loads', () => {
      const pending = new Subject<MonthlyTrainingInsight>();
      data.getMonthlyTrainingInsight.and.returnValue(pending as Observable<MonthlyTrainingInsight>);
      open();
      expect(element().querySelector('.grid')?.getAttribute('aria-busy')).toBe('true');
      expect(element().querySelectorAll('.cell.skeleton').length).toBe(30);
      expect(element().querySelectorAll('button.cell').length).toBe(0);
      expect(element().querySelectorAll('.row').length).toBe(5);

      pending.next(monthInsight());
      fixture.detectChanges();
      expect(element().querySelectorAll('.cell.skeleton').length).toBe(0);
      expect(element().querySelector('.grid')?.getAttribute('aria-busy')).toBe('false');
    });

    it('shows the error with a retry inside the column, and loads again when it is pressed', () => {
      data.getMonthlyTrainingInsight.and.returnValue(throwError(() => new Error('offline')));
      open();
      expect(element().querySelector('.state-text')?.textContent?.trim()).toBe('This month could not be loaded.');
      expect(element().querySelector('.grid')).toBeNull();
      expect(element().querySelector('.legend')).not.toBeNull();

      data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight()));
      element().querySelector<HTMLButtonElement>('.retry')?.click();
      fixture.detectChanges();

      expect(data.getMonthlyTrainingInsight).toHaveBeenCalledTimes(2);
      expect(data.getMonthlyTrainingInsight.calls.mostRecent().args).toEqual(['2026-09', 'Asia/Singapore']);
      expect(element().querySelector('.state')).toBeNull();
      expect(element().querySelectorAll('button.cell').length).toBe(30);
    });

    it('draws an empty month as a grid with no training day', () => {
      data.getMonthlyTrainingInsight.and.returnValue(
        of(monthInsight({ days: [], totals: { sessions: 0, minutes: 0, records: 0, longestStreakDays: 0 } }))
      );
      open();
      expect(element().querySelectorAll('button.cell').length).toBe(30);
      expect(element().querySelector('.cell.trained')).toBeNull();
    });
  });
});
