import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { OnboardingFormValue } from '../../core/fitsync.models';

type StepId = 'profile' | 'body' | 'goal' | 'training' | 'nutrition' | 'review';

interface OnboardingStep {
  id: StepId;
  label: string;
  controls: string[];
}

@Component({
  selector: 'app-onboarding-page',
  imports: [ReactiveFormsModule],
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss'
})
export class OnboardingPage {
  private readonly fb = inject(FormBuilder);
  private readonly dataService = inject(FitSyncDataService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly stepIndex = signal(0);

  readonly steps: OnboardingStep[] = [
    { id: 'profile', label: 'Profile', controls: ['displayName', 'birthDate', 'gender', 'preferredUnits'] },
    { id: 'body', label: 'Body', controls: ['heightCm', 'currentWeightKg', 'targetWeightKg', 'bodyFatRate', 'activityLevel'] },
    { id: 'goal', label: 'Goal', controls: ['targetDate'] },
    {
      id: 'training',
      label: 'Training',
      controls: ['fitnessLevel', 'trainingLocation', 'weeklyWorkoutDays', 'preferredDurationMinutes', 'preferredWorkoutTime', 'intensityPreference']
    },
    { id: 'nutrition', label: 'Nutrition', controls: ['dietaryPattern', 'mealFrequency', 'calorieTrackingMode', 'macroPreference', 'waterGoalMl'] },
    { id: 'review', label: 'Review', controls: [] }
  ];

  readonly form = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    birthDate: ['1996-01-01', Validators.required],
    gender: ['PREFER_NOT_TO_SAY', Validators.required],
    heightCm: [168, [Validators.required, Validators.min(80), Validators.max(300)]],
    activityLevel: ['MODERATELY_ACTIVE', Validators.required],
    currentWeightKg: [72, [Validators.required, Validators.min(1), Validators.max(500)]],
    targetWeightKg: [68, [Validators.required, Validators.min(1), Validators.max(500)]],
    bodyFatRate: [null as number | null, [Validators.min(0), Validators.max(100)]],
    targetDate: [this.defaultTargetDate(), Validators.required],
    preferredUnits: ['METRIC', Validators.required],
    fitnessLevel: ['BEGINNER', Validators.required],
    trainingLocation: ['MIXED', Validators.required],
    weeklyWorkoutDays: [4, [Validators.required, Validators.min(1), Validators.max(14)]],
    preferredDurationMinutes: [45, [Validators.required, Validators.min(5), Validators.max(240)]],
    preferredWorkoutTime: ['19:30'],
    intensityPreference: ['MODERATE', Validators.required],
    dietaryPattern: ['NONE', Validators.required],
    mealFrequency: [4, [Validators.required, Validators.min(1), Validators.max(12)]],
    calorieTrackingMode: ['FLEXIBLE', Validators.required],
    macroPreference: ['HIGH_PROTEIN', Validators.required],
    waterGoalMl: [2500, [Validators.required, Validators.min(0), Validators.max(10000)]],
    workoutReminderEnabled: [true],
    mealReminderEnabled: [true],
    weighInReminderEnabled: [true]
  });

  readonly currentStep = computed(() => this.steps[this.stepIndex()]);
  readonly progressPercent = computed(() => ((this.stepIndex() + 1) / this.steps.length) * 100);
  readonly estimatedCalories = computed(() => this.estimateCalories());
  readonly estimatedProtein = computed(() => Math.round((this.form.controls.currentWeightKg.value ?? 0) * 1.8));

  next(): void {
    if (!this.validateCurrentStep()) {
      return;
    }

    this.error.set(null);
    this.stepIndex.update((index) => Math.min(index + 1, this.steps.length - 1));
  }

  previous(): void {
    this.error.set(null);
    this.stepIndex.update((index) => Math.max(index - 1, 0));
  }

  goToStep(index: number): void {
    if (index <= this.stepIndex() || this.validateCurrentStep()) {
      this.error.set(null);
      this.stepIndex.set(index);
    }
  }

  submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.error.set('Please fix the highlighted fields before continuing.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.dataService.saveOnboarding(this.onboardingValue()).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (error: Error | HttpErrorResponse) => {
        this.error.set(this.saveErrorMessage(error));
        this.submitting.set(false);
      }
    });
  }

  private validateCurrentStep(): boolean {
    const controls = this.currentStep().controls;
    for (const name of controls) {
      const control = this.form.get(name);
      control?.markAsTouched();
      control?.updateValueAndValidity();
    }

    const valid = controls.every((name) => this.form.get(name)?.valid);
    if (!valid) {
      this.error.set('Please complete the highlighted fields before continuing.');
    }
    return valid;
  }

  private onboardingValue(): OnboardingFormValue {
    const value = this.form.getRawValue();
    return {
      displayName: value.displayName ?? '',
      birthDate: value.birthDate ?? '',
      gender: value.gender ?? 'PREFER_NOT_TO_SAY',
      heightCm: value.heightCm ?? 168,
      activityLevel: value.activityLevel ?? 'MODERATELY_ACTIVE',
      currentWeightKg: value.currentWeightKg ?? 72,
      targetWeightKg: value.targetWeightKg ?? 68,
      bodyFatRate: value.bodyFatRate,
      targetDate: value.targetDate ?? this.defaultTargetDate(),
      preferredUnits: value.preferredUnits ?? 'METRIC',
      fitnessLevel: value.fitnessLevel ?? 'BEGINNER',
      trainingLocation: value.trainingLocation ?? 'MIXED',
      weeklyWorkoutDays: value.weeklyWorkoutDays ?? 4,
      preferredDurationMinutes: value.preferredDurationMinutes ?? 45,
      preferredWorkoutTime: value.preferredWorkoutTime ?? '',
      intensityPreference: value.intensityPreference ?? 'MODERATE',
      dietaryPattern: value.dietaryPattern ?? 'NONE',
      mealFrequency: value.mealFrequency ?? 4,
      calorieTrackingMode: value.calorieTrackingMode ?? 'FLEXIBLE',
      macroPreference: value.macroPreference ?? 'HIGH_PROTEIN',
      waterGoalMl: value.waterGoalMl ?? 2500,
      workoutReminderEnabled: value.workoutReminderEnabled ?? true,
      mealReminderEnabled: value.mealReminderEnabled ?? true,
      weighInReminderEnabled: value.weighInReminderEnabled ?? true
    };
  }

  private estimateCalories(): number {
    const weight = this.form.controls.currentWeightKg.value ?? 72;
    const height = this.form.controls.heightCm.value ?? 168;
    const birthYear = Number((this.form.controls.birthDate.value ?? '1996').slice(0, 4));
    const age = Math.max(16, new Date().getFullYear() - birthYear);
    const gender = this.form.controls.gender.value;
    const currentWeight = this.form.controls.currentWeightKg.value ?? weight;
    const targetWeight = this.form.controls.targetWeightKg.value ?? currentWeight;
    const activity = this.form.controls.activityLevel.value ?? 'MODERATELY_ACTIVE';
    const adjustment = gender === 'MALE' ? 5 : gender === 'FEMALE' ? -161 : -78;
    const multipliers: Record<string, number> = {
      SEDENTARY: 1.2,
      LIGHTLY_ACTIVE: 1.375,
      MODERATELY_ACTIVE: 1.55,
      VERY_ACTIVE: 1.725,
      ATHLETE: 1.9
    };
    const bmr = 10 * weight + 6.25 * height - 5 * age + adjustment;
    const goalAdjustment = targetWeight < currentWeight ? -400 : targetWeight > currentWeight ? 250 : 0;
    return Math.max(1200, Math.round(bmr * multipliers[activity] + goalAdjustment));
  }

  private defaultTargetDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date.toISOString().slice(0, 10);
  }

  private saveErrorMessage(error: Error | HttpErrorResponse): string {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return 'Your session has expired. Please sign in again before saving setup.';
    }

    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Unable to reach the FitSync backend. Check that the local gateway is running.';
    }

    return error.message || 'Unable to save onboarding data. Please check the backend connection.';
  }
}
