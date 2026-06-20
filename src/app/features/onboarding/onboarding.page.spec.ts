import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { OnboardingSeed } from '../../core/fitsync.models';
import { OnboardingPage } from './onboarding.page';

describe('OnboardingPage', () => {
  let fixture: ComponentFixture<OnboardingPage>;
  let component: OnboardingPage;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingPage],
      providers: [provideHttpClient(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingPage);
    component = fixture.componentInstance;
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
});
