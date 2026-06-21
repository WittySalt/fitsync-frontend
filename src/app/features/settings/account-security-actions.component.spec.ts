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
      'deleteAccount'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    authService.changePassword.and.returnValue(of(undefined));
    authService.signOutEverywhere.and.returnValue(of(undefined));
    authService.deleteAccount.and.returnValue(of(undefined));

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

  it('signs out of all devices only after confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(true);

    component.signOutEverywhere();

    expect(window.confirm).toHaveBeenCalled();
    expect(authService.signOutEverywhere).toHaveBeenCalled();
  });

  it('requires typed confirmation before deleting the Cognito account', () => {
    const prompt = spyOn(window, 'prompt').and.returnValue('not delete');

    component.deleteAccount();

    expect(prompt.calls.mostRecent().args[0]).toContain('Backend data is not automatically deleted');
    expect(authService.deleteAccount).not.toHaveBeenCalled();

    prompt.and.returnValue('DELETE');

    component.deleteAccount();

    expect(authService.deleteAccount).toHaveBeenCalled();
  });

  it('shows a toast when Cognito account deletion fails', () => {
    spyOn(window, 'prompt').and.returnValue('DELETE');
    authService.deleteAccount.and.returnValue(throwError(() => new Error('Cognito denied the request.')));

    component.deleteAccount();

    expect(toast.error).toHaveBeenCalledWith('Cognito denied the request.');
  });

  it('renders the backend data cleanup warning in the danger panel', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Backend workout, nutrition, body-metric, and profile data are not automatically cleaned.');
  });
});
