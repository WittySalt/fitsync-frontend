import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AnalyticsApiService } from './analytics-api.service';
import { AnalyticsAchievementsResponse } from './analytics.models';

describe('AnalyticsApiService', () => {
  let service: AnalyticsApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnalyticsApiService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AnalyticsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads the analytics dashboard', () => {
    service.getDashboard().subscribe();

    const request = httpTesting.expectOne('/api/v1/analytics/dashboard');
    expect(request.request.method).toBe('GET');
    request.flush({
      generatedAt: '2026-06-22T00:00:00Z',
      timezone: 'UTC',
      body: { latestWeightKg: 77, latestBodyFatRate: 18, bmi: 24.3, weightChange30d: -2.4 },
      workout: { todayWorkoutCount: 1, weekWorkoutCount: 7, weekWorkoutMinutes: 300, activeStreakDays: 7 },
      nutrition: {
        todayCaloriesConsumed: 1850,
        todayCaloriesTarget: 2200,
        todayProteinGrams: 120,
        todayProteinTargetGrams: 150
      },
      goals: [{ goalId: 'goal-1', goalType: 'CALORIES', progressRatio: 0.95, onTrack: true }]
    });
  });

  it('loads goal progress with an optional status filter', () => {
    service.getGoalsProgress('ACTIVE').subscribe();

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/analytics/goals/progress' && req.params.get('status') === 'ACTIVE'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ goals: [] });
  });

  it('loads goal progress without a status filter', () => {
    service.getGoalsProgress().subscribe();

    const request = httpTesting.expectOne('/api/v1/analytics/goals/progress');
    expect(request.request.params.has('status')).toBeFalse();
    request.flush({ goals: [] });
  });

  it('loads body trends with range and bucket params', () => {
    service.getBodyTrends('2026-04-01', '2026-06-22', 'DAY').subscribe();

    expectRangeBucketRequest('/api/v1/analytics/body/trends', 'DAY');
  });

  it('loads workout series with range and bucket params', () => {
    service.getWorkoutSeries('2026-04-01', '2026-06-22', 'WEEK').subscribe();

    expectRangeBucketRequest('/api/v1/analytics/workouts/series', 'WEEK');
  });

  it('loads nutrition series with range and bucket params', () => {
    service.getNutritionSeries('2026-04-01', '2026-06-22', 'MONTH').subscribe();

    expectRangeBucketRequest('/api/v1/analytics/nutrition/series', 'MONTH');
  });

  it('loads workout summary with range params', () => {
    service.getWorkoutSummary('2026-06-01', '2026-06-22').subscribe();

    expectRangeRequest('/api/v1/analytics/workouts/summary');
  });

  it('loads nutrition summary with range params', () => {
    service.getNutritionSummary('2026-06-01', '2026-06-22').subscribe();

    expectRangeRequest('/api/v1/analytics/nutrition/summary');
  });

  it('loads the achievements and keeps what the server sent', () => {
    let result: AnalyticsAchievementsResponse | undefined;
    service.getAchievements().subscribe((value) => (result = value));

    const request = httpTesting.expectOne('/api/v1/analytics/achievements');
    expect(request.request.method).toBe('GET');
    request.flush({
      achievements: [
        { code: 'FIRST_WORKOUT', title: 'First workout', unlocked: true, unlockedAt: '2026-08-20T03:00:00Z', progress: 1 },
        { code: 'WORKOUTS_50', title: '50 workouts', unlocked: false, unlockedAt: null, progress: 0.66 }
      ]
    });

    expect(result?.achievements).toEqual([
      { code: 'FIRST_WORKOUT', title: 'First workout', unlocked: true, unlockedAt: '2026-08-20T03:00:00Z', progress: 1 },
      { code: 'WORKOUTS_50', title: '50 workouts', unlocked: false, unlockedAt: null, progress: 0.66 }
    ]);
  });

  it('treats a missing achievements list as empty', () => {
    let result: AnalyticsAchievementsResponse | undefined;
    service.getAchievements().subscribe((value) => (result = value));

    httpTesting.expectOne('/api/v1/analytics/achievements').flush({});

    expect(result?.achievements).toEqual([]);
  });

  it('defaults a missing progress to zero, clamps it into 0 to 1 and drops entries without a code', () => {
    let result: AnalyticsAchievementsResponse | undefined;
    service.getAchievements().subscribe((value) => (result = value));

    httpTesting.expectOne('/api/v1/analytics/achievements').flush({
      achievements: [
        { code: 'STREAK_7', title: 'Streak', unlocked: false },
        { code: 'STREAK_30', unlocked: false, progress: 4 },
        { code: 'PR_FIRST', title: 'Record', unlocked: false, progress: -2 },
        { title: 'No code', progress: 0.5 }
      ]
    });

    expect(result?.achievements.map((entry) => [entry.code, entry.progress, entry.unlockedAt])).toEqual([
      ['STREAK_7', 0, null],
      ['STREAK_30', 1, null],
      ['PR_FIRST', 0, null]
    ]);
    expect(result?.achievements[1].title).toBe('STREAK_30');
  });

  it('loads period comparison by period', () => {
    service.getSummaryCompare('WEEK').subscribe();

    const request = httpTesting.expectOne(
      (req) => req.url === '/api/v1/analytics/summary/compare' && req.params.get('period') === 'WEEK'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      period: 'WEEK',
      currentWindow: { from: '2026-06-22', to: '2026-06-22' },
      previousWindow: { from: '2026-06-15', to: '2026-06-15' },
      workout: {
        completedWorkoutCount: { current: 1, previous: 1, delta: 0, deltaPct: 0 },
        totalWorkoutMinutes: { current: 60, previous: 45, delta: 15, deltaPct: 0.33 },
        totalCaloriesBurned: { current: 300, previous: 0, delta: 300, deltaPct: null },
        totalExerciseCount: { current: 5, previous: 4, delta: 1, deltaPct: 0.25 }
      },
      nutrition: {
        totalCaloriesConsumed: { current: 1850, previous: null, delta: null, deltaPct: null },
        totalProteinGrams: { current: 120, previous: null, delta: null, deltaPct: null },
        totalCarbsGrams: { current: 200, previous: null, delta: null, deltaPct: null },
        totalFatGrams: { current: 70, previous: null, delta: null, deltaPct: null }
      }
    });
  });

  it('loads the activity calendar with range params', () => {
    service.getActivityCalendar('2026-04-01', '2026-06-22').subscribe();

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/v1/analytics/activity/calendar' &&
        req.params.get('from') === '2026-04-01' &&
        req.params.get('to') === '2026-06-22'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      from: '2026-04-01',
      to: '2026-06-22',
      days: [{ date: '2026-06-22', workoutCount: 0, workoutMinutes: 0 }]
    });
  });

  function expectRangeBucketRequest(url: string, bucket: string): void {
    const request = httpTesting.expectOne(
      (req) =>
        req.url === url &&
        req.params.get('from') === '2026-04-01' &&
        req.params.get('to') === '2026-06-22' &&
        req.params.get('bucket') === bucket
    );
    expect(request.request.method).toBe('GET');
    request.flush({ from: '2026-04-01', to: '2026-06-22', bucket, points: [] });
  }

  function expectRangeRequest(url: string): void {
    const request = httpTesting.expectOne(
      (req) =>
        req.url === url &&
        req.params.get('from') === '2026-06-01' &&
        req.params.get('to') === '2026-06-22'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ from: '2026-06-01', to: '2026-06-22' });
  }
});
