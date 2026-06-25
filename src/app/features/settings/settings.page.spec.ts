import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import {
  AccountCenterData,
  AccountDataService,
  AccountDataExportPayload
} from '../../core/account-data.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/toast/toast.service';
import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let authService: jasmine.SpyObj<AuthService>;
  let accountDataService: jasmine.SpyObj<AccountDataService>;
  let toast: jasmine.SpyObj<ToastService>;

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
      activeGoals: [{
        goalId: 'goal-1',
        goalType: 'WEIGHT',
        targetValue: 68,
        targetUnit: 'kg',
        targetDate: '2026-09-30',
        status: 'ACTIVE',
        notes: 'Cut slowly while maintaining strength.'
      }],
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

    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'logout',
      'changePassword',
      'signOutEverywhere',
      'deleteAccount'
    ]);
    accountDataService = jasmine.createSpyObj<AccountDataService>(
      'AccountDataService',
      [
        'getAccountCenter',
        'updateProfile',
        'uploadAvatar',
        'updatePreferences',
        'createBodyMetric',
        'listBodyMetrics',
        'replaceBodyMetric',
        'updateRecoveryEmail',
        'requestDataExport',
        'downloadDataExport',
        'requestAccountDeletion'
      ]
    );
    accountDataService.getAccountCenter.and.returnValue(of(accountData));
    accountDataService.updateProfile.and.returnValue(of(accountData.user.profile));
    accountDataService.uploadAvatar.and.returnValue(of(accountData.user.profile));
    accountDataService.updatePreferences.and.returnValue(of(accountData.user.preferences));
    accountDataService.listBodyMetrics.and.returnValue(of([accountData.user.latestBodyMetrics!]));
    accountDataService.replaceBodyMetric.and.returnValue(of(accountData.user.latestBodyMetrics!));
    accountDataService.updateRecoveryEmail.and.returnValue(of({
      ...accountData.security,
      recoveryEmail: 'recovery@example.com',
      recoveryEmailUpdatable: true
    }));
    accountDataService.requestDataExport.and.returnValue(of(accountData.latestDataExport!));
    accountDataService.downloadDataExport.and.returnValue(of({} as AccountDataExportPayload));
    accountDataService.requestAccountDeletion.and.returnValue(of(accountData.accountDeletion));
    authService.changePassword.and.returnValue(of(undefined));
    authService.signOutEverywhere.and.returnValue(of(undefined));
    authService.deleteAccount.and.returnValue(of(undefined));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AccountDataService, useValue: accountDataService },
        { provide: ToastService, useValue: toast },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
  });

  it('renders the account center from the real account model groups', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Alice Tan');
    expect(text).toContain('Timezone');
    expect(text).toContain('Identity');
    expect(text).toContain('Gender');
    expect(text).toContain('Activity level');
    expect(text).toContain('Manage goals');
    expect(text).not.toContain('Region');
    expect(text).not.toContain('Goals / targets');
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[href="/me#goal-lifecycle"]')).not.toBeNull();
    // Section tabs: these live in non-default sections but the nav labels are always rendered.
    expect(text).toContain('Preferences');
    expect(text).toContain('Privacy & Data');
    expect(text).toContain('Security');
  });

  it('marks Cognito security fields as read-only instead of editable settings', () => {
    const component = fixture.componentInstance;

    component.selectedSection.set('security');
    fixture.detectChanges();
    const securityText = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(securityText).toContain('Managed by Cognito');
    expect(securityText).toContain('Cognito protected');
  });

  it('renders appearance controls and stores the selected theme preference', () => {
    const service = TestBed.inject(ThemeService);
    fixture.componentInstance.selectedSection.set('appearance');
    fixture.detectChanges();
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
    expect(darkButton?.getAttribute('aria-pressed')).toBe('true');

    systemButton?.click();
    fixture.detectChanges();

    expect(service.preference()).toBe('system');
    expect(localStorage.getItem('fs-theme')).toBe('system');
    expect(systemButton?.getAttribute('aria-pressed')).toBe('true');
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

  it('uses row-level settings edit affordances without duplicate section header edit buttons', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.sub-card-header .button.secondary.compact')).toBeNull();
    expect(compiled.textContent).toContain('Profile location');
    expect(compiled.textContent).not.toContain('LocationNot set');
  });

  it('formats account dates with the fixed English locale', () => {
    const component = fixture.componentInstance;

    component.data.set({
      ...accountData,
      user: {
        ...accountData.user,
        preferences: {
          ...accountData.user.preferences,
          app: {
            ...accountData.user.preferences.app,
            language: '110002'
          }
        }
      }
    });

    expect(component.displayDate('1995-04-12')).toBe('12 Apr 1995');
    expect(component.displayDateTime('2026-06-17T07:00:00Z')).toBe('17 Jun 2026, 3:00 pm');
    expect(component.displayDate('not-a-date')).toBe('Not set');
    expect(component.displayDateTime('not-a-date')).toBe('Not set');

    component.selectedSection.set('security');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('expires 17 Jun 2026, 3:00 pm');
    expect(text).not.toContain('2026年');
  });

  it('requests account data export from the privacy section', () => {
    fixture.componentInstance.requestDataExport();

    expect(accountDataService.requestDataExport).toHaveBeenCalled();
  });

  it('signs out from the account menu', () => {
    fixture.componentInstance.logout();

    expect(authService.logout).toHaveBeenCalled();
  });

  it('surfaces load and metric history failures without leaving loading flags set', () => {
    accountDataService.getAccountCenter.and.returnValue(throwError(() => new Error('settings offline')));

    fixture.componentInstance.load();

    expect(fixture.componentInstance.error()).toBe('settings offline');
    expect(fixture.componentInstance.loading()).toBeFalse();

  });

  it('covers display fallbacks, imperial formatting, labels, summaries, and menu closing', () => {
    const component = fixture.componentInstance;
    const imperialData: AccountCenterData = {
      ...accountData,
      user: {
        ...accountData.user,
        profile: {
          ...accountData.user.profile,
          heightCm: 180,
          locationDisplay: null,
          timezone: 'Asia/Singapore'
        },
        preferences: {
          ...accountData.user.preferences,
          app: {
            ...accountData.user.preferences.app,
            preferredUnits: '100002'
          },
          notifications: {
            ...accountData.user.preferences.notifications,
            weeklyProgressReportEnabled: false,
            quietHoursStart: null,
            quietHoursEnd: null
          }
        },
        latestBodyMetrics: {
          ...accountData.user.latestBodyMetrics!,
          weightKg: 72,
          bmi: null
        },
        activeGoals: []
      }
    };

    component.data.set(null);

    expect(component.accountType()).toBe('Account');
    expect(component.displayHeight(null)).toBe('Not set');
    expect(component.displayDateTime(null)).toBe('Not set');
    expect(component.displayDate(null)).toBe('Not set');
    expect(component.trainingDefaults()).toBe('Not set');
    expect(component.nutritionTracking()).toBe('Not set');
    expect(component.weeklyReportSummary()).toBe('Off');
    expect(component.quietHoursSummary()).toBe('Not set');
    expect(component.labelFor(null)).toBe('Not set');

    component.data.set(imperialData);

    expect(component.region()).toBe('Asia/Singapore');
    expect(component.displayHeight(180)).toBe('5 ft 11 in');
    expect(component.labelFor('VERY_ACTIVE')).toBe('Very Active');

    component.accountMenuOpen.set(true);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(component.accountMenuOpen()).toBeFalse();
  });

  it('handles edit cancellation', () => {
    const component = fixture.componentInstance;

    component.identityForm.patchValue({ displayName: 'Unsaved Name' });
    component.cancelEdit();

    expect(component.identityForm.controls.displayName.value).toBe('Alice Tan');
    expect(component.editPanel()).toBeNull();
  });

  it('saves location, activity, preferences, recovery email, exports, and deletion requests', () => {
    const component = fixture.componentInstance;

    component.locationForm.patchValue({
      locationDisplay: ' Singapore ',
      profileTimezone: 'Asia/Singapore',
      appTimezone: 'Asia/Singapore'
    });
    component.saveLocation();

    expect(accountDataService.updateProfile).toHaveBeenCalledWith(jasmine.objectContaining({
      locationDisplay: 'Singapore',
      timezone: 'Asia/Singapore'
    }));
    expect(accountDataService.updatePreferences).toHaveBeenCalledWith(jasmine.objectContaining({
      app: jasmine.objectContaining({ timezone: 'Asia/Singapore' })
    }));

    component.activityForm.patchValue({ activityLevel: 'VERY_ACTIVE' });
    component.saveActivity();

    expect(accountDataService.updateProfile).toHaveBeenCalledWith(jasmine.objectContaining({
      activityLevel: 'VERY_ACTIVE'
    }));

    component.trainingForm.patchValue({
      fitnessLevel: '200003',
      trainingLocation: '210002',
      weeklyWorkoutDays: '5',
      preferredDurationMinutes: '60',
      preferredWorkoutTime: '06:15',
      intensityPreference: '220003'
    });
    component.savePreferences('training');

    expect(accountDataService.updatePreferences).toHaveBeenCalledWith(jasmine.objectContaining({
      training: jasmine.objectContaining({
        weeklyWorkoutDays: 5,
        preferredDurationMinutes: 60,
        preferredWorkoutTime: '06:15:00'
      })
    }));

    component.nutritionForm.patchValue({ mealFrequency: '4', waterGoalMl: '2800' });
    component.savePreferences('nutrition');

    expect(accountDataService.updatePreferences).toHaveBeenCalledWith(jasmine.objectContaining({
      nutrition: jasmine.objectContaining({ mealFrequency: 4, waterGoalMl: 2800 })
    }));

    component.notificationsForm.patchValue({
      weeklyProgressReportEnabled: true,
      weeklyProgressReportChannel: 'PUSH',
      quietHoursStart: '21:30',
      quietHoursEnd: '06:45'
    });
    component.savePreferences('notifications');

    expect(accountDataService.updatePreferences).toHaveBeenCalledWith(jasmine.objectContaining({
      notifications: jasmine.objectContaining({
        weeklyProgressReportChannel: 'PUSH',
        quietHoursStart: '21:30:00',
        quietHoursEnd: '06:45:00'
      })
    }));

    component.formattingForm.patchValue({ preferredUnits: '100002', language: '110002' });
    component.savePreferences('formatting');
    component.privacyForm.patchValue({ privacyLevel: '120003', dataSharingConsent: true });
    component.savePreferences('privacy');

    expect(accountDataService.updatePreferences).toHaveBeenCalledWith(jasmine.objectContaining({
      app: jasmine.objectContaining({ privacyLevel: '120003', dataSharingConsent: true })
    }));

    component.data.set({
      ...accountData,
      security: { ...accountData.security, recoveryEmailUpdatable: true }
    });
    component.recoveryForm.patchValue({ email: 'recovery@example.com', currentPassword: 'password123' });
    component.saveRecoveryEmail();

    expect(accountDataService.updateRecoveryEmail).toHaveBeenCalledWith('recovery@example.com', 'password123');
    expect(component.recoveryForm.controls.currentPassword.value).toBe('');

    component.requestDataExport();
    component.downloadDataExport();

    expect(accountDataService.requestDataExport).toHaveBeenCalled();
    expect(accountDataService.downloadDataExport).toHaveBeenCalledWith('export-1');

    component.deletionForm.patchValue({ confirmationText: ' DELETE ', currentPassword: 'password123' });
    component.requestAccountDeletion();

    expect(accountDataService.requestAccountDeletion).toHaveBeenCalledWith('DELETE', 'password123');
    expect(toast.success).toHaveBeenCalledWith('Account deletion request submitted.');
  });

  it('uses the single privacy account deletion flow', () => {
    const component = fixture.componentInstance;
    component.selectedSection.set('security');
    fixture.detectChanges();

    let text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Delete Cognito account');
    expect(text).not.toContain('Delete login credential');

    component.selectedSection.set('privacy-data');
    fixture.detectChanges();
    text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Delete account');
    expect(text).toContain('Request account deletion');

    const deleteButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.danger-action');
    deleteButton?.click();
    fixture.detectChanges();

    expect(component.editPanel()).toBe('delete');
  });

  it('persists notification toggles inline with optimistic state', () => {
    const component = fixture.componentInstance;
    const updatedPreferences = {
      ...accountData.user.preferences,
      notifications: {
        ...accountData.user.preferences.notifications,
        mealReminderEnabled: true
      }
    };
    accountDataService.updatePreferences.and.returnValue(of(updatedPreferences));

    component.toggleNotification('mealReminderEnabled', true);

    expect(component.notificationToggleValue('mealReminderEnabled')).toBeTrue();
    expect(accountDataService.updatePreferences).toHaveBeenCalledWith(jasmine.objectContaining({
      notifications: jasmine.objectContaining({ mealReminderEnabled: true })
    }));
    expect(component.savingNotificationToggle()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Notifications updated.');
  });

  it('rolls back notification toggles when persistence fails', () => {
    const component = fixture.componentInstance;
    accountDataService.updatePreferences.and.returnValue(throwError(() => new Error('notifications failed')));

    component.toggleNotification('pushEnabled', false);

    expect(component.notificationToggleValue('pushEnabled')).toBeTrue();
    expect(component.sectionErrors().notifications).toBe('notifications failed');
    expect(component.savingNotificationToggle()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('notifications failed');
  });

  it('marks forms touched and skips service calls for invalid or unavailable save paths', () => {
    const component = fixture.componentInstance;

    accountDataService.updateProfile.calls.reset();
    accountDataService.updatePreferences.calls.reset();
    accountDataService.updateRecoveryEmail.calls.reset();
    accountDataService.requestDataExport.calls.reset();
    accountDataService.downloadDataExport.calls.reset();
    accountDataService.requestAccountDeletion.calls.reset();

    component.identityForm.patchValue({ displayName: '' });
    component.saveIdentity();
    component.locationForm.patchValue({ locationDisplay: 'x'.repeat(121) });
    component.saveLocation();
    component.trainingForm.patchValue({ weeklyWorkoutDays: '20' });
    component.savePreferences('training');
    component.recoveryForm.patchValue({ email: 'bad-email', currentPassword: '' });
    component.saveRecoveryEmail();
    component.deletionForm.patchValue({ confirmationText: 'no' });
    component.requestAccountDeletion();

    expect(accountDataService.updateProfile).not.toHaveBeenCalled();
    expect(accountDataService.updatePreferences).not.toHaveBeenCalled();
    expect(accountDataService.updateRecoveryEmail).not.toHaveBeenCalled();
    expect(accountDataService.requestAccountDeletion).not.toHaveBeenCalled();

    component.data.set(null);
    component.saveActivity();
    component.requestDataExport();
    component.downloadDataExport();

    expect(accountDataService.requestDataExport).not.toHaveBeenCalled();
    expect(accountDataService.downloadDataExport).not.toHaveBeenCalled();
  });

  it('records save errors from every asynchronous settings mutation', () => {
    const component = fixture.componentInstance;

    accountDataService.updateProfile.and.returnValue(throwError(() => new Error('profile failed')));
    component.saveActivity();

    expect(component.sectionErrors().activity).toBe('profile failed');
    expect(toast.error).toHaveBeenCalledWith('profile failed');

    accountDataService.updatePreferences.and.returnValue(throwError(() => new Error('preferences failed')));
    component.savePreferences('formatting');

    expect(component.sectionErrors().formatting).toBe('preferences failed');

    accountDataService.updateRecoveryEmail.and.returnValue(throwError(() => new Error('recovery failed')));
    component.data.set({
      ...accountData,
      security: { ...accountData.security, recoveryEmailUpdatable: true }
    });
    component.recoveryForm.patchValue({ email: 'recovery@example.com', currentPassword: 'password123' });
    component.saveRecoveryEmail();

    expect(component.sectionErrors().recovery).toBe('recovery failed');

    accountDataService.requestDataExport.and.returnValue(throwError(() => new Error('export failed')));
    component.requestDataExport();

    expect(component.sectionErrors().privacy).toBe('export failed');

    accountDataService.downloadDataExport.and.returnValue(throwError(() => new Error('download failed')));
    component.downloadDataExport();

    expect(component.sectionErrors().privacy).toBe('download failed');

    accountDataService.requestAccountDeletion.and.returnValue(throwError(() => new Error('delete failed')));
    component.deletionForm.patchValue({ confirmationText: 'DELETE', currentPassword: '' });
    component.requestAccountDeletion();

    expect(component.sectionErrors().delete).toBe('delete failed');
    expect(component.saving()).toBeNull();
  });

});
