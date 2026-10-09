import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import {
  AccountCenterData,
  AccountDataService,
  AccountDataExportPayload
} from '../../core/account-data.service';
import { AuthService } from '../../core/auth/auth.service';
import { SessionsApiService } from '../../core/auth/sessions-api.service';
import { anchorSteps } from '../../core/guide/guide-testing.spec';
import { GuideService } from '../../core/guide/guide.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/toast/toast.service';
import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let authService: jasmine.SpyObj<AuthService>;
  let accountDataService: jasmine.SpyObj<AccountDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let router: Router;

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
      'deleteAccount',
      'noteDeletionRequested',
      'completeLogout',
      'hasRefreshToken'
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
        'requestAccountDeletion',
        'invalidateCurrentUser'
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
    authService.hasRefreshToken.and.returnValue(false);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AccountDataService, useValue: accountDataService },
        { provide: ToastService, useValue: toast },
        { provide: SessionsApiService, useValue: jasmine.createSpyObj<SessionsApiService>('SessionsApiService', ['list', 'revoke', 'revokeOthers']) },
        provideRouter([])
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
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

  it('opens the section named in the link, such as the nutrient reference ranges in Preferences', () => {
    const url = spyOnProperty(router, 'url', 'get').and.returnValue('/settings?section=preferences');
    const linked = TestBed.createComponent(SettingsPage);
    linked.detectChanges();
    expect(linked.componentInstance.selectedSection()).toBe('preferences');

    url.and.returnValue('/settings?section=nonsense');
    const unknown = TestBed.createComponent(SettingsPage);
    unknown.detectChanges();
    expect(unknown.componentInstance.selectedSection()).toBe('personal');
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

  it('anchors the sections rail and, in Appearance, the guide button for the Settings path', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(anchorSteps(el, 'settings')).toContain('sections');
    el.querySelector<HTMLButtonElement>('#settings-tab-appearance')?.click();
    fixture.detectChanges();
    expect(anchorSteps(el, 'settings')).toContain('guide');
  });

  it('restarts the guide from the Appearance section and says so', () => {
    const guide = TestBed.inject(GuideService);
    spyOn(guide, 'restart');
    fixture.componentInstance.selectedSection.set('appearance');
    fixture.detectChanges();

    const row = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-test="show-guide"]');
    expect(row?.textContent).toContain('Show the guide again');
    row?.click();

    expect(guide.restart).toHaveBeenCalledWith('user-1');
    expect(toast.success).toHaveBeenCalledWith('The guide is back on Home, and the first tour will play again.');
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

  it('shows a birth date as the same calendar date whatever the account zone', () => {
    const component = fixture.componentInstance;
    const withZone = (timezone: string) =>
      component.data.set({
        ...accountData,
        user: {
          ...accountData.user,
          preferences: { ...accountData.user.preferences, app: { ...accountData.user.preferences.app, timezone } }
        }
      });

    // Far behind and far ahead of UTC, so device midnight read in the account zone would move the day.
    withZone('America/Los_Angeles');
    expect(component.displayDate('1995-04-12')).toBe('12 Apr 1995');
    withZone('Pacific/Kiritimati');
    expect(component.displayDate('1995-04-12')).toBe('12 Apr 1995');
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
    expect(text).toContain('Your devices');
    expect(text).toContain('Device list is not available yet.');
    expect(text).not.toContain('127.0.0.1');
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

  it('shows the four reference range options and the menstruation note unless female is chosen', () => {
    const component = fixture.componentInstance;
    component.selectedSection.set('preferences');
    component.startEdit('nutrition');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const select = Array.from(root.querySelectorAll('select')).find((el) => el.getAttribute('formControlName') === 'nutrientReferenceRange') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual(['Based on my profile', 'Female ranges', 'Male ranges', 'Blended ranges']);
    expect(component.nutritionForm.controls.nutrientReferenceRange.value).toBe('PROFILE');
    expect(root.textContent).toContain('Daily amounts in nutrition science are set for female and male bodies.');
    expect(root.querySelector('[data-testid="range-menstruate-note"]')).not.toBeNull();

    component.nutritionForm.controls.nutrientReferenceRange.setValue('FEMALE');
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="range-menstruate-note"]')).toBeNull();
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

    component.nutritionForm.patchValue({ mealFrequency: '4', waterGoalMl: '2800', nutrientReferenceRange: 'FEMALE' });
    component.savePreferences('nutrition');

    expect(accountDataService.updatePreferences).toHaveBeenCalledWith(jasmine.objectContaining({
      nutrition: jasmine.objectContaining({ mealFrequency: 4, waterGoalMl: 2800, nutrientReferenceRange: 'FEMALE' })
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
    expect(authService.completeLogout).toHaveBeenCalled();
  });

  it('signs out after a deletion request and hands the date to the sign-in page', () => {
    const component = fixture.componentInstance;
    accountDataService.requestAccountDeletion.and.returnValue(of({
      status: 'REQUESTED',
      requestedAt: '2026-10-01T08:00:00Z',
      scheduledFor: '2026-10-31T12:00:00Z',
      passwordConfirmationRequired: false
    }));

    component.data.set({ ...accountData, accountDeletion: { ...accountData.accountDeletion, passwordConfirmationRequired: false } });
    component.deletionForm.patchValue({ confirmationText: 'DELETE', currentPassword: '' });
    component.requestAccountDeletion();

    expect(authService.noteDeletionRequested).toHaveBeenCalledWith('2026-10-31T12:00:00Z');
    expect(authService.completeLogout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/login');
    expect(accountDataService.invalidateCurrentUser).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(component.saving()).toBeNull();
  });

  it('says what happens before any request and names the submit button plainly', () => {
    const component = fixture.componentInstance;
    component.selectedSection.set('privacy-data');
    component.startEdit('delete');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const submit = element.querySelector<HTMLButtonElement>('.danger-zone button.danger');
    const zoneText = element.querySelector('.danger-zone')?.textContent ?? '';
    expect(zoneText).toContain(
      'Deleting your account signs you out and schedules your data for removal in 30 days. Signing in again within that time cancels it.'
    );
    expect(zoneText).toContain('Export your data first if you want to keep a copy.');
    expect(zoneText).not.toContain('Your account is scheduled for deletion');
    expect(submit?.textContent?.trim()).toBe('Delete my account');
    expect(element.querySelector('.danger-zone')?.textContent).not.toContain('Submit deletion request');
  });

  it('keeps the pending wording with the date when a removal date is already known', () => {
    const component = fixture.componentInstance;
    const status = {
      status: 'NOT_REQUESTED',
      requestedAt: '2026-10-01T08:00:00Z',
      scheduledFor: '2026-10-31T12:00:00Z',
      passwordConfirmationRequired: false
    };
    component.data.set({ ...accountData, accountDeletion: status });

    expect(component.deletionGraceLine(status)).toBe(
      'Your account is scheduled for deletion and you are signed out. Sign in again before 31 Oct 2026 to cancel. After that, your data is removed.'
    );
  });

  it('keeps the pending wording without a date when only the status says a request was made', () => {
    const status = { status: 'REQUESTED', requestedAt: null, scheduledFor: null, passwordConfirmationRequired: false };

    expect(fixture.componentInstance.deletionGraceLine(status)).toBe(
      'Your account is scheduled for deletion and you are signed out. Sign in again within 30 days to cancel. After that, your data is removed.'
    );
  });

  describe('delete account form', () => {
    function openDeleteForm(): HTMLElement {
      fixture.componentInstance.selectedSection.set('privacy-data');
      fixture.componentInstance.startEdit('delete');
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    function type(element: HTMLElement, selector: string, value: string): void {
      const input = element.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    function submitButton(element: HTMLElement): HTMLButtonElement {
      return element.querySelector<HTMLButtonElement>('.danger-zone form button.danger')!;
    }

    it('names the word to type in the label and links the input to its hint', () => {
      const element = openDeleteForm();
      const input = element.querySelector<HTMLInputElement>('#delete-confirmation')!;

      expect(input.closest('label')?.textContent).toContain('Type DELETE to confirm');
      expect(input.getAttribute('aria-describedby')).toBe('delete-confirmation-hint');
      expect(element.querySelector('#delete-confirmation-hint')?.textContent).toContain('Use capital letters.');
      expect(element.querySelector<HTMLInputElement>('#delete-password')?.closest('label')?.textContent).toContain('Current password');
    });

    it('keeps the delete button disabled until the text and the password are there', () => {
      const element = openDeleteForm();
      expect(submitButton(element).disabled).toBeTrue();

      type(element, '#delete-confirmation', 'DELET');
      type(element, '#delete-password', 'password123');
      expect(submitButton(element).disabled).toBeTrue();

      type(element, '#delete-confirmation', ' DELETE ');
      expect(submitButton(element).disabled).toBeFalse();

      type(element, '#delete-password', '');
      expect(submitButton(element).disabled).toBeTrue();
    });

    it('does not accept a lowercase delete, because the server compares it exactly', () => {
      const element = openDeleteForm();
      type(element, '#delete-password', 'password123');
      type(element, '#delete-confirmation', 'delete');

      expect(submitButton(element).disabled).toBeTrue();
      fixture.componentInstance.requestAccountDeletion();
      expect(accountDataService.requestAccountDeletion).not.toHaveBeenCalled();
    });

    it('hides the password field and does not ask for it when the account has none', () => {
      fixture.componentInstance.data.set({
        ...accountData,
        accountDeletion: { ...accountData.accountDeletion, passwordConfirmationRequired: false }
      });
      const element = openDeleteForm();

      expect(element.querySelector('#delete-password')).toBeNull();
      type(element, '#delete-confirmation', 'DELETE');
      expect(submitButton(element).disabled).toBeFalse();
    });

    it('shows a loading label and keeps the button disabled while the request runs', () => {
      const pending = new Subject<never>();
      accountDataService.requestAccountDeletion.and.returnValue(pending);
      const element = openDeleteForm();
      type(element, '#delete-confirmation', 'DELETE');
      type(element, '#delete-password', 'password123');

      submitButton(element).click();
      fixture.detectChanges();

      expect(submitButton(element).textContent?.trim()).toBe('Deleting...');
      expect(submitButton(element).disabled).toBeTrue();
      expect(element.querySelector('.danger-zone form')?.getAttribute('aria-busy')).toBe('true');
      expect(accountDataService.requestAccountDeletion).toHaveBeenCalledTimes(1);
    });

    it('shows the reason the server gave when it refuses the request', () => {
      accountDataService.requestAccountDeletion.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 401,
        error: { status: 401, error: 'Unauthorized', message: 'Current password is invalid', details: [] }
      })));
      const element = openDeleteForm();
      type(element, '#delete-confirmation', 'DELETE');
      type(element, '#delete-password', 'wrong-password');

      submitButton(element).click();
      fixture.detectChanges();

      const alert = element.querySelector('.danger-zone form [role="alert"]');
      expect(alert?.textContent?.trim()).toBe('Current password is invalid');
      expect(toast.error).toHaveBeenCalledWith('Current password is invalid');
      expect(submitButton(element).textContent?.trim()).toBe('Delete my account');
      expect(submitButton(element).disabled).toBeFalse();
      expect(authService.completeLogout).not.toHaveBeenCalled();
    });

    it('reads a ProblemDetail detail and falls back to a plain line when there is no reason', () => {
      accountDataService.requestAccountDeletion.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 400,
        error: { title: 'Bad Request', detail: 'Confirmation text must be DELETE' }
      })));
      const element = openDeleteForm();
      type(element, '#delete-confirmation', 'DELETE');
      type(element, '#delete-password', 'password123');
      submitButton(element).click();
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe('Confirmation text must be DELETE');

      accountDataService.requestAccountDeletion.and.returnValue(throwError(() => new HttpErrorResponse({ status: 502, error: '' })));
      submitButton(element).click();
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe('Your account was not deleted. Try again.');
    });

    it('signs out and goes to the sign-in page when the request succeeds', () => {
      const element = openDeleteForm();
      type(element, '#delete-confirmation', 'DELETE');
      type(element, '#delete-password', 'password123');

      submitButton(element).click();

      expect(accountDataService.requestAccountDeletion).toHaveBeenCalledWith('DELETE', 'password123');
      expect(authService.completeLogout).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/login');
    });

    it('clears the typed text when the form is cancelled', () => {
      const element = openDeleteForm();
      type(element, '#delete-confirmation', 'DELETE');

      fixture.componentInstance.cancelEdit();

      expect(fixture.componentInstance.deletionForm.getRawValue().confirmationText).toBe('');
    });
  });

  it('shows the scheduled date and a sign-out button instead of the form when a deletion is pending', () => {
    const component = fixture.componentInstance;
    component.data.set({
      ...accountData,
      accountDeletion: {
        status: 'REQUESTED',
        requestedAt: '2026-10-01T08:00:00Z',
        scheduledFor: '2026-10-31T12:00:00Z',
        passwordConfirmationRequired: false
      }
    });
    component.selectedSection.set('privacy-data');
    fixture.detectChanges();

    const zone = (fixture.nativeElement as HTMLElement).querySelector('.danger-zone');
    expect(zone?.textContent).toContain('This account is scheduled for deletion on 31 Oct 2026.');
    expect(zone?.querySelector('form')).toBeNull();
    expect(zone?.querySelector('button.danger-action')).toBeNull();
    const signOut = Array.from(zone?.querySelectorAll('button') ?? []).find((candidate) => candidate.textContent?.trim() === 'Sign out');
    signOut?.click();
    expect(authService.logout).toHaveBeenCalled();
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
    component.deletionForm.patchValue({ confirmationText: 'DELETE', currentPassword: 'password123' });
    component.requestAccountDeletion();

    expect(component.sectionErrors().delete).toBe('Your account was not deleted. Try again.');
    expect(component.saving()).toBeNull();
  });

});
