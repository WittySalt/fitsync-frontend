import { CoachApiService } from '../../core/coach/coach-api.service';
import { CoachReading } from '../../core/coach/coach.models';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

// The page carries an insight panel. Its store is real; only the wire is stubbed. The reading is
// empty, so the panel takes no space and the specs about the page itself are not disturbed.
const emptyReading: CoachReading = {
  surface: 'PROGRESS',
  status: 'EMPTY',
  readingId: null,
  period: 'NONE',
  periodStart: null,
  periodEnd: null,
  facts: [],
  reading: null,
  lifts: []
};
const coachApiStub = {
  listRecommendations: () => of([]),
  refreshRecommendations: () => of(undefined),
  getReading: jasmine.createSpy('getReading').and.returnValue(of(emptyReading))
};

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

afterEach(() => jasmine.clock().uninstall());
  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getProgressGoals']);
    dataService.getProgressGoals.and.returnValue(of(goals));
    accountDataService = jasmine.createSpyObj<AccountDataService>('AccountDataService', [
      'getAccountCenter',
      'updateGoal',
      'deleteGoal',
      'listBodyMetrics'
    ]);
    accountDataService.getAccountCenter.and.returnValue(of(accountData));
    accountDataService.updateGoal.and.returnValue(of(weightGoal));
    accountDataService.deleteGoal.and.returnValue(of(undefined));
    // Needed once the embedded Body tab is rendered (BodyPage loads metrics on init).
    accountDataService.listBodyMetrics.and.returnValue(of([]));
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
        // The page carries an insight panel, whose store reaches HttpClient through the API client.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CoachApiService, useValue: coachApiStub },
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: AccountDataService, useValue: accountDataService },
        { provide: AnalyticsApiService, useValue: analyticsApi },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('mounts the insight panel for progress in place of the old coach block', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('app-insight-panel').length).toBe(1);
    expect(compiled.querySelector('app-coach-anchor')).toBeNull();
    expect(coachApiStub.getReading).toHaveBeenCalledWith('PROGRESS', jasmine.any(String));
  });

  it('defaults to the Overview tab: hub header and tabs, no body or goals detail', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;

    expect(dataService.getProgressGoals).toHaveBeenCalled();
    expect(component.selectedTab()).toBe('overview');
    expect(compiled.textContent).toContain('Your progress');
    expect(compiled.querySelector('#progress-tab-overview')).not.toBeNull();
    expect(compiled.querySelector('#progress-tab-body')).not.toBeNull();
    expect(compiled.querySelector('#progress-tab-goals')).not.toBeNull();
    // Body and Goals panels are not rendered until their tab is selected.
    expect(compiled.textContent).not.toContain('Latest weight');
    expect(compiled.textContent).not.toContain('Active goal progress');
  });

  it('shows active goal progress on the Goals tab', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-24T04:00:00Z'));
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();
    fixture.componentInstance.selectTab('goals');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Active goal progress');
    expect(compiled.textContent).toContain('Add goal');
    expect(compiled.textContent).toContain('Edit');
    expect(compiled.textContent).toContain('55%');
    expect(compiled.textContent).toContain('On track · 100 days left');
    expect(compiled.textContent).toContain('68 kg · 30 Sept');
    expect(compiled.textContent).not.toContain('2026-09-30');
    jasmine.clock().uninstall();
  });

  it('renders the Body tab through the embedded body page', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();
    fixture.componentInstance.selectTab('body');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-body-page')).not.toBeNull();
    // Embedded mode suppresses the standalone Body page heading.
    expect(compiled.textContent).not.toContain('Body metrics');
  });

  it('shows a goals empty state when no active goals exist', () => {
    dataService.getProgressGoals.and.returnValue(of([]));

    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();
    fixture.componentInstance.selectTab('goals');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No active goals');
  });

  it('opens an add-goal editor with defaults', () => {
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();
    fixture.componentInstance.selectTab('goals');
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
    fixture.componentInstance.selectTab('goals');
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
    fixture.componentInstance.selectTab('goals');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Goal progress unavailable');
    expect(compiled.textContent).toContain('Unable to load goal progress.');
  });

  describe('the Overview range', () => {
    function overview(): ComponentFixture<ProgressPage> {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date('2026-10-03T04:00:00Z'));
      const fixture = TestBed.createComponent(ProgressPage);
      fixture.detectChanges();
      return fixture;
    }

    it('opens on 90 days and gives the trend charts and the heatmap the same range', () => {
      const fixture = overview();

      expect(fixture.componentInstance.activeDays()).toBe(90);
      expect(analyticsApi.getWorkoutSeries).toHaveBeenCalledWith('2026-07-05', '2026-10-03', 'WEEK');
      expect(analyticsApi.getActivityCalendar).toHaveBeenCalledWith('2026-07-05', '2026-10-03');
    });

    it('shows one range control, with the chosen preset visibly selected', () => {
      const fixture = overview();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelectorAll('app-progress-range').length).toBe(1);
      expect(element.querySelectorAll('input[type="date"]').length).toBe(0);
      const active = element.querySelector('app-progress-range .presets button.active');
      expect(active?.textContent?.trim()).toBe('90 days');
      expect(active?.getAttribute('aria-pressed')).toBe('true');
    });

    it('moves the charts and the heatmap together when a preset is chosen', () => {
      const fixture = overview();
      const element = fixture.nativeElement as HTMLElement;

      element.querySelectorAll<HTMLButtonElement>('app-progress-range .presets button')[0].click();
      fixture.detectChanges();

      expect(analyticsApi.getWorkoutSeries.calls.mostRecent().args.slice(0, 2)).toEqual(['2026-09-03', '2026-10-03']);
      expect(analyticsApi.getActivityCalendar.calls.mostRecent().args).toEqual(['2026-09-03', '2026-10-03']);
      expect(element.querySelector('app-progress-range .presets button.active')?.textContent?.trim()).toBe('30 days');
    });

    it('keeps the custom start and end behind More, and applies them to both', () => {
      const fixture = overview();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('#progress-range-more')).toBeNull();

      element.querySelector<HTMLButtonElement>('app-progress-range .more')?.click();
      fixture.detectChanges();
      expect(element.querySelector('#progress-range-more')).not.toBeNull();
      fixture.componentInstance.chooseCustomRange({ from: '2026-08-01', to: '2026-08-31' });
      fixture.detectChanges();

      expect(analyticsApi.getWorkoutSeries.calls.mostRecent().args.slice(0, 2)).toEqual(['2026-08-01', '2026-08-31']);
      expect(analyticsApi.getActivityCalendar.calls.mostRecent().args).toEqual(['2026-08-01', '2026-08-31']);
      expect(fixture.componentInstance.activeDays()).toBeNull();
      expect(element.querySelector('app-progress-range .presets button.active')).toBeNull();
    });

    it('sends the profile zone with the period comparison', () => {
      overview();

      expect(analyticsApi.getSummaryCompare).toHaveBeenCalledWith('WEEK', 'Asia/Singapore');
    });

    it('shows no ISO date anywhere on the Overview tab, aria labels included', () => {
      const fixture = overview();

      const html = (fixture.nativeElement as HTMLElement).innerHTML.replace(/value="\d{4}-\d{2}-\d{2}"/g, '');
      expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('writes the page header without a dash', () => {
      const fixture = overview();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Training, nutrition, body and goals in one place.');
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('—');
    });

    it('shows the coach reading on the Overview tab only', () => {
      const fixture = overview();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelectorAll('app-insight-panel').length).toBe(1);

      fixture.componentInstance.selectTab('goals');
      fixture.detectChanges();
      expect(element.querySelectorAll('app-insight-panel').length).toBe(0);

      fixture.componentInstance.selectTab('body');
      fixture.detectChanges();
      expect(element.querySelectorAll('app-insight-panel').length).toBe(0);

      fixture.componentInstance.selectTab('overview');
      fixture.detectChanges();
      expect(element.querySelectorAll('app-insight-panel').length).toBe(1);
    });
  });

  describe('the Goals tab', () => {
    const paused: Goal = {
      goalType: 'PROTEIN',
      targetValue: 140,
      targetUnit: 'g',
      targetDate: '2026-11-30',
      status: 'PAUSED',
      progressRatio: 0.2,
      onTrack: null
    };
    const completed: Goal = { ...paused, goalType: 'CALORIES', targetValue: 2100, targetUnit: 'kcal', status: 'COMPLETED', progressRatio: 1 };

    function goalsTab(): ComponentFixture<ProgressPage> {
      const fixture = TestBed.createComponent(ProgressPage);
      fixture.detectChanges();
      fixture.componentInstance.selectTab('goals');
      fixture.detectChanges();
      return fixture;
    }

    function text(fixture: ComponentFixture<ProgressPage>): string {
      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    }

    function saveWeight(fixture: ComponentFixture<ProgressPage>, value: number): void {
      const component = fixture.componentInstance;
      accountDataService.updateGoal.and.returnValue(of({ ...weightGoal, targetValue: value }));
      component.startGoalEdit('WEIGHT');
      component.goalForm.patchValue({ targetValue: String(value) });
      component.saveGoal();
    }

    it('lists paused and completed goals in a separate Not active group', () => {
      dataService.getProgressGoals.and.returnValue(of([...goals, paused, completed]));
      const fixture = goalsTab();
      const element = fixture.nativeElement as HTMLElement;

      const group = element.querySelector('.inactive-goals');
      expect(group?.querySelector('h3')?.textContent).toBe('Not active');
      expect(group?.querySelectorAll('.goal-row').length).toBe(2);
      expect(group?.textContent).toContain('Paused');
      expect(group?.textContent).toContain('Completed');
      expect(element.querySelector('.goal-list:not(.inactive-goals)')?.querySelectorAll('.goal-row').length).toBe(1);
    });

    it('still lists the Not active group when no goal is active', () => {
      dataService.getProgressGoals.and.returnValue(of([paused]));
      const fixture = goalsTab();

      expect(text(fixture)).toContain('No active goals');
      expect(text(fixture)).toContain('Not active');
    });

    it('has no Not active group when every goal is active', () => {
      const fixture = goalsTab();

      expect((fixture.nativeElement as HTMLElement).querySelector('.inactive-goals')).toBeNull();
    });

    it('shows the saved value at once, while the progress list still holds the old one', () => {
      jasmine.clock().install();
      const fixture = goalsTab();

      saveWeight(fixture, 66);
      fixture.detectChanges();

      expect(text(fixture)).toContain('66 kg');
      expect(text(fixture)).not.toContain('68 kg');
    });

    it('asks again a few times and drops the saved copy once the list agrees', () => {
      jasmine.clock().install();
      const fixture = goalsTab();
      dataService.getProgressGoals.calls.reset();

      saveWeight(fixture, 66);
      expect(dataService.getProgressGoals).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(1500);
      expect(dataService.getProgressGoals).toHaveBeenCalledTimes(2);

      dataService.getProgressGoals.and.returnValue(of([{ ...goals[0], targetValue: 66 }]));
      jasmine.clock().tick(1500);
      expect(dataService.getProgressGoals).toHaveBeenCalledTimes(3);

      jasmine.clock().tick(10_000);
      expect(dataService.getProgressGoals).toHaveBeenCalledTimes(3);
      fixture.detectChanges();
      expect(text(fixture)).toContain('66 kg');
    });

    it('stops asking after three more tries and still shows what was saved', () => {
      jasmine.clock().install();
      const fixture = goalsTab();
      dataService.getProgressGoals.calls.reset();

      saveWeight(fixture, 66);
      jasmine.clock().tick(60_000);

      expect(dataService.getProgressGoals).toHaveBeenCalledTimes(4);
      fixture.detectChanges();
      expect(text(fixture)).toContain('66 kg');
    });

    it('moves the focus into the editor when it opens', async () => {
      const fixture = goalsTab();
      const holder = document.createElement('div');
      document.body.appendChild(holder);
      holder.appendChild(fixture.nativeElement);

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="edit-goal-WEIGHT"]')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const editor = (fixture.nativeElement as HTMLElement).querySelector('form.goal-editor');
      expect(editor?.contains(document.activeElement)).toBeTrue();
      holder.remove();
    });

    it('offers a red Delete goal action that asks before it deletes', () => {
      const fixture = goalsTab();
      const element = fixture.nativeElement as HTMLElement;
      const button = element.querySelector<HTMLButtonElement>('[data-testid="delete-goal-WEIGHT"]');

      expect(button?.textContent?.trim()).toBe('Delete goal');
      expect(button?.classList).toContain('danger-text');

      button?.click();
      fixture.detectChanges();

      expect(accountDataService.deleteGoal).not.toHaveBeenCalled();
      const dialog = element.querySelector('app-confirm-dialog');
      expect(dialog?.textContent).toContain('Delete this goal?');
      expect(dialog?.querySelector('.confirm')?.classList).toContain('danger');
    });

    it('leaves the goal alone when the dialog is cancelled', () => {
      const fixture = goalsTab();
      const element = fixture.nativeElement as HTMLElement;

      element.querySelector<HTMLButtonElement>('[data-testid="delete-goal-WEIGHT"]')?.click();
      fixture.detectChanges();
      element.querySelector<HTMLButtonElement>('app-confirm-dialog .cancel')?.click();
      fixture.detectChanges();

      expect(accountDataService.deleteGoal).not.toHaveBeenCalled();
      expect(element.querySelector('app-confirm-dialog')).toBeNull();
      expect(text(fixture)).toContain('Weight');
    });

    it('deletes through the account API and takes the goal off the page while the list catches up', () => {
      jasmine.clock().install();
      const fixture = goalsTab();
      const element = fixture.nativeElement as HTMLElement;

      element.querySelector<HTMLButtonElement>('[data-testid="delete-goal-WEIGHT"]')?.click();
      fixture.detectChanges();
      element.querySelector<HTMLButtonElement>('app-confirm-dialog .confirm')?.click();
      fixture.detectChanges();

      expect(accountDataService.deleteGoal).toHaveBeenCalledWith('WEIGHT');
      expect(toast.success).toHaveBeenCalledWith('Goal deleted.');
      expect(element.querySelector('app-confirm-dialog')).toBeNull();
      expect(element.querySelector('[data-testid="edit-goal-WEIGHT"]')).toBeNull();
      expect(text(fixture)).toContain('No active goals');
    });

    it('says so and keeps the goal when the delete fails', () => {
      accountDataService.deleteGoal.and.returnValue(throwError(() => new Error('nope')));
      const fixture = goalsTab();
      const element = fixture.nativeElement as HTMLElement;

      element.querySelector<HTMLButtonElement>('[data-testid="delete-goal-WEIGHT"]')?.click();
      fixture.detectChanges();
      element.querySelector<HTMLButtonElement>('app-confirm-dialog .confirm')?.click();
      fixture.detectChanges();

      expect(toast.error).toHaveBeenCalledWith('Unable to delete goal. Please retry.');
      expect(element.querySelector('[data-testid="edit-goal-WEIGHT"]')).not.toBeNull();
    });
  });
});
