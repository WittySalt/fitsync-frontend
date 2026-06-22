import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsNutritionSeriesResponse, AnalyticsWorkoutSeriesResponse } from '../../core/analytics.models';
import { FitSyncDataService, ProgressData } from '../../core/fitsync-data.service';
import { ProgressPage } from './progress.page';

describe('ProgressPage', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;

  const emptyWorkoutSeries: AnalyticsWorkoutSeriesResponse = {
    from: '2026-06-01',
    to: '2026-06-22',
    bucket: 'WEEK',
    points: []
  };

  const emptyNutritionSeries: AnalyticsNutritionSeriesResponse = {
    from: '2026-06-01',
    to: '2026-06-22',
    bucket: 'WEEK',
    points: []
  };

  const progressData: ProgressData = {
    latestBodyMetric: {
      weightKg: 71.8,
      bmi: 24.9,
      bodyFatRate: 20.4,
      waistCm: 82,
      measuredAt: '2026-06-17T07:00:00Z'
    },
    bodyMetrics: [
      {
        weightKg: 71.8,
        bmi: 24.9,
        bodyFatRate: 20.4,
        waistCm: 82,
        measuredAt: '2026-06-17T07:00:00Z'
      }
    ],
    trendPoints: [
      {
        weightKg: 72.6,
        bmi: 25.2,
        bodyFatRate: 21.1,
        waistCm: 83,
        measuredAt: '2026-06-01T07:00:00Z'
      },
      {
        weightKg: 71.8,
        bmi: 24.9,
        bodyFatRate: 20.4,
        waistCm: 82,
        measuredAt: '2026-06-17T07:00:00Z'
      }
    ],
    goals: [
      {
        goalType: 'WEIGHT',
        targetValue: 68,
        targetUnit: 'kg',
        targetDate: '2026-09-30',
        status: 'ACTIVE',
        progressRatio: 0.55,
        onTrack: true,
        daysRemaining: 100
      }
    ]
  };

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getProgressData']);
    dataService.getProgressData.and.returnValue(of(progressData));
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getWorkoutSeries', 'getNutritionSeries']);
    analyticsApi.getWorkoutSeries.and.returnValue(of(emptyWorkoutSeries));
    analyticsApi.getNutritionSeries.and.returnValue(of(emptyNutritionSeries));

    await TestBed.configureTestingModule({
      imports: [ProgressPage],
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: AnalyticsApiService, useValue: analyticsApi }
      ]
    }).compileComponents();
  });

  it('loads and renders real progress metrics', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(dataService.getProgressData).toHaveBeenCalledWith(
      jasmine.objectContaining({ startDate: jasmine.any(String), endDate: jasmine.any(String) }),
      'DAY'
    );
    expect(compiled.textContent).toContain('71.8 kg');
    expect(compiled.textContent).toContain('24.9');
    expect(compiled.textContent).toContain('55%');
    expect(compiled.textContent).toContain('On track - 100 days left');
    expect(compiled.textContent).not.toContain('26.6');
    expect(compiled.textContent).not.toContain('21.5%');
    expect(compiled.textContent).not.toContain('42%');
  });

  it('re-queries body trends when the bucket changes', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const bodyTrendBucketToggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.filters-card .bucket-toggle');
    const bucketButtons = Array.from(bodyTrendBucketToggle?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    expect(bucketButtons.map((button) => button.textContent?.trim())).toEqual(['Day', 'Week', 'Month']);

    bucketButtons[1].click();
    fixture.detectChanges();

    expect(dataService.getProgressData.calls.mostRecent().args[1]).toBe('WEEK');
  });

  it('wires metric tabs to the trend panel', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(compiled.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panel = compiled.querySelector<HTMLElement>('#progress-trend-panel');

    expect(tabs.length).toBe(4);
    expect(tabs[0].id).toBe('progress-metric-tab-weightKg');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-controls')).toBe('progress-trend-panel');
    expect(panel?.getAttribute('role')).toBe('tabpanel');
    expect(panel?.getAttribute('aria-labelledby')).toBe('progress-metric-tab-weightKg');
  });

  it('shows the real empty state when no body metrics exist', () => {
    dataService.getProgressData.and.returnValue(
      of({
        latestBodyMetric: null,
        bodyMetrics: [],
        trendPoints: [],
        goals: []
      })
    );

    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Record your first weight');
  });

  it('shows an error state when progress data cannot be loaded', () => {
    dataService.getProgressData.and.returnValue(throwError(() => new Error('Unable to load progress data.')));

    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Progress unavailable');
    expect(compiled.textContent).toContain('Unable to load progress data.');
  });
});
