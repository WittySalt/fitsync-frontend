import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';

export type ActivityLevel = 'SEDENTARY' | 'LIGHTLY_ACTIVE' | 'MODERATELY_ACTIVE' | 'VERY_ACTIVE' | 'ATHLETE';
export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';
export type MetricSource = 'MANUAL' | 'DEVICE' | 'IMPORTED';
export type GoalType = 'WEIGHT' | 'CALORIES' | 'PROTEIN' | 'WORKOUT_FREQUENCY' | 'STEPS';
export type GoalStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface AccountProfile {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  birthDate: string | null;
  gender: Gender | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  timezone: string | null;
  locationDisplay: string | null;
  bio: string | null;
  membershipTier: string | null;
  membershipStatus: string | null;
  onboardingCompleted: boolean;
}

export interface AccountBodyMetric {
  metricId: string | null;
  weightKg: number | null;
  bodyFatRate: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  calfCm: number | null;
  bmi: number | null;
  measuredAt: string | null;
  source: MetricSource | null;
  note: string | null;
}

export interface AppPreferences {
  preferredUnits: string;
  language: string;
  timezone: string | null;
  privacyLevel: string;
  dataSharingConsent: boolean;
}

export interface TrainingPreferences {
  fitnessLevel: string;
  trainingLocation: string;
  weeklyWorkoutDays: number | null;
  preferredDurationMinutes: number | null;
  preferredWorkoutTime: string | null;
  intensityPreference: string;
}

export interface NutritionPreferences {
  dietaryPattern: string;
  mealFrequency: number | null;
  calorieTrackingMode: string;
  macroPreference: string;
  waterGoalMl: number | null;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  workoutReminderEnabled: boolean;
  mealReminderEnabled: boolean;
  weighInReminderEnabled: boolean;
  goalProgressReminderEnabled: boolean;
  weeklyProgressReportEnabled: boolean | null;
  weeklyProgressReportChannel: string | null;
  marketingEmailsEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export interface AccountPreferences {
  app: AppPreferences;
  training: TrainingPreferences;
  nutrition: NutritionPreferences;
  notifications: NotificationPreferences;
}

export interface UserGoal {
  goalId: string | null;
  goalType: GoalType;
  targetValue: number | null;
  targetUnit: string | null;
  targetDate: string | null;
  status: GoalStatus;
  notes: string | null;
}

export interface AccountUserResponse {
  userId: string;
  email: string | null;
  role: string | null;
  profile: AccountProfile;
  preferences: AccountPreferences;
  activeGoals: UserGoal[];
  latestBodyMetrics: AccountBodyMetric | null;
}

export interface AuthAccountResponse {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: string | null;
  authProvider: string | null;
}

export interface SecurityOverview {
  authProvider: string | null;
  passwordManagedExternally: boolean;
  twoFactorEnabled: boolean;
  twoFactorConfigurable: boolean;
  recoveryEmail: string | null;
  recoveryEmailUpdatable: boolean;
  sessionCount: number;
  sessionTrackingAvailable: boolean;
  securityLabel: string | null;
}

export interface ActiveSessionView {
  sessionId: string;
  deviceLabel: string;
  ipAddress: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  current: boolean;
  revocable: boolean;
}

export interface AccountDataExportRequestView {
  exportRequestId: string;
  status: 'REQUESTED' | 'READY' | 'FAILED' | string;
  requestedAt: string;
  completedAt: string | null;
  downloadAvailable: boolean;
}

export interface AccountDeletionStatus {
  status: 'NOT_REQUESTED' | 'REQUESTED' | string;
  requestedAt: string | null;
  passwordConfirmationRequired: boolean;
}

export interface AccountDataExportPayload {
  generatedAt: string;
  account: AccountUserResponse;
  goals: UserGoal[];
  bodyMetrics: AccountBodyMetric[];
}

export interface AccountCenterData {
  user: AccountUserResponse;
  auth: AuthAccountResponse;
  security: SecurityOverview;
  sessions: ActiveSessionView[];
  latestDataExport: AccountDataExportRequestView | null;
  accountDeletion: AccountDeletionStatus;
}

export interface AccountSummary {
  displayName: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
  authProvider: string;
  membershipTier: string;
}

export interface UpsertUserGoalRequest {
  targetValue: number | null;
  targetUnit: string | null;
  targetDate: string | null;
  status: GoalStatus;
  notes: string | null;
}

export interface CreateBodyMetricRequest {
  weightKg: number | null;
  bodyFatRate: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  calfCm: number | null;
  measuredAt: string;
  source: MetricSource;
  note: string | null;
}

export interface ListBodyMetricsOptions {
  from?: string;
  to?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class AccountDataService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '/api/v1';

  getAccountCenter(): Observable<AccountCenterData> {
    return forkJoin({
      user: this.http.get<AccountUserResponse>(`${this.apiBaseUrl}/users/me`),
      auth: this.http.get<AuthAccountResponse>(`${this.apiBaseUrl}/auth/me`),
      security: this.http.get<SecurityOverview>(`${this.apiBaseUrl}/auth/security/overview`),
      sessions: this.getActiveSessions(),
      latestDataExport: this.getLatestDataExport(),
      accountDeletion: this.getAccountDeletionStatus()
    });
  }

  getAccountSummary(): Observable<AccountSummary> {
    return this.getAccountCenter().pipe(map((data) => this.toAccountSummary(data)));
  }

  updateProfile(profile: AccountProfile): Observable<AccountProfile> {
    return this.http.put<AccountProfile>(`${this.apiBaseUrl}/users/me/profile`, profile);
  }

  uploadAvatar(file: Blob): Observable<AccountProfile> {
    const form = new FormData();
    form.append('file', file, 'avatar.png');
    return this.http.post<AccountProfile>(`${this.apiBaseUrl}/users/me/profile/avatar`, form);
  }

  updatePreferences(preferences: AccountPreferences): Observable<AccountPreferences> {
    return this.http.put<AccountPreferences>(`${this.apiBaseUrl}/users/me/preferences`, preferences);
  }

  createBodyMetric(request: CreateBodyMetricRequest): Observable<AccountBodyMetric> {
    return this.http.post<AccountBodyMetric>(`${this.apiBaseUrl}/users/me/body-metrics`, request);
  }

  listBodyMetrics(options: ListBodyMetricsOptions = {}): Observable<AccountBodyMetric[]> {
    let params = new HttpParams();
    if (options.from) {
      params = params.set('from', options.from);
    }
    if (options.to) {
      params = params.set('to', options.to);
    }
    if (options.limit !== undefined) {
      params = params.set('limit', String(options.limit));
    }
    return this.http.get<AccountBodyMetric[]>(`${this.apiBaseUrl}/users/me/body-metrics`, { params });
  }

  replaceBodyMetric(metricId: string, request: CreateBodyMetricRequest): Observable<AccountBodyMetric> {
    return this.http.put<AccountBodyMetric>(`${this.apiBaseUrl}/users/me/body-metrics/${metricId}`, request);
  }

  updateGoal(goalType: GoalType, request: UpsertUserGoalRequest): Observable<UserGoal> {
    return this.http.put<UserGoal>(`${this.apiBaseUrl}/users/me/goals/${goalType}`, request);
  }

  getActiveSessions(): Observable<ActiveSessionView[]> {
    return this.http.get<ActiveSessionView[]>(`${this.apiBaseUrl}/auth/security/sessions`);
  }

  updateRecoveryEmail(email: string, currentPassword: string): Observable<SecurityOverview> {
    return this.http.patch<SecurityOverview>(`${this.apiBaseUrl}/auth/security/recovery-email`, {
      email,
      currentPassword
    });
  }

  getLatestDataExport(): Observable<AccountDataExportRequestView | null> {
    return this.http.get<AccountDataExportRequestView | null>(`${this.apiBaseUrl}/users/me/data-export/requests/latest`);
  }

  requestDataExport(): Observable<AccountDataExportRequestView> {
    return this.http.post<AccountDataExportRequestView>(`${this.apiBaseUrl}/users/me/data-export/requests`, {});
  }

  downloadDataExport(exportRequestId: string): Observable<AccountDataExportPayload> {
    return this.http.get<AccountDataExportPayload>(`${this.apiBaseUrl}/users/me/data-export/requests/${exportRequestId}/download`);
  }

  getAccountDeletionStatus(): Observable<AccountDeletionStatus> {
    return this.http.get<AccountDeletionStatus>(`${this.apiBaseUrl}/auth/account-deletion`);
  }

  requestAccountDeletion(confirmationText: string, currentPassword: string | null): Observable<AccountDeletionStatus> {
    return this.http.post<AccountDeletionStatus>(`${this.apiBaseUrl}/auth/account-deletion/request`, {
      confirmationText,
      currentPassword
    });
  }

  toAccountSummary(data: AccountCenterData): AccountSummary {
    const displayName = data.user.profile.displayName || data.auth.displayName || 'FitSync User';
    return {
      displayName,
      email: data.auth.email || data.user.email || 'Cognito account',
      initials: initialsFor(displayName),
      avatarUrl: data.user.profile.avatarUrl,
      authProvider: data.auth.authProvider || data.security.authProvider || 'Cognito',
      membershipTier: data.user.profile.membershipTier || 'Member'
    };
  }
}

export function initialsFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return 'FS';
  }
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}
