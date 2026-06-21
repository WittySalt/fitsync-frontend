import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, signal } from '@angular/core';

import { WorkoutSessionDetail } from '../../core/fitsync.models';

export interface WorkoutCelebrationSummary {
  completedSets: number;
  totalSets: number;
  elapsedSeconds: number;
  estimatedCalories: number;
  session: WorkoutSessionDetail;
}

@Component({
  selector: 'app-workout-celebration',
  templateUrl: './workout-celebration.component.html',
  styleUrl: './workout-celebration.component.scss'
})
export class WorkoutCelebrationComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) summary: WorkoutCelebrationSummary | null = null;
  @Input() reducedMotion = false;

  @Output() continue = new EventEmitter<void>();

  readonly displaySets = signal(0);
  readonly displaySeconds = signal(0);
  readonly displayCalories = signal(0);
  readonly confettiPieces = Array.from({ length: 16 }, (_, index) => index);

  private countTimerId: ReturnType<typeof setInterval> | null = null;
  private hasVibrated = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['summary'] || changes['reducedMotion']) {
      this.startPresentation();
    }
  }

  ngOnDestroy(): void {
    this.clearCountTimer();
  }

  formatElapsed(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}m ${remainder}s`;
  }

  private startPresentation(): void {
    const summary = this.summary;
    this.clearCountTimer();
    if (!summary) {
      return;
    }

    if (this.reducedMotion) {
      this.displaySets.set(summary.completedSets);
      this.displaySeconds.set(summary.elapsedSeconds);
      this.displayCalories.set(summary.estimatedCalories);
      return;
    }

    this.vibrateOnce();
    const startedAt = Date.now();
    const durationMs = 800;
    this.displaySets.set(0);
    this.displaySeconds.set(0);
    this.displayCalories.set(0);
    this.countTimerId = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      this.displaySets.set(Math.round(summary.completedSets * progress));
      this.displaySeconds.set(Math.round(summary.elapsedSeconds * progress));
      this.displayCalories.set(Math.round(summary.estimatedCalories * progress));
      if (progress >= 1) {
        this.clearCountTimer();
      }
    }, 40);
  }

  private vibrateOnce(): void {
    if (this.hasVibrated || typeof navigator === 'undefined') {
      return;
    }
    navigator.vibrate?.(35);
    this.hasVibrated = true;
  }

  private clearCountTimer(): void {
    if (this.countTimerId) {
      clearInterval(this.countTimerId);
      this.countTimerId = null;
    }
  }
}
