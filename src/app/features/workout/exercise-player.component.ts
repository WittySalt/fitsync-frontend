import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, computed, inject, signal } from '@angular/core';

import {
  WorkoutExerciseLog,
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { WorkoutLiveService } from './workout-live.service';

@Component({
  selector: 'app-exercise-player',
  templateUrl: './exercise-player.component.html',
  styleUrl: './exercise-player.component.scss'
})
export class ExercisePlayerComponent implements OnChanges, OnDestroy {
  private readonly toast = inject(ToastService);
  readonly live = inject(WorkoutLiveService);

  @Input({ required: true }) session: WorkoutSessionDetail | null = null;
  @Input({ required: true }) activePlan: WorkoutPlan | null = null;
  @Input() initialExerciseId: string | null = null;

  @Output() completed = new EventEmitter<WorkoutSessionDetail>();
  @Output() cancelled = new EventEmitter<WorkoutSessionDetail>();

  readonly currentExerciseIndex = signal(0);
  readonly currentSetNumber = signal(1);
  readonly restRemainingSeconds = signal(0);
  readonly savingSet = signal(false);
  readonly ending = signal(false);
  readonly allTargetsComplete = signal(false);
  readonly failedMediaKeys = signal<Set<string>>(new Set());

  private restTimerId: ReturnType<typeof setInterval> | null = null;

  readonly orderedLogs = computed(() =>
    [...(this.live.session()?.exercises ?? [])].sort((a, b) => a.sequence - b.sequence)
  );

  readonly currentLog = computed(() => this.orderedLogs()[this.currentExerciseIndex()] ?? null);
  readonly currentPlanExercise = computed(() => this.findPlanExercise(this.currentLog()));
  readonly targetSets = computed(() => Math.max(1, this.currentPlanExercise()?.targetSets ?? 1));
  readonly totalTargetSets = computed(() =>
    (this.activePlan?.exercises ?? []).reduce((sum, exercise) => sum + Math.max(1, exercise.targetSets ?? 1), 0)
  );
  readonly completedSetCount = computed(() =>
    this.orderedLogs().reduce((sum, log) => sum + log.sets.filter((set) => set.logged).length, 0)
  );
  readonly progressPercent = computed(() => {
    const total = this.totalTargetSets();
    if (!total) {
      return 0;
    }
    return Math.min(100, Math.round((this.completedSetCount() / total) * 100));
  });
  readonly currentMediaUrl = computed(() => {
    const key = this.currentMediaKey();
    if (!key || this.failedMediaKeys().has(key)) {
      return null;
    }
    const log = this.currentLog();
    const target = this.currentPlanExercise();
    return target?.images?.[0]
      ?? target?.animationUrl
      ?? log?.images?.[0]
      ?? log?.animationUrl
      ?? null;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['session'] || changes['initialExerciseId']) && this.session) {
      this.live.setSession(this.session);
      const index = this.initialExerciseIndex();
      this.currentExerciseIndex.set(index);
      this.currentSetNumber.set(this.nextTargetSetNumber(this.orderedLogs()[index] ?? null));
      this.allTargetsComplete.set(false);
      this.clearRestTimer();
    }
  }

  ngOnDestroy(): void {
    this.clearRestTimer();
  }

  completeCurrentSet(): void {
    const session = this.live.session();
    const log = this.currentLog();
    const target = this.currentPlanExercise();
    const setNumber = this.currentSetNumber();
    if (!session?.sessionId || !log?.exerciseLogId || !this.live.canWrite() || this.savingSet() || this.restRemainingSeconds() > 0) {
      return;
    }

    this.savingSet.set(true);
    this.live.recordSet(session.sessionId, log.exerciseLogId, setNumber, {
      reps: target?.targetReps ?? null,
      weightKg: target?.targetWeightKg ?? null,
      durationSeconds: target?.targetDurationSeconds ?? null,
      distanceKm: target?.targetDistanceKm ?? null,
      restSeconds: target?.restSeconds ?? null,
      perceivedExertion: null,
      notes: null
    }).subscribe({
      next: () => this.beginRestOrAdvance(target?.restSeconds ?? 0),
      error: () => this.toast.error('Unable to save this set. Please retry.'),
      complete: () => this.savingSet.set(false)
    });
  }

  skipRest(): void {
    if (this.restRemainingSeconds() <= 0) {
      return;
    }
    this.clearRestTimer();
    this.advanceTarget();
  }

  addRestSeconds(): void {
    if (this.restRemainingSeconds() > 0) {
      this.restRemainingSeconds.update((value) => value + 15);
    }
  }

  pauseOrResume(): void {
    if (this.live.paused()) {
      this.live.resume();
      return;
    }
    this.live.pause();
  }

  finish(): void {
    if (this.ending()) {
      return;
    }
    this.ending.set(true);
    this.live.finish().subscribe({
      next: (session) => {
        if (session.status === 'CANCELLED') {
          this.toast.info('Short workout cancelled, so it will not count toward metrics.');
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

  abort(): void {
    if (this.ending()) {
      return;
    }
    this.ending.set(true);
    this.live.abort().subscribe({
      next: (session) => {
        this.toast.info('Workout cancelled.');
        this.cancelled.emit(session);
      },
      error: () => this.toast.error('Unable to cancel workout. Please retry.'),
      complete: () => this.ending.set(false)
    });
  }

  targetSummary(exercise: WorkoutPlanExercise | null): string {
    if (!exercise) {
      return 'Follow the plan target for this movement.';
    }
    const parts = [`${Math.max(1, exercise.targetSets ?? 1)} x ${exercise.targetReps ?? '-'}`];
    if (exercise.targetWeightKg) {
      parts.push(`${exercise.targetWeightKg} kg`);
    }
    if (exercise.targetDurationSeconds) {
      parts.push(`${exercise.targetDurationSeconds} sec`);
    }
    if (exercise.restSeconds) {
      parts.push(`${exercise.restSeconds} sec rest`);
    }
    return parts.join(' / ');
  }

  mediaAlt(log: WorkoutExerciseLog): string {
    return `${log.exerciseNameSnapshot} movement reference`;
  }

  mediaInitial(log: WorkoutExerciseLog | null): string {
    return (log?.exerciseNameSnapshot ?? 'Exercise').trim().charAt(0).toUpperCase() || 'E';
  }

  onMediaError(): void {
    const key = this.currentMediaKey();
    if (!key) {
      return;
    }
    this.failedMediaKeys.update((failed) => new Set(failed).add(key));
  }

  formatClock(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  }

  formatElapsed(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}m ${remainder}s`;
  }

  private beginRestOrAdvance(restSeconds: number): void {
    if (restSeconds <= 0 || this.isLastTarget()) {
      this.advanceTarget();
      return;
    }

    this.restRemainingSeconds.set(restSeconds);
    this.clearRestTimer(false);
    this.restTimerId = setInterval(() => {
      this.restRemainingSeconds.update((value) => Math.max(0, value - 1));
      if (this.restRemainingSeconds() === 0) {
        this.clearRestTimer(false);
        this.advanceTarget();
      }
    }, 1000);
  }

  private advanceTarget(): void {
    this.restRemainingSeconds.set(0);
    if (this.currentSetNumber() < this.targetSets()) {
      this.currentSetNumber.update((value) => value + 1);
      return;
    }

    if (this.currentExerciseIndex() < this.orderedLogs().length - 1) {
      this.currentExerciseIndex.update((value) => value + 1);
      this.currentSetNumber.set(this.nextTargetSetNumber(this.currentLog()));
      return;
    }

    this.allTargetsComplete.set(true);
  }

  private isLastTarget(): boolean {
    return this.currentSetNumber() >= this.targetSets()
      && this.currentExerciseIndex() >= this.orderedLogs().length - 1;
  }

  private nextTargetSetNumber(log: WorkoutExerciseLog | null): number {
    const logged = log?.sets.filter((set) => set.logged).map((set) => set.setNumber) ?? [];
    return Math.max(0, ...logged) + 1;
  }

  private findPlanExercise(log: WorkoutExerciseLog | null): WorkoutPlanExercise | null {
    if (!log || !this.activePlan?.exercises?.length) {
      return null;
    }
    return this.activePlan.exercises.find((exercise) => exercise.exerciseId === log.exerciseId)
      ?? this.activePlan.exercises.find((exercise) => exercise.sequence === log.sequence)
      ?? null;
  }

  private initialExerciseIndex(): number {
    if (!this.initialExerciseId) {
      return 0;
    }
    const index = this.orderedLogs().findIndex((log) => log.exerciseId === this.initialExerciseId);
    return index >= 0 ? index : 0;
  }

  private currentMediaKey(): string | null {
    const log = this.currentLog();
    if (!log) {
      return null;
    }
    return log.exerciseId || log.exerciseLogId || log.exerciseNameSnapshot;
  }

  private clearRestTimer(reset = true): void {
    if (this.restTimerId) {
      clearInterval(this.restTimerId);
      this.restTimerId = null;
    }
    if (reset) {
      this.restRemainingSeconds.set(0);
    }
  }
}
