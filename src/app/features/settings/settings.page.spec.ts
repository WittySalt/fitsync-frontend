import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  AccountCenterData,
  AccountDataService,
  AccountDataExportPayload,
  UserGoal
} from '../../core/account-data.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let authService: jasmine.SpyObj<AuthService>;
  let accountDataService: jasmine.SpyObj<AccountDataService>;

  const weightGoal: UserGoal = {
    goalId: 'goal-1',
    goalType: 'WEIGHT',
    targetValue: 68,
    targetUnit: 'kg',
    targetDate: '2026-09-30',
    status: 'ACTIVE',
    notes: 'Cut slowly while maintaining strength.'
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
      latestBodyMetrics: {
        metricId: 'metric-1',
        weightKg: 72.4,
        bodyFatRate: 18.2,
        waistCm: 82,
        hipCm: 96,
        chestCm: 98,
        armCm: 32,
        thighCm: 55.5,
        calfCm: 37,
        bmi: 24.5,
        measuredAt: '2026-06-16T07:20:00Z',
        source: 'MANUAL',
        note: 'Morning weigh-in'
      }
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
    sessions: [{
      sessionId: 'session-1',
      deviceLabel: 'Current browser',
      ipAddress: '127.0.0.1',
      issuedAt: '2026-06-16T07:00:00Z',
      expiresAt: '2026-06-17T07:00:00Z',
      current: true,
      revocable: false
    }],
    latestDataExport: {
      exportRequestId: 'export-1',
      status: 'READY',
      requestedAt: '2026-06-16T08:00:00Z',
      completedAt: '2026-06-16T08:01:00Z',
      downloadAvailable: true
    },
    accountDeletion: {
      status: 'NOT_REQUESTED',
      requestedAt: null,
      passwordConfirmationRequired: true
    }
  };

  beforeEach(async () => {
    localStorage.removeItem('fs-theme');
    document.documentElement.removeAttribute('data-theme');
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);

    authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);
    accountDataService = jasmine.createSpyObj<AccountDataService>(
      'AccountDataService',
      [
        'getAccountCenter',
        'updateProfile',
        'updatePreferences',
        'createBodyMetric',
        'replaceBodyMetric',
        'updateGoal',
        'updateRecoveryEmail',
        'requestDataExport',
        'downloadDataExport',
        'requestAccountDeletion'
      ]
    );
    accountDataService.getAccountCenter.and.returnValue(of(accountData));
    accountDataService.updateProfile.and.returnValue(of(accountData.user.profile));
    accountDataService.updatePreferences.and.returnValue(of(accountData.user.preferences));
    accountDataService.replaceBodyMetric.and.returnValue(of(accountData.user.latestBodyMetrics!));
    accountDataService.updateGoal.and.returnValue(of(weightGoal));
    accountDataService.requestDataExport.and.returnValue(of(accountData.latestDataExport!));
    accountDataService.downloadDataExport.and.returnValue(of({} as AccountDataExportPayload));
    accountDataService.requestAccountDeletion.and.returnValue(of(accountData.accountDeletion));

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AccountDataService, useValue: accountDataService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
  });

  it('renders the account center from the real account model groups', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Alice Tan');
    expect(text).toContain('Identity');
    expect(text).toContain('Gender');
    expect(text).toContain('Goals / targets');
    expect(text).toContain('Training defaults');
    expect(text).toContain('Download archive');
    expect(text).toContain('Cognito protected');
  });

  it('marks Cognito and derived fields as read-only instead of editable settings', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Managed by Cognito');
    expect(text).toContain('BMI');
    expect(text).toContain('Derived');
  });

  it('renders appearance controls and stores the selected theme preference', () => {
    const service = TestBed.inject(ThemeService);
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.appearance-toggle button')
    );
    const darkButton = buttons.find((button) => button.textContent?.trim() === 'Dark');
    const systemButton = buttons.find((button) => button.textContent?.trim() === 'System');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Appearance');
    expect(darkButton).toBeTruthy();
    expect(systemButton).toBeTruthy();

    darkButton?.click();
    fixture.detectChanges();

    expect(service.preference()).toBe('dark');
    expect(localStorage.getItem('fs-theme')).toBe('dark');
    expect(darkButton?.getAttribute('aria-checked')).toBe('true');

    systemButton?.click();
    fixture.detectChanges();

    expect(service.preference()).toBe('system');
    expect(localStorage.getItem('fs-theme')).toBe('system');
    expect(systemButton?.getAttribute('aria-checked')).toBe('true');
  });

  it('saves identity fields through the profile endpoint', () => {
    const component = fixture.componentInstance;

    component.startEdit('identity');
    component.identityForm.patchValue({
      displayName: 'Alice Training',
      gender: 'FEMALE',
      birthDate: '1995-04-12'
    });
    component.saveIdentity();

    expect(accountDataService.updateProfile).toHaveBeenCalledWith(jasmine.objectContaining({
      displayName: 'Alice Training',
      gender: 'FEMALE',
      birthDate: '1995-04-12'
    }));
  });

  it('updates goals through the goal endpoint', () => {
    const component = fixture.componentInstance;

    component.startGoalEdit('WEIGHT');
    component.goalForm.patchValue({ targetValue: '67.5', targetUnit: 'kg', status: 'ACTIVE' });
    component.saveGoal();

    expect(accountDataService.updateGoal).toHaveBeenCalledWith('WEIGHT', jasmine.objectContaining({
      targetValue: 67.5,
      targetUnit: 'kg',
      status: 'ACTIVE'
    }));
  });

  it('requests account data export from the privacy section', () => {
    fixture.componentInstance.requestDataExport();

    expect(accountDataService.requestDataExport).toHaveBeenCalled();
  });

  it('signs out from the account menu', () => {
    fixture.componentInstance.logout();

    expect(authService.logout).toHaveBeenCalled();
  });
});
