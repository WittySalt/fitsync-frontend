import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

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
});
