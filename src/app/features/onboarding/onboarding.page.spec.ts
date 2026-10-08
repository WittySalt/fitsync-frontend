import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { OnboardingSeed } from '../../core/fitsync.models';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { OnboardingPage } from './onboarding.page';
import { entryTarget } from '../workout/plan-flow/plan-entry';

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
    targetFatGrams: 70
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
    component.currentStep.set(1);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(component.showsTargetAndPace()).toBeFalse();
    expect(element.textContent).not.toContain('Target weight');
    expect(element.textContent).not.toContain('Weekly pace');
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
    component.currentStep.set(2);
    component.form.controls.preferredDurationMinutes.setValue(2);

    component.nextStep();

    expect(component.currentStep()).toBe(2);
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
    component.currentStep.set(3);
    component.form.controls.parqHeartCondition.setValue(true);

    component.nextStep();

    expect(component.currentStep()).toBe(3);
    expect(component.hasParqRisk()).toBeTrue();

    component.setParqAcknowledged(true);
    component.nextStep();

    expect(component.currentStep()).toBe(4);
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

  it('applies goal defaults for each primary goal and says what the goal changes', () => {
    component.selectPrimaryGoal('LOSE_FAT');
    expect(component.form.controls.weeklyPaceKg.value).toBe(0.5);
    expect(component.form.controls.calorieTrackingMode.value).toBe('STRICT');
    expect(component.explainLines()[0]).toContain('Lose fat sets a weekly pace');

    component.selectPrimaryGoal('BUILD_MUSCLE');
    expect(component.form.controls.weeklyPaceKg.value).toBe(0.25);
    expect(component.explainLines()[0]).toContain('gentle surplus');

    component.selectPrimaryGoal('MAINTAIN');
    expect(component.form.controls.weeklyWorkoutDays.value).toBe(3);
    expect(component.form.controls.weeklyPaceKg.value).toBeNull();
    expect(component.explainLines()[0]).toContain('close to what you burn');

    component.selectPrimaryGoal('IMPROVE_FITNESS');
    expect(component.form.controls.weeklyWorkoutDays.value).toBe(5);
    expect(component.showsTargetAndPace()).toBeFalse();
    expect(component.explainLines()[0]).toContain('training rhythm');

    component.form.controls.primaryGoal.setValue(null);
    expect(component.explainLines()[0]).toContain('first defaults');
  });

  it('groups the setup into five named steps with one subtitle each', () => {
    expect(component.steps.map((step) => step.label)).toEqual(['Goal', 'You', 'Training', 'Health', 'Your plan']);
    expect(component.subtitle()).toBe('Pick the outcome that matters most right now. You can change it later.');
    component.currentStep.set(1);
    expect(component.subtitle()).toBe('The basics the targets are worked out from.');
    component.currentStep.set(2);
    expect(component.subtitle()).toBe('What the coach plans your week from.');
  });

  it('shows the step line and the What this changes card instead of the chip strip', () => {
    component.selectPrimaryGoal('LOSE_FAT');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(Array.from(element.querySelectorAll('app-onboarding-step-line li')).map((li) => li.textContent?.trim())).toEqual([
      'Goal',
      'You',
      'Training',
      'Health',
      'Your plan'
    ]);
    expect(element.querySelector('app-onboarding-step-line li.current')?.textContent?.trim()).toBe('Goal');
    expect(element.querySelector('app-onboarding-explain-card')?.textContent).toContain('What this changes');
    expect(element.querySelector('.plan-strip')).toBeNull();
  });

  it('keeps the sentences of the card current while choices change', () => {
    component.currentStep.set(2);
    component.form.controls.weeklyWorkoutDays.setValue(3);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('app-onboarding-explain-card') as HTMLElement;
    expect(card.textContent).toContain('Three sessions a week becomes your target');

    component.form.controls.weeklyWorkoutDays.setValue(5);
    fixture.detectChanges();
    expect(card.textContent).toContain('Five sessions a week becomes your target');
  });

  it('writes experience and intensity together from the How hard row', () => {
    const [easeIn, steady, push] = component.howHardChoices;

    component.selectHowHard(easeIn);
    expect(component.form.controls.fitnessLevel.value).toBe('BEGINNER');
    expect(component.form.controls.intensityPreference.value).toBe('LOW');
    expect(component.isHowHardSelected(easeIn)).toBeTrue();

    component.selectHowHard(steady);
    expect(component.form.controls.fitnessLevel.value).toBe('INTERMEDIATE');
    expect(component.form.controls.intensityPreference.value).toBe('MODERATE');

    component.selectHowHard(push);
    expect(component.form.controls.fitnessLevel.value).toBe('ADVANCED');
    expect(component.form.controls.intensityPreference.value).toBe('HIGH');
    expect(component.isHowHardSelected(push)).toBeTrue();
    expect(component.isHowHardSelected(steady)).toBeFalse();
  });

  it('renders the three How hard choices on the training step and no separate level rows', () => {
    component.currentStep.set(2);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const labels = Array.from(element.querySelectorAll('[aria-label="How hard"] .choice-pill strong')).map((node) => node.textContent?.trim());
    expect(labels).toEqual(['Ease in', 'Steady', 'Push']);
    expect(element.textContent).not.toContain('How experienced are you?');
    expect(element.textContent).not.toContain('How hard should we start?');
  });

  it('has no reminder toggles and sends both reminders off', () => {
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    component.currentStep.set(4);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('reminder');
    expect(Object.keys(component.form.controls)).not.toContain('workoutReminderEnabled');
    expect(Object.keys(component.form.controls)).not.toContain('mealReminderEnabled');

    fillValidOnboarding(component);
    component.submit();

    expect(dataService.saveOnboarding).toHaveBeenCalledWith(
      jasmine.objectContaining({ workoutReminderEnabled: false, mealReminderEnabled: false })
    );
  });

  it('sends the same request fields as before, with the How hard mapping on experience and intensity', () => {
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fillValidOnboarding(component);
    component.selectHowHard(component.howHardChoices[2]);

    component.submit();

    expect(dataService.saveOnboarding).toHaveBeenCalledWith(
      jasmine.objectContaining({
        primaryGoal: 'LOSE_FAT',
        fitnessLevel: 'ADVANCED',
        intensityPreference: 'HIGH',
        trainingLocation: 'GYM',
        activityLevel: 'MODERATELY_ACTIVE',
        dietaryPattern: 'NONE',
        calorieTrackingMode: 'STRICT'
      })
    );
  });

  it('offers the Athlete activity level with the code settings uses, and sends it', () => {
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    component.selectPrimaryGoal('LOSE_FAT');
    component.currentStep.set(1);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const options = Array.from(
      element.querySelectorAll<HTMLOptionElement>('select[formControlName="activityLevel"] option')
    ).map((option) => [option.value, option.textContent?.trim()]);
    expect(options).toContain(['ATHLETE', 'Athlete']);
    expect(options.map(([value]) => value)).not.toContain('EXTRA_ACTIVE');

    fillValidOnboarding(component);
    component.form.controls.activityLevel.setValue('ATHLETE');
    component.submit();

    expect(dataService.saveOnboarding).toHaveBeenCalledWith(jasmine.objectContaining({ activityLevel: 'ATHLETE' }));
  });

  it('asks for the You fields, weight included, before leaving step two', () => {
    component.selectPrimaryGoal('LOSE_FAT');
    component.currentStep.set(1);
    component.form.patchValue({ displayName: 'Alice Tan', gender: 'FEMALE', birthDate: '1992-03-14', heightCm: 168 });

    component.nextStep();
    expect(component.currentStep()).toBe(1);
    expect(component.form.controls.currentWeightKg.invalid).toBeTrue();

    component.form.patchValue({ currentWeightKg: 72, targetWeightKg: 65 });
    component.nextStep();
    expect(component.currentStep()).toBe(2);
  });

  it('asks for the targets and the pattern before the plan can be saved', () => {
    component.currentStep.set(4);
    component.form.patchValue({ targetCalories: null });

    component.submit();
    expect(dataService.saveOnboarding).not.toHaveBeenCalled();

    component.form.patchValue({ targetCalories: 2000 });
    expect(component.form.controls.targetCalories.valid).toBeTrue();
  });

  it('writes the plan summary in words on the last step', () => {
    fillValidOnboarding(component);
    component.currentStep.set(4);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Gym, four days a week, 45 minutes, steady effort. Lose fat to 65 kg by');
    expect(text).toContain('Use recommendation');
    expect(text).toContain('Save and continue');
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
    component.currentStep.set(3);
    component.form.controls.injuryAreas.setValue(['bad-value']);

    component.nextStep();

    expect(component.currentStep()).toBe(3);
    expect(component.form.controls.injuryAreas.invalid).toBeTrue();

    component.form.controls.injuryAreas.setValue(['KNEE']);
    component.setParqAcknowledged(true);
    component.setParqAcknowledged(false);

    expect(component.form.controls.parqAcknowledged.value).toBeFalse();
    const value = (component as unknown as { toOnboardingValue(): { parqAcknowledgedAt: string | null } }).toOnboardingValue();
    expect(value.parqAcknowledgedAt).toBeNull();
  });

  it('submits a valid onboarding payload and offers the three ways into a first plan', () => {
    const navigateByUrl = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fillValidOnboarding(component);

    component.submit();

    expect(dataService.saveOnboarding).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Your plan is ready.');
    expect(component.entryOpen()).toBeTrue();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('hands a new account to the plan flow, a template in it, or Plan Studio, from the same sheet', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    component.entryOpen.set(true);

    component.handleEntryChosen(entryTarget('own'));
    expect(component.entryOpen()).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/workout/plans/new'], { queryParams: undefined });

    component.handleEntryChosen(entryTarget('template', 'full-body-beginner'));
    expect(navigate).toHaveBeenCalledWith(['/workout/plans/new'], { queryParams: { template: 'full-body-beginner' } });

    component.handleEntryChosen(entryTarget('coach'));
    expect(navigate).toHaveBeenCalledWith(['/coach/plan'], { queryParams: { coach: 'open' } });
  });

  it('still lands on the dashboard when the person skips the first plan', () => {
    const navigateByUrl = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    component.entryOpen.set(true);

    component.skipEntry();

    expect(component.entryOpen()).toBeFalse();
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
      component.currentStep.set(2);
      fixture.detectChanges();

      const checkbox = decideLaterCheckbox();
      expect(checkbox.type).toBe('checkbox');
      expect(checkbox.checked).toBeFalse();
      expect(component.form.controls.weeklyWorkoutDays.value).toBe(4);
    });

    it('makes the value null and the step valid when Decide later is chosen', () => {
      component.currentStep.set(2);
      fixture.detectChanges();

      decideLaterCheckbox().click();
      fixture.detectChanges();

      expect(component.form.controls.weeklyWorkoutDays.value).toBeNull();
      expect(component.form.controls.weeklyWorkoutDays.valid).toBeTrue();
      expect(component.weeklyDaysUndecided()).toBeTrue();
      expect(decideLaterCheckbox().checked).toBeTrue();

      component.nextStep();
      expect(component.currentStep()).toBe(3);
    });

    it('goes back to a number when Decide later is cleared, and when a number is typed', () => {
      component.currentStep.set(2);
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
      returning.componentInstance.currentStep.set(2);
      returning.detectChanges();

      expect(returning.componentInstance.form.controls.weeklyWorkoutDays.value).toBeNull();
      expect(decideLaterCheckbox(returning).checked).toBeTrue();
      expect(returning.componentInstance.summary()).toContain('days a week to be decided');
    });
  });
});
