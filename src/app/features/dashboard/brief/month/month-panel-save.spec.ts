import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import { AccountDataService } from '../../../../core/account-data.service';
import { AnalyticsApiService } from '../../../../core/analytics-api.service';
import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { analyticsStub, monthInsight, septemberInsight } from './month-fixtures.spec';
import { MonthImageModel } from './month-image';
import { MONTH_IMAGE_EXPORT, MonthImageExport } from './month-image-export';
import { MonthPanelComponent } from './month-panel.component';
import { MonthViewState } from './month-view.state';

describe('MonthPanelComponent save as image', () => {
  let fixture: ComponentFixture<MonthPanelComponent>;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let exporter: jasmine.SpyObj<MonthImageExport>;
  let made: Subject<Blob>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const button = (): HTMLButtonElement | null => root().querySelector<HTMLButtonElement>('.save');

  function open(): void {
    TestBed.inject(MonthViewState).open('Asia/Singapore', '2026-09-27');
    fixture = TestBed.createComponent(MonthPanelComponent);
    fixture.componentRef.setInput('weeklyTarget', 4);
    fixture.componentRef.setInput('personName', 'Ruixian');
    fixture.detectChanges();
  }

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMonthlyTrainingInsight']);
    data.getMonthlyTrainingInsight.and.returnValue(of(septemberInsight()));
    const accounts = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['listBodyMetrics']);
    accounts.listBodyMetrics.and.returnValue(of([]));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    made = new Subject<Blob>();
    exporter = jasmine.createSpyObj<MonthImageExport>('MonthImageExport', ['make', 'save']);
    exporter.make.and.callFake(() => new Promise<Blob>((resolve, reject) => made.subscribe({ next: resolve, error: reject })));
    TestBed.configureTestingModule({
      providers: [
        MonthViewState,
        { provide: FitSyncDataService, useValue: data },
        { provide: AccountDataService, useValue: accounts },
        { provide: AnalyticsApiService, useValue: analyticsStub() },
        { provide: ToastService, useValue: toast },
        { provide: MONTH_IMAGE_EXPORT, useValue: exporter }
      ]
    });
  });

  it('offers a quiet button once the month has sessions', () => {
    open();
    expect(button()?.textContent?.trim()).toBe('Save as image');
    expect(button()?.type).toBe('button');
    expect(button()?.disabled).toBeFalse();
  });

  it('is not there while the month loads', () => {
    data.getMonthlyTrainingInsight.and.returnValue(new Subject());
    open();
    expect(button()).toBeNull();
  });

  it('is not there when the month cannot be loaded', () => {
    data.getMonthlyTrainingInsight.and.returnValue(new Subject<never>());
    open();
    TestBed.inject(MonthViewState).status.set('error');
    fixture.detectChanges();
    expect(button()).toBeNull();
  });

  it('is not there for a month without a session', () => {
    data.getMonthlyTrainingInsight.and.returnValue(of(monthInsight({ totals: { sessions: 0, minutes: 0, records: 0, longestStreakDays: 0 } })));
    open();
    expect(button()).toBeNull();
  });

  it('disables itself and reads Saving while the picture is made, then saves it and says so', async () => {
    open();
    button()?.click();
    fixture.detectChanges();
    expect(button()?.disabled).toBeTrue();
    expect(button()?.textContent?.trim()).toBe('Saving…');

    // A second press while it works makes no second picture.
    button()?.click();
    expect(exporter.make).toHaveBeenCalledTimes(1);

    const blob = new Blob(['x'], { type: 'image/png' });
    made.next(blob);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(exporter.save).toHaveBeenCalledOnceWith(blob, 'fitsync-2026-09.png');
    expect(toast.success).toHaveBeenCalledOnceWith('Saved to your device.');
    expect(toast.error).not.toHaveBeenCalled();
    expect(button()?.disabled).toBeFalse();
    expect(button()?.textContent?.trim()).toBe('Save as image');
  });

  it('hands the picture the person, the dates and three figures', async () => {
    open();
    button()?.click();
    const model = exporter.make.calls.mostRecent().args[0] as MonthImageModel;
    expect(model.name).toBe('Ruixian');
    expect(model.monthName).toBe('September');
    expect(model.figures.map((figure) => figure.caption)).toEqual(['sessions', 'trained', 'personal records']);
    made.next(new Blob());
    await fixture.whenStable();
  });

  it('says so and does nothing else when the picture cannot be made', async () => {
    open();
    button()?.click();
    made.error(new Error('no canvas'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledOnceWith('The picture could not be made.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(exporter.save).not.toHaveBeenCalled();
    expect(button()?.disabled).toBeFalse();
  });
});
