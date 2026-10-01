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
      'getWeeklyTrainingInsight',
      'getMealsForDay'
    ]);
    dataService.getDashboard.and.returnValue(of(dashboardData));
    dataService.getDailyNutritionSummary.and.returnValue(of(dashboardData.nutrition));
    dataService.getMealsForDay.and.returnValue(of([]));
    // The coach brief loads independently of the rest of the dashboard; these specs are not
    // about the brief itself (see coach-brief.component.spec.ts), so it is given a quiet,
    // empty week and no active plan unless a test says otherwise.
    dataService.getWorkoutSessionsInRange.and.returnValue(of([]));
    dataService.getGoals.and.returnValue(of([]));
    dataService.getActivePlan.and.returnValue(of(null));
    // The brief treats a failed insight as no insight, which keeps these page tests about the page.
    dataService.getWeeklyTrainingInsight.and.returnValue(throwError(() => new Error('not under test')));
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', [
      'getActivityCalendar',
      'getAchievements',
      'getSummaryCompare'
    ]);
    analyticsApi.getActivityCalendar.and.returnValue(of(activityCalendar));
    // The Earned section loads on its own (see earned.component.spec.ts); these page specs only
    // need it to settle quietly, so its requests fail and it shows its own failed state.
    analyticsApi.getAchievements.and.returnValue(throwError(() => new Error('not under test')));
    analyticsApi.getSummaryCompare.and.returnValue(throwError(() => new Error('not under test')));

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
    expect(text).toContain('Today');
    expect(text).not.toContain('2026-06-24T00:05:00.512709Z');
    expect(text).not.toContain('2026-06-21T12:30:00Z');
    expect(goalRowText().length).toBe(1);
    expect(goalRowText()[0]).toContain('Calories 1,900 of 2,000 kcal');
    // A daily amount carries no date, whatever the goal record holds.
    expect(goalRowText()[0]).not.toContain('by 31 Aug 2026');
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
    expect(text).toContain('No measurement yet');
    expect(text).toContain('No goals yet');
    expect(text).toContain('Workout consistency');
    expect(text).toContain('Complete setup');
    expect(text).not.toContain('NaN');
  });

  it('replaces the protein stat with a compact workout heatmap link', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const heatmapCard = compiled.querySelector<HTMLAnchorElement>('.heatmap-metric');
    expect(heatmapCard?.getAttribute('href')).toBe('/progress');
    expect(heatmapCard?.textContent).toContain('Last five weeks');
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
    expect(compiled.querySelector<HTMLAnchorElement>('.metric-card.streak')?.getAttribute('href')).toBe('/workout');
    expect(compiled.querySelector<HTMLAnchorElement>('.heatmap-metric')?.getAttribute('href')).toBe('/progress');

    const activityLinks = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.activity-link-card'));
    expect(activityLinks.map((link) => link.getAttribute('href'))).toEqual(['/workout']);
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

  it('links the Goals tab to goal management', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector<HTMLAnchorElement>('app-today-goals a')?.getAttribute('href')).toBe('/me#goal-lifecycle');
  });

  it('renders the coach brief in place of the old hero panel, with the profile passed through', () => {
    fixture.detectChanges();

    const brief = fixture.nativeElement.querySelector('app-coach-brief');
    expect(brief).toBeTruthy();
    expect(brief.textContent).toContain('Wang');
    expect(fixture.nativeElement.querySelector('.hero-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-coach-anchor')).toBeNull();
  });

  it('renders the protein goal row from the active goal and the Food budget from the daily summary', () => {
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
    expect(goalRowText()[0]).toContain('Protein 140 of 140 g');
    expect(goalRowText()[0]).not.toContain('by 31 Aug 2026');
    // The goal row keeps the goal's own 140 g. The budget bar on the Food tab is the daily summary's.
    expect(text).toContain('7 of 155 g');
    expect(text).not.toContain('155g');
  });

  it('places the Today card directly below the brief and drops the four cards it replaces', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brief = compiled.querySelector('app-coach-brief');
    expect(brief?.nextElementSibling?.tagName.toLowerCase()).toBe('app-today-card');
    expect(compiled.querySelector('.metric-card.calories')).toBeNull();
    expect(compiled.querySelector('.metric-card.body')).toBeNull();
    expect(compiled.querySelector('.goals-card')).toBeNull();
    expect(compiled.querySelector('.metrics-grid')).toBeNull();
    expect(compiled.textContent).not.toContain('Latest Meal');
    expect(compiled.textContent).not.toContain('Latest body metric');
  });

  it('mounts the Earned section directly after the Today card and before the remaining cards', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const today = compiled.querySelector('app-today-card');
    const earned = today?.nextElementSibling;
    expect(earned?.tagName.toLowerCase()).toBe('app-earned');
    expect(earned?.nextElementSibling?.classList).toContain('card-row');
    expect(analyticsApi.getAchievements).toHaveBeenCalledTimes(1);
  });

  it('keeps the heatmap, the last 7 days and the latest workout together in one row of three', () => {
    fixture.detectChanges();

    const row = (fixture.nativeElement as HTMLElement).querySelector('.card-row-grid');
    expect(row?.children.length).toBe(3);
    expect(row?.querySelector('.heatmap-metric')).toBeTruthy();
    expect(row?.querySelector('.metric-card.streak')).toBeTruthy();
    expect(row?.textContent).toContain('Latest Workout');
  });

  it('reloads the nutrition summary from the card without reloading the whole page', () => {
    dataService.getDailyNutritionSummary.and.returnValue(throwError(() => new Error('down')));
    fixture.detectChanges();
    expect(fixture.componentInstance.nutritionFailed()).toBeTrue();

    dataService.getDashboard.calls.reset();
    dataService.getDailyNutritionSummary.and.returnValue(of(dashboardData.nutrition));
    fixture.componentInstance.loadNutrition();

    expect(fixture.componentInstance.nutritionFailed()).toBeFalse();
    expect(fixture.componentInstance.nutritionSummary()).toEqual(dashboardData.nutrition);
    expect(dataService.getDashboard).not.toHaveBeenCalled();
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

    const text = pageText();
    expect(text).not.toContain('2001');
    expect(text).toContain('Weighed 20 May');
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
    expect(rows[0]).not.toContain('was due 31 May 2026');
    expect(rows[0]).not.toContain('by 31 May');
    expect(rows[0])
      .withContext('claiming progress against a deadline that has passed is the defect')
      .not.toContain('% complete');
  });

  function goalRowText(): string[] {
    // Angular drops the whitespace between elements, so neighbouring texts are joined with a space.
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-today-goals .goal')).map((row) => {
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      const parts: string[] = [];
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const value = (text.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (value) {
          parts.push(value);
        }
      }
      return parts.join(' ');
    });
  }
});
