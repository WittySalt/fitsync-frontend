import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import {
  AnalyticsActivityCalendarResponse,
  AnalyticsNutritionSeriesResponse,
  AnalyticsSummaryCompareResponse,
  AnalyticsWorkoutSeriesResponse
} from '../../core/analytics.models';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Goal } from '../../core/fitsync.models';
import { ProgressPage } from './progress.page';

describe('ProgressPage', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;

  const goals: Goal[] = [
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
  ];

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

  const emptyComparison: AnalyticsSummaryCompareResponse = {
    period: 'WEEK',
    currentWindow: { from: '2026-06-22', to: '2026-06-22' },
    previousWindow: { from: '2026-06-15', to: '2026-06-15' },
    workout: {
      completedWorkoutCount: { current: 0, previous: 0, delta: 0, deltaPct: 0 },
      totalWorkoutMinutes: { current: 0, previous: 0, delta: 0, deltaPct: 0 },
      totalCaloriesBurned: { current: 0, previous: 0, delta: 0, deltaPct: 0 },
      totalExerciseCount: { current: 0, previous: 0, delta: 0, deltaPct: 0 }
    },
    nutrition: {
      totalCaloriesConsumed: { current: null, previous: null, delta: null, deltaPct: null },
      totalProteinGrams: { current: null, previous: null, delta: null, deltaPct: null },
      totalCarbsGrams: { current: null, previous: null, delta: null, deltaPct: null },
      totalFatGrams: { current: null, previous: null, delta: null, deltaPct: null }
    }
  };

  const emptyActivityCalendar: AnalyticsActivityCalendarResponse = {
    from: '2026-06-20',
    to: '2026-06-22',
    days: [
      { date: '2026-06-20', workoutCount: 0, workoutMinutes: 0 },
      { date: '2026-06-21', workoutCount: 0, workoutMinutes: 0 },
      { date: '2026-06-22', workoutCount: 0, workoutMinutes: 0 }
    ]
  };

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getProgressGoals']);
    dataService.getProgressGoals.and.returnValue(of(goals));
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', [
      'getWorkoutSeries',
      'getNutritionSeries',
      'getSummaryCompare',
      'getActivityCalendar'
    ]);
    analyticsApi.getWorkoutSeries.and.returnValue(of(emptyWorkoutSeries));
    analyticsApi.getNutritionSeries.and.returnValue(of(emptyNutritionSeries));
    analyticsApi.getSummaryCompare.and.returnValue(of(emptyComparison));
    analyticsApi.getActivityCalendar.and.returnValue(of(emptyActivityCalendar));

    await TestBed.configureTestingModule({
      imports: [ProgressPage],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: AnalyticsApiService, useValue: analyticsApi }
      ]
    }).compileComponents();
  });

  it('renders activity analytics and active goals without body metric panels', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(dataService.getProgressGoals).toHaveBeenCalled();
    expect(compiled.textContent).toContain('Activity analytics');
    expect(compiled.textContent).toContain('Active goal progress');
    expect(compiled.textContent).toContain('55%');
    expect(compiled.textContent).toContain('On track - 100 days left');
    expect(compiled.textContent).not.toContain('Latest weight');
    expect(compiled.textContent).not.toContain('Body Metrics');
    expect(compiled.querySelector('#progress-trend-panel')).toBeNull();
    expect(compiled.querySelector('[role="tablist"][aria-label="Trend metric"]')).toBeNull();
  });

  it('shows a goals empty state when no active goals exist', () => {
    dataService.getProgressGoals.and.returnValue(of([]));

    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No active goals');
  });

  it('shows a goal error state when goal progress cannot be loaded', () => {
    dataService.getProgressGoals.and.returnValue(throwError(() => new Error('Unable to load goal progress.')));

    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Goal progress unavailable');
    expect(compiled.textContent).toContain('Unable to load goal progress.');
  });
});
