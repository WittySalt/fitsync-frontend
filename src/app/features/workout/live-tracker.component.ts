import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';

import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { LiveTrackerGoal } from './live-tracker.models';
import { WorkoutLiveService } from './workout-live.service';

@Component({
  selector: 'app-live-tracker',
  templateUrl: './live-tracker.component.html',
  styleUrl: './live-tracker.component.scss'
})
export class LiveTrackerComponent implements OnChanges {
  private readonly toast = inject(ToastService);
  readonly live = inject(WorkoutLiveService);

  @Input({ required: true }) session: WorkoutSessionDetail | null = null;
  @Input() goal: LiveTrackerGoal | null = null;

  @Output() completed = new EventEmitter<WorkoutSessionDetail>();
  @Output() cancelled = new EventEmitter<WorkoutSessionDetail>();

  readonly ending = signal(false);

  readonly goalProgressPercent = computed(() => {
    if (!this.goal) {
      return 0;
    }
    const current = this.goal.type === 'MINUTES'
      ? this.live.elapsedSeconds() / 60
      : this.live.estimatedCalories();
    return Math.min(100, Math.round((current / Math.max(1, this.goal.target)) * 100));
  });

  readonly goalCurrentValue = computed(() => {
    if (!this.goal) {
      return '';
    }
    return this.goal.type === 'MINUTES'
      ? `${Math.floor(this.live.elapsedSeconds() / 60)} min`
      : `${this.live.estimatedCalories()} kcal`;
  });

  readonly goalTargetValue = computed(() => {
    if (!this.goal) {
      return '';
    }
    return this.goal.type === 'MINUTES'
      ? `${this.goal.target} min`
      : `${this.goal.target} kcal`;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.session) {
      this.live.setSession(this.session);
    }
  }

  pauseOrResume(): void {
    if (this.live.paused()) {
      this.live.resume();
      return;
    }
    this.live.pause();
  }

  terminate(): void {
    if (this.ending()) {
      return;
    }

    this.ending.set(true);
    this.live.finish().subscribe({
      next: (session) => {
        if (session.status === 'CANCELLED') {
          this.toast.info('Workout was under 60 seconds, so it was cancelled and will not count toward metrics.');
          this.cancelled.emit(session);
          return;
        }
        this.toast.success('Workout completed.');
        this.completed.emit(session);
      },
      error: () => this.toast.error('Unable to finish workout. Please retry.'),
      complete: () => this.ending.set(false)
    });
  }

  formatElapsed(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  }

  formatLabel(value: string | null | undefined): string {
    return (value ?? '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
