import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            signIn: () => of(void 0),
            signUp: () => of(void 0),
            confirmSignUp: () => of(void 0),
            resendConfirmationCode: () => of(void 0)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  });

  it('renders the redesigned sign-in page and brand panel', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Sign in to FitSync');
    expect(element.textContent).toContain('Strong habits make strong weeks.');
    expect(element.textContent).toContain('Did you know?');
    expect(element.textContent).not.toContain('7-day streak');
    expect(element.querySelector('form')).not.toBeNull();
  });

  it('keeps the selected fact from the configured fact list', () => {
    const component = fixture.componentInstance;

    expect(component.healthFacts).toContain(component.currentFact());
  });

  it('switches to the create account mode without losing the auth shell', () => {
    const component = fixture.componentInstance;

    component.showMode('signup');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Create your FitSync account');
    expect(element.textContent).toContain('Training / Meals / Progress');
  });

  it('shows validation errors for an invalid sign-in form', () => {
    const component = fixture.componentInstance;

    component.signIn();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(component.signInForm.invalid).toBeTrue();
    expect(element.textContent).toContain('Please enter a valid email and password.');
  });

  it('toggles password visibility', () => {
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    const passwordInput = element.querySelector<HTMLInputElement>('#password');

    expect(passwordInput?.type).toBe('password');
    component.togglePasswordVisibility();
    fixture.detectChanges();

    expect(passwordInput?.type).toBe('text');
  });

  it('shows a notice for unavailable social sign-in', () => {
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    const googleButton = Array.from(element.querySelectorAll<HTMLButtonElement>('.social-grid button'))
      .find((button) => button.textContent?.includes('Google'));

    googleButton?.click();
    fixture.detectChanges();

    expect(component.notice()).toContain('Google sign-in is not connected yet.');
    expect(element.textContent).toContain('Google sign-in is not connected yet.');
  });
});
