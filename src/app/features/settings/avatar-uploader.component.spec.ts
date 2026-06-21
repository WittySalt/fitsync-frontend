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

  it('ignores empty file selections after clearing transient crop state', () => {
    component.onCropped({
      blob: new Blob(['previous'], { type: 'image/png' }),
      width: 128,
      height: 128,
      cropperPosition: { x1: 0, y1: 0, x2: 128, y2: 128 },
      imagePosition: { x1: 0, y1: 0, x2: 128, y2: 128 }
    });

    component.onFileSelected({ target: { files: [], value: '' } } as unknown as Event);

    expect(component.error()).toBeNull();
    expect(component.croppedBlob()).toBeNull();
    expect(component.imageChangedEvent()).toBeNull();
  });

  it('accepts valid image selections and records the selected file name', () => {
    const file = new File(['avatar'], 'avatar.webp', { type: 'image/webp' });
    const event = fileEvent(file);

    component.onFileSelected(event);

    expect(component.selectedFileName()).toBe('avatar.webp');
    expect(component.imageChangedEvent()).toBe(event);
    expect(component.error()).toBeNull();
  });

  it('requires a cropped blob before uploading', async () => {
    await component.upload();

    expect(component.error()).toBe('Crop a photo before uploading.');
    expect(accountData.uploadAvatar).not.toHaveBeenCalled();
  });

  it('clears crop state and emits cancel when upload is cancelled', () => {
    let cancelled = false;
    component.cancel.subscribe(() => {
      cancelled = true;
    });
    component.onFileSelected(fileEvent(new File(['avatar'], 'avatar.png', { type: 'image/png' })));
    component.onCropped({
      blob: new Blob(['cropped'], { type: 'image/png' }),
      width: 128,
      height: 128,
      cropperPosition: { x1: 0, y1: 0, x2: 128, y2: 128 },
      imagePosition: { x1: 0, y1: 0, x2: 128, y2: 128 }
    });

    component.cancelUpload();

    expect(cancelled).toBeTrue();
    expect(component.imageChangedEvent()).toBeNull();
    expect(component.croppedBlob()).toBeNull();
    expect(component.selectedFileName()).toBeNull();
    expect(component.error()).toBeNull();
  });

  it('uses the generic upload message for non-Error rejections', async () => {
    const cropped = new Blob(['cropped'], { type: 'image/png' });
    accountData.uploadAvatar.and.returnValue(throwError(() => 'backend rejected'));

    component.onCropped({
      blob: cropped,
      width: 512,
      height: 512,
      cropperPosition: { x1: 0, y1: 0, x2: 512, y2: 512 },
      imagePosition: { x1: 0, y1: 0, x2: 512, y2: 512 }
    });
    await component.upload();

    expect(toast.error).toHaveBeenCalledWith('Unable to upload avatar. Please retry.');
    expect(component.error()).toBe('Unable to upload avatar. Please retry.');
    expect(component.uploading()).toBeFalse();
  });

  it('reports oversized cropped avatars when resizing cannot reduce them', async () => {
    const originalCreateImageBitmap = (window as unknown as { createImageBitmap?: unknown }).createImageBitmap;
    (window as unknown as { createImageBitmap?: unknown }).createImageBitmap = undefined;
    const cropped = new Blob([new Uint8Array(AVATAR_MAX_BYTES + 1)], { type: 'image/png' });

    component.onCropped({
      blob: cropped,
      width: 512,
      height: 512,
      cropperPosition: { x1: 0, y1: 0, x2: 512, y2: 512 },
      imagePosition: { x1: 0, y1: 0, x2: 512, y2: 512 }
    });

    await component.upload();

    expect(accountData.uploadAvatar).not.toHaveBeenCalled();
    expect(component.error()).toContain('still larger than 2 MB');
    expect(component.uploading()).toBeFalse();

    (window as unknown as { createImageBitmap?: unknown }).createImageBitmap = originalCreateImageBitmap;
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
