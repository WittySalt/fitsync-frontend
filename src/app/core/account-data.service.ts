import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, shareReplay, tap } from 'rxjs';

import { AuthService } from './auth/auth.service';

export type ActivityLevel = 'SEDENTARY' | 'LIGHTLY_ACTIVE' | 'MODERATELY_ACTIVE' | 'VERY_ACTIVE' | 'ATHLETE';
export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';
export type MetricSource = 'MANUAL' | 'DEVICE' | 'IMPORTED';
export type GoalType = 'WEIGHT' | 'CALORIES' | 'PROTEIN' | 'CARBS' | 'FAT' | 'WORKOUT_FREQUENCY' | 'STEPS';
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
  focusAreas?: string[] | null;
}

export type NutrientReferenceRange = 'PROFILE' | 'FEMALE' | 'MALE' | 'BLENDED';

export function normalizeReferenceRange(value: unknown): NutrientReferenceRange {
  return value === 'FEMALE' || value === 'MALE' || value === 'BLENDED' ? value : 'PROFILE';
}

function withReferenceRange(preferences: AccountPreferences): AccountPreferences {
  if (!preferences?.nutrition) {
    return preferences;
  }
  return {
    ...preferences,
    nutrition: { ...preferences.nutrition, nutrientReferenceRange: normalizeReferenceRange(preferences.nutrition.nutrientReferenceRange) }
  };
}

export interface NutritionPreferences {
  dietaryPattern: string;
  mealFrequency: number | null;
  calorieTrackingMode: string;
  macroPreference: string;
  waterGoalMl: number | null;
  nutrientReferenceRange?: NutrientReferenceRange | null;
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
  /** When the data is removed. The service always fills it, with null while nothing is pending. */
  scheduledFor?: string | null;
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
  private readonly authService = inject(AuthService);
  private readonly apiBaseUrl = '/api/v1';
  private currentUser$?: Observable<AccountUserResponse>;
  private profileSummary$?: Observable<AccountSummary>;

  getCurrentUser(): Observable<AccountUserResponse> {
    this.currentUser$ ??= this.http.get<AccountUserResponse>(`${this.apiBaseUrl}/users/me`).pipe(
      map((user) => (user?.preferences ? { ...user, preferences: withReferenceRange(user.preferences) } : user)),
      tap((user) => this.authService.setUserRole(user.role)),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.currentUser$;
  }

  getAccountCenter(): Observable<AccountCenterData> {
    return forkJoin({
      user: this.getCurrentUser(),
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

  getProfileSummary(): Observable<AccountSummary> {
    this.profileSummary$ ??= this.getCurrentUser().pipe(
      map((user) => this.toProfileSummary(user)),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.profileSummary$;
  }

  updateProfile(profile: AccountProfile): Observable<AccountProfile> {
    this.invalidateCurrentUser();
    return this.http.put<AccountProfile>(`${this.apiBaseUrl}/users/me/profile`, profile);
  }

  uploadAvatar(file: Blob): Observable<AccountProfile> {
    const form = new FormData();
    form.append('file', file, 'avatar.png');
    this.invalidateCurrentUser();
    return this.http.post<AccountProfile>(`${this.apiBaseUrl}/users/me/profile/avatar`, form);
  }

  updatePreferences(preferences: AccountPreferences): Observable<AccountPreferences> {
    this.invalidateCurrentUser();
    return this.http
      .put<AccountPreferences>(`${this.apiBaseUrl}/users/me/preferences`, withReferenceRange(preferences))
      .pipe(map(withReferenceRange));
  }

  createBodyMetric(request: CreateBodyMetricRequest): Observable<AccountBodyMetric> {
    this.invalidateCurrentUser();
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
    this.invalidateCurrentUser();
    return this.http.put<AccountBodyMetric>(`${this.apiBaseUrl}/users/me/body-metrics/${metricId}`, request);
  }

  updateGoal(goalType: GoalType, request: UpsertUserGoalRequest): Observable<UserGoal> {
    this.invalidateCurrentUser();
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
    return this.http.get<AccountDeletionStatus>(`${this.apiBaseUrl}/auth/account-deletion`).pipe(map(withScheduledFor));
  }

  requestAccountDeletion(confirmationText: string, currentPassword: string | null): Observable<AccountDeletionStatus> {
    return this.http
      .post<AccountDeletionStatus>(`${this.apiBaseUrl}/auth/account-deletion/request`, {
        confirmationText,
        currentPassword
      })
      .pipe(map(withScheduledFor));
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

  private toProfileSummary(user: AccountUserResponse): AccountSummary {
    const displayName = user.profile.displayName || 'FitSync User';
    return {
      displayName,
      email: user.email || 'Cognito account',
      initials: initialsFor(displayName),
      avatarUrl: user.profile.avatarUrl,
      authProvider: 'Cognito',
      membershipTier: user.profile.membershipTier || 'Member'
    };
  }

  invalidateCurrentUser(): void {
    this.currentUser$ = undefined;
    this.profileSummary$ = undefined;
  }
}

function withScheduledFor(status: AccountDeletionStatus): AccountDeletionStatus {
  return { ...status, scheduledFor: status.scheduledFor ?? null };
}

/** "31 Oct 2026" for an instant, in the browser's timezone, or an empty string when it is not a date. */
export function formatDeletionDate(instant: string | null | undefined): string {
  const date = instant ? new Date(instant) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  // en-GB's short September is "Sept" on current ICU data but has differed between versions.
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date).replace(/\bSep\b/, 'Sept');
}

export function initialsFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return 'FS';
  }
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}
