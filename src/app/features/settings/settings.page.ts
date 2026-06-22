import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ToastService } from '../../core/toast/toast.service';

import {
  AccountCenterData,
  AccountDataService,
  AccountPreferences,
  AccountProfile,
  initialsFor
} from '../../core/account-data.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemePreference, ThemeService } from '../../core/theme/theme.service';
import { AccountSecurityActionsComponent } from './account-security-actions.component';

type EditablePanel =
  | 'identity'
  | 'location'
  | 'activity'
  | 'formatting'
  | 'training'
  | 'nutrition'
  | 'notifications'
  | 'privacy'
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

@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, RouterLink, AccountSecurityActionsComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss'
})
export class SettingsPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly accountDataService = inject(AccountDataService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly themeService = inject(ThemeService);
  private readonly toast = inject(ToastService);

  readonly data = signal<AccountCenterData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);
  readonly sectionErrors = signal<Partial<Record<EditablePanel, string>>>({});
  readonly saving = signal<EditablePanel | null>(null);
  readonly editPanel = signal<EditablePanel | null>(null);
  readonly accountMenuOpen = signal(false);
  readonly selectedSection = signal('personal');

  readonly sections: SectionNavItem[] = [
    { id: 'personal', label: 'Personal', description: 'Identity, location, activity, and targets.' },
    { id: 'appearance', label: 'Appearance', description: 'Theme mode and display preferences.' },
    { id: 'preferences', label: 'Preferences', description: 'Formatting, training defaults, and nutrition tracking.' },
    { id: 'security', label: 'Security', description: 'Password state, recovery email, and active sessions.' },
    { id: 'notifications', label: 'Notifications', description: 'Channels, reminders, reports, and quiet hours.' },
    { id: 'privacy-data', label: 'Privacy & Data', description: 'Visibility, sharing, exports, and account deletion.' }
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
  readonly identityForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    firstName: ['', [Validators.maxLength(80)]],
    lastName: ['', [Validators.maxLength(80)]],
    birthDate: [''],
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
    waterGoalMl: ['', [Validators.min(0), Validators.max(10000)]]
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
    privacyLevel: ['120001'],
    dataSharingConsent: [false]
  });

  readonly recoveryForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    currentPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(120)]]
  });

  readonly deletionForm = this.fb.group({
    confirmationText: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(120)]],
    currentPassword: ['', [Validators.maxLength(120)]]
  });

  ngOnInit(): void {
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
    const profile = this.data()?.user.profile;
    return profile?.locationDisplay || profile?.timezone || 'Not set';
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
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  displayDate(value: string | null | undefined): string {
    if (!value) {
      return 'Not set';
    }
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
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
    this.editPanel.set(null);
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
    this.saving.set('privacy');
    this.accountDataService.downloadDataExport(exportRequestId).subscribe({
      next: () => this.finishSave('privacy', 'Data archive downloaded by the API.'),
      error: (error: Error) => this.handleSaveError('privacy', error)
    });
  }

  requestAccountDeletion(): void {
    const data = this.data();
    if (!data || this.deletionForm.invalid) {
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
        this.setData({ ...data, accountDeletion });
        this.deletionForm.reset();
        this.finishSave('delete', 'Account deletion request submitted.');
      },
      error: (error: Error) => this.handleSaveError('delete', error)
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
    this.activityForm.patchValue({ activityLevel: profile.activityLevel ?? '' });
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
      waterGoalMl: toFormNumber(preferences.nutrition.waterGoalMl)
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
      privacyLevel: preferences.app.privacyLevel,
      dataSharingConsent: preferences.app.dataSharingConsent
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
      error: (error: Error) => this.handleSaveError(panel, error)
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
          waterGoalMl: toNullableNumber(value.waterGoalMl)
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

  private toTimeInput(value: string | null | undefined): string {
    return value ? value.slice(0, 5) : '';
  }

  private toBackendTime(value: string): string | null {
    return value ? `${value}:00` : null;
  }

  private options(entries: string[][]): Option[] {
    return entries.map(([value, label]) => ({ value, label }));
  }
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
