import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, effect, inject, signal, untracked } from '@angular/core';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { LiveTrackerGoal } from './live-tracker.models';
import { SegmentStripViewComponent } from './plan-editor/segments/segment-strip-view.component';
import { PlayerRingComponent } from './player-ring.component';
import { SegmentWriteQueue } from './segments/segment-queue';
import {
  SegmentTimer,
  StepResult,
  addMinute,
  advance,
  cueFigure,
  segmentElapsed,
  skip,
  startTimer,
  stripRows,
  timerLine
} from './segments/segment-timer';
import { WorkoutCelebrationComponent, WorkoutCelebrationSummary } from './workout-celebration.component';
import { WorkoutLiveService } from './workout-live.service';

@Component({
  selector: 'app-live-tracker',
  imports: [SegmentStripViewComponent, PlayerRingComponent, WorkoutCelebrationComponent],
  templateUrl: './live-tracker.component.html',
  styleUrl: './live-tracker.component.scss'
})
export class LiveTrackerComponent implements OnChanges {
  private readonly toast = inject(ToastService);
  private readonly dataService = inject(FitSyncDataService);
  readonly live = inject(WorkoutLiveService);

  @Input({ required: true }) session: WorkoutSessionDetail | null = null;
  @Input() goal: LiveTrackerGoal | null = null;

  @Output() completed = new EventEmitter<WorkoutSessionDetail>();
  @Output() cancelled = new EventEmitter<WorkoutSessionDetail>();
  @Output() minimise = new EventEmitter<void>();

  readonly ending = signal(false);
  /** The finished session, shown on the completion page when it had segments. */
  readonly finished = signal<WorkoutCelebrationSummary | null>(null);

  /** The timer of the session's segments; null for a session without any. */
  protected readonly timer = signal<SegmentTimer | null>(null);
  private timerSessionId: string | null = null;
  private readonly writes = new SegmentWriteQueue((entryId, input) =>
    this.dataService.updateSessionSegment(this.live.session()?.sessionId ?? '', entryId, input)
  );
  protected readonly segmentLine = computed(() => {
    const timer = this.timer();
    return timer ? timerLine(timer, this.live.elapsedSeconds()) : '';
  });
  protected readonly stripRows = computed(() => {
    const timer = this.timer();
    return timer ? stripRows(timer) : [];
  });
  protected readonly stripElapsed = computed(() => {
    const timer = this.timer();
    return timer ? segmentElapsed(timer, this.live.elapsedSeconds()) : 0;
  });
  protected readonly cue = computed(() => {
    const timer = this.timer();
    return timer && !this.live.paused() ? cueFigure(timer, this.live.elapsedSeconds()) : null;
  });
  protected readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    effect(() => {
      const elapsed = this.live.elapsedSeconds();
      const paused = this.live.paused();
      untracked(() => {
        const timer = this.timer();
        if (timer && !paused) {
          this.apply(advance(timer, elapsed));
        }
      });
    });
  }

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
      this.syncSegments(this.session);
    }
  }

  skipSegment(): void {
    const timer = this.timer();
    if (timer) {
      this.apply(skip(timer, this.live.elapsedSeconds()));
    }
  }

  addMinute(): void {
    const timer = this.timer();
    if (timer) {
      this.timer.set(addMinute(timer));
    }
  }

  continueAfterFinish(): void {
    const summary = this.finished();
    this.finished.set(null);
    if (summary) {
      this.completed.emit(summary.session);
    }
  }

  private syncSegments(session: WorkoutSessionDetail): void {
    const segments = session.segments ?? [];
    if (segments.length === 0) {
      this.timer.set(null);
      this.timerSessionId = null;
      return;
    }
    this.writes.learn(segments);
    // A refreshed answer for the same session brings entry ids but never restarts the timer.
    if (this.timerSessionId !== session.sessionId) {
      this.timerSessionId = session.sessionId ?? null;
      this.timer.set(startTimer(segments, this.live.elapsedSeconds()));
    }
  }

  private apply(step: StepResult): void {
    if (step.settled.length === 0) {
      return;
    }
    this.timer.set(step.timer);
    this.writes.push(step.settled);
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
    if (!window.confirm('Terminate this workout now? Sessions under 60 seconds are discarded and will not be saved.')) {
      return;
    }

    this.ending.set(true);
    this.live.finish().subscribe({
      next: (session) => {
        if (session.status === 'CANCELLED') {
          if (!this.live.nothingLoggedCancel()) {
            this.toast.info('Workout was under 60 seconds, so it was cancelled and will not count toward metrics.');
          }
          this.cancelled.emit(session);
          return;
        }
        this.toast.success('Workout completed.');
        if (session.segments?.length) {
          this.finished.set({
            completedSets: 0,
            totalSets: 0,
            elapsedSeconds: Math.max(this.live.elapsedSeconds(), (session.durationMinutes ?? 0) * 60),
            estimatedCalories: this.live.estimatedCalories(),
            session
          });
          return;
        }
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
