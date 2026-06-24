import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  AccountCenterData,
  AccountDataService,
  AccountPreferences,
  AccountProfile,
  AccountSummary,
  AccountUserResponse,
  CreateBodyMetricRequest,
  SecurityOverview,
  initialsFor
} from './account-data.service';

describe('AccountDataService', () => {
  let service: AccountDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AccountDataService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AccountDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists body metrics with the backend history query parameters', () => {
    let result: unknown;

    service.listBodyMetrics({
      from: '2026-01-01T00:00:00Z',
      to: '2026-06-01T00:00:00Z',
      limit: 50
    }).subscribe((metrics) => {
      result = metrics;
    });

    const request = httpTesting.expectOne((entry) =>
      entry.url === '/api/v1/users/me/body-metrics' &&
      entry.params.get('from') === '2026-01-01T00:00:00Z' &&
      entry.params.get('to') === '2026-06-01T00:00:00Z' &&
      entry.params.get('limit') === '50'
    );
    request.flush([
      {
        metricId: 'metric-1',
        weightKg: 72.4,
        bodyFatRate: 18.2,
        waistCm: 82,
        measuredAt: '2026-06-01T08:00:00Z',
        source: 'MANUAL'
      }
    ]);

    expect(result).toEqual([jasmine.objectContaining({
      metricId: 'metric-1',
      weightKg: 72.4,
      measuredAt: '2026-06-01T08:00:00Z'
    })]);
  });

  it('uploads avatars as multipart form data without forcing the content type', () => {
    const avatar = new Blob(['avatar'], { type: 'image/png' });
    let result: unknown;

    service.uploadAvatar(avatar).subscribe((profile) => {
      result = profile;
    });

    const request = httpTesting.expectOne('/api/v1/users/me/profile/avatar');
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    expect(request.request.headers.has('Content-Type')).toBeFalse();

    const form = request.request.body as FormData;
    expect(form.get('file')).toEqual(jasmine.any(Blob));

    request.flush({
      displayName: 'Alice Tan',
      firstName: 'Alice',
      lastName: 'Tan',
      avatarUrl: 'https://cdn.example/avatar.png',
      birthDate: null,
      gender: null,
      heightCm: null,
      activityLevel: null,
      timezone: null,
      locationDisplay: null,
      bio: null,
      membershipTier: null,
      membershipStatus: null,
      onboardingCompleted: true
    });

    expect(result).toEqual(jasmine.objectContaining({
      avatarUrl: 'https://cdn.example/avatar.png'
    }));
  });

  it('lists body metrics without query parameters by default', () => {
    service.listBodyMetrics().subscribe();

    const request = httpTesting.expectOne('/api/v1/users/me/body-metrics');
    expect(request.request.params.keys()).toEqual([]);
    request.flush([]);
  });

  it('updates profile and preferences through the account endpoints', () => {
    const profile = profileFixture({ displayName: 'Updated User' });
    const preferences = preferencesFixture();
    let profileResult: AccountProfile | undefined;
    let preferencesResult: AccountPreferences | undefined;

    service.updateProfile(profile).subscribe((result) => {
      profileResult = result;
    });
    const profileRequest = httpTesting.expectOne('/api/v1/users/me/profile');
    expect(profileRequest.request.method).toBe('PUT');
    expect(profileRequest.request.body).toEqual(profile);
    profileRequest.flush(profile);

    service.updatePreferences(preferences).subscribe((result) => {
      preferencesResult = result;
    });
    const preferencesRequest = httpTesting.expectOne('/api/v1/users/me/preferences');
    expect(preferencesRequest.request.method).toBe('PUT');
    expect(preferencesRequest.request.body).toEqual(preferences);
    preferencesRequest.flush(preferences);

    expect(profileResult?.displayName).toBe('Updated User');
    expect(preferencesResult?.app.language).toBe('en');
  });

  it('creates and replaces body metrics through the expected endpoints', () => {
    const metricRequest: CreateBodyMetricRequest = {
      weightKg: 72,
      bodyFatRate: null,
      waistCm: null,
      hipCm: null,
      chestCm: null,
      armCm: null,
      thighCm: null,
      calfCm: null,
      measuredAt: '2026-06-21T08:00:00Z',
      source: 'MANUAL',
      note: null
    };

    service.createBodyMetric(metricRequest).subscribe();
    const createRequest = httpTesting.expectOne('/api/v1/users/me/body-metrics');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(metricRequest);
    createRequest.flush({ metricId: 'metric-1', ...metricRequest, bmi: null });

    service.replaceBodyMetric('metric-1', metricRequest).subscribe();
    const replaceRequest = httpTesting.expectOne('/api/v1/users/me/body-metrics/metric-1');
    expect(replaceRequest.request.method).toBe('PUT');
    expect(replaceRequest.request.body).toEqual(metricRequest);
    replaceRequest.flush({ metricId: 'metric-1', ...metricRequest, bmi: null });
  });

  it('updates goals and security recovery email via their API routes', () => {
    service.updateGoal('WEIGHT', {
      targetValue: 70,
      targetUnit: 'kg',
      targetDate: null,
      status: 'ACTIVE',
      notes: null
    }).subscribe();

    const goalRequest = httpTesting.expectOne('/api/v1/users/me/goals/WEIGHT');
    expect(goalRequest.request.method).toBe('PUT');
    expect(goalRequest.request.body.targetValue).toBe(70);
    goalRequest.flush({ goalId: 'goal-1', goalType: 'WEIGHT', targetValue: 70, targetUnit: 'kg', targetDate: null, status: 'ACTIVE', notes: null });

    service.updateRecoveryEmail('new@example.com', 'current-password').subscribe();
    const recoveryRequest = httpTesting.expectOne('/api/v1/auth/security/recovery-email');
    expect(recoveryRequest.request.method).toBe('PATCH');
    expect(recoveryRequest.request.body).toEqual({ email: 'new@example.com', currentPassword: 'current-password' });
    recoveryRequest.flush(securityFixture());
  });

  it('requests, downloads, and reads data export/account deletion state', () => {
    service.getLatestDataExport().subscribe();
    const latestRequest = httpTesting.expectOne('/api/v1/users/me/data-export/requests/latest');
    expect(latestRequest.request.method).toBe('GET');
    latestRequest.flush(null);

    service.requestDataExport().subscribe();
    const requestExport = httpTesting.expectOne('/api/v1/users/me/data-export/requests');
    expect(requestExport.request.method).toBe('POST');
    expect(requestExport.request.body).toEqual({});
    requestExport.flush({
      exportRequestId: 'export-1',
      status: 'REQUESTED',
      requestedAt: '2026-06-21T08:00:00Z',
      completedAt: null,
      downloadAvailable: false
    });

    service.downloadDataExport('export-1').subscribe();
    const downloadRequest = httpTesting.expectOne('/api/v1/users/me/data-export/requests/export-1/download');
    expect(downloadRequest.request.method).toBe('GET');
    downloadRequest.flush({ generatedAt: '2026-06-21T08:00:00Z', account: userFixture(), goals: [], bodyMetrics: [] });

    service.getAccountDeletionStatus().subscribe();
    const deletionRequest = httpTesting.expectOne('/api/v1/auth/account-deletion');
    expect(deletionRequest.request.method).toBe('GET');
    deletionRequest.flush({ status: 'NOT_REQUESTED', requestedAt: null, passwordConfirmationRequired: false });

    service.requestAccountDeletion('DELETE', null).subscribe();
    const requestDeletion = httpTesting.expectOne('/api/v1/auth/account-deletion/request');
    expect(requestDeletion.request.method).toBe('POST');
    expect(requestDeletion.request.body).toEqual({ confirmationText: 'DELETE', currentPassword: null });
    requestDeletion.flush({ status: 'REQUESTED', requestedAt: '2026-06-21T08:00:00Z', passwordConfirmationRequired: true });
  });

  it('combines account center requests and derives summary fallbacks', () => {
    let center: AccountCenterData | undefined;
    service.getAccountCenter().subscribe((value) => {
      center = value;
    });

    httpTesting.expectOne('/api/v1/users/me').flush(userFixture());
    httpTesting.expectOne('/api/v1/auth/me').flush({ userId: 'user-1', email: null, displayName: 'Auth Name', role: 'USER', authProvider: null });
    httpTesting.expectOne('/api/v1/auth/security/overview').flush(securityFixture({ authProvider: 'COGNITO' }));
    httpTesting.expectOne('/api/v1/auth/security/sessions').flush([]);
    httpTesting.expectOne('/api/v1/users/me/data-export/requests/latest').flush(null);
    httpTesting.expectOne('/api/v1/auth/account-deletion').flush({ status: 'NOT_REQUESTED', requestedAt: null, passwordConfirmationRequired: false });

    expect(center?.auth.displayName).toBe('Auth Name');

    const summary = service.toAccountSummary({
      user: userFixture({ profile: profileFixture({ displayName: '', membershipTier: null }), email: null }),
      auth: { userId: 'user-1', email: null, displayName: 'Auth Name', role: 'USER', authProvider: null },
      security: securityFixture({ authProvider: 'COGNITO' }),
      sessions: [],
      latestDataExport: null,
      accountDeletion: { status: 'NOT_REQUESTED', requestedAt: null, passwordConfirmationRequired: false }
    });

    expect(summary).toEqual(jasmine.objectContaining({
      displayName: 'Auth Name',
      email: 'Cognito account',
      initials: 'AN',
      authProvider: 'COGNITO',
      membershipTier: 'Member'
    }));
    expect(initialsFor('   ')).toBe('FS');
    expect(initialsFor('alice tan lee')).toBe('AT');
  });

  it('loads a lightweight cached profile summary from users/me only', () => {
    const summaries: AccountSummary[] = [];
    service.getProfileSummary().subscribe((summary) => summaries.push(summary));
    service.getProfileSummary().subscribe((summary) => summaries.push(summary));

    const request = httpTesting.expectOne('/api/v1/users/me');
    expect(request.request.method).toBe('GET');
    request.flush(userFixture({ profile: profileFixture({ displayName: 'Wang Xu', membershipTier: 'Plus' }) }));

    httpTesting.expectNone('/api/v1/auth/me');
    httpTesting.expectNone('/api/v1/auth/security/overview');
    httpTesting.expectNone('/api/v1/auth/security/sessions');
    httpTesting.expectNone('/api/v1/users/me/data-export/requests/latest');
    httpTesting.expectNone('/api/v1/auth/account-deletion');

    expect(summaries).toEqual([
      jasmine.objectContaining({
        displayName: 'Wang Xu',
        email: 'user@example.com',
        initials: 'WX',
        authProvider: 'Cognito',
        membershipTier: 'Plus'
      }),
      jasmine.objectContaining({
        displayName: 'Wang Xu',
        initials: 'WX'
      })
    ]);
  });
});

function profileFixture(overrides: Partial<AccountProfile> = {}): AccountProfile {
  return {
    displayName: 'Alice Tan',
    firstName: 'Alice',
    lastName: 'Tan',
    avatarUrl: null,
    birthDate: null,
    gender: null,
    heightCm: null,
    activityLevel: null,
    timezone: null,
    locationDisplay: null,
    bio: null,
    membershipTier: null,
    membershipStatus: null,
    onboardingCompleted: true,
    ...overrides
  };
}

function preferencesFixture(): AccountPreferences {
  return {
    app: {
      preferredUnits: 'METRIC',
      language: 'en',
      timezone: 'Asia/Singapore',
      privacyLevel: 'PRIVATE',
      dataSharingConsent: false
    },
    training: {
      fitnessLevel: 'BEGINNER',
      trainingLocation: 'GYM',
      weeklyWorkoutDays: 3,
      preferredDurationMinutes: 45,
      preferredWorkoutTime: 'MORNING',
      intensityPreference: 'MODERATE'
    },
    nutrition: {
      dietaryPattern: 'BALANCED',
      mealFrequency: 3,
      calorieTrackingMode: 'STANDARD',
      macroPreference: 'BALANCED',
      waterGoalMl: 2200
    },
    notifications: {
      pushEnabled: true,
      emailEnabled: true,
      workoutReminderEnabled: true,
      mealReminderEnabled: false,
      weighInReminderEnabled: false,
      goalProgressReminderEnabled: true,
      weeklyProgressReportEnabled: null,
      weeklyProgressReportChannel: null,
      marketingEmailsEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null
    }
  };
}

function userFixture(overrides: Partial<AccountUserResponse> = {}): AccountUserResponse {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    role: 'USER',
    profile: profileFixture(),
    preferences: preferencesFixture(),
    activeGoals: [],
    latestBodyMetrics: null,
    ...overrides
  };
}

function securityFixture(overrides: Partial<SecurityOverview> = {}): SecurityOverview {
  return {
    authProvider: null,
    passwordManagedExternally: true,
    twoFactorEnabled: false,
    twoFactorConfigurable: false,
    recoveryEmail: null,
    recoveryEmailUpdatable: true,
    sessionCount: 0,
    sessionTrackingAvailable: true,
    securityLabel: null,
    ...overrides
  };
}
