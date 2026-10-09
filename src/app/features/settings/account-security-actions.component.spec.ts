import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { AccountSecurityActionsComponent } from './account-security-actions.component';

describe('AccountSecurityActionsComponent', () => {
  let fixture: ComponentFixture<AccountSecurityActionsComponent>;
  let component: AccountSecurityActionsComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'changePassword',
      'signOutEverywhere',
      'hasRefreshToken'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    authService.changePassword.and.returnValue(of(undefined));
    authService.signOutEverywhere.and.returnValue(of(undefined));
    authService.hasRefreshToken.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [AccountSecurityActionsComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSecurityActionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('changes password with the entered old and new passwords', () => {
    component.passwordForm.setValue({
      currentPassword: 'old-password',
      newPassword: 'NewPassword1',
      confirmPassword: 'NewPassword1'
    });

    component.changePassword();

    expect(authService.changePassword).toHaveBeenCalledWith('old-password', 'NewPassword1');
    expect(toast.success).toHaveBeenCalledWith('Password changed.');
  });

  it('does not change password when confirmation does not match', () => {
    component.passwordForm.setValue({
      currentPassword: 'old-password',
      newPassword: 'NewPassword1',
      confirmPassword: 'Different1'
    });

    component.changePassword();

    expect(authService.changePassword).not.toHaveBeenCalled();
    expect(component.passwordForm.controls.confirmPassword.hasError('mismatch')).toBeTrue();
  });

  it('shows a toast when Cognito password change fails', () => {
    authService.changePassword.and.returnValue(throwError(() => new Error('Incorrect old password.')));
    component.passwordForm.setValue({
      currentPassword: 'old-password',
      newPassword: 'NewPassword1',
      confirmPassword: 'NewPassword1'
    });

    component.changePassword();

    expect(toast.error).toHaveBeenCalledWith('Incorrect old password.');
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function buttonNamed(label: string): HTMLButtonElement | undefined {
    return Array.from(element().querySelectorAll('button')).find((button) => button.textContent?.trim() === label);
  }

  it('asks inline, without a native dialog, before signing out everywhere', () => {
    const nativeConfirm = spyOn(window, 'confirm');

    buttonNamed('Sign out everywhere')!.click();
    fixture.detectChanges();

    expect(authService.signOutEverywhere).not.toHaveBeenCalled();
    expect(element().textContent).toContain('Sign out everywhere, including this device?');
    const confirm = element().querySelector<HTMLButtonElement>('.confirm-row .danger-solid')!;
    expect(document.activeElement).toBe(confirm);

    confirm.click();
    fixture.detectChanges();

    expect(authService.signOutEverywhere).toHaveBeenCalledTimes(1);
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it('cancels the inline confirm without signing out', () => {
    buttonNamed('Sign out everywhere')!.click();
    fixture.detectChanges();
    buttonNamed('Cancel')!.click();
    fixture.detectChanges();

    expect(authService.signOutEverywhere).not.toHaveBeenCalled();
    expect(element().textContent).not.toContain('including this device?');
  });

  it('shows a toast when signing out everywhere fails', () => {
    authService.signOutEverywhere.and.returnValue(throwError(() => new Error('Cognito is down.')));
    buttonNamed('Sign out everywhere')!.click();
    fixture.detectChanges();
    element().querySelector<HTMLButtonElement>('.confirm-row .danger-solid')!.click();

    expect(toast.error).toHaveBeenCalledWith('Cognito is down.');
    expect(component.signingOut()).toBeFalse();
  });

  it('leaves signing out other devices to the devices list when sessions can be refreshed', () => {
    authService.hasRefreshToken.and.returnValue(true);
    fixture = TestBed.createComponent(AccountSecurityActionsComponent);
    fixture.detectChanges();

    expect(element().textContent).not.toContain('Sign out everywhere');
  });


  it('does not render a separate Cognito account deletion flow', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toContain('Delete Cognito account');
    expect(text).not.toContain('Delete login credential');
  });
});
