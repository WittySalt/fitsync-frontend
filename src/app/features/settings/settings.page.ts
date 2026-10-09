import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ToastService } from '../../core/toast/toast.service';

import {
  AccountCenterData,
  AccountDataService,
  AccountDeletionStatus,
  AccountPreferences,
  AccountProfile,
  AppPreferences,
  NotificationPreferences,
  NutrientReferenceRange,
  normalizeReferenceRange,
  formatDeletionDate,
  toActivityLevel,
  initialsFor
} from '../../core/account-data.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemePreference, ThemeService } from '../../core/theme/theme.service';
import { GuideService } from '../../core/guide/guide.service';
import { SpotlightDirective } from '../../core/guide/spotlight.directive';
import { ToggleComponent } from '../../shared/toggle.component';
import {
  birthDateErrorMessage,
  latestAllowedBirthDate,
  minimumAgeValidator,
  serverValidationMessage
} from '../../shared/min-age';
import { AccountSecurityActionsComponent } from './account-security-actions.component';
import { DevicesListComponent } from './devices-list.component';

// auth-service accepts a deletion request only when the trimmed confirmation text equals this word exactly,
// and keeps the account for fitsync.account-deletion.grace-days (30 by default) before removing the data.
const DELETION_CONFIRMATION_WORD = 'DELETE';
const DELETION_GRACE_DAYS = 30;

type EditablePanel =
  | 'identity'
  | 'location'
  | 'activity'
  | 'formatting'
  | 'training'
  | 'nutrition'
  | 'notifications'
  | 'privacy'
  | 'consent'
  | 'export'
  | 'recovery'
  | 'delete';

interface Option {
  value: string;
  label: string;
}

interface SectionNavItem {
  id: string;
  label: string;
  description: string;
}

type NotificationToggleKey = {
  [Key in keyof NotificationPreferences]: NotificationPreferences[Key] extends boolean | null ? Key : never;
}[keyof NotificationPreferences];

interface NotificationToggleOption {
  key: NotificationToggleKey;
  label: string;
  description: string;
}

const DISPLAY_LOCALE = 'en-SG';

@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, RouterLink, AccountSecurityActionsComponent, DevicesListComponent, SpotlightDirective, ToggleComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss'
})
export class SettingsPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly accountDataService = inject(AccountDataService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly themeService = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly guide = inject(GuideService);

  readonly data = signal<AccountCenterData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);
  readonly sectionErrors = signal<Partial<Record<EditablePanel, string>>>({});
  readonly saving = signal<EditablePanel | null>(null);
  readonly savingNotificationToggle = signal<NotificationToggleKey | null>(null);
  readonly editPanel = signal<EditablePanel | null>(null);
  readonly accountMenuOpen = signal(false);
  readonly selectedSection = signal('personal');

  readonly sections: SectionNavItem[] = [
    { id: 'personal', label: 'Personal', description: 'Identity, location, activity, and targets.' },
    { id: 'appearance', label: 'Appearance', description: 'Theme mode and display preferences.' },
    { id: 'preferences', label: 'Preferences', description: 'Formatting, training defaults, and nutrition tracking.' },
    { id: 'security', label: 'Security', description: 'Password state, recovery email, and your devices.' },
    { id: 'notifications', label: 'Notifications', description: 'Channels, reminders, reports, and quiet hours.' },
    { id: 'privacy-data', label: 'Privacy & Data', description: 'Visibility, health data consent, exports, and account deletion.' }
  ];
  readonly themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' }
  ];

  readonly genderOptions: Option[] = [
    { value: '', label: 'Not set' },
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'NON_BINARY', label: 'Non-binary' },
    { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' }
  ];
  readonly activityOptions: Option[] = [
    { value: '', label: 'Not set' },
    { value: 'SEDENTARY', label: 'Sedentary' },
    { value: 'LIGHTLY_ACTIVE', label: 'Lightly active' },
    { value: 'MODERATELY_ACTIVE', label: 'Moderately active' },
    { value: 'VERY_ACTIVE', label: 'Very active' },
    { value: 'ATHLETE', label: 'Athlete' }
  ];
  // The numeric values are the backend's dictionary codes; labelFor maps the same codes back to words.
  readonly unitOptions = this.options([
    ['100001', 'Metric'],
    ['100002', 'Imperial']
  ]);
  readonly languageOptions = this.options([
    ['110001', 'English'],
    ['110002', 'Simplified Chinese']
  ]);
  readonly privacyOptions = this.options([
    ['120001', 'Only me'],
    ['120002', 'Friends only'],
    ['120003', 'Public profile']
  ]);
  readonly fitnessOptions = this.options([
    ['200001', 'Beginner'],
    ['200002', 'Intermediate'],
    ['200003', 'Advanced']
  ]);
  readonly trainingLocationOptions = this.options([
    ['210001', 'Home'],
    ['210002', 'Gym'],
    ['210003', 'Outdoor'],
    ['210004', 'Mixed']
  ]);
  readonly intensityOptions = this.options([
    ['220001', 'Low'],
    ['220002', 'Moderate'],
    ['220003', 'High']
  ]);
  readonly dietaryOptions = this.options([
    ['300001', 'No dietary pattern'],
    ['300002', 'Halal'],
    ['300003', 'Vegetarian'],
    ['300004', 'Vegan'],
    ['300005', 'Keto'],
    ['300006', 'Low carbohydrate']
  ]);
  readonly referenceRangeOptions: { value: NutrientReferenceRange; label: string }[] = [
    { value: 'PROFILE', label: 'Based on my profile' },
    { value: 'FEMALE', label: 'Female ranges' },
    { value: 'MALE', label: 'Male ranges' },
    { value: 'BLENDED', label: 'Blended ranges' }
  ];
  readonly calorieModeOptions = this.options([
    ['310001', 'Off'],
    ['310002', 'Flexible'],
    ['310003', 'Strict']
  ]);
  readonly macroOptions = this.options([
    ['320001', 'Balanced'],
    ['320002', 'High protein'],
    ['320003', 'Low carbohydrate']
  ]);
  readonly channelOptions = this.options([
    ['EMAIL', 'Email'],
    ['PUSH', 'Push']
  ]);
  readonly notificationToggleOptions: NotificationToggleOption[] = [
    { key: 'pushEnabled', label: 'Push channel', description: 'In-app and device push notifications.' },
    { key: 'emailEnabled', label: 'Email channel', description: 'Email notifications for account activity.' },
    { key: 'workoutReminderEnabled', label: 'Workout reminders', description: 'Prompts for planned training.' },
    { key: 'mealReminderEnabled', label: 'Meal reminders', description: 'Prompts to keep nutrition logs current.' },
    { key: 'weighInReminderEnabled', label: 'Weigh-in reminders', description: 'Prompts for body metric check-ins.' },
    { key: 'goalProgressReminderEnabled', label: 'Goal progress reminders', description: 'Progress nudges for active targets.' },
    { key: 'weeklyProgressReportEnabled', label: 'Weekly report', description: 'Weekly progress summaries.' },
    { key: 'marketingEmailsEnabled', label: 'Marketing emails', description: 'Product news and offers.' }
  ];
  readonly identityForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    firstName: ['', [Validators.maxLength(80)]],
    lastName: ['', [Validators.maxLength(80)]],
    birthDate: ['', [minimumAgeValidator()]],
    gender: [''],
    bio: ['', [Validators.maxLength(300)]],
    onboardingCompleted: [false]
  });

  readonly locationForm = this.fb.group({
    locationDisplay: ['', [Validators.maxLength(120)]],
    profileTimezone: ['', [Validators.maxLength(80)]],
    appTimezone: ['', [Validators.maxLength(80)]]
  });

  readonly activityForm = this.fb.group({
    activityLevel: ['']
  });

  readonly formattingForm = this.fb.group({
    preferredUnits: ['100001'],
    language: ['110001']
  });

  readonly trainingForm = this.fb.group({
    fitnessLevel: ['200002'],
    trainingLocation: ['210004'],
    weeklyWorkoutDays: ['', [Validators.min(0), Validators.max(14)]],
    preferredDurationMinutes: ['', [Validators.min(5), Validators.max(240)]],
    preferredWorkoutTime: [''],
    intensityPreference: ['220002']
  });

  readonly nutritionForm = this.fb.group({
    dietaryPattern: ['300001'],
    mealFrequency: ['', [Validators.min(1), Validators.max(12)]],
    calorieTrackingMode: ['310002'],
    macroPreference: ['320001'],
    waterGoalMl: ['', [Validators.min(0), Validators.max(10000)]],
    nutrientReferenceRange: ['PROFILE' as NutrientReferenceRange]
  });

  readonly notificationsForm = this.fb.group({
    pushEnabled: [false],
    emailEnabled: [false],
    workoutReminderEnabled: [false],
    mealReminderEnabled: [false],
    weighInReminderEnabled: [false],
    goalProgressReminderEnabled: [false],
    weeklyProgressReportEnabled: [false],
    weeklyProgressReportChannel: ['EMAIL'],
    marketingEmailsEnabled: [false],
    quietHoursStart: [''],
    quietHoursEnd: ['']
  });

  readonly privacyForm = this.fb.group({
    privacyLevel: ['120001']
  });

  /** Giving consent again takes a tick that is never pre-set. */
  readonly consentForm = this.fb.group({
    agree: [false, Validators.requiredTrue]
  });

  readonly recoveryForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    currentPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(120)]]
  });

  readonly deletionForm = this.fb.group({
    confirmationText: ['', [Validators.required, Validators.maxLength(120)]],
    currentPassword: ['', [Validators.maxLength(120)]]
  });

  readonly deletionConfirmationWord = DELETION_CONFIRMATION_WORD;

  ngOnInit(): void {
    // A link such as /settings?section=preferences opens that section.
    const section = new URLSearchParams(this.router.url.split('?')[1] ?? '').get('section');
    if (section) {
      this.selectSection(section);
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.accountDataService.getAccountCenter().subscribe({
      next: (data) => {
        this.setData(data);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message || 'Unable to load account settings.');
        this.loading.set(false);
      }
    });
  }

  initials(): string {
    return initialsFor(this.data()?.user.profile.displayName ?? 'FitSync User');
  }

  accountType(): string {
    const data = this.data();
    if (!data) {
      return 'Account';
    }
    return `${this.labelFor(data.auth.authProvider || data.security.authProvider || 'COGNITO')} account - ${this.labelFor(data.user.profile.membershipTier || 'MEMBER')}`;
  }

  region(): string {
    const data = this.data();
    return data?.user.preferences.app.timezone || data?.user.profile.timezone || 'Not set';
  }

  displayHeight(heightCm: number | null | undefined): string {
    if (!heightCm) {
      return 'Not set';
    }
    const imperial = this.data()?.user.preferences.app.preferredUnits === '100002';
    if (!imperial) {
      return `${heightCm} cm`;
    }
    const totalInches = Math.round(heightCm / 2.54);
    return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
  }

  displayDateTime(value: string | null | undefined): string {
    if (!value) {
      return 'Not set';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Not set';
    }
    return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: this.accountTimezone()
    }).format(date);
  }

  /**
   * The one quiet line about the grace period. Before a request it says what deleting will do; once a deletion
   * is pending (the status says so or the backend has fixed a date) it says the account is scheduled.
   */
  deletionGraceLine(status: AccountDeletionStatus): string {
    const date = formatDeletionDate(status.scheduledFor, this.accountTimezone());
    if (!date && status.status !== 'REQUESTED') {
      return `Deleting your account signs you out and schedules your data for removal in ${DELETION_GRACE_DAYS} days. `
        + 'Signing in again within that time cancels it.';
    }
    const cancel = date
      ? `Sign in again before ${date} to cancel.`
      : `Sign in again within ${DELETION_GRACE_DAYS} days to cancel.`;
    return `Your account is scheduled for deletion and you are signed out. ${cancel} After that, your data is removed.`;
  }

  /**
   * Whether the delete button can be pressed: the text matches what auth-service accepts (DELETE in capitals,
   * spaces around it ignored), a password is typed when the account needs one, and no request is running.
   */
  canRequestDeletion(status: AccountDeletionStatus): boolean {
    const value = this.deletionForm.getRawValue();
    return this.saving() !== 'delete'
      && value.confirmationText.trim() === DELETION_CONFIRMATION_WORD
      && (!status.passwordConfirmationRequired || value.currentPassword.length > 0);
  }

  deletionScheduledLine(status: AccountDeletionStatus): string {
    const date = formatDeletionDate(status.scheduledFor, this.accountTimezone());
    return date ? `This account is scheduled for deletion on ${date}.` : 'This account is scheduled for deletion.';
  }

  displayDate(value: string | null | undefined): string {
    if (!value) {
      return 'Not set';
    }
    // A calendar date such as a birth date belongs to no zone, so it is read and shown at UTC
    // midnight and stays the same date whatever the device's or the account's zone.
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      return 'Not set';
    }
    return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
      dateStyle: 'medium',
      timeZone: 'UTC'
    }).format(date);
  }

  displayTime(value: string | null | undefined): string {
    return this.toTimeInput(value) || 'Not set';
  }

  trainingDefaults(): string {
    const training = this.data()?.user.preferences.training;
    if (!training) {
      return 'Not set';
    }
    return `${this.labelFor(training.fitnessLevel)} / ${this.labelFor(training.trainingLocation)} / ${this.displayTime(training.preferredWorkoutTime)}`;
  }

  referenceRangeLabel(value: string | null | undefined): string {
    const range = normalizeReferenceRange(value);
    return this.referenceRangeOptions.find((option) => option.value === range)?.label ?? 'Based on my profile';
  }

  nutritionTracking(): string {
    const nutrition = this.data()?.user.preferences.nutrition;
    if (!nutrition) {
      return 'Not set';
    }
    return `${this.labelFor(nutrition.calorieTrackingMode)} / ${this.labelFor(nutrition.macroPreference)}`;
  }

  weeklyReportSummary(): string {
    const notifications = this.data()?.user.preferences.notifications;
    if (!notifications?.weeklyProgressReportEnabled) {
      return 'Off';
    }
    return `On / ${this.labelFor(notifications.weeklyProgressReportChannel || 'EMAIL')}`;
  }

  quietHoursSummary(): string {
    const notifications = this.data()?.user.preferences.notifications;
    if (!notifications?.quietHoursStart || !notifications.quietHoursEnd) {
      return 'Not set';
    }
    return `${this.displayTime(notifications.quietHoursStart)} / ${this.displayTime(notifications.quietHoursEnd)}`;
  }

  notificationToggleValue(key: NotificationToggleKey): boolean {
    return Boolean(this.data()?.user.preferences.notifications[key]);
  }

  toggleNotification(key: NotificationToggleKey, enabled: boolean): void {
    const data = this.data();
    if (!data || this.notificationToggleValue(key) === enabled) {
      return;
    }

    const previousPreferences = data.user.preferences;
    const nextPreferences: AccountPreferences = {
      ...previousPreferences,
      notifications: {
        ...previousPreferences.notifications,
        [key]: enabled
      }
    };

    this.savingNotificationToggle.set(key);
    this.clearSectionError('notifications');
    this.setData({ ...data, user: { ...data.user, preferences: nextPreferences } });

    this.accountDataService.updatePreferences(nextPreferences).subscribe({
      next: (updatedPreferences) => {
        const latest = this.data();
        if (latest) {
          this.setData({ ...latest, user: { ...latest.user, preferences: updatedPreferences } });
        }
        this.savingNotificationToggle.set(null);
        this.toast.success('Notifications updated.');
      },
      error: (error: Error) => {
        const latest = this.data();
        if (latest) {
          this.setData({ ...latest, user: { ...latest.user, preferences: previousPreferences } });
        }
        this.savingNotificationToggle.set(null);
        const message = error.message || 'Unable to update notifications.';
        this.sectionErrors.update((errors) => ({
          ...errors,
          notifications: message
        }));
        this.toast.error(message);
      }
    });
  }

  labelFor(value: string | null | undefined): string {
    if (!value) {
      return 'Not set';
    }

    const labels: Record<string, string> = {
      '100001': 'Metric',
      '100002': 'Imperial',
      '110001': 'English',
      '110002': 'Simplified Chinese',
      '120001': 'Only me',
      '120002': 'Friends only',
      '120003': 'Public profile',
      '200001': 'Beginner',
      '200002': 'Intermediate',
      '200003': 'Advanced',
      '210001': 'Home',
      '210002': 'Gym',
      '210003': 'Outdoor',
      '210004': 'Mixed',
      '220001': 'Low',
      '220002': 'Moderate',
      '220003': 'High',
      '300001': 'No dietary pattern',
      '300002': 'Halal',
      '300003': 'Vegetarian',
      '300004': 'Vegan',
      '300005': 'Keto',
      '300006': 'Low carbohydrate',
      '310001': 'Off',
      '310002': 'Flexible',
      '310003': 'Strict',
      '320001': 'Balanced',
      '320002': 'High protein',
      '320003': 'Low carbohydrate',
      COGNITO: 'Cognito',
      LOCAL: 'Local',
      EMAIL: 'Email',
      PUSH: 'Push'
    };
    return labels[value] ?? value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  startEdit(panel: EditablePanel): void {
    this.editPanel.set(panel);
    this.saveMessage.set(null);
    this.clearSectionError(panel);
  }

  cancelEdit(): void {
    const data = this.data();
    if (data) {
      this.patchForms(data);
    }
    this.deletionForm.reset();
    this.consentForm.reset();
    this.editPanel.set(null);
  }

  /** The latest birth date the date picker offers: today, 16 years ago. */
  readonly maxBirthDate = latestAllowedBirthDate();

  /** Why the birth date in the identity form is refused, or null when it is fine or empty. */
  birthDateError(): string | null {
    return birthDateErrorMessage(this.identityForm.controls.birthDate.errors);
  }

  /** The consent state in words, with the date when the server sends it. */
  healthConsentLine(app: AppPreferences): string {
    if (!app.dataSharingConsent) {
      return 'Not given';
    }
    return app.healthDataConsentAt ? `Given on ${this.displayDateTime(app.healthDataConsentAt)}` : 'Given';
  }

  /**
   * Gives or withdraws the explicit consent to health data. Withdrawing is reached only through the open
   * panel that explains its effect, and giving needs the tick in that panel.
   */
  saveHealthDataConsent(given: boolean): void {
    const data = this.data();
    if (!data || this.saving() === 'consent') {
      return;
    }
    if (given && this.consentForm.invalid) {
      this.consentForm.markAllAsTouched();
      return;
    }
    const preferences: AccountPreferences = {
      ...data.user.preferences,
      app: { ...data.user.preferences.app, dataSharingConsent: given }
    };
    this.saving.set('consent');
    this.accountDataService.updatePreferences(preferences).subscribe({
      next: (updatedPreferences) => {
        this.setData({ ...data, user: { ...data.user, preferences: updatedPreferences } });
        this.consentForm.reset();
        this.finishSave('consent', given ? 'Consent recorded.' : 'Consent withdrawn.');
      },
      error: (error: Error) => this.handleSaveError('consent', error)
    });
  }

  saveIdentity(): void {
    const data = this.data();
    if (!data || this.identityForm.invalid) {
      this.identityForm.markAllAsTouched();
      return;
    }

    const value = this.identityForm.getRawValue();
    this.saveProfilePanel('identity', data, {
      ...data.user.profile,
      displayName: value.displayName.trim(),
      firstName: nullableText(value.firstName),
      lastName: nullableText(value.lastName),
      birthDate: nullableText(value.birthDate),
      gender: nullableText(value.gender) as AccountProfile['gender'],
      bio: nullableText(value.bio),
      onboardingCompleted: value.onboardingCompleted
    });
  }

  saveLocation(): void {
    const data = this.data();
    if (!data || this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }

    const value = this.locationForm.getRawValue();
    const profile = {
      ...data.user.profile,
      locationDisplay: nullableText(value.locationDisplay),
      timezone: nullableText(value.profileTimezone)
    };
    const preferences: AccountPreferences = {
      ...data.user.preferences,
      app: {
        ...data.user.preferences.app,
        timezone: nullableText(value.appTimezone)
      }
    };

    this.saving.set('location');
    forkJoin({
      profile: this.accountDataService.updateProfile(profile),
      preferences: this.accountDataService.updatePreferences(preferences)
    }).subscribe({
      next: ({ profile: updatedProfile, preferences: updatedPreferences }) => {
        this.setData({ ...data, user: { ...data.user, profile: updatedProfile, preferences: updatedPreferences } });
        this.finishSave('location', 'Location updated.');
      },
      error: (error: Error) => this.handleSaveError('location', error)
    });
  }

  saveActivity(): void {
    const data = this.data();
    if (!data) {
      return;
    }
    this.saveProfilePanel('activity', data, {
      ...data.user.profile,
      activityLevel: nullableText(this.activityForm.controls.activityLevel.value) as AccountProfile['activityLevel']
    });
  }

  savePreferences(panel: 'formatting' | 'training' | 'nutrition' | 'notifications' | 'privacy'): void {
    const data = this.data();
    if (!data || this.formForPanel(panel).invalid) {
      this.formForPanel(panel).markAllAsTouched();
      return;
    }

    const preferences = this.updatedPreferences(panel, data.user.preferences);
    this.saving.set(panel);
    this.accountDataService.updatePreferences(preferences).subscribe({
      next: (updatedPreferences) => {
        this.setData({ ...data, user: { ...data.user, preferences: updatedPreferences } });
        this.finishSave(panel, 'Preferences updated.');
      },
      error: (error: Error) => this.handleSaveError(panel, error)
    });
  }

  saveRecoveryEmail(): void {
    const data = this.data();
    if (!data || this.recoveryForm.invalid || !data.security.recoveryEmailUpdatable) {
      this.recoveryForm.markAllAsTouched();
      return;
    }
    const value = this.recoveryForm.getRawValue();

    this.saving.set('recovery');
    this.accountDataService.updateRecoveryEmail(value.email.trim(), value.currentPassword).subscribe({
      next: (security) => {
        this.setData({ ...data, security });
        this.recoveryForm.controls.currentPassword.reset('');
        this.finishSave('recovery', 'Recovery email updated.');
      },
      error: (error: Error) => this.handleSaveError('recovery', error)
    });
  }

  requestDataExport(): void {
    const data = this.data();
    if (!data) {
      return;
    }
    this.saving.set('privacy');
    this.accountDataService.requestDataExport().subscribe({
      next: (latestDataExport) => {
        this.setData({ ...data, latestDataExport });
        this.finishSave('privacy', 'Data export is ready.');
      },
      error: (error: Error) => this.handleSaveError('privacy', error)
    });
  }

  downloadDataExport(): void {
    const data = this.data();
    const exportRequestId = data?.latestDataExport?.exportRequestId;
    if (!exportRequestId) {
      return;
    }
    this.saving.set('export');
    this.accountDataService.downloadFullDataExport(exportRequestId).subscribe({
      next: (archive) => {
        this.saveJsonFile(`fitsync-export-${archive.exportedAt.slice(0, 10)}.json`, archive);
        this.finishSave('export', 'Your data was downloaded.');
      },
      error: (error: Error) => this.handleSaveError('export', error)
    });
  }

  /** Hands the browser one JSON file to save. */
  protected saveJsonFile(fileName: string, content: unknown): void {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  requestAccountDeletion(): void {
    const data = this.data();
    if (!data || this.deletionForm.invalid || !this.canRequestDeletion(data.accountDeletion)) {
      this.deletionForm.markAllAsTouched();
      return;
    }
    const value = this.deletionForm.getRawValue();
    this.saving.set('delete');
    this.accountDataService.requestAccountDeletion(
      value.confirmationText.trim(),
      nullableText(value.currentPassword)
    ).subscribe({
      next: (accountDeletion) => {
        this.deletionForm.reset();
        this.saving.set(null);
        // The sign-in page explains what happens next, so it has to be reached without a page reload that
        // would drop what the auth service holds for it. The cached user is dropped with the session.
        this.accountDataService.invalidateCurrentUser();
        this.authService.noteDeletionRequested(accountDeletion.scheduledFor ?? null);
        this.authService.completeLogout();
        void this.router.navigateByUrl('/auth/login');
      },
      error: (error: unknown) => this.handleSaveError('delete', new Error(deletionErrorMessage(error)))
    });
  }

  toggleAccountMenu(): void {
    this.accountMenuOpen.update((open) => !open);
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  selectSection(id: string): void {
    if (this.sections.some((section) => section.id === id)) {
      this.selectedSection.set(id);
    }
  }

  logout(): void {
    this.authService.logout();
  }

  setThemePreference(preference: ThemePreference): void {
    this.themeService.setTheme(preference);
  }

  /** Resets the guide on the server, so the Home card and the first tour of the four main pages come back. */
  showGuideAgain(userId: string): void {
    this.guide.restart(userId);
    this.toast.success('The guide is back on Home, and the first tour will play again.');
  }

  @HostListener('document:click', ['$event'])
  protected closeMenusFromDocument(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.accountMenuOpen() && !target?.closest('.settings-account-menu')) {
      this.closeAccountMenu();
    }
  }

  private setData(data: AccountCenterData): void {
    this.data.set(data);
    this.patchForms(data);
  }

  private patchForms(data: AccountCenterData): void {
    const profile = data.user.profile;
    const preferences = data.user.preferences;

    this.identityForm.patchValue({
      displayName: profile.displayName,
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      birthDate: profile.birthDate ?? '',
      gender: profile.gender ?? '',
      bio: profile.bio ?? '',
      onboardingCompleted: profile.onboardingCompleted
    });
    this.locationForm.patchValue({
      locationDisplay: profile.locationDisplay ?? '',
      profileTimezone: profile.timezone ?? '',
      appTimezone: preferences.app.timezone ?? ''
    });
    this.activityForm.patchValue({ activityLevel: toActivityLevel(profile.activityLevel) ?? '' });
    this.formattingForm.patchValue({
      preferredUnits: preferences.app.preferredUnits,
      language: preferences.app.language
    });
    this.trainingForm.patchValue({
      fitnessLevel: preferences.training.fitnessLevel,
      trainingLocation: preferences.training.trainingLocation,
      weeklyWorkoutDays: toFormNumber(preferences.training.weeklyWorkoutDays),
      preferredDurationMinutes: toFormNumber(preferences.training.preferredDurationMinutes),
      preferredWorkoutTime: this.toTimeInput(preferences.training.preferredWorkoutTime),
      intensityPreference: preferences.training.intensityPreference
    });
    this.nutritionForm.patchValue({
      dietaryPattern: preferences.nutrition.dietaryPattern,
      mealFrequency: toFormNumber(preferences.nutrition.mealFrequency),
      calorieTrackingMode: preferences.nutrition.calorieTrackingMode,
      macroPreference: preferences.nutrition.macroPreference,
      waterGoalMl: toFormNumber(preferences.nutrition.waterGoalMl),
      nutrientReferenceRange: normalizeReferenceRange(preferences.nutrition.nutrientReferenceRange)
    });
    this.notificationsForm.patchValue({
      pushEnabled: preferences.notifications.pushEnabled,
      emailEnabled: preferences.notifications.emailEnabled,
      workoutReminderEnabled: preferences.notifications.workoutReminderEnabled,
      mealReminderEnabled: preferences.notifications.mealReminderEnabled,
      weighInReminderEnabled: preferences.notifications.weighInReminderEnabled,
      goalProgressReminderEnabled: preferences.notifications.goalProgressReminderEnabled,
      weeklyProgressReportEnabled: preferences.notifications.weeklyProgressReportEnabled ?? false,
      weeklyProgressReportChannel: preferences.notifications.weeklyProgressReportChannel ?? 'EMAIL',
      marketingEmailsEnabled: preferences.notifications.marketingEmailsEnabled,
      quietHoursStart: this.toTimeInput(preferences.notifications.quietHoursStart),
      quietHoursEnd: this.toTimeInput(preferences.notifications.quietHoursEnd)
    });
    this.privacyForm.patchValue({
      privacyLevel: preferences.app.privacyLevel
    });
    this.recoveryForm.patchValue({
      email: data.security.recoveryEmail ?? data.auth.email ?? '',
      currentPassword: ''
    });
  }

  private saveProfilePanel(panel: EditablePanel, data: AccountCenterData, profile: AccountProfile): void {
    this.saving.set(panel);
    this.accountDataService.updateProfile(profile).subscribe({
      next: (updatedProfile) => {
        this.setData({ ...data, user: { ...data.user, profile: updatedProfile } });
        this.finishSave(panel, 'Profile updated.');
      },
      error: (error: Error) => {
        // A 400 carries the reason, such as a birth date under the minimum age; show it as the server wrote it.
        const reason = serverValidationMessage(error);
        this.handleSaveError(panel, reason ? new Error(reason) : error);
      }
    });
  }

  private updatedPreferences(panel: 'formatting' | 'training' | 'nutrition' | 'notifications' | 'privacy',
                             current: AccountPreferences): AccountPreferences {
    if (panel === 'formatting') {
      return { ...current, app: { ...current.app, ...this.formattingForm.getRawValue() } };
    }
    if (panel === 'privacy') {
      return { ...current, app: { ...current.app, ...this.privacyForm.getRawValue() } };
    }
    if (panel === 'training') {
      const value = this.trainingForm.getRawValue();
      return {
        ...current,
        training: {
          fitnessLevel: value.fitnessLevel,
          trainingLocation: value.trainingLocation,
          weeklyWorkoutDays: toNullableNumber(value.weeklyWorkoutDays),
          preferredDurationMinutes: toNullableNumber(value.preferredDurationMinutes),
          preferredWorkoutTime: this.toBackendTime(value.preferredWorkoutTime),
          intensityPreference: value.intensityPreference
        }
      };
    }
    if (panel === 'nutrition') {
      const value = this.nutritionForm.getRawValue();
      return {
        ...current,
        nutrition: {
          dietaryPattern: value.dietaryPattern,
          mealFrequency: toNullableNumber(value.mealFrequency),
          calorieTrackingMode: value.calorieTrackingMode,
          macroPreference: value.macroPreference,
          waterGoalMl: toNullableNumber(value.waterGoalMl),
          nutrientReferenceRange: value.nutrientReferenceRange
        }
      };
    }

    const value = this.notificationsForm.getRawValue();
    return {
      ...current,
      notifications: {
        pushEnabled: value.pushEnabled,
        emailEnabled: value.emailEnabled,
        workoutReminderEnabled: value.workoutReminderEnabled,
        mealReminderEnabled: value.mealReminderEnabled,
        weighInReminderEnabled: value.weighInReminderEnabled,
        goalProgressReminderEnabled: value.goalProgressReminderEnabled,
        weeklyProgressReportEnabled: value.weeklyProgressReportEnabled,
        weeklyProgressReportChannel: value.weeklyProgressReportChannel,
        marketingEmailsEnabled: value.marketingEmailsEnabled,
        quietHoursStart: this.toBackendTime(value.quietHoursStart),
        quietHoursEnd: this.toBackendTime(value.quietHoursEnd)
      }
    };
  }

  private formForPanel(panel: 'formatting' | 'training' | 'nutrition' | 'notifications' | 'privacy') {
    const forms = {
      formatting: this.formattingForm,
      training: this.trainingForm,
      nutrition: this.nutritionForm,
      notifications: this.notificationsForm,
      privacy: this.privacyForm
    };
    return forms[panel];
  }

  private finishSave(panel: EditablePanel, message: string): void {
    this.saving.set(null);
    this.editPanel.set(null);
    this.saveMessage.set(message);
    this.toast.success(message);
    this.clearSectionError(panel);
  }

  private handleSaveError(panel: EditablePanel, error: Error): void {
    this.saving.set(null);
    const message = error.message || 'Unable to save account settings.';
    this.sectionErrors.update((errors) => ({
      ...errors,
      [panel]: message
    }));
    this.toast.error(message);
  }

  private clearSectionError(panel: EditablePanel): void {
    this.sectionErrors.update((errors) => {
      const next = { ...errors };
      delete next[panel];
      return next;
    });
  }

  // The backend stores times as HH:mm:ss and a time input works in HH:mm.
  private toTimeInput(value: string | null | undefined): string {
    return value ? value.slice(0, 5) : '';
  }

  private toBackendTime(value: string): string | null {
    return value ? `${value}:00` : null;
  }

  private options(entries: string[][]): Option[] {
    return entries.map(([value, label]) => ({ value, label }));
  }

  private accountTimezone(): string {
    return this.data()?.user.preferences.app.timezone
      || this.data()?.user.profile.timezone
      || 'Asia/Singapore';
  }
}

/**
 * The reason auth-service gave for refusing a deletion request, such as "Confirmation text must be DELETE" or
 * "Current password is invalid". Its errors carry the reason in `message`; `detail` is read too for a
 * ProblemDetail body. Anything else falls back to a plain line.
 */
function deletionErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'FitSync could not be reached. Your account was not deleted.';
    }
    const body = (error.error ?? null) as { detail?: unknown; message?: unknown } | null;
    const reason = [body?.detail, body?.message].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    );
    if (reason) {
      return reason;
    }
  }
  return 'Your account was not deleted. Try again.';
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableNumber(value: string): number | null {
  return value === '' ? null : Number(value);
}

function toFormNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}
