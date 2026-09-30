import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { OnboardingSeed } from '../../core/fitsync.models';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { OnboardingPage } from './onboarding.page';

function emptySeed(): OnboardingSeed {
  return {
    value: {},
    hasExistingBodyBaseline: false,
    hasExistingTrainingBaseline: false,
    hasExistingNutritionBaseline: false
  };
}

function fillValidOnboarding(component: OnboardingPage): void {
  component.selectPrimaryGoal('LOSE_FAT');
  component.form.patchValue({
    displayName: 'Alice Tan',
    gender: 'FEMALE',
    birthDate: '1992-03-14',
    preferredUnits: 'METRIC',
    heightCm: 168,
    currentWeightKg: 72,
    targetWeightKg: 65,
    weeklyPaceKg: 0.5,
    activityLevel: 'MODERATELY_ACTIVE',
    weeklyWorkoutDays: 4,
    fitnessLevel: 'INTERMEDIATE',
    trainingLocation: 'GYM',
    preferredDurationMinutes: 45,
    preferredWorkoutTime: '07:30',
    intensityPreference: 'MODERATE',
    equipmentInventory: ['DUMBBELLS'],
    focusAreas: ['FULL_BODY'],
    injuryAreas: [],
    dietaryPattern: 'NONE',
    calorieTrackingMode: 'STRICT',
    targetCalories: 2100,
    targetProteinGrams: 140,
    targetCarbsGrams: 210,
    targetFatGrams: 70,
    workoutReminderEnabled: true,
    mealReminderEnabled: false
  });
}

describe('OnboardingPage', () => {
  let fixture: ComponentFixture<OnboardingPage>;
  let component: OnboardingPage;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let router: Router;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getOnboardingSeed', 'saveOnboarding']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    dataService.getOnboardingSeed.and.returnValue(of(emptySeed()));
    dataService.saveOnboarding.and.returnValue(of({ ok: true }));

    await TestBed.configureTestingModule({
      imports: [OnboardingPage],
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('renders the goal-driven setup flow', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Build your FitSync plan');
    expect(element.textContent).toContain('Lose fat');
    expect(element.querySelector('form')).not.toBeNull();
  });

  it('requires a primary goal before submit', () => {
    component.submit();

    expect(component.form.invalid).toBeTrue();
    expect(component.error()).toContain('Please fix');
  });

  it('hides target and pace inputs for maintain goals', () => {
    component.selectPrimaryGoal('MAINTAIN');
    component.currentStep.set(2);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(component.showsTargetAndPace()).toBeFalse();
    expect(element.textContent).toContain('Activity-based plan');
    expect(element.textContent).not.toContain('Target weight');
  });

  it('switches profile inputs to imperial units', () => {
    component.currentStep.set(1);
    component.form.controls.heightCm.setValue(178);
    component.changeUnits('IMPERIAL');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Height (ft)');
    expect(element.textContent).toContain('Height (in)');
    expect(component.form.controls.heightFt.value).toBe(5);
    expect(component.form.controls.heightIn.value).toBe(10);
  });

  it('requires gender and birth date on the profile step', () => {
    component.selectPrimaryGoal('LOSE_FAT');
    component.currentStep.set(1);
    component.form.patchValue({
      displayName: 'Alice Tan',
      heightCm: 168
    });

    component.nextStep();

    expect(component.currentStep()).toBe(1);
    expect(component.error()).toContain('Please complete');
    expect(component.form.controls.gender.invalid).toBeTrue();
    expect(component.form.controls.birthDate.invalid).toBeTrue();
  });

  it('requires training choices before advancing from the training step', () => {
    component.currentStep.set(3);
    component.form.controls.preferredDurationMinutes.setValue(2);

    component.nextStep();

    expect(component.currentStep()).toBe(3);
    expect(component.error()).toContain('Please complete');
    expect(component.form.controls.preferredDurationMinutes.invalid).toBeTrue();
  });

  it('enforces equipment and focus multi-select limits', () => {
    component.form.controls.equipmentInventory.setValue([
      'DUMBBELLS',
      'BARBELL',
      'BANDS',
      'PULL_UP_BAR',
      'KETTLEBELL',
      'MACHINES',
      'FULL_GYM',
      'EXTRA_ONE',
      'EXTRA_TWO'
    ]);
    component.form.controls.focusAreas.setValue([
      'FULL_BODY',
      'UPPER',
      'CORE',
      'LOWER',
      'MOBILITY',
      'CARDIO',
      'EXTRA'
    ]);

    expect(component.form.controls.equipmentInventory.invalid).toBeTrue();
    expect(component.form.controls.focusAreas.invalid).toBeTrue();

    component.form.controls.equipmentInventory.setValue(['NONE']);
    component.toggleMultiSelect('equipmentInventory', 'DUMBBELLS');

    expect(component.form.controls.equipmentInventory.value).toEqual(['DUMBBELLS']);
  });

  it('requires PAR-Q disclaimer acknowledgement when a readiness risk is selected', () => {
    component.currentStep.set(4);
    component.form.controls.parqHeartCondition.setValue(true);

    component.nextStep();

    expect(component.currentStep()).toBe(4);
    expect(component.hasParqRisk()).toBeTrue();

    component.setParqAcknowledged(true);
    component.nextStep();

    expect(component.currentStep()).toBe(5);
    const value = (component as unknown as { toOnboardingValue(): { parqAcknowledgedAt: string | null } }).toOnboardingValue();
    expect(value.parqAcknowledgedAt).toBeTruthy();
  });

  it('prefills guided training controls from onboarding seed values', () => {
    const seed: OnboardingSeed = {
      value: {
        fitnessLevel: 'ADVANCED',
        trainingLocation: 'OUTDOOR',
        preferredDurationMinutes: 35,
        preferredWorkoutTime: '06:45',
        intensityPreference: 'LOW',
        equipmentInventory: ['NONE'],
        focusAreas: ['CARDIO', 'MOBILITY']
      },
      hasExistingBodyBaseline: false,
      hasExistingTrainingBaseline: true,
      hasExistingNutritionBaseline: false
    };

    (component as unknown as { applyOnboardingSeed(seed: OnboardingSeed): void }).applyOnboardingSeed(seed);

    expect(component.form.controls.fitnessLevel.value).toBe('ADVANCED');
    expect(component.form.controls.trainingLocation.value).toBe('OUTDOOR');
    expect(component.form.controls.preferredDurationMinutes.value).toBe(35);
    expect(component.form.controls.preferredWorkoutTime.value).toBe('06:45');
    expect(component.form.controls.equipmentInventory.value).toEqual(['NONE']);
    expect(component.form.controls.focusAreas.value).toEqual(['CARDIO', 'MOBILITY']);
    expect(component.hasExistingTrainingBaseline()).toBeTrue();
  });

  it('loads seed baselines and ignores prefill when the form is dirty', () => {
    component.form.controls.displayName.setValue('Manual name');
    component.form.markAsDirty();

    (component as unknown as { applyOnboardingSeed(seed: OnboardingSeed): void }).applyOnboardingSeed({
      value: {
        displayName: 'Seed name',
        heightCm: 180
      },
      hasExistingBodyBaseline: true,
      hasExistingTrainingBaseline: false,
      hasExistingNutritionBaseline: true
    });

    expect(component.form.controls.displayName.value).toBe('Manual name');
    expect(component.form.controls.heightCm.value).toBeNull();
    expect(component.hasExistingBodyBaseline()).toBeTrue();
    expect(component.hasExistingNutritionBaseline()).toBeTrue();
  });

  it('handles seed failures without blocking the flow', () => {
    dataService.getOnboardingSeed.calls.reset();
    dataService.getOnboardingSeed.and.returnValue(throwError(() => new Error('seed failed')));

    component.ngOnInit();

    expect(dataService.getOnboardingSeed).toHaveBeenCalled();
    expect(component.error()).toBeNull();
  });

  it('applies seeded imperial values and refreshes recommended plan targets', () => {
    (component as unknown as { applyOnboardingSeed(seed: OnboardingSeed): void }).applyOnboardingSeed({
      value: {
        preferredUnits: 'IMPERIAL',
        heightCm: 183,
        currentWeightKg: 90,
        targetWeightKg: 82,
        targetCalories: 2400,
        targetProteinGrams: 180
      },
      hasExistingBodyBaseline: true,
      hasExistingTrainingBaseline: false,
      hasExistingNutritionBaseline: true
    });

    expect(component.preferredUnits()).toBe('IMPERIAL');
    expect(component.form.controls.heightFt.value).toBe(6);
    expect(component.form.controls.heightIn.value).toBe(0);
    expect(component.form.controls.currentWeightLb.value).toBe(198.4);
    expect(component.form.controls.targetWeightLb.value).toBe(180.8);
    expect(component.form.controls.targetCalories.value).toBeGreaterThan(2400);
    expect(component.form.pristine).toBeTrue();
  });

  it('applies goal defaults and goal copy for each primary goal', () => {
    component.selectPrimaryGoal('LOSE_FAT');
    expect(component.form.controls.weeklyPaceKg.value).toBe(0.5);
    expect(component.form.controls.calorieTrackingMode.value).toBe('STRICT');
    expect(component.goalCopy()).toContain('sustainable deficit');

    component.selectPrimaryGoal('BUILD_MUSCLE');
    expect(component.form.controls.weeklyPaceKg.value).toBe(0.25);
    expect(component.goalCopy()).toContain('measured surplus');

    component.selectPrimaryGoal('MAINTAIN');
    expect(component.form.controls.weeklyWorkoutDays.value).toBe(3);
    expect(component.form.controls.weeklyPaceKg.value).toBeNull();
    expect(component.goalCopy()).toContain('maintenance');

    component.selectPrimaryGoal('IMPROVE_FITNESS');
    expect(component.form.controls.weeklyWorkoutDays.value).toBe(5);
    expect(component.showsTargetAndPace()).toBeFalse();
    expect(component.goalCopy()).toContain('activity consistency');

    component.form.controls.primaryGoal.setValue(null);
    expect(component.goalCopy()).toContain('Pick the outcome');
  });

  it('covers training and health goal copy branches', () => {
    component.currentStep.set(3);

    component.selectChoice('trainingLocation', 'HOME');
    expect(component.goalCopy()).toContain('your space');
    expect(component.isChoiceSelected('trainingLocation', 'HOME')).toBeTrue();

    component.selectChoice('trainingLocation', 'GYM');
    expect(component.goalCopy()).toContain('gym access');

    component.selectChoice('trainingLocation', 'OUTDOOR');
    expect(component.goalCopy()).toContain('outdoor-friendly');

    component.selectChoice('trainingLocation', 'MIXED');
    expect(component.goalCopy()).toContain('flexible');

    component.currentStep.set(4);
    expect(component.goalCopy()).toContain('not medical advice');
  });

  it('advances and retreats within step bounds after valid input', () => {
    component.nextStep();
    expect(component.currentStep()).toBe(0);
    expect(component.error()).toContain('Please complete');
    expect(component.isInvalid('primaryGoal')).toBeTrue();

    component.selectPrimaryGoal('LOSE_FAT');
    component.nextStep();
    expect(component.currentStep()).toBe(1);

    component.previousStep();
    component.previousStep();
    expect(component.currentStep()).toBe(0);
    expect(component.error()).toBeNull();
  });

  it('handles multi-select removal, NONE replacement, and selected checks', () => {
    component.toggleMultiSelect('equipmentInventory', 'DUMBBELLS');
    expect(component.isMultiSelected('equipmentInventory', 'DUMBBELLS')).toBeTrue();

    component.toggleMultiSelect('equipmentInventory', 'DUMBBELLS');
    expect(component.form.controls.equipmentInventory.value).toEqual([]);

    component.toggleMultiSelect('equipmentInventory', 'NONE');
    expect(component.form.controls.equipmentInventory.value).toEqual(['NONE']);

    component.toggleMultiSelect('equipmentInventory', 'BARBELL');
    expect(component.form.controls.equipmentInventory.value).toEqual(['BARBELL']);

    component.toggleMultiSelect('focusAreas', 'CORE');
    expect(component.isMultiSelected('focusAreas', 'CORE')).toBeTrue();
    component.toggleMultiSelect('injuryAreas', 'KNEE');
    expect(component.hasParqRisk()).toBeTrue();
  });

  it('requires valid injury areas and clears PAR-Q acknowledgement timestamps', () => {
    component.currentStep.set(4);
    component.form.controls.injuryAreas.setValue(['bad-value']);

    component.nextStep();

    expect(component.currentStep()).toBe(4);
    expect(component.form.controls.injuryAreas.invalid).toBeTrue();

    component.form.controls.injuryAreas.setValue(['KNEE']);
    component.setParqAcknowledged(true);
    component.setParqAcknowledged(false);

    expect(component.form.controls.parqAcknowledged.value).toBeFalse();
    const value = (component as unknown as { toOnboardingValue(): { parqAcknowledgedAt: string | null } }).toOnboardingValue();
    expect(value.parqAcknowledgedAt).toBeNull();
  });

  it('summarizes plan chips with optional equipment, focus, and health notes', () => {
    component.form.patchValue({
      trainingLocation: 'GYM',
      fitnessLevel: 'ADVANCED',
      intensityPreference: 'HIGH',
      weeklyWorkoutDays: 5,
      preferredDurationMinutes: 60,
      equipmentInventory: ['DUMBBELLS', 'BARBELL'],
      focusAreas: ['UPPER', 'LOWER'],
      parqOtherReason: true
    });

    expect(component.planChips()).toEqual([
      'Gym',
      'Advanced',
      '5 days/week',
      '60 min',
      'High',
      '2 equipment',
      '2 focus areas',
      'Health notes'
    ]);

    component.form.patchValue({
      equipmentInventory: [],
      focusAreas: ['CORE'],
      parqOtherReason: false
    });

    expect(component.planChips()).toContain('1 focus area');
    expect(component.planChips()).not.toContain('Health notes');
  });

  it('submits a valid onboarding payload and navigates to the dashboard', () => {
    const navigateByUrl = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fillValidOnboarding(component);

    component.submit();

    expect(dataService.saveOnboarding).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Your plan is ready. Welcome to FitSync!');
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('reports save errors and leaves the form ready for retry', () => {
    dataService.saveOnboarding.and.returnValue(throwError(() => new Error('Save failed')));
    fillValidOnboarding(component);

    component.submit();

    expect(component.error()).toBe('Save failed');
    expect(toast.error).toHaveBeenCalledWith('Save failed');
    expect(component.submitting()).toBeFalse();
  });

  describe('weekly workout days', () => {
    function decideLaterCheckbox(target: ComponentFixture<OnboardingPage> = fixture): HTMLInputElement {
      const checkbox = Array.from((target.nativeElement as HTMLElement).querySelectorAll<HTMLLabelElement>('.weekly-days .toggle-row'))
        .find((row) => row.textContent?.trim() === 'Decide later')
        ?.querySelector('input');
      if (!checkbox) {
        throw new Error('The Decide later control is missing.');
      }
      return checkbox;
    }

    it('offers Decide later beside the number on the training step', () => {
      component.currentStep.set(3);
      fixture.detectChanges();

      const checkbox = decideLaterCheckbox();
      expect(checkbox.type).toBe('checkbox');
      expect(checkbox.checked).toBeFalse();
      expect(component.form.controls.weeklyWorkoutDays.value).toBe(4);
    });

    it('makes the value null and the step valid when Decide later is chosen', () => {
      component.currentStep.set(3);
      fixture.detectChanges();

      decideLaterCheckbox().click();
      fixture.detectChanges();

      expect(component.form.controls.weeklyWorkoutDays.value).toBeNull();
      expect(component.form.controls.weeklyWorkoutDays.valid).toBeTrue();
      expect(component.weeklyDaysUndecided()).toBeTrue();
      expect(decideLaterCheckbox().checked).toBeTrue();

      component.nextStep();
      expect(component.currentStep()).toBe(4);
    });

    it('goes back to a number when Decide later is cleared, and when a number is typed', () => {
      component.currentStep.set(3);
      component.setWeeklyDaysLater(true);
      fixture.detectChanges();

      decideLaterCheckbox().click();
      fixture.detectChanges();
      expect(component.form.controls.weeklyWorkoutDays.value).toBe(4);

      component.setWeeklyDaysLater(true);
      component.form.controls.weeklyWorkoutDays.setValue(6);
      fixture.detectChanges();
      expect(component.weeklyDaysUndecided()).toBeFalse();
      expect(decideLaterCheckbox().checked).toBeFalse();
    });

    it('still asks for one to seven days when a number is given', () => {
      const control = component.form.controls.weeklyWorkoutDays;

      [1, 7].forEach((days) => {
        control.setValue(days);
        expect(control.valid).toBeTrue();
      });
      [0, 8, 2.5].forEach((days) => {
        control.setValue(days);
        expect(control.invalid).toBeTrue();
      });
    });

    it('sends null when the user decides later', () => {
      spyOn(router, 'navigateByUrl').and.resolveTo(true);
      fillValidOnboarding(component);
      component.setWeeklyDaysLater(true);

      component.submit();

      expect(dataService.saveOnboarding).toHaveBeenCalledWith(jasmine.objectContaining({ weeklyWorkoutDays: null }));
    });

    it('still sends the number when one is chosen', () => {
      spyOn(router, 'navigateByUrl').and.resolveTo(true);
      fillValidOnboarding(component);
      component.form.controls.weeklyWorkoutDays.setValue(5);

      component.submit();

      expect(dataService.saveOnboarding).toHaveBeenCalledWith(jasmine.objectContaining({ weeklyWorkoutDays: 5 }));
    });

    it('shows Decide later for a returning user whose stored value is null', () => {
      dataService.getOnboardingSeed.and.returnValue(
        of({ ...emptySeed(), value: { weeklyWorkoutDays: null }, hasExistingTrainingBaseline: true })
      );
      const returning = TestBed.createComponent(OnboardingPage);
      returning.componentInstance.currentStep.set(3);
      returning.detectChanges();

      expect(returning.componentInstance.form.controls.weeklyWorkoutDays.value).toBeNull();
      expect(decideLaterCheckbox(returning).checked).toBeTrue();
      expect(returning.componentInstance.planChips()).toContain('Days to be decided');
    });
  });
});
