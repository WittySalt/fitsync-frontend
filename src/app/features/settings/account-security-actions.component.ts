import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';

@Component({
  selector: 'app-account-security-actions',
  imports: [ReactiveFormsModule],
  templateUrl: './account-security-actions.component.html',
  styleUrl: './account-security-actions.component.scss'
})
export class AccountSecurityActionsComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);

  readonly changingPassword = signal(false);
  readonly signingOut = signal(false);
  readonly confirmingSignOut = signal(false);

  /**
   * The Cognito sign-out covers every device, this one included. With session refresh, "Your devices"
   * signs out the other devices instead, so this entry is shown only when that list is not available.
   */
  readonly showSignOutEverywhere = !this.authService.hasRefreshToken();

  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmSignOut');

  constructor() {
    // The confirm step replaces the button that opened it, so focus moves to the confirm button.
    effect(() => this.confirmButton()?.nativeElement.focus());
  }

  readonly passwordForm = this.fb.group({
    currentPassword: ['', [Validators.required, Validators.maxLength(120)]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(120)]],
    confirmPassword: ['', [Validators.required, Validators.maxLength(120)]]
  });

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const value = this.passwordForm.getRawValue();
    if (!this.isStrongEnough(value.newPassword)) {
      this.passwordForm.controls.newPassword.setErrors({ weak: true });
      return;
    }
    if (value.newPassword !== value.confirmPassword) {
      this.passwordForm.controls.confirmPassword.setErrors({ mismatch: true });
      return;
    }

    this.changingPassword.set(true);
    this.authService.changePassword(value.currentPassword, value.newPassword).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordForm.reset();
        this.toast.success('Password changed.');
      },
      error: (error: Error) => {
        this.changingPassword.set(false);
        this.toast.error(error.message || 'Unable to change password.');
      }
    });
  }

  signOutEverywhere(): void {
    if (this.signingOut()) {
      return;
    }
    this.signingOut.set(true);
    this.authService.signOutEverywhere().subscribe({
      error: (error: Error) => {
        this.signingOut.set(false);
        this.toast.error(error.message || 'Unable to sign out of all devices.');
      }
    });
  }

  protected currentPasswordInvalid(): boolean {
    const control = this.passwordForm.controls.currentPassword;
    return control.invalid && (control.dirty || control.touched);
  }

  protected newPasswordInvalid(): boolean {
    const control = this.passwordForm.controls.newPassword;
    return control.invalid && (control.dirty || control.touched);
  }

  protected confirmPasswordInvalid(): boolean {
    const control = this.passwordForm.controls.confirmPassword;
    return control.invalid && (control.dirty || control.touched);
  }

  private isStrongEnough(password: string): boolean {
    return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  }
}
