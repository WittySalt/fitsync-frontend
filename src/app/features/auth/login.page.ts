import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

type AuthMode = 'signin' | 'signup' | 'confirm';
type AuthAction = 'signin' | 'signup' | 'confirm' | 'resend';
type BrandQuote = {
  headline: string;
  sub: string;
};

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPage implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly quoteIntervalMs = 5000;
  private quoteTimer: ReturnType<typeof setInterval> | null = null;
  private readonly prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly mode = signal<AuthMode>('signin');
  readonly loading = signal<AuthAction | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly activeQuoteIndex = signal(0);
  readonly currentFact = signal('');

  readonly brandQuotes: BrandQuote[] = [
    {
      headline: 'Strong habits make strong weeks.',
      sub: 'Bring training, meals, and progress into a rhythm you can actually follow.'
    },
    {
      headline: 'Show up, then prove it.',
      sub: 'Plans get you started - evidence keeps you going.'
    },
    {
      headline: 'Small reps, real results.',
      sub: 'Consistency compounds when every session is logged.'
    },
    {
      headline: 'Train with intent.',
      sub: 'Walk in with a plan, walk out with progress.'
    }
  ];

  readonly healthFacts: string[] = [
    'Muscle keeps growing for up to 48 hours after a workout - recovery is part of training.',
    'Drinking water before a meal can help regulate appetite and portion size.',
    'Just 10 minutes of daily movement measurably improves mood and focus.',
    'Protein spread across the day builds muscle better than one large serving.',
    'Sleep is when most muscle repair happens - under-sleeping stalls progress.',
    'Logging meals, even roughly, improves dietary awareness more than dieting alone.',
    'Consistency beats intensity: 3 steady weeks outperform 1 all-out week.',
    'Walking after eating helps blunt blood-sugar spikes.'
  ];

  readonly signInForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  readonly signUpForm = new FormGroup({
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  readonly confirmForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    confirmationCode: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  ngOnInit(): void {
    this.pickFact();
    this.startQuoteRotation();
  }

  ngOnDestroy(): void {
    this.stopQuoteRotation();
  }

  selectQuote(index: number): void {
    this.activeQuoteIndex.set(index);
  }

  pauseQuoteRotation(): void {
    this.stopQuoteRotation();
  }

  resumeQuoteRotation(): void {
    this.startQuoteRotation();
  }

  signIn(): void {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      this.error.set('Please enter a valid email and password.');
      return;
    }

    this.loading.set('signin');
    this.resetMessages();

    const { email, password } = this.signInForm.getRawValue();
    this.authService.signIn(email, password).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (error: Error) => this.fail(error),
      complete: () => this.loading.set(null)
    });
  }

  signUp(): void {
    if (this.signUpForm.invalid) {
      this.signUpForm.markAllAsTouched();
      this.error.set('Please complete the account details.');
      return;
    }

    this.loading.set('signup');
    this.resetMessages();

    const { email, password, displayName } = this.signUpForm.getRawValue();
    this.authService.signUp(email, password, displayName).subscribe({
      next: () => {
        this.confirmForm.controls.email.setValue(email);
        this.mode.set('confirm');
        this.notice.set('We sent a confirmation code to your email.');
      },
      error: (error: Error) => this.fail(error),
      complete: () => this.loading.set(null)
    });
  }

  confirmSignUp(): void {
    if (this.confirmForm.invalid) {
      this.confirmForm.markAllAsTouched();
      this.error.set('Please enter your email and confirmation code.');
      return;
    }

    this.loading.set('confirm');
    this.resetMessages();

    const { email, confirmationCode } = this.confirmForm.getRawValue();
    this.authService.confirmSignUp(email, confirmationCode).subscribe({
      next: () => {
        this.signInForm.controls.email.setValue(email);
        this.mode.set('signin');
        this.notice.set('Account confirmed. Sign in with your new password.');
      },
      error: (error: Error) => this.fail(error),
      complete: () => this.loading.set(null)
    });
  }

  resendCode(): void {
    const emailControl = this.confirmForm.controls.email;
    if (emailControl.invalid) {
      emailControl.markAsTouched();
      this.error.set('Please enter the email address for your account.');
      return;
    }

    this.loading.set('resend');
    this.resetMessages();

    this.authService.resendConfirmationCode(emailControl.getRawValue()).subscribe({
      next: () => this.notice.set('A new confirmation code has been sent.'),
      error: (error: Error) => this.fail(error),
      complete: () => this.loading.set(null)
    });
  }

  showMode(nextMode: AuthMode): void {
    if (nextMode === 'signup') {
      this.signUpForm.controls.email.setValue(this.signInForm.controls.email.getRawValue());
    }
    if (nextMode === 'confirm') {
      this.confirmForm.controls.email.setValue(this.signUpForm.controls.email.getRawValue());
    }
    this.mode.set(nextMode);
    this.resetMessages();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  showUnavailableSignIn(provider: string): void {
    this.error.set(null);
    this.notice.set(`${provider} sign-in is not connected yet.`);
  }

  private resetMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private pickFact(): void {
    const randomIndex = Math.floor(Math.random() * this.healthFacts.length);
    this.currentFact.set(this.healthFacts[randomIndex]);
  }

  private startQuoteRotation(): void {
    if (this.prefersReducedMotion || this.quoteTimer) {
      return;
    }

    this.quoteTimer = setInterval(() => {
      this.activeQuoteIndex.update((index) => (index + 1) % this.brandQuotes.length);
    }, this.quoteIntervalMs);
  }

  private stopQuoteRotation(): void {
    if (!this.quoteTimer) {
      return;
    }

    clearInterval(this.quoteTimer);
    this.quoteTimer = null;
  }

  private fail(error: Error): void {
    this.error.set(error.message);
    this.loading.set(null);
  }
}
