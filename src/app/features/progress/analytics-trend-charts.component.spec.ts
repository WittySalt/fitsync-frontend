import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsNutritionSeriesResponse, AnalyticsWorkoutSeriesResponse } from '../../core/analytics.models';
import { AnalyticsTrendChartsComponent } from './analytics-trend-charts.component';
import { DateRange } from './progress-range';

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

const range: DateRange = { from: '2026-04-03', to: '2026-10-03' };

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
    fixture.componentRef.setInput('range', range);
  });

  it('loads workout and nutrition series for the page range and the selected bucket', () => {
    fixture.detectChanges();

    expect(analyticsApi.getWorkoutSeries).toHaveBeenCalledWith('2026-04-03', '2026-10-03', 'WEEK');
    expect(analyticsApi.getNutritionSeries).toHaveBeenCalledWith('2026-04-03', '2026-10-03', 'WEEK');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Workout and nutrition trends');
  });

  it('loads again when the page changes the range', () => {
    fixture.detectChanges();
    analyticsApi.getWorkoutSeries.calls.reset();

    fixture.componentRef.setInput('range', { from: '2026-09-03', to: '2026-10-03' });
    fixture.detectChanges();

    expect(analyticsApi.getWorkoutSeries).toHaveBeenCalledOnceWith('2026-09-03', '2026-10-03', 'WEEK');
  });

  it('has no range controls of its own and writes the range in the short date style', () => {
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('input[type="date"]')).toBeNull();
    expect(element.querySelector('.range-presets')).toBeNull();
    expect(element.querySelector('.date-caption')?.textContent?.trim()).toBe('3 Apr to 3 Oct');
    expect(element.textContent).not.toContain('2026-04-03');
    const labels = Array.from(element.querySelectorAll('fs-chart canvas')).map((canvas) => canvas.getAttribute('aria-label'));
    expect(labels.every((label) => !/\d{4}-\d{2}-\d{2}/.test(label ?? ''))).toBeTrue();
  });

  it('reads the dates of the chart as calendar days, so a zone west of UTC cannot move them', () => {
    fixture.detectChanges();

    expect(component.chartLabels()).toEqual(['1 Jun', '8 Jun']);
  });

  it('maps nullable nutrition buckets to chart gaps instead of zeros', () => {
    fixture.detectChanges();

    expect(component.nutritionSeries()[0].values).toEqual([120, null]);
    expect(component.nutritionSeries()[1].values).toEqual([200, null]);
  });

  it('draws sessions, minutes and calories burned each on their own chart, sessions as bars', () => {
    fixture.detectChanges();

    expect(component.sessionsSeries()[0].values).toEqual([3, 2]);
    expect(component.minutesSeries()[0].values).toEqual([150, 90]);
    expect(component.caloriesBurnedSeries()[0].values).toEqual([1110, 700]);
    const charts = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('fs-chart'));
    expect(charts.length).toBe(4);
    expect(charts[0].classList).toContain('compact');
  });

  it('draws protein, carbs and fat only, since the energy card covers calories', () => {
    fixture.detectChanges();

    expect(component.nutritionSeries().map((series) => series.label)).toEqual(['Protein', 'Carbs', 'Fat']);
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
