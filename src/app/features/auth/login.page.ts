import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

type AuthMode = 'signin' | 'signup' | 'confirm';
type AuthAction = 'signin' | 'signup' | 'confirm' | 'resend';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<AuthMode>('signin');
  readonly loading = signal<AuthAction | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  email = '';
  password = '';
  displayName = '';
  confirmationCode = '';

  signIn(): void {
    if (!this.requireFields(['email', 'password'])) {
      return;
    }

    this.loading.set('signin');
    this.resetMessages();

    this.authService.signIn(this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (error: Error) => this.fail(error),
      complete: () => this.loading.set(null)
    });
  }

  signUp(): void {
    if (!this.requireFields(['email', 'password', 'displayName'])) {
      return;
    }

    this.loading.set('signup');
    this.resetMessages();

    this.authService.signUp(this.email, this.password, this.displayName).subscribe({
      next: () => {
        this.mode.set('confirm');
        this.notice.set('We sent a confirmation code to your email.');
      },
      error: (error: Error) => this.fail(error),
      complete: () => this.loading.set(null)
    });
  }

  confirmSignUp(): void {
    if (!this.requireFields(['email', 'confirmationCode'])) {
      return;
    }

    this.loading.set('confirm');
    this.resetMessages();

    this.authService.confirmSignUp(this.email, this.confirmationCode).subscribe({
      next: () => {
        this.mode.set('signin');
        this.notice.set('Account confirmed. Sign in with your new password.');
      },
      error: (error: Error) => this.fail(error),
      complete: () => this.loading.set(null)
    });
  }

  resendCode(): void {
    if (!this.requireFields(['email'])) {
      return;
    }

    this.loading.set('resend');
    this.resetMessages();

    this.authService.resendConfirmationCode(this.email).subscribe({
      next: () => this.notice.set('A new confirmation code has been sent.'),
      error: (error: Error) => this.fail(error),
      complete: () => this.loading.set(null)
    });
  }

  showMode(nextMode: AuthMode): void {
    this.mode.set(nextMode);
    this.resetMessages();
  }

  private requireFields(fields: Array<'email' | 'password' | 'displayName' | 'confirmationCode'>): boolean {
    const missing = fields.some((field) => !this[field].trim());
    if (missing) {
      this.error.set('Please complete the required fields.');
      return false;
    }

    return true;
  }

  private resetMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private fail(error: Error): void {
    this.error.set(error.message);
    this.loading.set(null);
  }
}
