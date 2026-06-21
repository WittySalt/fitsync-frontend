import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AccountDataService, AccountProfile, AccountSummary } from '../../core/account-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { AvatarUploadPage } from './avatar-upload.page';
import { AvatarUploaderComponent } from './avatar-uploader.component';

@Component({
  selector: 'app-avatar-uploader',
  template: '',
  standalone: true
})
class AvatarUploaderStubComponent {
  @Input() currentAvatarUrl: string | null = null;
  @Input() initials = 'FS';
  @Output() uploaded = new EventEmitter<AccountProfile>();
  @Output() cancel = new EventEmitter<void>();
}

describe('AvatarUploadPage', () => {
  let fixture: ComponentFixture<AvatarUploadPage>;
  let accountDataService: jasmine.SpyObj<AccountDataService>;
  let router: jasmine.SpyObj<Router>;
  let toast: jasmine.SpyObj<ToastService>;

  const summary: AccountSummary = {
    displayName: 'Alice Tan',
    email: 'alice@example.com',
    initials: 'AT',
    avatarUrl: 'https://cdn.example/avatar.png',
    authProvider: 'COGNITO',
    membershipTier: 'MEMBER'
  };

  const uploadedProfile: AccountProfile = {
    displayName: 'Alice Tan',
    firstName: 'Alice',
    lastName: 'Tan',
    avatarUrl: 'https://cdn.example/new-avatar.png',
    birthDate: null,
    gender: null,
    heightCm: null,
    activityLevel: null,
    timezone: null,
    locationDisplay: null,
    bio: null,
    membershipTier: 'MEMBER',
    membershipStatus: 'ACTIVE',
    onboardingCompleted: true
  };

  beforeEach(async () => {
    accountDataService = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['getAccountSummary']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    accountDataService.getAccountSummary.and.returnValue(of(summary));

    await TestBed.configureTestingModule({
      imports: [AvatarUploadPage],
      providers: [
        { provide: AccountDataService, useValue: accountDataService },
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toast }
      ]
    })
      .overrideComponent(AvatarUploadPage, {
        remove: { imports: [AvatarUploaderComponent] },
        add: { imports: [AvatarUploaderStubComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(AvatarUploadPage);
    fixture.detectChanges();
  });

  it('renders the current account avatar before upload', () => {
    const element = fixture.nativeElement as HTMLElement;
    const image = element.querySelector<HTMLImageElement>('.current-avatar');
    const uploader = fixture.debugElement.query(By.directive(AvatarUploaderStubComponent)).componentInstance as AvatarUploaderStubComponent;

    expect(accountDataService.getAccountSummary).toHaveBeenCalled();
    expect(element.textContent).toContain('Profile photo');
    expect(element.textContent).toContain('Alice Tan');
    expect(image?.src).toContain('/avatar.png');
    expect(image?.alt).toBe('Alice Tan profile photo');
    expect(uploader.currentAvatarUrl).toBe(summary.avatarUrl);
    expect(uploader.initials).toBe('AT');
  });

  it('navigates back to settings after upload succeeds', () => {
    const uploader = fixture.debugElement.query(By.directive(AvatarUploaderStubComponent)).componentInstance as AvatarUploaderStubComponent;

    uploader.uploaded.emit(uploadedProfile);

    expect(toast.success).toHaveBeenCalledWith('Profile photo updated.');
    expect(router.navigate).toHaveBeenCalledWith(['/settings']);
  });

  it('navigates back to settings when upload is canceled', () => {
    const uploader = fixture.debugElement.query(By.directive(AvatarUploaderStubComponent)).componentInstance as AvatarUploaderStubComponent;

    uploader.cancel.emit();

    expect(router.navigate).toHaveBeenCalledWith(['/settings']);
  });
});
