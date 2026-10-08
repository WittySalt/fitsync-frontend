import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import {
  AccountBodyMetric,
  AccountCenterData,
  AccountDataService
} from '../../core/account-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { BodyPage } from './body.page';

describe('BodyPage', () => {
  let fixture: ComponentFixture<BodyPage>;
  let accountDataService: jasmine.SpyObj<AccountDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  const latestMetric: AccountBodyMetric = {
    metricId: 'metric-2',
    weightKg: 71.8,
    bodyFatRate: 18.1,
    waistCm: 81,
    hipCm: 95,
    chestCm: 98,
    armCm: 32,
    thighCm: 55,
    calfCm: 37,
    bmi: 24.3,
    measuredAt: '2026-06-18T07:30:00Z',
    source: 'MANUAL',
    note: 'Morning check'
  };

  const olderMetric: AccountBodyMetric = {
    metricId: 'metric-1',
    weightKg: 73.2,
    bodyFatRate: 19.4,
    waistCm: 83,
    hipCm: 97,
    chestCm: 99,
    armCm: 32.5,
    thighCm: 56,
    calfCm: 37.5,
    bmi: 24.8,
    measuredAt: '2026-06-01T07:30:00Z',
    source: 'MANUAL',
    note: 'Baseline'
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
        bio: null,
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
      activeGoals: [],
      latestBodyMetrics: latestMetric
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
    accountDataService = jasmine.createSpyObj<AccountDataService>('AccountDataService', [
      'getAccountCenter',
      'listBodyMetrics',
      'updateProfile',
      'createBodyMetric',
      'replaceBodyMetric'
    ]);
    accountDataService.getAccountCenter.and.returnValue(of(accountData));
    accountDataService.listBodyMetrics.and.returnValue(of([latestMetric, olderMetric]));
    accountDataService.updateProfile.and.returnValue(of(accountData.user.profile));
    accountDataService.createBodyMetric.and.returnValue(of(latestMetric));
    accountDataService.replaceBodyMetric.and.returnValue(of(latestMetric));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [BodyPage],
      providers: [
        { provide: AccountDataService, useValue: accountDataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BodyPage);
    fixture.detectChanges();
  });

  it('loads raw body metrics and renders the body dashboard', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(accountDataService.listBodyMetrics).toHaveBeenCalledWith({ limit: 200 });
    expect(text).toContain('Body metrics');
    expect(text).toContain('71.8 kg');
    expect(text).toContain('-1.4 kg');
    expect(text).toContain('BMI');
    expect(text).toContain('Morning check');
  });

  it('filters and paginates measurement history client side', () => {
    const component = fixture.componentInstance;

    component.page.set(1);
    component.updateMetricFilter('bodyFatRate');
    component.updateDateFrom('2026-06-10');

    expect(component.page()).toBe(0);
    expect(component.filteredMetrics().length).toBe(1);
    expect(component.filteredMetrics()[0].metricId).toBe('metric-2');

    component.setPageSize(5);

    expect(component.pageSize()).toBe(5);
  });

  it('filters by the calendar day of a measurement in the profile zone, not its UTC day', () => {
    const component = fixture.componentInstance;
    // 12:30 UTC on 17 June is 00:30 on the 18th in Auckland and 05:30 on the 17th in Los Angeles.
    component.metrics.set([{ ...latestMetric, measuredAt: '2026-06-17T12:30:00Z' }]);
    component.updateDateFrom('2026-06-18');
    component.updateDateTo('2026-06-18');

    TestBed.inject(UserTimezoneService).setProfileZone('Pacific/Auckland');
    expect(component.filteredMetrics().length).toBe(1);

    TestBed.inject(UserTimezoneService).setProfileZone('America/Los_Angeles');
    expect(component.filteredMetrics().length).toBe(0);
  });

  it('jumps to a page of the measurement history inside the range', () => {
    const component = fixture.componentInstance;

    component.goToPage(-3);
    expect(component.currentPage()).toBe(0);
    component.goToPage(99);
    expect(component.currentPage()).toBe(component.totalPages() - 1);
  });

  it('creates a new measurement from the raw body-metrics endpoint', () => {
    const component = fixture.componentInstance;
    const measuredAt = '2026-06-19T08:15';

    component.openNewMeasurement();
    component.bodyForm.patchValue({
      heightCm: '172',
      weightKg: '71.2',
      bodyFatRate: '18',
      waistCm: '80.5',
      measuredAt,
      source: 'MANUAL',
      note: 'New low'
    });
    component.saveBody();

    expect(accountDataService.createBodyMetric).toHaveBeenCalledWith(jasmine.objectContaining({
      weightKg: 71.2,
      bodyFatRate: 18,
      waistCm: 80.5,
      measuredAt: new Date(measuredAt).toISOString(),
      note: 'New low'
    }));
    expect(accountDataService.replaceBodyMetric).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Measurement saved.');
  });

  it('replaces an existing measurement when editing a history row', () => {
    const component = fixture.componentInstance;

    component.editMetric(latestMetric);
    component.bodyForm.patchValue({ weightKg: '71.5' });
    component.saveBody();

    expect(accountDataService.replaceBodyMetric).toHaveBeenCalledWith('metric-2', jasmine.objectContaining({
      weightKg: 71.5
    }));
  });

  it('shows distinct load and empty states', () => {
    accountDataService.getAccountCenter.and.returnValue(throwError(() => new Error('body offline')));
    fixture.componentInstance.load();

    expect(fixture.componentInstance.error()).toBe('body offline');
    expect(fixture.componentInstance.loading()).toBeFalse();

    accountDataService.getAccountCenter.and.returnValue(of(accountData));
    accountDataService.listBodyMetrics.and.returnValue(of([]));
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No measurements yet');
  });
});
