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

/** The weekly frequency may be left open (null), and otherwise has to be a whole number of days from one to seven. */
const weeklyDaysValidator: ValidatorFn = (control) => {
  const value = control.value;
  if (value === null) {
    return null;
  }
  return Number.isInteger(value) && value >= 1 && value <= 7 ? null : { weeklyDays: true };
};
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
  | 'fitnessLevel'
  | 'trainingLocation'
  | 'preferredDurationMinutes'
  | 'preferredWorkoutTime'
  | 'intensityPreference'
  | 'equipmentInventory'
  | 'focusAreas'
  | 'parqHeartCondition'
  | 'parqChestPainActivity'
  | 'parqDizziness'
  | 'parqBoneJointIssue'
  | 'parqBpOrHeartMeds'
  | 'parqOtherReason'
  | 'injuryAreas'
  | 'parqAcknowledged'
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

interface ChoiceOption {
  value: string;
  label: string;
  description: string;
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
    { label: 'Training', title: 'Shape your training style' },
    { label: 'Health', title: 'Check your readiness' },
    { label: 'Habits', title: 'Set nutrition habits' },
    { label: 'Review', title: 'Review your targets' }
  ];

  readonly trainingLocationOptions: ChoiceOption[] = [
    { value: 'HOME', label: 'Home', description: 'Compact sessions around bodyweight and small equipment.' },
    { value: 'GYM', label: 'Gym', description: 'Use machines, barbells, and structured strength work.' },
    { value: 'OUTDOOR', label: 'Outdoor', description: 'Prioritize cardio, mobility, and outdoor-friendly sessions.' },
    { value: 'MIXED', label: 'Mixed', description: 'Blend gym, home, and outdoor training across the week.' }
  ];
  readonly fitnessLevelOptions: ChoiceOption[] = [
    { value: 'BEGINNER', label: 'Beginner', description: 'New or returning after a long break.' },
    { value: 'INTERMEDIATE', label: 'Intermediate', description: 'Consistent training with familiar exercises.' },
    { value: 'ADVANCED', label: 'Advanced', description: 'Experienced, structured, and comfortable with progression.' }
  ];
  readonly intensityOptions: ChoiceOption[] = [
    { value: 'LOW', label: 'Low', description: 'Easy starts, more recovery, gentle progression.' },
    { value: 'MODERATE', label: 'Moderate', description: 'Balanced effort with sustainable weekly work.' },
    { value: 'HIGH', label: 'High', description: 'Challenging sessions when recovery is reliable.' }
  ];
  readonly equipmentOptions: ChoiceOption[] = [
    { value: 'NONE', label: 'None', description: 'Bodyweight only' },
    { value: 'DUMBBELLS', label: 'Dumbbells', description: 'Pairs or adjustable weights' },
    { value: 'BARBELL', label: 'Barbell', description: 'Rack, plates, or platform' },
    { value: 'BANDS', label: 'Bands', description: 'Resistance or mobility bands' },
    { value: 'PULL_UP_BAR', label: 'Pull-up bar', description: 'Doorway or fixed bar' },
    { value: 'KETTLEBELL', label: 'Kettlebell', description: 'Swings, carries, complexes' },
    { value: 'MACHINES', label: 'Machines', description: 'Selectorized or cable machines' },
    { value: 'FULL_GYM', label: 'Full gym', description: 'Commercial gym access' }
  ];
  readonly focusOptions: ChoiceOption[] = [
    { value: 'FULL_BODY', label: 'Full body', description: 'Balanced training' },
    { value: 'UPPER', label: 'Upper', description: 'Chest, back, shoulders, arms' },
    { value: 'CORE', label: 'Core', description: 'Trunk strength and stability' },
    { value: 'LOWER', label: 'Lower', description: 'Glutes, quads, hamstrings' },
    { value: 'MOBILITY', label: 'Mobility', description: 'Range and movement quality' },
    { value: 'CARDIO', label: 'Cardio', description: 'Heart and conditioning' }
  ];
  readonly injuryOptions: ChoiceOption[] = [
    { value: 'LOWER_BACK', label: 'Lower back', description: 'Back sensitivity or pain' },
    { value: 'KNEE', label: 'Knee', description: 'Knee limitation' },
    { value: 'SHOULDER', label: 'Shoulder', description: 'Shoulder limitation' },
    { value: 'HIP', label: 'Hip', description: 'Hip limitation' },
    { value: 'ANKLE', label: 'Ankle', description: 'Ankle limitation' },
    { value: 'NECK', label: 'Neck', description: 'Neck limitation' },
    { value: 'WRIST', label: 'Wrist', description: 'Wrist limitation' },
    { value: 'OTHER', label: 'Other', description: 'Something else' }
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
    weeklyWorkoutDays: [4 as number | null, [weeklyDaysValidator]],
    fitnessLevel: ['BEGINNER', Validators.required],
    trainingLocation: ['MIXED', Validators.required],
    preferredDurationMinutes: [45 as number | null, [Validators.required, Validators.min(5), Validators.max(240)]],
    preferredWorkoutTime: ['19:00'],
    intensityPreference: ['MODERATE', Validators.required],
    equipmentInventory: [[] as string[], [maxSelected(8)]],
    focusAreas: [['FULL_BODY'] as string[], [maxSelected(6)]],
    parqHeartCondition: [false],
    parqChestPainActivity: [false],
    parqDizziness: [false],
    parqBoneJointIssue: [false],
    parqBpOrHeartMeds: [false],
    parqOtherReason: [false],
    injuryAreas: [[] as string[], [maxSelected(8), validInjuryAreas()]],
    parqAcknowledged: [false],
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
  private parqAcknowledgedAt: string | null = null;

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

  selectChoice(controlName: 'trainingLocation' | 'fitnessLevel' | 'intensityPreference', value: string): void {
    this.form.controls[controlName].setValue(value);
    this.error.set(null);
  }

  /** True while the user has chosen to leave the weekly training frequency open. */
  weeklyDaysUndecided(): boolean {
    return this.form.controls.weeklyWorkoutDays.value === null;
  }

  setWeeklyDaysLater(later: boolean): void {
    const control = this.form.controls.weeklyWorkoutDays;
    // Coming back from "Decide later" restores the number the plan defaults to for a fresh form.
    control.setValue(later ? null : 4);
    control.markAsDirty();
    this.error.set(null);
    this.refreshProjection(false);
  }

  isChoiceSelected(controlName: 'trainingLocation' | 'fitnessLevel' | 'intensityPreference', value: string): boolean {
    return this.form.controls[controlName].value === value;
  }

  toggleMultiSelect(controlName: 'equipmentInventory' | 'focusAreas' | 'injuryAreas', value: string): void {
    const control = this.form.controls[controlName];
    const current = control.value ?? [];
    let next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];

    if (controlName === 'equipmentInventory') {
      if (value === 'NONE' && !current.includes('NONE')) {
        next = ['NONE'];
      } else if (value !== 'NONE') {
        next = next.filter((entry) => entry !== 'NONE');
      }
    }

    control.setValue(next);
    control.markAsDirty();
    control.updateValueAndValidity();
  }

  isMultiSelected(controlName: 'equipmentInventory' | 'focusAreas' | 'injuryAreas', value: string): boolean {
    return this.form.controls[controlName].value?.includes(value) ?? false;
  }

  isInvalid(controlName: ControlName): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  setParqAcknowledged(checked: boolean): void {
    this.form.controls.parqAcknowledged.setValue(checked);
    this.parqAcknowledgedAt = checked ? new Date().toISOString() : null;
  }

  hasParqRisk(): boolean {
    return (
      this.form.controls.parqHeartCondition.value ||
      this.form.controls.parqChestPainActivity.value ||
      this.form.controls.parqDizziness.value ||
      this.form.controls.parqBoneJointIssue.value ||
      this.form.controls.parqBpOrHeartMeds.value ||
      this.form.controls.parqOtherReason.value ||
      Boolean(this.form.controls.injuryAreas.value?.length)
    );
  }

  private weeklyDaysChip(): string {
    const days = this.form.controls.weeklyWorkoutDays.value;
    return days === null ? 'Days to be decided' : `${days} days/week`;
  }

  planChips(): string[] {
    const chips: string[] = [];
    const location = this.optionLabel(this.trainingLocationOptions, this.form.controls.trainingLocation.value);
    const level = this.optionLabel(this.fitnessLevelOptions, this.form.controls.fitnessLevel.value);
    const intensity = this.optionLabel(this.intensityOptions, this.form.controls.intensityPreference.value);
    chips.push(location, level, this.weeklyDaysChip(), `${this.form.controls.preferredDurationMinutes.value ?? 0} min`, intensity);

    const equipment = this.form.controls.equipmentInventory.value ?? [];
    if (equipment.length) {
      chips.push(`${equipment.length} equipment`);
    }
    const focus = this.form.controls.focusAreas.value ?? [];
    if (focus.length) {
      chips.push(`${focus.length} focus area${focus.length === 1 ? '' : 's'}`);
    }
    if (this.hasParqRisk()) {
      chips.push('Health notes');
    }
    return chips.filter(Boolean);
  }

  goalCopy(): string {
    if (this.currentStep() === 3) {
      switch (this.form.controls.trainingLocation.value) {
        case 'HOME':
          return 'We will make the plan work around your space and the equipment you actually have.';
        case 'GYM':
          return 'We will use your gym access for structured progression and clear training days.';
        case 'OUTDOOR':
          return 'We will bias toward outdoor-friendly conditioning, mobility, and simple strength work.';
        default:
          return 'We will keep your training flexible across home, gym, and outdoor sessions.';
      }
    }
    if (this.currentStep() === 4) {
      return 'FitSync is not medical advice. If anything here is a yes, we will keep the plan conservative and suggest checking with a doctor first.';
    }

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

  private optionLabel(options: ChoiceOption[], value: string | null | undefined): string {
    return options.find((option) => option.value === value)?.label ?? '';
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
    switch (step) {
      case 0:
        return this.form.controls.primaryGoal.valid;
      case 1:
        return this.isProfileStepValid();
      case 2:
        return this.isGoalPlanStepValid();
      case 3:
        return this.isTrainingStepValid();
      case 4:
        return this.isHealthStepValid();
      case 5:
        return this.isNutritionPreferenceStepValid();
      default:
        return this.isNutritionTargetStepValid();
    }
  }

  private isProfileStepValid(): boolean {
    const heightValid = this.preferredUnits() === 'METRIC'
      ? this.form.controls.heightCm.valid
      : this.form.controls.heightFt.valid && this.form.controls.heightIn.valid;

    return (
      this.form.controls.displayName.valid &&
      this.form.controls.gender.valid &&
      this.form.controls.birthDate.valid &&
      heightValid
    );
  }

  private isGoalPlanStepValid(): boolean {
    const metricUnits = this.preferredUnits() === 'METRIC';
    const hasCurrentWeight = metricUnits
      ? this.form.controls.currentWeightKg.valid
      : this.form.controls.currentWeightLb.valid;
    const hasTarget = !this.showsTargetAndPace() || (
      metricUnits ? this.form.controls.targetWeightKg.valid : this.form.controls.targetWeightLb.valid
    );

    return hasCurrentWeight && hasTarget && this.form.controls.weeklyPaceKg.valid;
  }

  private isTrainingStepValid(): boolean {
    return (
      this.form.controls.activityLevel.valid &&
      this.form.controls.weeklyWorkoutDays.valid &&
      this.form.controls.fitnessLevel.valid &&
      this.form.controls.trainingLocation.valid &&
      this.form.controls.preferredDurationMinutes.valid &&
      this.form.controls.preferredWorkoutTime.valid &&
      this.form.controls.intensityPreference.valid &&
      this.form.controls.equipmentInventory.valid &&
      this.form.controls.focusAreas.valid
    );
  }

  private isHealthStepValid(): boolean {
    return (
      this.form.controls.injuryAreas.valid &&
      (!this.hasParqRisk() || this.form.controls.parqAcknowledged.value === true)
    );
  }

  private isNutritionPreferenceStepValid(): boolean {
    return (
      this.form.controls.dietaryPattern.valid &&
      this.form.controls.calorieTrackingMode.valid
    );
  }

  private isNutritionTargetStepValid(): boolean {
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
      [
        'activityLevel',
        'weeklyWorkoutDays',
        'fitnessLevel',
        'trainingLocation',
        'preferredDurationMinutes',
        'preferredWorkoutTime',
        'intensityPreference',
        'equipmentInventory',
        'focusAreas'
      ],
      [
        'parqHeartCondition',
        'parqChestPainActivity',
        'parqDizziness',
        'parqBoneJointIssue',
        'parqBpOrHeartMeds',
        'parqOtherReason',
        'injuryAreas',
        'parqAcknowledged'
      ],
      ['dietaryPattern', 'calorieTrackingMode'],
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
      weeklyWorkoutDays: raw.weeklyWorkoutDays,
      fitnessLevel: raw.fitnessLevel ?? 'BEGINNER',
      trainingLocation: raw.trainingLocation ?? 'MIXED',
      preferredDurationMinutes: raw.preferredDurationMinutes,
      preferredWorkoutTime: raw.preferredWorkoutTime ?? '',
      intensityPreference: raw.intensityPreference ?? 'MODERATE',
      equipmentInventory: raw.equipmentInventory ?? [],
      focusAreas: raw.focusAreas ?? [],
      parqHeartCondition: raw.parqHeartCondition ?? false,
      parqChestPainActivity: raw.parqChestPainActivity ?? false,
      parqDizziness: raw.parqDizziness ?? false,
      parqBoneJointIssue: raw.parqBoneJointIssue ?? false,
      parqBpOrHeartMeds: raw.parqBpOrHeartMeds ?? false,
      parqOtherReason: raw.parqOtherReason ?? false,
      injuryAreas: raw.injuryAreas ?? [],
      parqAcknowledged: raw.parqAcknowledged ?? false,
      parqAcknowledgedAt: this.parqAcknowledgedAt,
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

function maxSelected(max: number): ValidatorFn {
  return (control: AbstractControl) => {
    const value = control.value as unknown;
    return Array.isArray(value) && value.length > max ? { maxSelected: true } : null;
  };
}

function validInjuryAreas(): ValidatorFn {
  return (control: AbstractControl) => {
    const value = control.value as unknown;
    if (!Array.isArray(value)) {
      return null;
    }
    return value.every((entry) => typeof entry === 'string' && /^[A-Z_]{2,40}$/.test(entry))
      ? null
      : { invalidInjuryArea: true };
  };
}
