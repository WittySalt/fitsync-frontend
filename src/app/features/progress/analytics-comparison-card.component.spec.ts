import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsSummaryCompareResponse } from '../../core/analytics.models';
import { AnalyticsComparisonCardComponent } from './analytics-comparison-card.component';

const weekComparison: AnalyticsSummaryCompareResponse = {
  period: 'WEEK',
  currentWindow: { from: '2026-06-22', to: '2026-06-22' },
  previousWindow: { from: '2026-06-15', to: '2026-06-15' },
  workout: {
    completedWorkoutCount: { current: 4, previous: 2, delta: 2, deltaPct: 100 },
    totalWorkoutMinutes: { current: 180, previous: 120, delta: 60, deltaPct: 50 },
    totalCaloriesBurned: { current: 1100, previous: 900, delta: 200, deltaPct: 22.2 },
    totalExerciseCount: { current: 18, previous: 18, delta: 0, deltaPct: 0 }
  },
  nutrition: {
    totalCaloriesConsumed: { current: 1850, previous: null, delta: null, deltaPct: null },
    totalProteinGrams: { current: 120, previous: 100, delta: 20, deltaPct: 20 },
    totalCarbsGrams: { current: null, previous: null, delta: null, deltaPct: null },
    totalFatGrams: { current: 60, previous: 70, delta: -10, deltaPct: -14.3 }
  }
};

const monthComparison: AnalyticsSummaryCompareResponse = {
  ...weekComparison,
  period: 'MONTH',
  currentWindow: { from: '2026-06-01', to: '2026-06-22' },
  previousWindow: { from: '2026-05-01', to: '2026-05-22' }
};

describe('AnalyticsComparisonCardComponent', () => {
  let fixture: ComponentFixture<AnalyticsComparisonCardComponent>;
  let component: AnalyticsComparisonCardComponent;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;

  beforeEach(async () => {
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getSummaryCompare']);
    analyticsApi.getSummaryCompare.and.returnValue(of(weekComparison));

    await TestBed.configureTestingModule({
      imports: [AnalyticsComparisonCardComponent],
      providers: [{ provide: AnalyticsApiService, useValue: analyticsApi }]
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsComparisonCardComponent);
    component = fixture.componentInstance;
  });

  it('loads and renders the week comparison by default', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(analyticsApi.getSummaryCompare).toHaveBeenCalledWith('WEEK');
    expect(compiled.textContent).toContain('Period comparison');
    expect(compiled.textContent).toContain('Current: 2026-06-22 to 2026-06-22');
    expect(compiled.textContent).toContain('Completed workouts');
    expect(compiled.textContent).toContain('↑ +100%');
  });

  it('shows n/a when deltaPct is null', () => {
    fixture.detectChanges();

    expect(component.deltaPctLabel(weekComparison.nutrition.totalCaloriesConsumed)).toBe('n/a');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('n/a');
  });

  it('re-queries when the period changes', () => {
    analyticsApi.getSummaryCompare.and.returnValues(of(weekComparison), of(monthComparison));
    fixture.detectChanges();

    const periodButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.period-toggle button'));
    periodButtons[1].click();
    fixture.detectChanges();

    expect(component.selectedPeriod()).toBe('MONTH');
    expect(analyticsApi.getSummaryCompare.calls.mostRecent().args[0]).toBe('MONTH');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Current: 2026-06-01 to 2026-06-22');
  });

  it('renders an error state when comparison loading fails', () => {
    analyticsApi.getSummaryCompare.and.returnValue(throwError(() => new Error('nope')));

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Comparison unavailable');
  });
});
