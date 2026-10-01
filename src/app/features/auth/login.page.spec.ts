import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';

import { AuthService, PendingDeletion } from '../../core/auth/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let authService: jasmine.SpyObj<AuthService>;
  let pendingDeletion: WritableSignal<PendingDeletion | null>;
  let canCancel: WritableSignal<boolean>;
  let router: Router;

  beforeEach(async () => {
    pendingDeletion = signal<PendingDeletion | null>(null);
    canCancel = signal(false);
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      [
        'signIn',
        'signUp',
        'confirmSignUp',
        'resendConfirmationCode',
        'forgotPassword',
        'confirmForgotPassword',
        'beginSocialSignIn',
        'cancelAccountDeletion',
        'dismissPendingDeletion'
      ],
      { socialSignInEnabled: false, pendingDeletion, canCancelAccountDeletion: canCancel }
    );
    authService.cancelAccountDeletion.and.returnValue(of(void 0));
    authService.dismissPendingDeletion.and.callFake(() => {
      pendingDeletion.set(null);
      canCancel.set(false);
    });
    authService.signIn.and.returnValue(of(void 0));
    authService.signUp.and.returnValue(of(void 0));
    authService.confirmSignUp.and.returnValue(of(void 0));
    authService.resendConfirmationCode.and.returnValue(of(void 0));
    authService.forgotPassword.and.returnValue(of(void 0));
    authService.confirmForgotPassword.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
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

  it('uses Web Crypto to choose the selected fact', () => {
    const component = fixture.componentInstance;
    spyOn(crypto, 'getRandomValues').and.callFake((array) => {
      (array as Uint32Array)[0] = 2;
      return array;
    });

    (component as unknown as { pickFact: () => void }).pickFact();

    expect(crypto.getRandomValues).toHaveBeenCalled();
    expect(component.currentFact()).toBe(component.healthFacts[2]);
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

  it('presents social sign-in as disabled coming-soon options, not silent dead-ends', () => {
    const element = fixture.nativeElement as HTMLElement;
    const socialButtons = Array.from(element.querySelectorAll<HTMLButtonElement>('.social-grid button'));

    expect(socialButtons.length).toBe(2);
    expect(socialButtons.every((button) => button.disabled)).toBeTrue();
    expect(element.textContent).toContain('Social sign-in is coming soon.');
  });

  it('signs in with valid credentials and navigates to the dashboard', () => {
    const component = fixture.componentInstance;

    component.signInForm.setValue({ email: 'user@example.com', password: 'secret' });
    component.signIn();

    expect(authService.signIn).toHaveBeenCalledWith('user@example.com', 'secret');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(component.loading()).toBeNull();
    expect(component.error()).toBeNull();
  });

  it('surfaces sign-in service errors and clears loading', () => {
    const component = fixture.componentInstance;

    authService.signIn.and.returnValue(throwError(() => new Error('Invalid email or password.')));
    component.signInForm.setValue({ email: 'user@example.com', password: 'secret' });
    component.signIn();

    expect(component.error()).toBe('Invalid email or password.');
    expect(component.loading()).toBeNull();
  });

  it('validates and completes the sign-up flow into confirmation mode', () => {
    const component = fixture.componentInstance;

    component.signUp();

    expect(component.signUpForm.invalid).toBeTrue();
    expect(component.error()).toBe('Please complete the account details.');
    expect(authService.signUp).not.toHaveBeenCalled();

    component.signUpForm.setValue({
      displayName: 'New User',
      email: 'new@example.com',
      password: 'secret'
    });
    component.signUp();

    expect(authService.signUp).toHaveBeenCalledWith('new@example.com', 'secret', 'New User');
    expect(component.mode()).toBe('confirm');
    expect(component.confirmForm.controls.email.value).toBe('new@example.com');
    expect(component.notice()).toBe('We sent a confirmation code to your email.');

    authService.signUp.and.returnValue(throwError(() => new Error('Sign-up failed.')));
    component.signUp();

    expect(component.error()).toBe('Sign-up failed.');
    expect(component.loading()).toBeNull();
  });

  it('validates confirmation, confirms the account, and returns to sign-in', () => {
    const component = fixture.componentInstance;

    component.confirmSignUp();

    expect(component.confirmForm.invalid).toBeTrue();
    expect(component.error()).toBe('Please enter your email and confirmation code.');
    expect(authService.confirmSignUp).not.toHaveBeenCalled();

    component.confirmForm.setValue({ email: 'new@example.com', confirmationCode: '123456' });
    component.confirmSignUp();

    expect(authService.confirmSignUp).toHaveBeenCalledWith('new@example.com', '123456');
    expect(component.mode()).toBe('signin');
    expect(component.signInForm.controls.email.value).toBe('new@example.com');
    expect(component.notice()).toBe('Account confirmed. Sign in with your new password.');

    authService.confirmSignUp.and.returnValue(throwError(() => new Error('Confirmation failed.')));
    component.confirmSignUp();

    expect(component.error()).toBe('Confirmation failed.');
    expect(component.loading()).toBeNull();
  });

  it('validates and resends confirmation codes', () => {
    const component = fixture.componentInstance;

    component.resendCode();

    expect(component.error()).toBe('Please enter the email address for your account.');
    expect(authService.resendConfirmationCode).not.toHaveBeenCalled();

    component.confirmForm.controls.email.setValue('new@example.com');
    component.resendCode();

    expect(authService.resendConfirmationCode).toHaveBeenCalledWith('new@example.com');
    expect(component.notice()).toBe('A new confirmation code has been sent.');
    expect(component.loading()).toBeNull();

    authService.resendConfirmationCode.and.returnValue(throwError(() => new Error('Resend failed.')));
    component.resendCode();

    expect(component.error()).toBe('Resend failed.');
    expect(component.loading()).toBeNull();
  });

  it('copies emails between modes, resets messages, and controls quote selection', () => {
    const component = fixture.componentInstance;

    component.signInForm.controls.email.setValue('signin@example.com');
    component.error.set('old error');
    component.notice.set('old notice');
    component.showMode('signup');

    expect(component.signUpForm.controls.email.value).toBe('signin@example.com');
    expect(component.error()).toBeNull();
    expect(component.notice()).toBeNull();

    component.signUpForm.controls.email.setValue('signup@example.com');
    component.showMode('confirm');

    expect(component.confirmForm.controls.email.value).toBe('signup@example.com');

    component.selectQuote(2);
    component.pauseQuoteRotation();
    component.resumeQuoteRotation();

    expect(component.activeQuoteIndex()).toBe(2);
  });

  it('opens the password reset flow carrying the sign-in email', () => {
    const component = fixture.componentInstance;

    component.signInForm.controls.email.setValue('user@example.com');
    component.showMode('reset');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(component.mode()).toBe('reset');
    expect(component.resetForm.controls.email.value).toBe('user@example.com');
    expect(element.textContent).toContain('Reset your password');
  });

  it('validates and requests a password reset code, then advances to confirmation', () => {
    const component = fixture.componentInstance;

    component.requestPasswordReset();

    expect(component.resetForm.invalid).toBeTrue();
    expect(component.error()).toBe('Please enter the email address for your account.');
    expect(authService.forgotPassword).not.toHaveBeenCalled();

    component.resetForm.controls.email.setValue('user@example.com');
    component.requestPasswordReset();

    expect(authService.forgotPassword).toHaveBeenCalledWith('user@example.com');
    expect(component.mode()).toBe('reset-confirm');
    expect(component.resetConfirmForm.controls.email.value).toBe('user@example.com');
    expect(component.notice()).toBe('We sent a reset code to your email.');

    authService.forgotPassword.and.returnValue(throwError(() => new Error('Reset request failed.')));
    component.requestPasswordReset();

    expect(component.error()).toBe('Reset request failed.');
    expect(component.loading()).toBeNull();
  });

  describe('when the account is scheduled for deletion', () => {
    const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const button = (label: string): HTMLButtonElement | undefined =>
      Array.from(element().querySelectorAll<HTMLButtonElement>('.deletion-notice button')).find((candidate) => candidate.textContent?.trim().startsWith(label));

    function showNotice(held: boolean): void {
      pendingDeletion.set({ scheduledFor: '2026-10-31T12:00:00Z' });
      canCancel.set(held);
      fixture.detectChanges();
    }

    it('replaces the sign-in form with the notice and the date', () => {
      showNotice(true);

      const notice = element().querySelector('.deletion-notice');
      expect(notice?.getAttribute('role')).toBe('status');
      expect(notice?.querySelector('h1')?.textContent).toContain('This account is scheduled for deletion');
      expect(notice?.textContent).toContain('It will be removed on 31 Oct 2026.');
      expect(notice?.textContent).not.toContain('Sign in again within that time');
      expect(element().querySelector('form')).toBeNull();
      expect(button('Keep my account')).toBeDefined();
      expect(button('Back to sign in')).toBeDefined();
    });

    it('moves focus to the notice heading', () => {
      showNotice(true);

      expect(document.activeElement).toBe(element().querySelector('.deletion-notice h1'));
    });

    it('leaves the date sentence out when there is no date', () => {
      pendingDeletion.set({ scheduledFor: null });
      canCancel.set(true);
      fixture.detectChanges();

      expect(element().querySelector('.deletion-notice')?.textContent).not.toContain('It will be removed');
    });

    it('keeps the account and continues as a sign-in does', () => {
      showNotice(true);

      button('Keep my account')?.click();

      expect(authService.cancelAccountDeletion).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
      expect(fixture.componentInstance.loading()).toBeNull();
    });

    it('shows the busy state while the account is being restored', () => {
      authService.cancelAccountDeletion.and.returnValue(NEVER);
      showNotice(true);

      button('Keep my account')?.click();
      fixture.detectChanges();

      const keep = button('Keeping');
      expect(keep?.disabled).toBeTrue();
      expect(keep?.getAttribute('aria-busy')).toBe('true');
      expect(button('Back to sign in')?.disabled).toBeTrue();
    });

    it('shows the failure and leaves the notice in place', () => {
      authService.cancelAccountDeletion.and.returnValue(throwError(() => new Error('The account could not be restored. Try again.')));
      showNotice(true);

      button('Keep my account')?.click();
      fixture.detectChanges();

      expect(element().textContent).toContain('The account could not be restored. Try again.');
      expect(button('Keep my account')?.disabled).toBeFalse();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('offers no primary button when the notice was handed over from settings', () => {
      showNotice(false);

      expect(button('Keep my account')).toBeUndefined();
      const text = (element().querySelector('.deletion-notice')?.textContent ?? '').replace(/\s+/g, ' ');
      expect(text).toContain('It will be removed on 31 Oct 2026. Sign in again within that time to keep it.');
    });

    it('goes back to the sign-in form', () => {
      showNotice(true);

      button('Back to sign in')?.click();
      fixture.detectChanges();

      expect(authService.dismissPendingDeletion).toHaveBeenCalled();
      expect(element().querySelector('.deletion-notice')).toBeNull();
      expect(element().querySelector('form')).not.toBeNull();
      expect(element().textContent).toContain('Sign in to FitSync');
    });
  });

  it('validates and confirms a new password, then returns to sign-in', () => {
    const component = fixture.componentInstance;

    component.confirmPasswordReset();

    expect(component.resetConfirmForm.invalid).toBeTrue();
    expect(component.error()).toBe('Enter the reset code and a new password of at least 8 characters.');
    expect(authService.confirmForgotPassword).not.toHaveBeenCalled();

    component.resetConfirmForm.setValue({
      email: 'user@example.com',
      confirmationCode: '123456',
      password: 'newsecret1'
    });
    component.confirmPasswordReset();

    expect(authService.confirmForgotPassword).toHaveBeenCalledWith('user@example.com', '123456', 'newsecret1');
    expect(component.mode()).toBe('signin');
    expect(component.signInForm.controls.email.value).toBe('user@example.com');
    expect(component.notice()).toBe('Password updated. Sign in with your new password.');

    authService.confirmForgotPassword.and.returnValue(throwError(() => new Error('Reset failed.')));
    component.confirmPasswordReset();

    expect(component.error()).toBe('Reset failed.');
    expect(component.loading()).toBeNull();
  });
});
