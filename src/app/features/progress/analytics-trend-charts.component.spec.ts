import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsNutritionSeriesResponse, AnalyticsWorkoutSeriesResponse } from '../../core/analytics.models';
import { AnalyticsTrendChartsComponent } from './analytics-trend-charts.component';

const workoutSeries: AnalyticsWorkoutSeriesResponse = {
  from: '2026-06-01',
  to: '2026-06-22',
  bucket: 'WEEK',
  points: [
    {
      date: '2026-06-01',
      completedWorkoutCount: 3,
      totalWorkoutMinutes: 150,
      totalCaloriesBurned: 1110,
      totalExerciseCount: 15
    },
    {
      date: '2026-06-08',
      completedWorkoutCount: 2,
      totalWorkoutMinutes: 90,
      totalCaloriesBurned: 700,
      totalExerciseCount: 10
    }
  ]
};

const nutritionSeries: AnalyticsNutritionSeriesResponse = {
  from: '2026-06-01',
  to: '2026-06-22',
  bucket: 'WEEK',
  points: [
    {
      date: '2026-06-01',
      totalCaloriesConsumed: 1850,
      totalProteinGrams: 120,
      totalCarbsGrams: 200,
      totalFatGrams: 70,
      calorieTarget: 2200,
      proteinTargetGrams: 150
    },
    {
      date: '2026-06-08',
      totalCaloriesConsumed: null,
      totalProteinGrams: null,
      totalCarbsGrams: null,
      totalFatGrams: null,
      calorieTarget: null,
      proteinTargetGrams: null
    }
  ]
};

describe('AnalyticsTrendChartsComponent', () => {
  let fixture: ComponentFixture<AnalyticsTrendChartsComponent>;
  let component: AnalyticsTrendChartsComponent;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;

  beforeEach(async () => {
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getWorkoutSeries', 'getNutritionSeries']);
    analyticsApi.getWorkoutSeries.and.returnValue(of(workoutSeries));
    analyticsApi.getNutritionSeries.and.returnValue(of(nutritionSeries));

    await TestBed.configureTestingModule({
      imports: [AnalyticsTrendChartsComponent],
      providers: [{ provide: AnalyticsApiService, useValue: analyticsApi }]
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsTrendChartsComponent);
    component = fixture.componentInstance;
  });

  it('loads workout and nutrition series with the selected range and bucket', () => {
    fixture.detectChanges();

    expect(analyticsApi.getWorkoutSeries).toHaveBeenCalledWith(
      jasmine.any(String),
      jasmine.any(String),
      'WEEK'
    );
    expect(analyticsApi.getNutritionSeries).toHaveBeenCalledWith(
      jasmine.any(String),
      jasmine.any(String),
      'WEEK'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Workout and nutrition trends');
  });

  it('maps nullable nutrition buckets to chart gaps instead of zeros', () => {
    fixture.detectChanges();

    expect(component.nutritionSeries()[0].values).toEqual([1850, null]);
    expect(component.nutritionSeries()[1].values).toEqual([2200, null]);
    expect(component.workoutSeries()[0].values).toEqual([3, 2]);
  });

  it('re-queries both series when the bucket changes', () => {
    fixture.detectChanges();

    const bucketButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.bucket-toggle button'));
    bucketButtons[0].click();

    expect(component.selectedBucket()).toBe('DAY');
    expect(analyticsApi.getWorkoutSeries.calls.mostRecent().args[2]).toBe('DAY');
    expect(analyticsApi.getNutritionSeries.calls.mostRecent().args[2]).toBe('DAY');
  });

  it('renders an empty state when no series points exist', () => {
    analyticsApi.getWorkoutSeries.and.returnValue(of({ ...workoutSeries, points: [] }));
    analyticsApi.getNutritionSeries.and.returnValue(of({ ...nutritionSeries, points: [] }));

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No workout or nutrition trends');
  });

  it('renders an error state when trend series fail', () => {
    analyticsApi.getWorkoutSeries.and.returnValue(throwError(() => new Error('nope')));

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Analytics trends unavailable');
  });
});
