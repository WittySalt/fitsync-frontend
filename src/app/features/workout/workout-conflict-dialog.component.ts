import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ToastService } from '../../core/toast/toast.service';
import { WorkoutLiveService } from './workout-live.service';
import { WorkoutModalComponent } from './workout-modal.component';

/** "just now", "12 min ago", "1 h 5 min ago". */
export function startedAgoLabel(startedAt: string, now = Date.now()): string {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) {
    return '';
  }
  const minutes = Math.max(0, Math.floor((now - started) / 60_000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const leftoverMinutes = minutes % 60;
  return leftoverMinutes ? `${Math.floor(minutes / 60)} h ${leftoverMinutes} min ago` : `${Math.floor(minutes / 60)} h ago`;
}

/**
 * The answer to a start that the server refused because another workout is in progress. It is
 * mounted once in the shell, and any start from any page can open it.
 */
@Component({
  selector: 'app-workout-conflict-dialog',
  imports: [WorkoutModalComponent],
  template: `
    @if (live.pendingStart(); as pending) {
      <app-workout-modal heading="You have a workout in progress" (dismissed)="cancel()">
        <p class="what">
          <strong>{{ pending.info.name }}</strong>
          @if (ago(pending.info.startedAt); as when) {
            <span>started {{ when }}</span>
          }
        </p>
        <div class="choices">
          <button class="button primary" type="button" [disabled]="busy()" (click)="resumeIt()">Resume it</button>
          <button class="button secondary" type="button" [disabled]="busy()" (click)="endAndStart()">
            {{ busy() ? 'Starting...' : 'End it and start this one' }}
          </button>
          <button class="button secondary" type="button" [disabled]="busy()" (click)="cancel()">Cancel</button>
        </div>
      </app-workout-modal>
    }
  `,
  styles: `
    .what {
      display: grid;
      gap: 2px;
      margin: 0;
      color: var(--text-secondary);
    }

    strong {
      color: var(--text-primary);
    }

    .choices {
      display: grid;
      gap: 8px;
    }
  `
})
export class WorkoutConflictDialogComponent {
  protected readonly live = inject(WorkoutLiveService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);
  protected ago(startedAt: string): string {
    return startedAgoLabel(startedAt);
  }

  protected resumeIt(): void {
    this.live.resumePending();
    void this.router.navigateByUrl('/workout');
  }

  protected cancel(): void {
    if (!this.busy()) {
      this.live.dismissPendingStart();
    }
  }

  protected endAndStart(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.live.endAndStart().subscribe({
      next: () => {
        this.busy.set(false);
        this.live.open();
        void this.router.navigateByUrl('/workout');
      },
      error: () => {
        this.toast.error('Unable to start this workout. Please retry.');
        this.busy.set(false);
      },
      // The repeated start can be refused again and complete with no value; free the buttons then too.
      complete: () => this.busy.set(false)
    });
  }
}
