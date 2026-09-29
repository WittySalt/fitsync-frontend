import { CoachApiService } from '../../core/coach/coach-api.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsActivityCalendarResponse } from '../../core/analytics.models';
import { DashboardData, FitSyncDataService } from '../../core/fitsync-data.service';
import { DashboardPage } from './dashboard.page';

const activityCalendar: AnalyticsActivityCalendarResponse = {
  from: '2026-06-01',
  to: '2026-06-30',
  days: [
    { date: '2026-06-20', workoutCount: 1, workoutMinutes: 45 },
    { date: '2026-06-24', workoutCount: 2, workoutMinutes: 80 }
  ]
};

const dashboardData: DashboardData = {
  profile: {
    displayName: 'Wang Xu',
    firstName: 'Wang',
    lastName: 'Xu',
    heightCm: 178,
    activityLevel: 'MODERATELY_ACTIVE',
    timezone: 'Asia/Singapore',
    onboardingCompleted: true
  },
  nutrition: {
    totalCalories: 1850,
    targetCalories: 2200,
    totalProteinGrams: 120,
    targetProteinGrams: 150,
    totalCarbsGrams: 0,
    targetCarbsGrams: null,
    totalFatGrams: 0,
    targetFatGrams: null,
    mealCount: 1,
    totalFiberGrams: null,
    totalSugarGrams: null,
    totalSodiumMg: null,
    fiberTargetGrams: null,
    sugarLimitGrams: null,
    sodiumLimitMg: null,
    fiberTargetMet: null,
    sugarWithinLimit: null,
    sodiumWithinLimit: null
  },
  workout: {
    todayWorkoutCount: 1,
    weekWorkoutCount: 7,
    weekWorkoutMinutes: 300,
    activeStreakDays: 7
  },
  latestWorkout: null,
  latestMeal: {
    mealId: 'meal-1',
    mealType: 'LUNCH',
    name: 'Chicken rice',
    totalCalories: 640,
    totalProteinGrams: 48,
    consumedAt: '2026-06-21T12:30:00Z',
    itemCount: 1
  },
  latestBodyMetric: {
    weightKg: 77,
    bodyFatRate: 18,
    bmi: 24.3,
    measuredAt: '2026-06-24T00:05:00.512709Z'
  },
  goals: [
    {
      goalId: 'goal-calories-old',
      goalType: 'CALORIES',
      targetValue: 2100,
      targetUnit: 'kcal',
      targetDate: '2026-08-30',
      status: 'ACTIVE',
      progressRatio: 0.5,
      onTrack: false,
      currentValue: 1050,
      lastEvaluatedAt: '2026-06-22T00:00:00Z'
    },
    {
      goalId: 'goal-calories',
      goalType: 'CALORIES',
      targetValue: 2000,
      targetUnit: 'kcal',
      targetDate: '2026-08-31',
      status: 'ACTIVE',
      progressRatio: 0.95,
      onTrack: true,
      currentValue: 1900,
      lastEvaluatedAt: '2026-06-24T00:05:00Z'
    }
  ]
};

// The coach brief injects the real CoachStore (only its "ask" path is used by these specs, and
// none of them trigger it), which in turn needs CoachApiService; only the wire is stubbed so
// nothing here makes a real HTTP call it never asked for.
const coachApiStub = { listRecommendations: () => of([]), refreshRecommendations: () => of(undefined) };

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getDashboard',
      'getDailyNutritionSummary',
      'getWorkoutSessionsInRange',
      'getGoals',
      'getActivePlan',
      'getWeeklyTrainingInsight'
    ]);
    dataService.getDashboard.and.returnValue(of(dashboardData));
    dataService.getDailyNutritionSummary.and.returnValue(of(dashboardData.nutrition));
    // The coach brief loads independently of the rest of the dashboard; these specs are not
    // about the brief itself (see coach-brief.component.spec.ts), so it is given a quiet,
    // empty week and no active plan unless a test says otherwise.
    dataService.getWorkoutSessionsInRange.and.returnValue(of([]));
    dataService.getGoals.and.returnValue(of([]));
    dataService.getActivePlan.and.returnValue(of(null));
    // The brief treats a failed insight as no insight, which keeps these page tests about the page.
    dataService.getWeeklyTrainingInsight.and.returnValue(throwError(() => new Error('not under test')));
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getActivityCalendar']);
    analyticsApi.getActivityCalendar.and.returnValue(of(activityCalendar));

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        // The page carries a coach anchor, whose store reaches HttpClient through the API client.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CoachApiService, useValue: coachApiStub },
        { provide: FitSyncDataService, useValue: dataService },
        { provide: AnalyticsApiService, useValue: analyticsApi },
        provideRouter([])
      ]
    }).compileComponents();

    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-24T12:00:00+08:00'));

    fixture = TestBed.createComponent(DashboardPage);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('renders analytics dashboard streak, latest goal values, and humanized timestamps', () => {
    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('Active streak');
    expect(text).toContain('7 days');
    expect(text).toContain('7 workouts · 300 min in 7 days');
    expect(text).toContain('On track · 95% complete · by 31 Aug 2026');
    expect(text).toContain('Today');
    expect(text).toContain('3 days ago');
    expect(text).not.toContain('2026-06-24T00:05:00.512709Z');
    expect(text).not.toContain('2026-06-21T12:30:00Z');
    expect(goalRowText().length).toBe(1);
    expect(goalRowText()[0]).toContain('Calories 2,000 kcal');
    expect(goalRowText()[0]).toContain('On track · 95% complete · by 31 Aug 2026');
    expect(text).not.toContain('Complete setup');
  });

  it('leads with weekly workout totals when active streak is zero', () => {
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        workout: {
          todayWorkoutCount: 0,
          weekWorkoutCount: 5,
          weekWorkoutMinutes: 210,
          activeStreakDays: 0
        }
      })
    );

    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('Last 7 days');
    expect(text).toContain('5 workouts · 210 min');
    expect(text).not.toContain('0 days');
  });

  it('renders a start workout empty state when the latest session has no completed work', () => {
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        latestWorkout: {
          name: 'Draft workout',
          workoutType: 'STRENGTH',
          status: 'COMPLETED',
          startedAt: '2026-06-24T10:00:00Z',
          durationMinutes: 0,
          caloriesBurned: 0,
          completedAt: '2026-06-24T10:00:00Z',
          exerciseCount: 0
        }
      })
    );

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No completed workout yet');
    expect(compiled.querySelector<HTMLAnchorElement>('.empty-workout-state a')?.getAttribute('href')).toBe('/workout');
  });

  it('renders the latest workout empty state for non-completed sessions', () => {
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        latestWorkout: {
          name: 'Cancelled workout',
          workoutType: 'STRENGTH',
          status: 'CANCELLED',
          startedAt: '2026-06-24T10:00:00Z',
          durationMinutes: 0,
          caloriesBurned: 0,
          completedAt: '',
          exerciseCount: 4
        }
      })
    );

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No completed workout yet');
    expect(compiled.textContent).not.toContain('Cancelled workout');
  });

  it('renders friendly empty states for new users without NaN', () => {
    const emptyNutrition = {
      ...dashboardData.nutrition,
      totalCalories: 0,
      targetCalories: null,
      totalProteinGrams: 0,
      targetProteinGrams: null
    };
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        profile: {
          ...dashboardData.profile,
          onboardingCompleted: false
        },
        nutrition: emptyNutrition,
        latestBodyMetric: null,
        goals: []
      })
    );
    dataService.getDailyNutritionSummary.and.returnValue(of(emptyNutrition));

    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('No nutrition yet');
    expect(text).toContain('Workout consistency');
    expect(text).toContain('No metric yet');
    expect(text).toContain('Complete setup');
    expect(text).not.toContain('NaN');
  });

  it('replaces the protein stat with a compact workout heatmap link', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const heatmapCard = compiled.querySelector<HTMLAnchorElement>('.heatmap-metric');
    expect(heatmapCard?.getAttribute('href')).toBe('/progress');
    expect(heatmapCard?.textContent).toContain('This month');
    expect(heatmapCard?.textContent).toContain('3 workouts · 125 min');
    expect(compiled.textContent).not.toContain('Daily target progress');
  });

  it('links dashboard cards to their related sections', () => {
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        latestWorkout: {
          name: 'Upper body strength',
          workoutType: 'STRENGTH',
          status: 'COMPLETED',
          startedAt: '2026-06-24T09:00:00Z',
          completedAt: '2026-06-24T10:00:00Z',
          durationMinutes: 60,
          caloriesBurned: 320,
          exerciseCount: 6
        }
      })
    );

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector<HTMLAnchorElement>('.metric-card.calories')?.getAttribute('href')).toBe('/nutrition');
    expect(compiled.querySelector<HTMLAnchorElement>('.metric-card.streak')?.getAttribute('href')).toBe('/workout');
    expect(compiled.querySelector<HTMLAnchorElement>('.metric-card.body')?.getAttribute('href')).toBe('/body');
    expect(compiled.querySelector<HTMLAnchorElement>('.heatmap-metric')?.getAttribute('href')).toBe('/progress');

    const activityLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.activity-link-card'));
    expect(activityLinks.map((link) => link.getAttribute('href'))).toEqual(['/workout', '/nutrition']);
  });

  it('renders missing latest workout duration and calories without fake zeroes', () => {
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        latestWorkout: {
          name: 'Upper body strength',
          workoutType: 'STRENGTH',
          status: 'COMPLETED',
          startedAt: '2026-06-24T09:00:00Z',
          completedAt: '',
          durationMinutes: null,
          caloriesBurned: null,
          exerciseCount: 6
        }
      })
    );

    fixture.detectChanges();

    const latestWorkoutCard = (fixture.nativeElement as HTMLElement).querySelector('.activity-link-card')?.textContent ?? '';
    expect(latestWorkoutCard).toContain('STRENGTH · —');
    expect(latestWorkoutCard).toContain('Not recorded');
    expect(latestWorkoutCard).not.toContain('0 min');
  });

  it('links the goals card to goal management', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector<HTMLAnchorElement>('.goals-card .text-link')?.getAttribute('href')).toBe('/me#goal-lifecycle');
  });

  it('renders the coach brief in place of the old hero panel, with the profile passed through', () => {
    fixture.detectChanges();

    const brief = fixture.nativeElement.querySelector('app-coach-brief');
    expect(brief).toBeTruthy();
    expect(brief.textContent).toContain('Wang');
    expect(fixture.nativeElement.querySelector('.hero-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-coach-anchor')).toBeNull();
  });

  it('renders protein goal progress from the active goal source without the daily nutrition target', () => {
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        goals: [
          {
            goalId: 'goal-protein',
            goalType: 'PROTEIN',
            targetValue: 140,
            targetUnit: 'g',
            targetDate: '2026-08-31',
            status: 'ACTIVE',
            progressRatio: 1,
            onTrack: true,
            currentValue: 140,
            lastEvaluatedAt: '2026-06-24T00:05:00Z'
          }
        ]
      })
    );
    dataService.getDailyNutritionSummary.and.returnValue(
      of({
        ...dashboardData.nutrition,
        totalProteinGrams: 7.47,
        targetProteinGrams: 155
      })
    );

    fixture.detectChanges();

    const text = pageText();
    expect(goalRowText()[0]).toContain('Protein 140 g');
    expect(goalRowText()[0]).toContain('On track · 100% complete · by 31 Aug 2026');
    expect(text).not.toContain('155g');
    expect(text).not.toContain('155 g');
  });

  it('formats relative dates and fallback dates without exposing raw ISO timestamps', () => {
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.metricDateLabel(null)).toBe('');
    expect(component.metricDateLabel('2026-06-23T20:00:00+08:00')).toBe('Yesterday');
    expect(component.metricDateLabel('2026-06-20T08:00:00+08:00')).toBe('4 days ago');
    expect(component.metricDateLabel('2024-12-31T16:00:00Z')).toBe('1 Jan 2025');
    expect(component.metricDateLabel('not-a-date')).toBe('not-a-date');
    expect(component.metricDateLabel('2026-99-99T99:99:99Z')).toBe('Recently');
  });

  it('formats goal labels and target amounts for default units and missing targets', () => {
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.goalLabel({ ...dashboardData.goals[0], goalType: 'WORKOUT_FREQUENCY' })).toBe('Workout Frequency');
    expect(component.goalAmountLabel({ ...dashboardData.goals[0], goalType: 'PROTEIN', targetUnit: '', currentValue: 130, targetValue: 140 })).toBe('140 g');
    expect(component.goalAmountLabel({ ...dashboardData.goals[0], goalType: 'WEIGHT', targetUnit: '', currentValue: 77.25, targetValue: 75 })).toBe('75 kg');
    expect(
      component.goalAmountLabel({ ...dashboardData.goals[0], goalType: 'WORKOUT_FREQUENCY', targetUnit: '', currentValue: 3, targetValue: 4 })
    ).toBe('4 workouts/week');
    expect(component.goalAmountLabel({ ...dashboardData.goals[0], goalType: 'STEPS', targetUnit: '', currentValue: null, targetValue: 0 })).toBe(
      'No target set'
    );
    expect(component.goalAmountLabel({ ...dashboardData.goals[0], goalType: 'STEPS', targetUnit: '', currentValue: 2000, targetValue: 0 })).toBe(
      'No target set'
    );
    expect(component.goalDateLabel({ ...dashboardData.goals[0], targetDate: '2026-08-31' })).toBe('by 31 Aug 2026');
    expect(component.goalDateLabel({ ...dashboardData.goals[0], targetDate: '' })).toBe('No target date');
  });

  it('renders the dashboard error state', () => {
    dataService.getDashboard.and.returnValue(throwError(() => new Error('Unable to load dashboard data.')));

    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('Dashboard unavailable');
    expect(text).toContain('Unable to load dashboard data.');
  });

  function pageText(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  // --- regression: functional-defects-2026-09-26, defects 5, 6 and 7 --------------------------

  it('captions the body metric with the measurement date, not a re-formatted label', () => {
    // The value used to be overwritten with its own display label before rendering, and the
    // template then formatted it a second time. new Date("5 Jul") parses to the year 2001 under
    // V8's legacy parser, so a measurement taken in 2026 rendered as "5 Jul 2001".
    dataService.getDashboard.and.returnValue(
      of({ ...dashboardData, latestBodyMetric: { weightKg: 71.1, bodyFatRate: 21.4, bmi: 22.4, measuredAt: '2026-05-20' } })
    );

    fixture.detectChanges();

    // Outside the "N days ago" window, so the absolute format runs — the branch that used to
    // append the wrong year.
    const text = pageText();
    expect(text).not.toContain('2001');
    expect(text).toContain('20 May');
  });

  it('hands back an already-formatted string untouched instead of reparsing it', () => {
    const page = fixture.componentInstance;

    expect(page.metricDateLabel('5 Jul')).toBe('5 Jul');
    expect(page.metricDateLabel('5 Jul')).not.toContain('2001');
  });

  it('renders a goal past its target date as overdue and drops the progress claim', () => {
    dataService.getDashboard.and.returnValue(
      of({
        ...dashboardData,
        goals: [
          {
            goalId: 'goal-protein',
            goalType: 'PROTEIN',
            targetValue: 140,
            targetUnit: 'g',
            targetDate: '2026-05-31',
            status: 'ACTIVE',
            progressRatio: 0.44,
            onTrack: true,
            expired: true,
            currentValue: 62,
            lastEvaluatedAt: '2026-06-24T00:05:00Z'
          }
        ]
      })
    );

    fixture.detectChanges();

    const rows = goalRowText();
    expect(rows[0]).toContain('Overdue');
    expect(rows[0]).toContain('was due');
    expect(rows[0]).not.toContain('On track');
    expect(rows[0])
      .withContext('claiming progress against a deadline that has passed is the defect')
      .not.toContain('% complete');
  });

  function goalRowText(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.goal-row')).map((row) =>
      (row.textContent ?? '').replace(/\s+/g, ' ').trim()
    );
  }
});
