import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, computed, effect, inject, signal } from '@angular/core';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  ExerciseDetail,
  WorkoutExerciseLog,
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { WorkoutLiveService } from './workout-live.service';
import {
  WorkoutCelebrationComponent,
  WorkoutCelebrationSummary
} from './workout-celebration.component';
import { ExerciseVideoComponent } from './exercise-video.component';

@Component({
  selector: 'app-exercise-player',
  imports: [WorkoutCelebrationComponent, ExerciseVideoComponent],
  templateUrl: './exercise-player.component.html',
  styleUrl: './exercise-player.component.scss'
})
export class ExercisePlayerComponent implements OnChanges, OnDestroy {
  private readonly dataService = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);
  readonly live = inject(WorkoutLiveService);
  private readonly defaultTempoSecondsPerRep = 3;

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
  readonly mediaFrameIndex = signal(0);
  readonly failedFrameUrls = signal<Set<string>>(new Set());
  readonly guidanceOpen = signal(true);
  readonly currentDetail = signal<ExerciseDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly workGuideActive = signal(false);
  readonly workGuideElapsedSeconds = signal(0);
  readonly workGuideRemainingSeconds = signal(0);
  readonly guidedRepCount = signal(0);
  readonly setCompleteCue = signal(false);
  readonly restCompleteCue = signal(false);
  readonly showCelebration = signal(false);
  readonly celebrationSummary = signal<WorkoutCelebrationSummary | null>(null);
  readonly liveAnnouncement = signal('');
  readonly activeTempoSecondsPerRep = signal(this.defaultTempoSecondsPerRep);
  readonly prefersReducedMotion = this.readReducedMotionPreference();

  private restTimerId: ReturnType<typeof setInterval> | null = null;
  private workTimerId: ReturnType<typeof setInterval> | null = null;
  private mediaTimerId: ReturnType<typeof setInterval> | null = null;
  private setCueTimerId: ReturnType<typeof setTimeout> | null = null;
  private restCueTimerId: ReturnType<typeof setTimeout> | null = null;
  private readonly activePlanRevision = signal(0);
  private readonly detailCache = new Map<string, ExerciseDetail | null>();
  private currentMediaExerciseId = '';

  readonly orderedLogs = computed(() =>
    [...(this.live.session()?.exercises ?? [])].sort((a, b) => a.sequence - b.sequence)
  );

  readonly currentLog = computed(() => this.orderedLogs()[this.currentExerciseIndex()] ?? null);
  readonly currentPlanExercise = computed(() => this.findPlanExercise(this.currentLog()));
  readonly currentExerciseId = computed(() => this.currentLog()?.exerciseId || this.currentPlanExercise()?.exerciseId || '');
  readonly currentMediaIdentity = computed(() =>
    this.currentExerciseId() || this.currentLog()?.exerciseLogId || this.currentLog()?.exerciseNameSnapshot || ''
  );
  readonly targetSets = computed(() => Math.max(1, this.currentPlanExercise()?.targetSets ?? 1));
  readonly isTimedTarget = computed(() => (this.currentPlanExercise()?.targetDurationSeconds ?? 0) > 0);
  readonly currentTempoSecondsPerRep = computed(() => this.tempoForExerciseType(this.currentDetail()?.exerciseType));
  readonly targetWorkSeconds = computed(() => {
    const target = this.currentPlanExercise();
    if (!target) {
      return 0;
    }
    if ((target.targetDurationSeconds ?? 0) > 0) {
      return Math.max(1, target.targetDurationSeconds ?? 0);
    }
    if ((target.targetReps ?? 0) > 0) {
      return Math.max(1, target.targetReps ?? 0) * this.workGuideTempoSecondsPerRep();
    }
    return 0;
  });
  readonly workGuideProgressPercent = computed(() => {
    const targetSeconds = this.targetWorkSeconds();
    if (!targetSeconds) {
      return 0;
    }
    return Math.min(100, Math.round((this.workGuideElapsedSeconds() / targetSeconds) * 100));
  });
  readonly totalTargetSets = computed(() =>
    this.activePlanExercises().reduce((sum, exercise) => sum + Math.max(1, exercise.targetSets ?? 1), 0)
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
  readonly mediaFrames = computed(() => {
    const detailFrames = this.detailMediaFrames();
    const selectedFrames = detailFrames.length ? detailFrames : this.fallbackMediaFrames();
    const failed = this.failedFrameUrls();
    return selectedFrames.filter((url) => url && !failed.has(url));
  });
  readonly currentMediaUrl = computed(() => {
    const frames = this.mediaFrames();
    return frames.length ? frames[this.mediaFrameIndex() % frames.length] : null;
  });
  readonly sortedInstructions = computed(() =>
    [...(this.currentDetail()?.instructions ?? [])].sort((a, b) => (a.stepNumber ?? Number.MAX_SAFE_INTEGER) - (b.stepNumber ?? Number.MAX_SAFE_INTEGER))
  );
  readonly guidanceChips = computed(() => {
    const detail = this.currentDetail();
    if (!detail) {
      return [];
    }
    return [
      detail.primaryMuscleGroup,
      ...(detail.secondaryMuscleGroups ?? []),
      detail.equipment,
      detail.difficulty
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => this.formatLabel(value));
  });
  readonly hasGuidance = computed(() => {
    const detail = this.currentDetail();
    return Boolean(detail?.description?.trim()) || this.sortedInstructions().length > 0;
  });

  private readonly detailEffect = effect(() => {
    const exerciseId = this.currentExerciseId();
    this.resetMediaForExercise(this.currentMediaIdentity() ?? '');
    this.loadExerciseDetail(exerciseId);
  });

  private readonly mediaLoopEffect = effect(() => {
    const frames = this.mediaFrames();
    const paused = this.live.paused();
    if (frames.length <= 1 || paused || this.prefersReducedMotion) {
      this.clearMediaTimer();
      return;
    }
    this.startMediaTimer();
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activePlan']) {
      this.activePlanRevision.update((value) => value + 1);
      this.clearWorkTimer();
    }
    if ((changes['session'] || changes['initialExerciseId']) && this.session) {
      this.live.setSession(this.session);
      const index = this.initialExerciseIndex();
      this.currentExerciseIndex.set(index);
      this.currentSetNumber.set(this.nextTargetSetNumber(this.orderedLogs()[index] ?? null));
      this.allTargetsComplete.set(false);
      this.clearRestTimer();
      this.clearWorkTimer();
    }
  }

  ngOnDestroy(): void {
    this.clearRestTimer();
    this.clearWorkTimer();
    this.clearMediaTimer();
    this.clearCueTimers();
  }

  completeCurrentSet(): void {
    const session = this.live.session();
    const log = this.currentLog();
    const target = this.currentPlanExercise();
    const setNumber = this.currentSetNumber();
    if (!session?.sessionId || !log?.exerciseLogId || !this.live.canWrite() || this.savingSet() || this.restRemainingSeconds() > 0) {
      return;
    }

    this.clearWorkTimer();
    this.restCompleteCue.set(false);
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
      next: () => {
        this.triggerSetCompleteCue();
        this.beginRestOrAdvance(target?.restSeconds ?? 0);
      },
      error: () => {
        this.toast.error('Unable to save this set. Please retry.');
        this.savingSet.set(false);
      },
      complete: () => this.savingSet.set(false)
    });
  }

  startGuidedSet(): void {
    if (!this.canRecordWorkSet() || this.targetWorkSeconds() <= 0) {
      return;
    }

    this.clearWorkTimer();
    this.restCompleteCue.set(false);
    this.activeTempoSecondsPerRep.set(this.currentTempoSecondsPerRep());
    this.workGuideElapsedSeconds.set(0);
    this.workGuideRemainingSeconds.set(this.targetWorkSeconds());
    this.guidedRepCount.set(0);
    this.workGuideActive.set(true);
    this.workTimerId = setInterval(() => this.tickWorkGuide(), 1000);
  }

  stopGuidedSet(): void {
    if (!this.workGuideActive()) {
      return;
    }
    const elapsed = this.workGuideElapsedSeconds();
    this.clearWorkTimer(false);
    if (elapsed <= 0) {
      this.clearWorkTimer();
      return;
    }
    this.recordGuidedSet(false);
  }

  skipRest(): void {
    if (this.restRemainingSeconds() <= 0) {
      return;
    }
    this.clearRestTimer();
    this.restCompleteCue.set(false);
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
    const finishSummary = {
      completedSets: this.completedSetCount(),
      totalSets: this.totalTargetSets(),
      elapsedSeconds: this.live.elapsedSeconds(),
      estimatedCalories: this.live.estimatedCalories()
    };
    this.ending.set(true);
    this.live.finish().subscribe({
      next: (session) => {
        if (session.status === 'CANCELLED') {
          this.toast.info('Short workout cancelled, so it will not count toward metrics.');
          this.cancelled.emit(session);
          return;
        }
        this.toast.success('Workout completed.');
        this.showWorkoutCelebration(session, finishSummary);
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

  recordedSetCount(log: WorkoutExerciseLog): number {
    return log.sets.filter((set) => set.logged).length;
  }

  plannedSetCount(log: WorkoutExerciseLog): number {
    return Math.max(1, this.findPlanExercise(log)?.targetSets ?? log.sets.length);
  }

  onMediaError(): void {
    const url = this.currentMediaUrl();
    if (!url) {
      return;
    }
    this.failedFrameUrls.update((failed) => new Set(failed).add(url));
    this.mediaFrameIndex.set(0);
  }

  toggleGuidance(): void {
    this.guidanceOpen.update((open) => !open);
  }

  formatLabel(value: string | null | undefined): string {
    return (value ?? '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatClock(seconds: number): string {
    const wholeSeconds = Math.ceil(seconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const remainder = wholeSeconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  }

  formatElapsed(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}m ${remainder}s`;
  }

  workGuideLabel(): string {
    return this.isTimedTarget() ? 'Timed set' : 'Tempo guide';
  }

  workGuidePrimaryMetric(): string {
    if (this.isTimedTarget()) {
      return this.formatClock(this.workGuideRemainingSeconds());
    }
    return `${this.guidedRepCount()} / ${this.currentPlanExercise()?.targetReps ?? 0} reps`;
  }

  tempoSummary(): string {
    return `${this.workGuideTempoSecondsPerRep()}s per rep`;
  }

  private beginRestOrAdvance(restSeconds: number): void {
    this.clearWorkTimer();
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
        this.triggerRestCompleteCue();
        this.advanceTarget();
      }
    }, 1000);
  }

  private loadExerciseDetail(exerciseId: string | null): void {
    if (!exerciseId) {
      this.detailLoading.set(false);
      this.currentDetail.set(null);
      return;
    }

    if (this.detailCache.has(exerciseId)) {
      this.detailLoading.set(false);
      const cached = this.detailCache.get(exerciseId) ?? null;
      this.currentDetail.set(cached);
      this.preloadMediaFrames(cached);
      return;
    }

    this.detailLoading.set(true);
    this.currentDetail.set(null);
    this.dataService.getExercise(exerciseId).subscribe({
      next: (detail) => {
        this.detailCache.set(exerciseId, detail);
        if (this.currentExerciseId() === exerciseId) {
          this.currentDetail.set(detail);
          this.preloadMediaFrames(detail);
        }
      },
      error: () => {
        this.detailCache.set(exerciseId, null);
        if (this.currentExerciseId() === exerciseId) {
          this.currentDetail.set(null);
        }
      },
      complete: () => {
        if (this.currentExerciseId() === exerciseId) {
          this.detailLoading.set(false);
        }
      }
    });
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

  private canRecordWorkSet(): boolean {
    const session = this.live.session();
    const log = this.currentLog();
    return !!session?.sessionId
      && !!log?.exerciseLogId
      && this.live.canWrite()
      && !this.savingSet()
      && this.restRemainingSeconds() <= 0
      && !this.allTargetsComplete();
  }

  private tickWorkGuide(): void {
    if (!this.workGuideActive() || this.live.paused() || this.savingSet()) {
      return;
    }
    const targetSeconds = this.targetWorkSeconds();
    if (targetSeconds <= 0) {
      this.clearWorkTimer();
      return;
    }

    const nextElapsed = Math.min(targetSeconds, this.workGuideElapsedSeconds() + 1);
    this.workGuideElapsedSeconds.set(nextElapsed);
    this.workGuideRemainingSeconds.set(Math.max(0, targetSeconds - nextElapsed));
    this.updateGuidedRepCount(nextElapsed);

    if (nextElapsed >= targetSeconds) {
      this.clearWorkTimer(false);
      this.recordGuidedSet(true);
    }
  }

  private updateGuidedRepCount(elapsedSeconds: number): void {
    const targetReps = this.currentPlanExercise()?.targetReps ?? 0;
    if (this.isTimedTarget() || targetReps <= 0) {
      this.guidedRepCount.set(0);
      return;
    }
    const completedReps = Math.min(targetReps, Math.floor(elapsedSeconds / this.workGuideTempoSecondsPerRep()));
    this.guidedRepCount.set(completedReps);
  }

  private recordGuidedSet(fullTarget: boolean): void {
    const session = this.live.session();
    const log = this.currentLog();
    const target = this.currentPlanExercise();
    const setNumber = this.currentSetNumber();
    if (!session?.sessionId || !log?.exerciseLogId || !target || !this.canRecordWorkSet()) {
      this.clearWorkTimer();
      return;
    }

    const elapsedSeconds = this.workGuideElapsedSeconds();
    const recordedDurationSeconds = elapsedSeconds > 0 ? Math.round(elapsedSeconds) : null;
    const reps = this.guidedSetReps(fullTarget, target);
    this.restCompleteCue.set(false);
    this.savingSet.set(true);
    this.live.recordSet(session.sessionId, log.exerciseLogId, setNumber, {
      reps,
      weightKg: target.targetWeightKg ?? null,
      durationSeconds: recordedDurationSeconds,
      distanceKm: target.targetDistanceKm ?? null,
      restSeconds: target.restSeconds ?? null,
      perceivedExertion: null,
      notes: null
    }).subscribe({
      next: () => {
        this.triggerSetCompleteCue();
        this.beginRestOrAdvance(target.restSeconds ?? 0);
      },
      error: () => {
        this.toast.error('Unable to save this set. Please retry.');
        this.savingSet.set(false);
      },
      complete: () => this.savingSet.set(false)
    });
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
    const exercises = this.activePlanExercises();
    if (!log || !exercises.length) {
      return null;
    }
    return exercises.find((exercise) => exercise.exerciseId === log.exerciseId)
      ?? exercises.find((exercise) => exercise.sequence === log.sequence)
      ?? null;
  }

  private activePlanExercises(): WorkoutPlanExercise[] {
    this.activePlanRevision();
    return this.activePlan?.exercises ?? [];
  }

  private workGuideTempoSecondsPerRep(): number {
    return this.workGuideActive() ? this.activeTempoSecondsPerRep() : this.currentTempoSecondsPerRep();
  }

  private tempoForExerciseType(exerciseType: string | null | undefined): number {
    switch (exerciseType) {
      case 'MOBILITY':
        return 4;
      case 'CARDIO':
      case 'SPORT':
        return 2.5;
      case 'STRENGTH':
      default:
        return this.defaultTempoSecondsPerRep;
    }
  }

  private initialExerciseIndex(): number {
    if (!this.initialExerciseId) {
      return 0;
    }
    const index = this.orderedLogs().findIndex((log) => log.exerciseId === this.initialExerciseId);
    return index >= 0 ? index : 0;
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

  private clearWorkTimer(reset = true): void {
    if (this.workTimerId) {
      clearInterval(this.workTimerId);
      this.workTimerId = null;
    }
    this.workGuideActive.set(false);
    if (reset) {
      this.activeTempoSecondsPerRep.set(this.currentTempoSecondsPerRep());
      this.workGuideElapsedSeconds.set(0);
      this.workGuideRemainingSeconds.set(0);
      this.guidedRepCount.set(0);
    }
  }

  private detailMediaFrames(): string[] {
    return [...(this.currentDetail()?.images ?? [])]
      .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER))
      .map((image) => image.url)
      .filter((url): url is string => Boolean(url));
  }

  private fallbackMediaFrame(): string | null {
    const target = this.currentPlanExercise();
    const log = this.currentLog();
    return target?.images?.[0]
      ?? target?.animationUrl
      ?? log?.images?.[0]
      ?? log?.animationUrl
      ?? null;
  }

  private fallbackMediaFrames(): string[] {
    const fallbackFrame = this.fallbackMediaFrame();
    return fallbackFrame ? [fallbackFrame] : [];
  }

  private guidedSetReps(fullTarget: boolean, target: WorkoutPlanExercise): number | null {
    if (this.isTimedTarget()) {
      return null;
    }
    return fullTarget ? target.targetReps ?? null : this.guidedRepCount();
  }

  private resetMediaForExercise(exerciseId = ''): void {
    if (this.currentMediaExerciseId === exerciseId) {
      return;
    }
    this.currentMediaExerciseId = exerciseId;
    this.mediaFrameIndex.set(0);
    this.failedFrameUrls.set(new Set());
    this.clearMediaTimer();
  }

  private preloadMediaFrames(detail: ExerciseDetail | null): void {
    if (!detail || typeof Image === 'undefined') {
      return;
    }
    [...(detail.images ?? [])]
      .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER))
      .forEach((frame) => {
        if (!frame.url) {
          return;
        }
        const image = new Image();
        image.src = frame.url;
      });
  }

  private startMediaTimer(): void {
    if (this.mediaTimerId) {
      return;
    }
    this.mediaTimerId = setInterval(() => {
      if (this.live.paused() || this.mediaFrames().length <= 1) {
        this.clearMediaTimer();
        return;
      }
      this.mediaFrameIndex.update((index) => index + 1);
    }, 900);
  }

  private clearMediaTimer(): void {
    if (this.mediaTimerId) {
      clearInterval(this.mediaTimerId);
      this.mediaTimerId = null;
    }
  }

  private triggerSetCompleteCue(): void {
    this.setCompleteCue.set(true);
    this.liveAnnouncement.set('Set complete');
    if (this.setCueTimerId) {
      clearTimeout(this.setCueTimerId);
    }
    this.setCueTimerId = setTimeout(() => {
      this.setCompleteCue.set(false);
      this.setCueTimerId = null;
    }, 1000);
  }

  private triggerRestCompleteCue(): void {
    this.restCompleteCue.set(true);
    this.liveAnnouncement.set('Rest over - next set');
    if (this.restCueTimerId) {
      clearTimeout(this.restCueTimerId);
    }
    this.restCueTimerId = setTimeout(() => {
      this.restCompleteCue.set(false);
      this.restCueTimerId = null;
    }, 800);
  }

  private showWorkoutCelebration(
    session: WorkoutSessionDetail,
    summary: Omit<WorkoutCelebrationSummary, 'session'>
  ): void {
    this.liveAnnouncement.set('Workout complete, great work!');
    this.celebrationSummary.set({
      ...summary,
      session
    });
    this.showCelebration.set(true);
  }

  continueAfterCelebration(): void {
    const session = this.celebrationSummary()?.session;
    this.showCelebration.set(false);
    if (session) {
      this.completed.emit(session);
    }
  }

  private clearCueTimers(): void {
    if (this.setCueTimerId) {
      clearTimeout(this.setCueTimerId);
      this.setCueTimerId = null;
    }
    if (this.restCueTimerId) {
      clearTimeout(this.restCueTimerId);
      this.restCueTimerId = null;
    }
  }

  private readReducedMotionPreference(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
