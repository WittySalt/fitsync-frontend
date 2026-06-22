import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AccountDataService, AccountProfile, AccountSummary } from '../../core/account-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { AvatarUploaderComponent } from './avatar-uploader.component';

@Component({
  selector: 'app-avatar-upload-page',
  imports: [AvatarUploaderComponent, StatePanelComponent],
  templateUrl: './avatar-upload.page.html',
  styleUrl: './avatar-upload.page.scss'
})
export class AvatarUploadPage implements OnInit {
  private readonly accountData = inject(AccountDataService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly summary = signal<AccountSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.loading.set(true);
    this.error.set(null);
    this.accountData.getAccountSummary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message || 'Unable to load profile photo.');
        this.loading.set(false);
      }
    });
  }

  async handleUploaded(_profile: AccountProfile): Promise<void> {
    this.toast.success('Profile photo updated.');
    await this.router.navigate(['/settings']);
  }

  async backToSettings(): Promise<void> {
    await this.router.navigate(['/settings']);
  }
}
