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

  it('renders the setup form', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Personalize FitSync');
    expect(element.querySelector('form')).not.toBeNull();
  });

  it('requires a display name before submit', () => {
    component.form.controls.displayName.setValue('');
    component.submit();

    expect(component.form.invalid).toBeTrue();
    expect(component.error()).toContain('Please fix');
  });
});
