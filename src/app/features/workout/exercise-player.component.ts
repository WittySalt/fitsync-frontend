import {
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { concatMap, from, last } from 'rxjs';

import { CoachStore } from '../../core/coach/coach.store';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  ExerciseDetail,
  WorkoutExerciseLog,
  WorkoutPlan,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { ExerciseGuideComponent } from './exercise-guide.component';
import { ExercisePictureComponent } from './exercise-picture.component';
import { PlayerFooterComponent } from './player-footer.component';
import { PlayerRestComponent } from './player-rest.component';
import { PlayerSetListComponent } from './player-set-list.component';
import { PlayerStageComponent } from './player-stage.component';
import { PlayerStepperComponent } from './player-stepper.component';
import { PlayerTimerStageComponent } from './player-timer-stage.component';
import { PlayerTopStripComponent } from './player-top-strip.component';
import {
  PlayerSet,
  SetTarget,
  findPlanExercise,
  formatTargetDuration,
  resolveExerciseSets,
  targetLine
} from './player-targets';
import { restCoachLine, restCoachQuestion } from './rest-coach';
import { SpeechService } from './speech.service';
import { StageExercise } from './stage-exercise';
import { StepCarouselComponent } from './step-carousel.component';
import { guideSteps } from './guide-steps';
import { WorkoutCelebrationComponent, WorkoutCelebrationSummary } from './workout-celebration.component';
import { WorkoutLiveService } from './workout-live.service';
import { WorkoutModalComponent } from './workout-modal.component';

/** Container width from which the guide opens in a dialog and the screen has two columns. */
const WIDE_PLAYER_PX = 720;

type PlayerStage = 'set' | 'countdown' | 'timed' | 'rest';

/** What the guide shows of one exercise. */
interface GuideSubject {
  name: string;
  imageUrl: string | null;
  alt: string;
  initial: string;
  chips: string[];
  steps: string[];
  description: string;
  videoUrl: string | null;
}

/** The set or the exercise that follows the current set. */
interface UpNext {
  kind: 'set' | 'exercise';
  exerciseIndex: number;
  log: WorkoutExerciseLog;
  setNumber: number;
  total: number;
  target: SetTarget | null;
}

@Component({
  selector: 'app-exercise-player',
  imports: [
    WorkoutCelebrationComponent,
    WorkoutModalComponent,
    PlayerSetListComponent,
    PlayerTopStripComponent,
    PlayerStageComponent,
    PlayerTimerStageComponent,
    PlayerRestComponent,
    PlayerFooterComponent,
    PlayerStepperComponent,
    ExercisePictureComponent,
    ExerciseGuideComponent,
    StepCarouselComponent
  ],
  templateUrl: './exercise-player.component.html',
  styleUrl: './exercise-player.component.scss'
})
export class ExercisePlayerComponent implements OnChanges, OnDestroy {
  private readonly dataService = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);
  private readonly speech = inject(SpeechService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly live = inject(WorkoutLiveService);
  private readonly defaultTempoSecondsPerRep = 3;

  @Input({ required: true }) session: WorkoutSessionDetail | null = null;
  @Input({ required: true }) activePlan: WorkoutPlan | null = null;
  @Input() initialExerciseId: string | null = null;
  /** The set to start on, when the workout is picked up where it was left. */
  @Input() initialSetNumber: number | null = null;
  /** Every set was already done, so the screen opens on the last exercise with Finish as the next step. */
  @Input() allDoneOnOpen = false;

  @Output() completed = new EventEmitter<WorkoutSessionDetail>();
  @Output() cancelled = new EventEmitter<WorkoutSessionDetail>();
  @Output() minimise = new EventEmitter<void>();

  readonly currentExerciseIndex = signal(0);
  readonly currentSetNumber = signal(1);
  readonly restRemainingSeconds = signal(0);
  readonly restTotalSeconds = signal(0);
  readonly savingSet = signal(false);
  readonly ending = signal(false);
  readonly allTargetsComplete = signal(false);
  readonly mediaFrameIndex = signal(0);
  readonly failedFrameUrls = signal<Set<string>>(new Set());
  readonly currentDetail = signal<ExerciseDetail | null>(null);
  readonly detailsById = signal<ReadonlyMap<string, ExerciseDetail | null>>(new Map());
  readonly workGuideActive = signal(false);
  readonly workGuideElapsedSeconds = signal(0);
  readonly workGuideRemainingSeconds = signal(0);
  readonly guidedRepCount = signal(0);
  readonly countdownActive = signal(false);
  readonly setCompleteCue = signal(false);
  readonly restCompleteCue = signal(false);
  readonly showCelebration = signal(false);
  readonly celebrationSummary = signal<WorkoutCelebrationSummary | null>(null);
  readonly liveAnnouncement = signal('');
  readonly activeTempoSecondsPerRep = signal(this.defaultTempoSecondsPerRep);
  readonly prefersReducedMotion = this.readReducedMotionPreference();

  /** The step the carousel is on, and whether the steps are being read aloud. */
  readonly stepIndex = signal(0);
  readonly readAloud = signal(false);
  readonly guideOpen = signal(false);
  /** Wide screens show the guide in a dialog, a phone in a full view inside the screen. */
  readonly guideAsDialog = signal(false);
  /** The question asked before something is ended: finishing with sets open, or discarding. */
  readonly confirm = signal<'finish' | 'discard' | null>(null);

  /** What the person has dialled in for the current set; it starts from the target. */
  readonly repsValue = signal(0);
  readonly weightValue = signal(0);
  readonly durationValue = signal(0);

  private restTimerId: ReturnType<typeof setInterval> | null = null;
  private workTimerId: ReturnType<typeof setInterval> | null = null;
  private mediaTimerId: ReturnType<typeof setInterval> | null = null;
  private setCueTimerId: ReturnType<typeof setTimeout> | null = null;
  private restCueTimerId: ReturnType<typeof setTimeout> | null = null;
  private readonly activePlanRevision = signal(0);
  private readonly detailCache = new Map<string, ExerciseDetail | null>();
  private readonly detailPending = new Set<string>();
  private currentMediaExerciseId = '';
  private guideOpener: HTMLElement | null = null;

  readonly orderedLogs = computed(() =>
    [...(this.live.session()?.exercises ?? [])].sort((a, b) => a.sequence - b.sequence)
  );

  readonly currentLog = computed(() => this.orderedLogs()[this.currentExerciseIndex()] ?? null);
  /** The sets of every exercise: the session's own rows first, the plan only where there are none. */
  readonly setsByLog = computed(() => {
    this.activePlanRevision();
    const planDayId = this.live.session()?.planDayId ?? null;
    const plan = this.activePlan;
    return new Map<string, PlayerSet[]>(
      this.orderedLogs().map((log) => [log.exerciseLogId, resolveExerciseSets(log, planDayId, plan)])
    );
  });
  readonly currentSets = computed<PlayerSet[]>(() => {
    const log = this.currentLog();
    return (log && this.setsByLog().get(log.exerciseLogId)) || [];
  });
  readonly currentTarget = computed<SetTarget | null>(
    () => this.currentSets().find((set) => set.setNumber === this.currentSetNumber())?.target ?? null
  );
  readonly currentTargetLine = computed(() => targetLine(this.currentTarget()));
  readonly currentPlanExercise = computed(() => {
    this.activePlanRevision();
    return findPlanExercise(this.currentLog(), this.live.session()?.planDayId, this.activePlan);
  });
  readonly currentExerciseId = computed(() => this.currentLog()?.exerciseId || this.currentPlanExercise()?.exerciseId || '');
  readonly currentMediaIdentity = computed(() =>
    this.currentExerciseId() || this.currentLog()?.exerciseLogId || this.currentLog()?.exerciseNameSnapshot || ''
  );
  readonly targetSets = computed(() => Math.max(1, this.currentSets().length));
  readonly isTimedTarget = computed(() => (this.currentTarget()?.durationSeconds ?? 0) > 0);
  readonly currentTempoSecondsPerRep = computed(() => this.tempoForExerciseType(this.currentDetail()?.exerciseType));
  readonly targetWorkSeconds = computed(() => {
    const target = this.currentTarget();
    if (!target) {
      return 0;
    }
    if ((target.durationSeconds ?? 0) > 0) {
      return Math.max(1, target.durationSeconds ?? 0);
    }
    if ((target.reps ?? 0) > 0) {
      return Math.max(1, target.reps ?? 0) * this.workGuideTempoSecondsPerRep();
    }
    return 0;
  });
  /** How much of the timed set is left, from 1 down to 0. */
  readonly workGuideShare = computed(() => {
    const targetSeconds = this.targetWorkSeconds();
    return targetSeconds > 0 ? 1 - Math.min(1, this.workGuideElapsedSeconds() / targetSeconds) : 1;
  });
  readonly totalTargetSets = computed(() =>
    Array.from(this.setsByLog().values()).reduce((sum, sets) => sum + sets.length, 0)
  );
  readonly completedSetCount = computed(() =>
    this.orderedLogs().reduce((sum, log) => sum + log.sets.filter((set) => set.logged).length, 0)
  );
  /** Sets that are neither done nor skipped, in the whole workout. */
  readonly openSetCount = computed(() =>
    Array.from(this.setsByLog().values()).reduce(
      (sum, sets) => sum + sets.filter((set) => !set.logged && !set.skipped).length,
      0
    )
  );
  /** One share for each exercise, for the segments of the top strip. */
  readonly segments = computed(() =>
    this.orderedLogs().map((log) => {
      const planned = this.setsByLog().get(log.exerciseLogId)?.length ?? Math.max(1, log.sets.length);
      const done = log.sets.filter((set) => set.logged).length;
      return planned ? Math.min(1, done / planned) : 0;
    })
  );
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

  readonly stage = computed<PlayerStage>(() => {
    if (this.restRemainingSeconds() > 0) {
      return 'rest';
    }
    if (this.countdownActive()) {
      return 'countdown';
    }
    return this.workGuideActive() ? 'timed' : 'set';
  });

  readonly hasRepsStepper = computed(() => (this.currentTarget()?.reps ?? 0) > 0);
  readonly hasWeightStepper = computed(() => this.hasRepsStepper() && (this.currentTarget()?.weightKg ?? 0) > 0);

  /** The next set of this exercise, or the first open set of the next exercise. */
  readonly upNext = computed<UpNext | null>(() => {
    const log = this.currentLog();
    if (!log) {
      return null;
    }
    const setNumber = this.currentSetNumber();
    if (setNumber < this.targetSets()) {
      const target = this.currentSets().find((set) => set.setNumber === setNumber + 1)?.target ?? null;
      return { kind: 'set', exerciseIndex: this.currentExerciseIndex(), log, setNumber: setNumber + 1, total: this.targetSets(), target };
    }
    const exerciseIndex = this.currentExerciseIndex() + 1;
    const nextLog = this.orderedLogs()[exerciseIndex];
    if (!nextLog) {
      return null;
    }
    const sets = this.setsByLog().get(nextLog.exerciseLogId) ?? [];
    const first = sets.find((set) => !set.logged && !set.skipped) ?? sets[0] ?? null;
    return {
      kind: 'exercise',
      exerciseIndex,
      log: nextLog,
      setNumber: first?.setNumber ?? 1,
      total: Math.max(1, sets.length),
      target: first?.target ?? null
    };
  });

  /** "Set 3 of 3 · 10 reps · 20 kg", the line that says what comes next. */
  readonly upNextLine = computed(() => this.setLine(this.upNext()));
  /** The line under the set list on a set of reps: what is next, and the rest before it. */
  readonly nextLine = computed(() => {
    const up = this.upNext();
    const line = this.setLine(up);
    if (!up || !line) {
      return '';
    }
    const rest = this.currentTarget()?.restSeconds ?? 0;
    const text = up.kind === 'exercise' ? `${up.log.exerciseNameSnapshot} · ${line}` : line;
    return rest > 0 ? `${text}, after ${formatTargetDuration(rest)} of rest` : text;
  });
  readonly restShowsNext = computed(() => this.upNext()?.kind === 'exercise');

  readonly currentSubject = computed(() =>
    this.subjectFor(this.currentLog(), this.currentDetail(), this.currentMediaUrl())
  );
  readonly nextSubject = computed(() => {
    const up = this.upNext();
    if (up?.kind !== 'exercise') {
      return null;
    }
    const detail = this.detailsById().get(up.log.exerciseId) ?? null;
    return this.subjectFor(up.log, detail, this.firstFrameOf(up.log, detail));
  });
  /** The exercise the guide is about: what is next while the rest shows another exercise. */
  readonly guideSubject = computed(() =>
    (this.stage() === 'rest' ? this.nextSubject() : null) ?? this.currentSubject()
  );
  readonly currentCard = computed<StageExercise>(() => ({
    ...this.cardOf(this.currentSubject()),
    caption: this.currentTargetLine(),
    frameCount: this.mediaFrames().length,
    frame: this.mediaFrames().length ? this.mediaFrameIndex() % this.mediaFrames().length : 0
  }));
  readonly restCard = computed<StageExercise>(() => {
    const next = this.nextSubject();
    return next ? this.cardOf(next) : this.currentCard();
  });
  readonly restShare = computed(() => {
    const remaining = this.restRemainingSeconds();
    return remaining > 0 ? Math.min(1, remaining / Math.max(this.restTotalSeconds(), remaining)) : 0;
  });
  readonly restKicker = computed(() => {
    const up = this.upNext();
    return up?.kind === 'exercise' ? `Next · exercise ${up.exerciseIndex + 1} of ${this.orderedLogs().length}` : 'Next';
  });
  readonly coachLine = computed(() => {
    const open = this.currentSets().filter((set) => !set.logged && !set.skipped).length;
    return restCoachLine(this.currentLog(), open, this.openSetCount());
  });
  /** The countdown and the timer name the set that is about to start. */
  readonly timedLine = computed(() => this.setLine({
    setNumber: this.currentSetNumber(),
    total: this.targetSets(),
    target: this.currentTarget()
  }));
  readonly timedFigure = computed(() =>
    this.isTimedTarget()
      ? this.formatClock(this.workGuideRemainingSeconds())
      : `${this.guidedRepCount()} / ${this.currentTarget()?.reps ?? 0}`
  );
  readonly timedLabel = computed(() =>
    this.isTimedTarget()
      ? `${this.formatClock(this.workGuideRemainingSeconds())} left`
      : `${this.guidedRepCount()} of ${this.currentTarget()?.reps ?? 0} reps`
  );
  /** Nothing turns by itself while the workout is paused or the guide is open and not being read. */
  readonly holdSteps = computed(() => this.live.paused() || (this.guideOpen() && !this.readAloud()));
  readonly guideInline = computed(() => this.guideOpen() && !this.guideAsDialog());
  readonly guideBackLabel = computed(() =>
    this.stage() === 'rest' ? 'Back to the rest' : `Back to set ${this.currentSetNumber()}`
  );

  private readonly detailEffect = effect(() => {
    const exerciseId = this.currentExerciseId();
    this.resetMediaForExercise(this.currentMediaIdentity() ?? '');
    this.loadExerciseDetail(exerciseId);
  });

  /** The details of the exercise that follows are asked for early, so the rest screen can show them. */
  private readonly upcomingEffect = effect(() => {
    const up = this.upNext();
    const exerciseId = up?.kind === 'exercise' ? up.log.exerciseId : '';
    if (exerciseId && !this.detailCache.has(exerciseId)) {
      this.requestDetail(exerciseId);
    }
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

  /** The steppers start from the target of the set and go back to it for the next set. */
  private readonly stepperKey = computed(() => {
    const target = this.currentTarget();
    return [
      this.currentLog()?.exerciseLogId ?? '',
      this.currentSetNumber(),
      target?.reps ?? '',
      target?.weightKg ?? '',
      target?.durationSeconds ?? ''
    ].join('|');
  });
  private readonly stepperEffect = effect(() => {
    this.stepperKey();
    untracked(() => {
      const target = this.currentTarget();
      this.repsValue.set(target?.reps ?? 0);
      this.weightValue.set(target?.weightKg ?? 0);
      this.durationValue.set(target?.durationSeconds ?? 0);
    });
  });

  /** Each new exercise or screen starts its steps from the first one. */
  private readonly stepResetEffect = effect(() => {
    this.currentExerciseIndex();
    this.stage();
    untracked(() => this.stepIndex.set(0));
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activePlan']) {
      this.activePlanRevision.update((value) => value + 1);
      this.clearWorkTimer();
    }
    const sessionChange = changes['session'];
    if (this.session && sessionChange) {
      this.live.setSession(this.session);
    }
    // The session input follows the workout as sets are recorded. The screen goes back to the start
    // position only for another workout, or when it was asked to open somewhere else.
    const otherWorkout = !!sessionChange
      && (sessionChange.firstChange || sessionChange.previousValue?.sessionId !== this.session?.sessionId);
    const moved = !!(changes['initialExerciseId'] || changes['initialSetNumber'] || changes['allDoneOnOpen']);
    if (this.session && (otherWorkout || moved)) {
      const index = this.initialExerciseIndex();
      this.currentExerciseIndex.set(index);
      this.currentSetNumber.set(this.initialSetNumber ?? this.nextTargetSetNumber(this.orderedLogs()[index] ?? null));
      this.allTargetsComplete.set(this.allDoneOnOpen);
      this.clearRestTimer();
      this.clearWorkTimer();
      this.stopReading();
      this.guideOpen.set(false);
      this.confirm.set(null);
    }
  }

  ngOnDestroy(): void {
    this.clearRestTimer();
    this.clearWorkTimer();
    this.clearMediaTimer();
    this.clearCueTimers();
    this.stopReading();
  }

  completeCurrentSet(): void {
    const session = this.live.session();
    const log = this.currentLog();
    const target = this.currentTarget();
    const setNumber = this.currentSetNumber();
    if (!session?.sessionId || !log?.exerciseLogId || !this.live.canWrite() || this.savingSet() || this.restRemainingSeconds() > 0) {
      return;
    }

    this.clearWorkTimer();
    this.restCompleteCue.set(false);
    this.savingSet.set(true);
    this.live.recordSet(session.sessionId, log.exerciseLogId, setNumber, {
      reps: this.hasRepsStepper() ? this.repsValue() : (target?.reps ?? null),
      weightKg: this.hasWeightStepper() ? this.weightValue() : (target?.weightKg ?? null),
      durationSeconds: this.isTimedTarget() ? this.durationValue() : (target?.durationSeconds ?? null),
      distanceKm: target?.distanceKm ?? null,
      restSeconds: target?.restSeconds ?? null,
      perceivedExertion: null,
      notes: null
    }).subscribe({
      next: () => {
        this.stopReading();
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

  /** Records the current set as skipped and moves on like a done set, without a rest. */
  skipCurrentSet(): void {
    const session = this.live.session();
    const log = this.currentLog();
    if (!session?.sessionId || !log?.exerciseLogId || !this.live.canWrite() || this.savingSet() || this.restRemainingSeconds() > 0) {
      return;
    }
    this.clearWorkTimer();
    this.stopReading();
    this.savingSet.set(true);
    this.live.skipSet(session.sessionId, log.exerciseLogId, this.currentSetNumber()).subscribe({
      next: () => this.advanceTarget(),
      error: () => {
        this.toast.error('Unable to skip this set. Please retry.');
        this.savingSet.set(false);
      },
      complete: () => this.savingSet.set(false)
    });
  }

  /** Records every open set of the current exercise as skipped and moves to the next exercise. */
  skipCurrentExercise(): void {
    const session = this.live.session();
    const log = this.currentLog();
    if (!session?.sessionId || !log?.exerciseLogId || !this.live.canWrite() || this.savingSet()) {
      return;
    }
    const sessionId = session.sessionId;
    const exerciseLogId = log.exerciseLogId;
    const open = this.currentSets().filter((set) => !set.logged && !set.skipped).map((set) => set.setNumber);
    this.clearWorkTimer();
    this.clearRestTimer();
    this.stopReading();
    if (!open.length) {
      this.moveToNextExercise();
      return;
    }
    this.savingSet.set(true);
    from(open).pipe(
      concatMap((setNumber) => this.live.skipSet(sessionId, exerciseLogId, setNumber)),
      last()
    ).subscribe({
      next: () => this.moveToNextExercise(),
      error: () => {
        this.toast.error('Unable to skip this exercise. Please retry.');
        this.savingSet.set(false);
      },
      complete: () => this.savingSet.set(false)
    });
  }

  /** "Start timer": the three second countdown first, then the set. */
  startTimedSet(): void {
    if (!this.canRecordWorkSet() || this.targetWorkSeconds() <= 0) {
      return;
    }
    this.clearWorkTimer();
    this.restCompleteCue.set(false);
    this.countdownActive.set(true);
  }

  onCountdownStarted(): void {
    this.countdownActive.set(false);
    this.startGuidedSet();
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
    this.startCountdownIfTimed();
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

  onMinimise(): void {
    this.stopReading();
    this.minimise.emit();
  }

  /** The Finish button: asks once when sets are still open, otherwise finishes. */
  requestFinish(): void {
    if (this.ending()) {
      return;
    }
    if (this.openSetCount() > 0) {
      this.confirm.set('finish');
      return;
    }
    this.finish();
  }

  finish(): void {
    if (this.ending()) {
      return;
    }
    this.confirm.set(null);
    this.stopReading();
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
          if (!this.live.nothingLoggedCancel()) {
            this.toast.info('Short workout cancelled, so it will not count toward metrics.');
          }
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

  /** Discard asks once, in the dialog; this is what the dialog's Discard button does. */
  discard(): void {
    if (this.ending()) {
      return;
    }
    this.confirm.set(null);
    this.stopReading();
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

  openGuide(): void {
    this.guideAsDialog.set(this.host.nativeElement.clientWidth >= WIDE_PLAYER_PX);
    this.guideOpener = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);
    this.guideOpen.set(true);
  }

  closeGuide(): void {
    const inline = this.guideInline();
    this.guideOpen.set(false);
    const opener = this.guideOpener;
    this.guideOpener = null;
    if (inline && opener) {
      // The screen is shown again on the next render; focus goes back to what opened the guide.
      afterNextRender(() => (opener.isConnected ? opener.focus() : undefined), { injector: this.injector });
    }
  }

  askCoach(): void {
    const coach = this.injector.get(CoachStore);
    coach.open();
    coach.ask(restCoachQuestion(this.currentLog()?.exerciseNameSnapshot ?? 'workout'));
  }

  mediaAlt(log: WorkoutExerciseLog): string {
    return `${log.exerciseNameSnapshot} movement reference`;
  }

  mediaInitial(log: WorkoutExerciseLog | null): string {
    return (log?.exerciseNameSnapshot ?? 'Exercise').trim().charAt(0).toUpperCase() || 'E';
  }

  onMediaError(): void {
    const url = this.currentMediaUrl();
    if (!url) {
      return;
    }
    this.failedFrameUrls.update((failed) => new Set(failed).add(url));
    this.mediaFrameIndex.set(0);
  }

  /** A picture that failed on the rest screen only matters to the current exercise's frames. */
  onRestImageFailed(): void {
    if (!this.restShowsNext()) {
      this.onMediaError();
    }
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

  private stopReading(): void {
    if (this.readAloud()) {
      this.speech.cancel();
      this.readAloud.set(false);
    }
  }

  /** "Set 2 of 3 · 10 reps · 20 kg"; the rest is left out, it has its own place. */
  private setLine(up: Pick<UpNext, 'setNumber' | 'total' | 'target'> | null): string {
    if (!up) {
      return '';
    }
    const values = up.target ? targetLine({ ...up.target, restSeconds: null }) : '';
    return [`Set ${up.setNumber} of ${up.total}`, values].filter(Boolean).join(' · ');
  }

  private subjectFor(log: WorkoutExerciseLog | null, detail: ExerciseDetail | null, imageUrl: string | null): GuideSubject {
    const description = detail?.description?.trim() ?? '';
    const instructions = this.instructionsOf(detail);
    return {
      name: log?.exerciseNameSnapshot ?? 'Exercise',
      imageUrl,
      alt: log ? this.mediaAlt(log) : 'Exercise movement reference',
      initial: this.mediaInitial(log),
      chips: this.chipsOf(detail),
      steps: guideSteps({ shortSteps: detail?.shortSteps, instructions }),
      description,
      videoUrl: detail?.videoUrl ?? null
    };
  }

  private cardOf(subject: GuideSubject): StageExercise {
    return {
      name: subject.name,
      imageUrl: subject.imageUrl,
      alt: subject.alt,
      initial: subject.initial,
      caption: '',
      steps: subject.steps,
      frameCount: 0,
      frame: 0
    };
  }

  /** The instructions in order, without a leading step that only repeats the description. */
  private instructionsOf(detail: ExerciseDetail | null) {
    const steps = [...(detail?.instructions ?? [])].sort(
      (a, b) => (a.stepNumber ?? Number.MAX_SAFE_INTEGER) - (b.stepNumber ?? Number.MAX_SAFE_INTEGER)
    );
    const description = detail?.description?.trim();
    return description && steps.length && steps[0].text?.trim() === description ? steps.slice(1) : steps;
  }

  private chipsOf(detail: ExerciseDetail | null): string[] {
    if (!detail) {
      return [];
    }
    return [detail.primaryMuscleGroup, ...(detail.secondaryMuscleGroups ?? []), detail.equipment, detail.difficulty]
      .filter((value): value is string => Boolean(value))
      .map((value) => this.formatLabel(value));
  }

  private firstFrameOf(log: WorkoutExerciseLog, detail: ExerciseDetail | null): string | null {
    const fromDetail = [...(detail?.images ?? [])]
      .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER))
      .map((image) => image.url)
      .find((url) => !!url);
    if (fromDetail) {
      return fromDetail;
    }
    const planned = findPlanExercise(log, this.live.session()?.planDayId, this.activePlan);
    return planned?.images?.[0] ?? planned?.animationUrl ?? log.images?.[0] ?? log.animationUrl ?? null;
  }

  private beginRestOrAdvance(restSeconds: number): void {
    this.clearWorkTimer();
    if (restSeconds <= 0 || this.isLastTarget()) {
      this.advanceTarget();
      return;
    }

    this.restRemainingSeconds.set(restSeconds);
    this.restTotalSeconds.set(restSeconds);
    this.clearRestTimer(false);
    this.restTimerId = setInterval(() => {
      this.restRemainingSeconds.update((value) => Math.max(0, value - 1));
      if (this.restRemainingSeconds() === 0) {
        this.clearRestTimer(false);
        this.triggerRestCompleteCue();
        this.advanceTarget();
        this.startCountdownIfTimed();
      }
    }, 1000);
  }

  /** When a rest ends and the next set is timed, the countdown starts by itself. */
  private startCountdownIfTimed(): void {
    if (!this.allTargetsComplete() && this.isTimedTarget() && this.canRecordWorkSet() && this.targetWorkSeconds() > 0) {
      this.countdownActive.set(true);
    }
  }

  private loadExerciseDetail(exerciseId: string | null): void {
    if (!exerciseId) {
      this.currentDetail.set(null);
      return;
    }

    if (this.detailCache.has(exerciseId)) {
      const cached = this.detailCache.get(exerciseId) ?? null;
      this.currentDetail.set(cached);
      this.preloadMediaFrames(cached);
      return;
    }

    this.currentDetail.set(null);
    this.requestDetail(exerciseId);
  }

  private requestDetail(exerciseId: string): void {
    if (this.detailPending.has(exerciseId)) {
      return;
    }
    this.detailPending.add(exerciseId);
    const remember = (detail: ExerciseDetail | null) => {
      this.detailCache.set(exerciseId, detail);
      this.detailsById.update((known) => new Map(known).set(exerciseId, detail));
      if (this.currentExerciseId() === exerciseId) {
        this.currentDetail.set(detail);
        this.preloadMediaFrames(detail);
      }
    };
    this.dataService.getExercise(exerciseId).subscribe({
      next: remember,
      error: () => remember(null),
      complete: () => this.detailPending.delete(exerciseId)
    });
  }

  private advanceTarget(): void {
    this.restRemainingSeconds.set(0);
    if (this.currentSetNumber() < this.targetSets()) {
      this.currentSetNumber.update((value) => value + 1);
      return;
    }
    this.moveToNextExercise();
  }

  private moveToNextExercise(): void {
    this.restRemainingSeconds.set(0);
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
    const targetReps = this.currentTarget()?.reps ?? 0;
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
    const target = this.currentTarget();
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
      weightKg: this.hasWeightStepper() ? this.weightValue() : (target.weightKg ?? null),
      durationSeconds: recordedDurationSeconds,
      distanceKm: target.distanceKm ?? null,
      restSeconds: target.restSeconds ?? null,
      perceivedExertion: null,
      notes: null
    }).subscribe({
      next: () => {
        this.stopReading();
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
      return this.allDoneOnOpen ? Math.max(0, this.orderedLogs().length - 1) : 0;
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
    this.countdownActive.set(false);
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

  private guidedSetReps(fullTarget: boolean, target: SetTarget): number | null {
    if (this.isTimedTarget()) {
      return null;
    }
    return fullTarget ? target.reps ?? null : this.guidedRepCount();
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
