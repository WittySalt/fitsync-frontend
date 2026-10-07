import { CoachApiService } from '../../core/coach/coach-api.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { FitSyncDataService, HomeDashboardData } from '../../core/fitsync-data.service';
import { signInAs } from '../../core/guide/guide-testing.spec';
import { GuideService } from '../../core/guide/guide.service';
import { NutritionSummary } from '../../core/fitsync.models';
import { DashboardPage } from './dashboard.page';
import { UserTimezoneService } from '../../core/user-timezone.service';

const nutrition: NutritionSummary = {
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
};

const dashboardData: HomeDashboardData = {
  profile: {
    displayName: 'Wang Xu',
    firstName: 'Wang',
    lastName: 'Xu',
    heightCm: 178,
    activityLevel: 'MODERATELY_ACTIVE',
    timezone: 'Asia/Singapore',
    onboardingCompleted: true
  },
  workout: {
    todayWorkoutCount: 1,
    weekWorkoutCount: 7,
    weekWorkoutMinutes: 300,
    activeStreakDays: 7,
    currentStreakDays: 4,
    minutesThisWeek: 135
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
const coachApiStub = {};

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getHomeDashboard',
      'loadDailyNutritionSummary',
      'getWorkoutSessionsInRange',
      'getGoals',
      'getActivePlan',
      'getWeeklyTrainingInsight',
      'getMealsForDay',
      'getUsualMeals',
      'getBadges',
      'getWorkoutPlans',
      'hasLoggedMeal',
      'getWorkoutSessionPage'
    ]);
    dataService.getHomeDashboard.and.returnValue(of(dashboardData));
    dataService.loadDailyNutritionSummary.and.returnValue(of(nutrition));
    dataService.getMealsForDay.and.returnValue(of([]));
    dataService.getUsualMeals.and.returnValue(of([]));
    dataService.getBadges.and.returnValue(throwError(() => new Error('not under test')));
    dataService.getWorkoutPlans.and.returnValue(of([]));
    dataService.hasLoggedMeal.and.returnValue(of(false));
    dataService.getWorkoutSessionPage.and.returnValue(of({ sessions: [] }) as never);
    // The coach brief loads independently of the rest of the dashboard; these specs are not
    // about the brief itself (see coach-brief.component.spec.ts), so it is given a quiet,
    // empty week and no active plan unless a test says otherwise.
    dataService.getWorkoutSessionsInRange.and.returnValue(of([]));
    dataService.getGoals.and.returnValue(of([]));
    dataService.getActivePlan.and.returnValue(of(null));
    dataService.getWeeklyTrainingInsight.and.returnValue(throwError(() => new Error('not under test')));
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getAchievements', 'getSummaryCompare']);
    // The Earned section loads on its own (see earned.component.spec.ts); these page specs only
    // need it to settle quietly.
    analyticsApi.getAchievements.and.returnValue(throwError(() => new Error('not under test')));
    analyticsApi.getSummaryCompare.and.returnValue(throwError(() => new Error('not under test')));

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
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

  it('shows the brief, the Today card and Earned, and nothing else', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const brief = compiled.querySelector('app-coach-brief');
    expect(brief?.nextElementSibling?.tagName.toLowerCase()).toBe('app-today-card');
    expect(brief?.nextElementSibling?.nextElementSibling?.tagName.toLowerCase()).toBe('app-earned');
    expect(compiled.querySelector('app-earned')?.nextElementSibling).toBeNull();
    expect(compiled.querySelector('app-activity-heatmap')).toBeNull();
    expect(compiled.querySelector('.metric-card')).toBeNull();
    expect(compiled.querySelector('.activity-link-card')).toBeNull();
    expect(pageText()).not.toContain('Latest Workout');
    expect(pageText()).not.toContain('Alice');
    expect(pageText()).not.toContain('Complete setup');
  });

  it('shows the Getting started card inside the brief for a signed-in new account', () => {
    signInAs('home-user');
    // The guide's state would come from the server; a restart stands in for a loaded one.
    TestBed.inject(GuideService).restart('home-user');
    fixture.detectChanges();

    const card = (fixture.nativeElement as HTMLElement).querySelector('app-coach-brief app-guide-card');
    expect(card?.textContent).toContain('Four steps to your first week');
    localStorage.clear();
  });

  it('passes the profile through to the brief', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-coach-brief').textContent).toContain('Wang');
  });

  it('reads the goals once and hands them to the brief', () => {
    fixture.detectChanges();

    expect(dataService.getHomeDashboard).toHaveBeenCalledTimes(1);
    expect(dataService.getGoals).not.toHaveBeenCalled();
  });

  it('asks for the day summary of the day the profile zone is in, not of the browser', () => {
    TestBed.inject(UserTimezoneService).setProfileZone('Pacific/Pago_Pago');
    fixture.detectChanges();

    // 12:00 in Singapore is still the evening of the day before at UTC-11.
    expect(dataService.loadDailyNutritionSummary).toHaveBeenCalledWith('2026-06-23');
    expect(dataService.getMealsForDay.calls.mostRecent().args.length).toBeLessThanOrEqual(1);
    expect(dataService.getUsualMeals).toHaveBeenCalledWith();
  });

  it('turns the Earned card to the dashboard minutes and the streak', () => {
    fixture.detectChanges();

    const earned = (fixture.nativeElement as HTMLElement).querySelector('app-earned')?.textContent ?? '';
    expect(earned).toContain('2 h 15 min');
    expect(earned).toContain('4 days in a row');
  });

  it('renders the Food budget from the daily summary', () => {
    dataService.getHomeDashboard.and.returnValue(
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
    dataService.loadDailyNutritionSummary.and.returnValue(of({ ...nutrition, totalProteinGrams: 7.47, targetProteinGrams: 155 }));

    fixture.detectChanges();

    expect(pageText()).toContain('7 of 155 g');
  });


  it('renders friendly empty states for new users without NaN', () => {
    dataService.getHomeDashboard.and.returnValue(
      of({ ...dashboardData, profile: { ...dashboardData.profile, onboardingCompleted: false }, latestBodyMetric: null, goals: [] })
    );
    dataService.loadDailyNutritionSummary.and.returnValue(
      of({ ...nutrition, totalCalories: 0, targetCalories: null, totalProteinGrams: 0, targetProteinGrams: null })
    );

    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('Complete setup');
    expect(text).not.toContain('NaN');
  });

  it('links Body and goals to the Goal page, where the body and goals now live', () => {
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('app-today-card a.more');
    expect(link?.getAttribute('href')).toBe('/progress/goal');
    expect(link?.textContent?.trim()).toBe('Body and goals ›');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-today-goals, app-today-body, .head [role="tablist"]')).toBeNull();
  });

  it('shows the Food error panel with a retry when the day summary fails, not an empty day', () => {
    dataService.loadDailyNutritionSummary.and.returnValue(throwError(() => new Error('down')));

    fixture.detectChanges();

    expect(fixture.componentInstance.nutritionFailed()).toBeTrue();
    const food = (fixture.nativeElement as HTMLElement).querySelector('#today-panel-food');
    expect(food?.textContent).toContain('This could not be loaded.');
    expect(food?.querySelector('button.retry')).toBeTruthy();
    expect(food?.textContent).not.toContain('Calories');
  });

  it('reloads the nutrition summary from the card without reloading the whole page', () => {
    dataService.loadDailyNutritionSummary.and.returnValue(throwError(() => new Error('down')));
    fixture.detectChanges();
    expect(fixture.componentInstance.nutritionFailed()).toBeTrue();

    dataService.getHomeDashboard.calls.reset();
    dataService.loadDailyNutritionSummary.and.returnValue(of(nutrition));
    fixture.componentInstance.loadNutrition();

    expect(fixture.componentInstance.nutritionFailed()).toBeFalse();
    expect(fixture.componentInstance.nutritionSummary()).toEqual(nutrition);
    expect(dataService.getHomeDashboard).not.toHaveBeenCalled();
  });

  it('renders the dashboard error state', () => {
    dataService.getHomeDashboard.and.returnValue(throwError(() => new Error('Unable to load dashboard data.')));

    fixture.detectChanges();

    const text = pageText();
    expect(text).toContain('Dashboard unavailable');
    expect(text).toContain('Unable to load dashboard data.');
  });



  function pageText(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

});
