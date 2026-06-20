import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AccountDataService, AccountProfile } from '../../core/account-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { AVATAR_MAX_BYTES, AvatarUploaderComponent } from './avatar-uploader.component';

describe('AvatarUploaderComponent', () => {
  let fixture: ComponentFixture<AvatarUploaderComponent>;
  let component: AvatarUploaderComponent;
  let accountData: jasmine.SpyObj<AccountDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  const profile: AccountProfile = {
    displayName: 'Alice Tan',
    firstName: 'Alice',
    lastName: 'Tan',
    avatarUrl: 'https://cdn.example/avatar.png',
    birthDate: null,
    gender: null,
    heightCm: null,
    activityLevel: null,
    timezone: null,
    locationDisplay: null,
    bio: null,
    membershipTier: null,
    membershipStatus: null,
    onboardingCompleted: true
  };

  beforeEach(async () => {
    accountData = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['uploadAvatar']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    accountData.uploadAvatar.and.returnValue(of(profile));

    await TestBed.configureTestingModule({
      imports: [AvatarUploaderComponent],
      providers: [
        { provide: AccountDataService, useValue: accountData },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarUploaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('blocks files larger than 2 MB without uploading', () => {
    const file = new File([new Uint8Array(AVATAR_MAX_BYTES + 1)], 'large.png', { type: 'image/png' });

    component.onFileSelected(fileEvent(file));

    expect(component.error()).toContain('2 MB');
    expect(component.imageChangedEvent()).toBeNull();
    expect(accountData.uploadAvatar).not.toHaveBeenCalled();
  });

  it('blocks non-image files without uploading', () => {
    const file = new File(['not an image'], 'avatar.txt', { type: 'text/plain' });

    component.onFileSelected(fileEvent(file));

    expect(component.error()).toContain('PNG, JPEG, or WebP');
    expect(component.imageChangedEvent()).toBeNull();
    expect(accountData.uploadAvatar).not.toHaveBeenCalled();
  });

  it('uploads the cropped blob and emits the updated profile', async () => {
    const cropped = new Blob(['cropped'], { type: 'image/png' });
    let emitted: AccountProfile | undefined;
    component.uploaded.subscribe((value) => {
      emitted = value;
    });

    component.onCropped({
      blob: cropped,
      width: 512,
      height: 512,
      cropperPosition: { x1: 0, y1: 0, x2: 512, y2: 512 },
      imagePosition: { x1: 0, y1: 0, x2: 512, y2: 512 }
    });
    await component.upload();

    expect(accountData.uploadAvatar).toHaveBeenCalledWith(cropped);
    expect(toast.success).toHaveBeenCalledWith('Avatar updated.');
    expect(emitted).toEqual(profile);
  });

  it('shows a toast when upload fails', async () => {
    const cropped = new Blob(['cropped'], { type: 'image/png' });
    accountData.uploadAvatar.and.returnValue(throwError(() => new Error('Upload rejected.')));

    component.onCropped({
      blob: cropped,
      width: 512,
      height: 512,
      cropperPosition: { x1: 0, y1: 0, x2: 512, y2: 512 },
      imagePosition: { x1: 0, y1: 0, x2: 512, y2: 512 }
    });
    await component.upload();

    expect(toast.error).toHaveBeenCalledWith('Upload rejected.');
    expect(component.error()).toBe('Upload rejected.');
  });
});

function fileEvent(file: File): Event {
  return {
    target: {
      files: [file],
      value: file.name
    }
  } as unknown as Event;
}
