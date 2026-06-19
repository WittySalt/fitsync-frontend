import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { OnboardingFormValue, OnboardingSeed } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import {
  GoalProjection,
  PrimaryGoal,
  calculateGoalProjection,
  shouldShowTargetAndPace
} from './onboarding-projection';

type PreferredUnits = 'METRIC' | 'IMPERIAL';
type ControlName =
  | 'primaryGoal'
  | 'displayName'
  | 'gender'
  | 'birthDate'
  | 'preferredUnits'
  | 'heightCm'
  | 'heightFt'
  | 'heightIn'
  | 'currentWeightKg'
  | 'currentWeightLb'
  | 'targetWeightKg'
  | 'targetWeightLb'
  | 'weeklyPaceKg'
  | 'activityLevel'
  | 'weeklyWorkoutDays'
  | 'dietaryPattern'
  | 'calorieTrackingMode'
  | 'targetCalories'
  | 'targetProteinGrams'
  | 'targetCarbsGrams'
  | 'targetFatGrams'
  | 'workoutReminderEnabled'
  | 'mealReminderEnabled';

interface OnboardingStep {
  label: string;
  title: string;
}

@Component({
  selector: 'app-onboarding-page',
  imports: [ReactiveFormsModule, StatePanelComponent],
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss'
})
export class OnboardingPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dataService = inject(FitSyncDataService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly currentStep = signal(0);
  readonly hasExistingBodyBaseline = signal(false);
  readonly hasExistingTrainingBaseline = signal(false);
  readonly hasExistingNutritionBaseline = signal(false);
  readonly projection = signal<GoalProjection>(
    calculateGoalProjection({
      primaryGoal: 'MAINTAIN',
      heightCm: null,
      currentWeightKg: null,
      targetWeightKg: null,
      weeklyPaceKg: null,
      weeklyWorkoutDays: null,
      activityLevel: 'MODERATELY_ACTIVE',
      startDate: new Date()
    })
  );

  readonly steps: OnboardingStep[] = [
    { label: 'Goal', title: 'Choose your main goal' },
    { label: 'Profile', title: 'Tell us the basics' },
    { label: 'Projection', title: 'Set your plan' },
    { label: 'Habits', title: 'Training and nutrition' },
    { label: 'Review', title: 'Review your targets' }
  ];

  readonly form = this.fb.group({
    primaryGoal: [null as PrimaryGoal | null, Validators.required],
    displayName: ['', [Validators.required, Validators.maxLength(80)]],
    gender: ['', Validators.required],
    birthDate: ['', Validators.required],
    preferredUnits: ['METRIC' as PreferredUnits, Validators.required],
    heightCm: [null as number | null],
    heightFt: [null as number | null],
    heightIn: [null as number | null],
    currentWeightKg: [null as number | null],
    currentWeightLb: [null as number | null],
    targetWeightKg: [null as number | null],
    targetWeightLb: [null as number | null],
    weeklyPaceKg: [0.5 as number | null],
    activityLevel: ['MODERATELY_ACTIVE', Validators.required],
    weeklyWorkoutDays: [4, [Validators.required, Validators.min(1), Validators.max(7)]],
    dietaryPattern: ['NONE', Validators.required],
    calorieTrackingMode: ['FLEXIBLE', Validators.required],
    targetCalories: [null as number | null, [Validators.required, Validators.min(1000), Validators.max(6000)]],
    targetProteinGrams: [null as number | null, [Validators.required, Validators.min(20), Validators.max(400)]],
    targetCarbsGrams: [null as number | null, [Validators.required, Validators.min(0), Validators.max(900)]],
    targetFatGrams: [null as number | null, [Validators.required, Validators.min(10), Validators.max(300)]],
    workoutReminderEnabled: [true],
    mealReminderEnabled: [true]
  });

  private planEdited = false;

  constructor() {
    this.syncConditionalValidators();
    this.refreshProjection(true);

    this.form.valueChanges.subscribe(() => {
      this.syncConditionalValidators();
      this.refreshProjection(!this.planEdited);
    });
  }

  ngOnInit(): void {
    this.dataService.getOnboardingSeed().subscribe({
      next: (seed) => this.applyOnboardingSeed(seed),
      error: () => {
        // Returning-user prefill is best-effort; the route guard owns auth failures.
      }
    });
  }

  private applyOnboardingSeed(seed: OnboardingSeed): void {
    this.hasExistingBodyBaseline.set(seed.hasExistingBodyBaseline);
    this.hasExistingTrainingBaseline.set(seed.hasExistingTrainingBaseline);
    this.hasExistingNutritionBaseline.set(seed.hasExistingNutritionBaseline);

    if (this.form.dirty || Object.keys(seed.value).length === 0) {
      return;
    }

    // Seed comes from backend-normalized strings; the typed form narrows them at runtime.
    this.form.patchValue(seed.value as unknown as Partial<typeof this.form.value>, { emitEvent: false });
    if (this.form.controls.preferredUnits.value === 'IMPERIAL') {
      this.changeUnits('IMPERIAL');
    }
    this.syncConditionalValidators();

    const hasSeededPlan = seed.value.targetCalories != null || seed.value.targetProteinGrams != null;
    this.planEdited = hasSeededPlan;
    this.refreshProjection(!hasSeededPlan);
    this.form.markAsPristine();
  }

  selectPrimaryGoal(goal: PrimaryGoal): void {
    this.form.controls.primaryGoal.setValue(goal);
    this.applyGoalDefaults(goal);
    this.planEdited = false;
    this.error.set(null);
  }

  changeUnits(units: PreferredUnits): void {
    this.form.controls.preferredUnits.setValue(units);

    if (units === 'IMPERIAL') {
      const height = this.form.controls.heightCm.value;
      const currentWeight = this.form.controls.currentWeightKg.value;
      const targetWeight = this.form.controls.targetWeightKg.value;
      this.form.patchValue(
        {
          ...(height ? this.cmToFeetInches(height) : {}),
          currentWeightLb: currentWeight ? this.kgToLb(currentWeight) : null,
          targetWeightLb: targetWeight ? this.kgToLb(targetWeight) : null
        },
        { emitEvent: false }
      );
    } else {
      this.form.patchValue(
        {
          heightCm: this.imperialHeightToCm(),
          currentWeightKg: this.lbToKg(this.form.controls.currentWeightLb.value),
          targetWeightKg: this.lbToKg(this.form.controls.targetWeightLb.value)
        },
        { emitEvent: false }
      );
    }

    this.syncConditionalValidators();
    this.refreshProjection(!this.planEdited);
  }

  nextStep(): void {
    if (!this.isStepValid(this.currentStep())) {
      this.markStepTouched(this.currentStep());
      this.error.set('Please complete the highlighted fields before continuing.');
      return;
    }

    this.error.set(null);
    this.currentStep.update((step) => Math.min(step + 1, this.steps.length - 1));
  }

  previousStep(): void {
    this.error.set(null);
    this.currentStep.update((step) => Math.max(step - 1, 0));
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.syncConditionalValidators();
    this.refreshProjection(!this.planEdited);

    if (this.form.invalid || !this.steps.every((_, index) => this.isStepValid(index))) {
      this.error.set('Please fix the highlighted fields before continuing.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);

    this.dataService.saveOnboarding(this.toOnboardingValue()).subscribe({
      next: () => {
        this.toast.success('Your plan is ready. Welcome to FitSync!');
        this.router.navigateByUrl('/dashboard');
      },
      error: (error: Error) => {
        const message = error.message || 'Unable to save onboarding data. Please check the backend connection.';
        this.error.set(message);
        this.toast.error(message);
        this.submitting.set(false);
      }
    });
  }

  hasPrimaryGoal(): boolean {
    return this.form.controls.primaryGoal.value !== null;
  }

  preferredUnits(): PreferredUnits {
    return this.form.controls.preferredUnits.value ?? 'METRIC';
  }

  showsTargetAndPace(): boolean {
    const goal = this.form.controls.primaryGoal.value;
    return goal ? shouldShowTargetAndPace(goal) : false;
  }

  onPlanEdited(): void {
    this.planEdited = true;
  }

  useRecommendedPlan(): void {
    this.planEdited = false;
    this.refreshProjection(true);
  }

  isSelectedGoal(goal: PrimaryGoal): boolean {
    return this.form.controls.primaryGoal.value === goal;
  }

  isInvalid(controlName: ControlName): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  goalCopy(): string {
    switch (this.form.controls.primaryGoal.value) {
      case 'LOSE_FAT':
        return 'We will pair a sustainable deficit with enough protein to protect training performance.';
      case 'BUILD_MUSCLE':
        return 'We will use a measured surplus and strength-focused habits to support lean mass.';
      case 'MAINTAIN':
        return 'We will keep calories near maintenance and focus on consistent routines.';
      case 'IMPROVE_FITNESS':
        return 'We will prioritize activity consistency and recovery instead of chasing a scale target.';
      default:
        return 'Pick the outcome that matters most right now. You can change it later.';
    }
  }

  private applyGoalDefaults(goal: PrimaryGoal): void {
    let weeklyPaceKg: number | null;
    let weeklyWorkoutDays: number;
    let calorieTrackingMode: string;

    if (goal === 'LOSE_FAT') {
      weeklyPaceKg = 0.5;
      weeklyWorkoutDays = 4;
      calorieTrackingMode = 'STRICT';
    } else if (goal === 'BUILD_MUSCLE') {
      weeklyPaceKg = 0.25;
      weeklyWorkoutDays = 4;
      calorieTrackingMode = 'FLEXIBLE';
    } else if (goal === 'MAINTAIN') {
      weeklyPaceKg = null;
      weeklyWorkoutDays = 3;
      calorieTrackingMode = 'FLEXIBLE';
    } else {
      weeklyPaceKg = null;
      weeklyWorkoutDays = 5;
      calorieTrackingMode = 'FLEXIBLE';
    }

    this.form.patchValue({ weeklyPaceKg, weeklyWorkoutDays, calorieTrackingMode }, { emitEvent: false });
    this.syncConditionalValidators();
    this.refreshProjection(true);
  }

  private syncConditionalValidators(): void {
    const isMetric = this.preferredUnits() === 'METRIC';
    const needsTarget = this.showsTargetAndPace();

    this.setValidators(this.form.controls.heightCm, isMetric ? [Validators.required, Validators.min(80), Validators.max(240)] : []);
    this.setValidators(this.form.controls.heightFt, isMetric ? [] : [Validators.required, Validators.min(3), Validators.max(8)]);
    this.setValidators(this.form.controls.heightIn, isMetric ? [] : [Validators.required, Validators.min(0), Validators.max(11)]);
    this.setValidators(
      this.form.controls.currentWeightKg,
      isMetric ? [Validators.required, Validators.min(20), Validators.max(350)] : []
    );
    this.setValidators(
      this.form.controls.currentWeightLb,
      isMetric ? [] : [Validators.required, Validators.min(44), Validators.max(772)]
    );
    this.setValidators(
      this.form.controls.targetWeightKg,
      isMetric && needsTarget ? [Validators.required, Validators.min(20), Validators.max(350)] : []
    );
    this.setValidators(
      this.form.controls.targetWeightLb,
      !isMetric && needsTarget ? [Validators.required, Validators.min(44), Validators.max(772)] : []
    );
    this.setValidators(
      this.form.controls.weeklyPaceKg,
      needsTarget ? [Validators.required, Validators.min(0.25), Validators.max(1)] : []
    );
  }

  private setValidators(control: AbstractControl, validators: ValidatorFn[]): void {
    control.setValidators(validators);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private refreshProjection(updatePlanFields: boolean): void {
    const projection = calculateGoalProjection({
      primaryGoal: this.form.controls.primaryGoal.value ?? 'MAINTAIN',
      heightCm: this.heightCm(),
      currentWeightKg: this.currentWeightKg(),
      targetWeightKg: this.targetWeightKg(),
      weeklyPaceKg: this.form.controls.weeklyPaceKg.value,
      weeklyWorkoutDays: this.form.controls.weeklyWorkoutDays.value,
      activityLevel: this.form.controls.activityLevel.value,
      startDate: new Date()
    });

    this.projection.set(projection);

    if (updatePlanFields && projection.dailyCalories) {
      this.form.patchValue(
        {
          targetCalories: projection.dailyCalories,
          targetProteinGrams: projection.proteinGrams,
          targetCarbsGrams: projection.carbsGrams,
          targetFatGrams: projection.fatGrams
        },
        { emitEvent: false }
      );
    }
  }

  private isStepValid(step: number): boolean {
    if (step === 0) {
      return this.form.controls.primaryGoal.valid;
    }

    if (step === 1) {
      return (
        this.form.controls.displayName.valid &&
        this.form.controls.gender.valid &&
        this.form.controls.birthDate.valid &&
        (this.preferredUnits() === 'METRIC'
          ? this.form.controls.heightCm.valid
          : this.form.controls.heightFt.valid && this.form.controls.heightIn.valid)
      );
    }

    if (step === 2) {
      const hasCurrentWeight =
        this.preferredUnits() === 'METRIC'
          ? this.form.controls.currentWeightKg.valid
          : this.form.controls.currentWeightLb.valid;
      const hasTarget =
        !this.showsTargetAndPace() ||
        (this.preferredUnits() === 'METRIC'
          ? this.form.controls.targetWeightKg.valid
          : this.form.controls.targetWeightLb.valid);

      return hasCurrentWeight && hasTarget && this.form.controls.weeklyPaceKg.valid;
    }

    if (step === 3) {
      return (
        this.form.controls.activityLevel.valid &&
        this.form.controls.weeklyWorkoutDays.valid &&
        this.form.controls.dietaryPattern.valid &&
        this.form.controls.calorieTrackingMode.valid
      );
    }

    return (
      this.form.controls.targetCalories.valid &&
      this.form.controls.targetProteinGrams.valid &&
      this.form.controls.targetCarbsGrams.valid &&
      this.form.controls.targetFatGrams.valid
    );
  }

  private markStepTouched(step: number): void {
    const controlsByStep: ControlName[][] = [
      ['primaryGoal'],
      ['displayName', 'gender', 'birthDate', 'preferredUnits', 'heightCm', 'heightFt', 'heightIn'],
      ['currentWeightKg', 'currentWeightLb', 'targetWeightKg', 'targetWeightLb', 'weeklyPaceKg'],
      ['activityLevel', 'weeklyWorkoutDays', 'dietaryPattern', 'calorieTrackingMode'],
      ['targetCalories', 'targetProteinGrams', 'targetCarbsGrams', 'targetFatGrams']
    ];

    for (const controlName of controlsByStep[step] ?? []) {
      this.form.controls[controlName].markAsTouched();
    }
  }

  private toOnboardingValue(): OnboardingFormValue {
    const raw = this.form.getRawValue();

    return {
      primaryGoal: raw.primaryGoal ?? 'MAINTAIN',
      displayName: raw.displayName ?? '',
      gender: raw.gender ?? '',
      birthDate: raw.birthDate ?? '',
      preferredUnits: raw.preferredUnits ?? 'METRIC',
      heightCm: raw.heightCm,
      heightFt: raw.heightFt,
      heightIn: raw.heightIn,
      currentWeightKg: raw.currentWeightKg,
      currentWeightLb: raw.currentWeightLb,
      targetWeightKg: raw.targetWeightKg,
      targetWeightLb: raw.targetWeightLb,
      weeklyPaceKg: raw.weeklyPaceKg,
      activityLevel: raw.activityLevel ?? 'MODERATELY_ACTIVE',
      weeklyWorkoutDays: raw.weeklyWorkoutDays ?? 0,
      dietaryPattern: raw.dietaryPattern ?? 'NONE',
      calorieTrackingMode: raw.calorieTrackingMode ?? 'FLEXIBLE',
      targetCalories: raw.targetCalories,
      targetProteinGrams: raw.targetProteinGrams,
      targetCarbsGrams: raw.targetCarbsGrams,
      targetFatGrams: raw.targetFatGrams,
      projectedTargetDate: this.projection().projectedDate,
      workoutReminderEnabled: raw.workoutReminderEnabled ?? false,
      mealReminderEnabled: raw.mealReminderEnabled ?? false
    };
  }

  private heightCm(): number | null {
    return this.preferredUnits() === 'METRIC' ? this.form.controls.heightCm.value : this.imperialHeightToCm();
  }

  private currentWeightKg(): number | null {
    return this.preferredUnits() === 'METRIC'
      ? this.form.controls.currentWeightKg.value
      : this.lbToKg(this.form.controls.currentWeightLb.value);
  }

  private targetWeightKg(): number | null {
    return this.preferredUnits() === 'METRIC'
      ? this.form.controls.targetWeightKg.value
      : this.lbToKg(this.form.controls.targetWeightLb.value);
  }

  private imperialHeightToCm(): number | null {
    const feet = this.form.controls.heightFt.value;
    const inches = this.form.controls.heightIn.value;

    if (feet === null && inches === null) {
      return null;
    }

    return Math.round(((feet ?? 0) * 12 + (inches ?? 0)) * 2.54);
  }

  private cmToFeetInches(heightCm: number): { heightFt: number; heightIn: number } {
    const totalInches = Math.round(heightCm / 2.54);
    return {
      heightFt: Math.floor(totalInches / 12),
      heightIn: totalInches % 12
    };
  }

  private kgToLb(value: number): number {
    return Math.round(value * 2.20462 * 10) / 10;
  }

  private lbToKg(value: number | null): number | null {
    return value === null ? null : Math.round((value / 2.20462) * 10) / 10;
  }
}
