import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import {
  AccountCenterData,
  AccountDataService,
  UserGoal
} from '../../core/account-data.service';
import { AnalyticsApiService } from '../../core/analytics-api.service';
import {
  AnalyticsActivityCalendarResponse,
  AnalyticsNutritionSeriesResponse,
  AnalyticsSummaryCompareResponse,
  AnalyticsWorkoutSeriesResponse
} from '../../core/analytics.models';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Goal } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { ProgressPage } from './progress.page';

describe('ProgressPage', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let accountDataService: jasmine.SpyObj<AccountDataService>;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;
  let toast: jasmine.SpyObj<ToastService>;

  const weightGoal: UserGoal = {
    goalId: 'goal-1',
    goalType: 'WEIGHT',
    targetValue: 68,
    targetUnit: 'kg',
    targetDate: '2026-09-30',
    status: 'ACTIVE',
    notes: 'Cut slowly while maintaining strength.'
  };

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

  const accountData: AccountCenterData = {
    user: {
      userId: 'user-1',
      email: 'alice@example.com',
      role: 'USER',
      profile: {
        displayName: 'Alice Tan',
        firstName: 'Alice',
        lastName: 'Tan',
        avatarUrl: null,
        birthDate: '1995-04-12',
        gender: 'FEMALE',
        heightCm: 172,
        activityLevel: 'MODERATELY_ACTIVE',
        timezone: 'Asia/Singapore',
        locationDisplay: 'Singapore',
        bio: 'Training for a stronger 10K.',
        membershipTier: 'MEMBER',
        membershipStatus: 'ACTIVE',
        onboardingCompleted: true
      },
      preferences: {
        app: {
          preferredUnits: '100001',
          language: '110001',
          timezone: 'Asia/Singapore',
          privacyLevel: '120001',
          dataSharingConsent: false
        },
        training: {
          fitnessLevel: '200002',
          trainingLocation: '210002',
          weeklyWorkoutDays: 4,
          preferredDurationMinutes: 45,
          preferredWorkoutTime: '07:30:00',
          intensityPreference: '220002'
        },
        nutrition: {
          dietaryPattern: '300001',
          mealFrequency: 3,
          calorieTrackingMode: '310002',
          macroPreference: '320001',
          waterGoalMl: 2500
        },
        notifications: {
          pushEnabled: true,
          emailEnabled: true,
          workoutReminderEnabled: true,
          mealReminderEnabled: false,
          weighInReminderEnabled: true,
          goalProgressReminderEnabled: true,
          weeklyProgressReportEnabled: true,
          weeklyProgressReportChannel: 'EMAIL',
          marketingEmailsEnabled: false,
          quietHoursStart: '22:00:00',
          quietHoursEnd: '07:00:00'
        }
      },
      activeGoals: [weightGoal],
      latestBodyMetrics: null
    },
    auth: {
      userId: 'user-1',
      email: 'alice@example.com',
      displayName: 'Alice Tan',
      role: 'USER',
      authProvider: 'COGNITO'
    },
    security: {
      authProvider: 'COGNITO',
      passwordManagedExternally: true,
      twoFactorEnabled: false,
      twoFactorConfigurable: false,
      recoveryEmail: 'alice@example.com',
      recoveryEmailUpdatable: false,
      sessionCount: 1,
      sessionTrackingAvailable: true,
      securityLabel: 'Cognito protected'
    },
    sessions: [],
    latestDataExport: null,
    accountDeletion: {
      status: 'NOT_REQUESTED',
      requestedAt: null,
      passwordConfirmationRequired: true
    }
  };

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getProgressGoals']);
    dataService.getProgressGoals.and.returnValue(of(goals));
    accountDataService = jasmine.createSpyObj<AccountDataService>('AccountDataService', [
      'getAccountCenter',
      'updateGoal'
    ]);
    accountDataService.getAccountCenter.and.returnValue(of(accountData));
    accountDataService.updateGoal.and.returnValue(of(weightGoal));
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
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [ProgressPage],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: AccountDataService, useValue: accountDataService },
        { provide: AnalyticsApiService, useValue: analyticsApi },
        { provide: ToastService, useValue: toast }
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
    expect(compiled.textContent).toContain('Add goal');
    expect(compiled.textContent).toContain('Edit');
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

  it('opens an add-goal editor with defaults', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const addButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="add-goal"]');
    addButton?.click();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.editingGoalType()).toBe('WEIGHT');
    expect(component.goalForm.controls.goalType.value).toBe('WEIGHT');
    expect(component.goalForm.controls.targetUnit.value).toBe('kg');
    expect(compiled.textContent).toContain('Goal editor');
  });

  it('opens a per-goal editor with the existing editable goal values', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const editButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="edit-goal-WEIGHT"]');
    editButton?.click();
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(component.editingGoalType()).toBe('WEIGHT');
    expect(component.goalForm.getRawValue()).toEqual(jasmine.objectContaining({
      goalType: 'WEIGHT',
      targetValue: '68',
      targetUnit: 'kg',
      targetDate: '2026-09-30',
      status: 'ACTIVE',
      notes: 'Cut slowly while maintaining strength.'
    }));
  });

  it('saves a goal through the account API and refreshes progress goals', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();
    dataService.getProgressGoals.calls.reset();
    accountDataService.getAccountCenter.calls.reset();

    const component = fixture.componentInstance;
    component.startGoalEdit('WEIGHT');
    component.goalForm.patchValue({
      targetValue: '67.5',
      targetUnit: 'kg',
      targetDate: '2026-10-01',
      status: 'ACTIVE',
      notes: 'Keep it sustainable.'
    });
    component.saveGoal();

    expect(accountDataService.updateGoal).toHaveBeenCalledWith('WEIGHT', jasmine.objectContaining({
      targetValue: 67.5,
      targetUnit: 'kg',
      targetDate: '2026-10-01',
      status: 'ACTIVE',
      notes: 'Keep it sustainable.'
    }));
    expect(dataService.getProgressGoals).toHaveBeenCalled();
    expect(accountDataService.getAccountCenter).toHaveBeenCalled();
    expect(component.editingGoalType()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Goal updated.');
  });

  it('does not save invalid goal values', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.startGoalEdit('WEIGHT');
    component.goalForm.patchValue({ targetValue: '-1' });
    component.saveGoal();

    expect(accountDataService.updateGoal).not.toHaveBeenCalled();
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
