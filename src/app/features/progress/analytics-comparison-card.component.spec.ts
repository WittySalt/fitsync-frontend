import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsMetricComparison, AnalyticsSummaryCompareResponse } from '../../core/analytics.models';
import { AnalyticsComparisonCardComponent } from './analytics-comparison-card.component';

const weekComparison: AnalyticsSummaryCompareResponse = {
  period: 'WEEK',
  currentWindow: { from: '2026-06-22', to: '2026-06-24' },
  previousWindow: { from: '2026-06-15', to: '2026-06-17' },
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


const perLoggedDay = (current: number, previous: number, pct: number): AnalyticsMetricComparison => ({
  current,
  previous,
  delta: current - previous,
  deltaPct: pct
});

const loggedDayComparison: AnalyticsSummaryCompareResponse = {
  ...weekComparison,
  nutrition: {
    ...weekComparison.nutrition,
    totalCaloriesConsumed: {
      current: 5400,
      previous: 7600,
      delta: -2200,
      deltaPct: -28.9,
      averagePerLoggedDay: perLoggedDay(1800, 1900, -5.3)
    },
    daysLogged: { current: 3, previous: 4, delta: -1, deltaPct: -25 }
  }
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

    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-24T04:00:00Z'));

    fixture = TestBed.createComponent(AnalyticsComparisonCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('loads the week comparison by default and sends the profile zone', () => {
    fixture.componentRef.setInput('timezone', 'Asia/Singapore');
    fixture.detectChanges();

    expect(analyticsApi.getSummaryCompare).toHaveBeenCalledWith('WEEK', 'Asia/Singapore');
    expect(text()).toContain('Period comparison');
    expect(text()).toContain('Completed workouts');
  });

  it('names the windows "so far" and "same days", with the dates in the short style', () => {
    fixture.detectChanges();

    expect(text()).toContain('This week so far: 22 to 24 Jun');
    expect(text()).toContain('Last week, same days: 15 to 17 Jun');
    expect(text()).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text()).not.toContain('Current:');
    expect(text()).not.toContain('Previous:');
  });

  it('says the change in words, never red, and keeps a fall neutral', () => {
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const deltas = Array.from(element.querySelectorAll<HTMLElement>('.delta'));
    const byText = (label: string) => deltas.find((node) => node.textContent?.trim() === label);
    expect(byText('Up 100%')?.classList).toContain('positive');
    expect(byText('Down 14.3%')?.classList).toContain('neutral');
    expect(byText('No change')?.classList).toContain('neutral');
    expect(element.querySelector('.delta.negative')).toBeNull();
    expect(text()).not.toMatch(/[↑↓]/);
  });

  it('shows n/a when deltaPct is null', () => {
    fixture.detectChanges();

    expect(component.deltaPctLabel(weekComparison.nutrition.totalCaloriesConsumed)).toBe('n/a');
    expect(text()).toContain('n/a');
  });

  it('compares food by what a logged day held when the server sends it, and shows the days logged', () => {
    analyticsApi.getSummaryCompare.and.returnValue(of(loggedDayComparison));
    fixture.detectChanges();

    expect(text()).toContain('Calories consumed, a logged day');
    expect(text()).toContain('1,800 kcal');
    expect(text()).toContain('Down 5.3%');
    expect(text()).not.toContain('5,400');
    expect(text()).toContain('Days logged');
    expect(text()).toContain('3 days');
    expect(text()).toContain('4 days');
  });

  it('keeps the totals and leaves the days-logged row out for a server that sends no per-day figures', () => {
    fixture.detectChanges();

    expect(text()).toContain('Calories consumed');
    expect(text()).not.toContain('a logged day');
    expect(text()).not.toContain('Days logged');
  });

  it('sets tabular numbers on the table', () => {
    fixture.detectChanges();

    const table = (fixture.nativeElement as HTMLElement).querySelector('.comparison-table') as HTMLElement;
    expect(getComputedStyle(table).fontVariantNumeric).toContain('tabular-nums');
  });

  it('re-queries and renames the windows when the period changes', () => {
    analyticsApi.getSummaryCompare.and.returnValues(of(weekComparison), of(monthComparison));
    fixture.detectChanges();

    const periodButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.period-toggle button'));
    periodButtons[1].click();
    fixture.detectChanges();

    expect(component.selectedPeriod()).toBe('MONTH');
    expect(analyticsApi.getSummaryCompare.calls.mostRecent().args[0]).toBe('MONTH');
    expect(text()).toContain('This month so far: 1 to 22 Jun');
    expect(text()).toContain('Last month, same days: 1 to 22 May');
  });

  it('renders an error state when comparison loading fails', () => {
    analyticsApi.getSummaryCompare.and.returnValue(throwError(() => new Error('nope')));

    fixture.detectChanges();

    expect(text()).toContain('Comparison unavailable');
  });
});
