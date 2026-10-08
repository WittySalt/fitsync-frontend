import { Component, inject, input, output, signal } from '@angular/core';
import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';
import { firstValueFrom } from 'rxjs';

import { AccountDataService, AccountProfile } from '../../core/account-data.service';
import { ToastService } from '../../core/toast/toast.service';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const RESIZE_STEPS = [512, 384, 256, 128];

@Component({
  selector: 'app-avatar-uploader',
  imports: [ImageCropperComponent],
  templateUrl: './avatar-uploader.component.html',
  styleUrl: './avatar-uploader.component.scss'
})
export class AvatarUploaderComponent {
  private readonly accountData = inject(AccountDataService);
  private readonly toast = inject(ToastService);

  readonly currentAvatarUrl = input<string | null>(null);
  readonly initials = input('FS');
  readonly uploaded = output<AccountProfile>();
  readonly dismissed = output<void>();

  readonly imageChangedEvent = signal<Event | null>(null);
  readonly croppedBlob = signal<Blob | null>(null);
  readonly selectedFileName = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly uploading = signal(false);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.error.set(null);
    this.croppedBlob.set(null);

    if (!file) {
      return;
    }
    if (!AVATAR_TYPES.has(file.type)) {
      this.rejectSelection(input, 'Choose a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      this.rejectSelection(input, 'Choose an image smaller than 2 MB.');
      return;
    }

    this.selectedFileName.set(file.name);
    this.imageChangedEvent.set(event);
  }

  onCropped(event: ImageCroppedEvent): void {
    this.croppedBlob.set(event.blob ?? null);
    this.error.set(null);
  }

  async upload(): Promise<void> {
    const blob = this.croppedBlob();
    if (!blob) {
      this.error.set('Crop a photo before uploading.');
      return;
    }

    this.uploading.set(true);
    this.error.set(null);
    try {
      const uploadBlob = await this.ensureUploadableBlob(blob);
      const profile = await firstValueFrom(this.accountData.uploadAvatar(uploadBlob));
      this.toast.success('Avatar updated.');
      this.uploaded.emit(profile);
      this.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to upload avatar. Please retry.';
      this.toast.error(message);
      this.error.set(message);
    } finally {
      this.uploading.set(false);
    }
  }

  reset(): void {
    this.imageChangedEvent.set(null);
    this.croppedBlob.set(null);
    this.selectedFileName.set(null);
    this.error.set(null);
  }

  cancelUpload(): void {
    this.reset();
    this.dismissed.emit();
  }

  private rejectSelection(input: HTMLInputElement, message: string): void {
    input.value = '';
    this.selectedFileName.set(null);
    this.imageChangedEvent.set(null);
    this.error.set(message);
  }

  private async ensureUploadableBlob(blob: Blob): Promise<Blob> {
    if (blob.size <= AVATAR_MAX_BYTES) {
      return blob;
    }

    for (const size of RESIZE_STEPS) {
      const resized = await this.resizePng(blob, size);
      if (resized.size <= AVATAR_MAX_BYTES) {
        return resized;
      }
    }

    throw new Error('Cropped avatar is still larger than 2 MB. Choose a simpler image.');
  }

  // Drawing into a square canvas does not distort, because the cropper is held to an aspect ratio of 1.
  private async resizePng(blob: Blob, size: number): Promise<Blob> {
    if (typeof createImageBitmap !== 'function') {
      return blob;
    }

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return blob;
    }
    context.drawImage(bitmap, 0, 0, size, size);
    bitmap.close();

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((resized) => {
        if (resized) {
          resolve(resized);
        } else {
          reject(new Error('Unable to prepare cropped avatar.'));
        }
      }, 'image/png');
    });
  }
}
