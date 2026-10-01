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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { PlayerConfirmComponent } from './player-confirm.component';
import { PlayerCueComponent } from './player-cue.component';
import { PlayerFooterComponent } from './player-footer.component';
import { PlayerRingComponent } from './player-ring.component';
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
  isOpenSet,
  resolveExerciseSets,
  targetLine
} from './player-targets';
import { restCoachLine, restCoachQuestion } from './rest-coach';
import { SpeechService } from './speech.service';
import { StageExercise } from './stage-exercise';
import { StepCarouselComponent } from './step-carousel.component';
import { fullGuideSteps, guideSteps } from './guide-steps';
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
  /** The short steps, for the carousel read at a glance during a set. */
  steps: string[];
  /** The original instructions in full, for the guide. */
  fullSteps: string[];
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
    PlayerRingComponent,
    PlayerFooterComponent,
    PlayerConfirmComponent,
    PlayerCueComponent,
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
  readonly savingSet = signal(false);
  readonly ending = signal(false);
  readonly allTargetsComplete = signal(false);
  readonly mediaFrameIndex = signal(0);
  readonly failedFrameUrls = signal<Set<string>>(new Set());
  readonly currentDetail = signal<ExerciseDetail | null>(null);
  readonly detailsById = signal<ReadonlyMap<string, ExerciseDetail | null>>(new Map());
  readonly countdownActive = signal(false);
  readonly setCompleteCue = signal(false);
  readonly restCompleteCue = signal(false);
  readonly showCelebration = signal(false);
  readonly celebrationSummary = signal<WorkoutCelebrationSummary | null>(null);
  readonly liveAnnouncement = signal('');
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

  private mediaTimerId: ReturnType<typeof setInterval> | null = null;
  private setCueTimerId: ReturnType<typeof setTimeout> | null = null;
  private restCueTimerId: ReturnType<typeof setTimeout> | null = null;
  private readonly activePlanRevision = signal(0);
  private readonly defaultTempoSecondsPerRep = 3;
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
  /** The run of the live service (the set that is running, or its rest) when it is the one on screen. */
  private readonly runHere = computed(() => {
    const run = this.live.run();
    const log = this.currentLog();
    return run && log && run.exerciseLogId === log.exerciseLogId && run.setNumber === this.currentSetNumber() ? run : null;
  });
  readonly restRemainingSeconds = computed(() => (this.runHere()?.phase === 'rest' ? this.live.restRemainingSeconds() : 0));
  readonly restTotalSeconds = computed(() => this.runHere()?.restTotalSeconds ?? 0);
  readonly workGuideActive = computed(() => {
    const run = this.runHere();
    return run?.phase === 'active' && run.kind === 'timed';
  });
  readonly workGuideElapsedSeconds = computed(() => (this.workGuideActive() ? this.live.runElapsedSeconds() : 0));
  readonly workGuideRemainingSeconds = computed(() => (this.workGuideActive() ? this.live.runRemainingSeconds() : 0));
  /** A counted set that was started: the countdown is over and the set is running. */
  readonly setActive = computed(() => {
    const run = this.runHere();
    return run?.phase === 'active' && run.kind === 'counted';
  });
  readonly setElapsedSeconds = computed(() => (this.setActive() ? this.live.runElapsedSeconds() : 0));
  /** The ring of a counted set: the reps it has reached at the tempo of the exercise. */
  readonly ringReps = computed(() => (this.setActive() ? this.live.runReps() : 0));
  readonly ringTarget = computed(() => this.runHere()?.targetReps ?? 0);
  readonly ringFull = computed(() => this.ringTarget() > 0 && this.ringReps() >= this.ringTarget());
  readonly ringShare = computed(() => (this.ringTarget() > 0 ? this.ringReps() / this.ringTarget() : 0));
  readonly ringLabel = computed(
    () => `${this.ringReps()} of ${this.ringTarget()} reps, set time ${this.setClock()}`
  );
  /** Saving a set, by a button here or by the clock of a timed set reaching zero. */
  readonly saving = computed(() => this.savingSet() || this.live.recording());
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
    return (target.durationSeconds ?? 0) > 0 ? Math.max(1, target.durationSeconds ?? 0) : 0;
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
  readonly timedFigure = computed(() => this.formatClock(this.workGuideRemainingSeconds()));
  readonly timedLabel = computed(() => `${this.formatClock(this.workGuideRemainingSeconds())} left`);
  /** How long the counted set has lasted, as mm:ss. */
  readonly setClock = computed(() => this.formatClock(this.setElapsedSeconds()));
  /** Nothing turns by itself while the workout is paused or the guide is open. */
  readonly holdSteps = computed(() => this.live.paused() || this.guideOpen());
  readonly guideInline = computed(() => this.guideOpen() && !this.guideAsDialog());
  readonly guideBackLabel = computed(() =>
    this.stage() === 'rest' ? 'Back to the rest' : `Back to set ${this.currentSetNumber()}`
  );

  /** A timed set that ended or a rest that ended while this screen is mounted, with or without anyone looking. */
  private readonly runEventsSubscription = this.live.runEvents.pipe(takeUntilDestroyed()).subscribe((event) => {
    if (event.kind === 'recorded') {
      this.stopReading();
      this.triggerSetCompleteCue();
      if (!event.restStarted) {
        this.advanceTarget();
      }
      return;
    }
    this.triggerRestCompleteCue();
    this.advanceTarget();
  });

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

  private lastStage: PlayerStage | null = null;
  /** After the screen changes, focus goes to the primary button of the new one. */
  private readonly focusEffect = effect(() => {
    const stage = this.stage();
    untracked(() => {
      const previous = this.lastStage;
      this.lastStage = stage;
      if (previous && previous !== stage) {
        afterNextRender(() => this.focusPrimary(), { injector: this.injector });
      }
    });
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activePlan']) {
      this.activePlanRevision.update((value) => value + 1);
      this.countdownActive.set(false);
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
      // A set that is running (or its rest) keeps its place: the screen opens on it, wherever it was left.
      const run = this.live.run();
      const runIndex = run && run.sessionId === this.session.sessionId
        ? this.orderedLogs().findIndex((log) => log.exerciseLogId === run.exerciseLogId)
        : -1;
      const index = runIndex >= 0 ? runIndex : this.initialExerciseIndex();
      this.currentExerciseIndex.set(index);
      this.currentSetNumber.set(
        runIndex >= 0 && run ? run.setNumber : (this.initialSetNumber ?? this.nextTargetSetNumber(this.orderedLogs()[index] ?? null))
      );
      this.allTargetsComplete.set(this.allDoneOnOpen);
      this.countdownActive.set(false);
      this.stopReading();
      this.guideOpen.set(false);
      this.confirm.set(null);
    }
  }

  ngOnDestroy(): void {
    this.clearMediaTimer();
    this.clearCueTimers();
    this.stopReading();
  }

  completeCurrentSet(): void {
    const session = this.live.session();
    const log = this.currentLog();
    const target = this.currentTarget();
    const setNumber = this.currentSetNumber();
    if (!session?.sessionId || !log?.exerciseLogId || !this.live.canWrite() || this.saving() || this.restRemainingSeconds() > 0) {
      return;
    }

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
    if (!session?.sessionId || !log?.exerciseLogId || !this.live.canWrite() || this.saving() || this.restRemainingSeconds() > 0) {
      return;
    }
    this.countdownActive.set(false);
    this.live.clearRun();
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
    this.countdownActive.set(false);
    this.live.clearRun();
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

  /** "Start set" and "Start timer": the countdown comes first, then the set begins. */
  startSet(): void {
    if (!this.canRecordWorkSet() || (this.isTimedTarget() && this.targetWorkSeconds() <= 0)) {
      return;
    }
    this.restCompleteCue.set(false);
    this.countdownActive.set(true);
  }

  /** The countdown reached zero or was skipped: the set begins, a timed one with its timer, a counted one with its ring. */
  onCountdownStarted(): void {
    this.countdownActive.set(false);
    this.startGuidedSet();
  }

  /** The primary button of the set screen: it starts the set, and completes it once it is running. */
  onPrimary(): void {
    if (this.setActive()) {
      this.completeCurrentSet();
      return;
    }
    this.startSet();
  }

  /** The set starts running in the live service, which keeps its clock whether or not this screen is open. */
  startGuidedSet(): void {
    const session = this.live.session();
    const log = this.currentLog();
    if (!session?.sessionId || !log?.exerciseLogId || !this.canRecordWorkSet()) {
      return;
    }
    const target = this.currentTarget();
    const timed = this.isTimedTarget();
    if (timed && this.targetWorkSeconds() <= 0) {
      return;
    }
    this.restCompleteCue.set(false);
    this.live.startRun({
      sessionId: session.sessionId,
      exerciseLogId: log.exerciseLogId,
      setNumber: this.currentSetNumber(),
      exerciseName: log.exerciseNameSnapshot,
      kind: timed ? 'timed' : 'counted',
      targetSeconds: timed ? this.targetWorkSeconds() : 0,
      targetReps: timed ? 0 : (target?.reps ?? 0),
      tempoSeconds: this.currentTempoSecondsPerRep(),
      weightKg: target?.weightKg ?? null,
      distanceKm: target?.distanceKm ?? null,
      restSeconds: target?.restSeconds ?? null,
      restAfterSeconds: this.isLastTarget() ? 0 : (target?.restSeconds ?? 0)
    });
  }

  /** "Stop and save" on a timed set: what has run so far is recorded. */
  stopGuidedSet(): void {
    if (!this.workGuideActive()) {
      return;
    }
    this.live.finishTimedRun();
  }

  skipRest(): void {
    if (this.restRemainingSeconds() <= 0) {
      return;
    }
    this.live.clearRun();
    this.restCompleteCue.set(false);
    this.advanceTarget();
  }

  addRestSeconds(): void {
    if (this.restRemainingSeconds() > 0) {
      this.live.extendRest(15);
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
    this.stopReading();
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

  /** Only a screen that lost the focus when it was replaced gets it back; the footer and the dialogs keep theirs. */
  private focusPrimary(): void {
    if (typeof document === 'undefined' || this.guideOpen()) {
      return;
    }
    const active = document.activeElement;
    if (active && active !== document.body) {
      return;
    }
    this.host.nativeElement.querySelector<HTMLElement>('.stage-wrap [data-primary]:not(:disabled)')?.focus({ preventScroll: true });
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
    const instructions = this.instructionsOf(detail);
    return {
      name: log?.exerciseNameSnapshot ?? 'Exercise',
      imageUrl,
      alt: log ? this.mediaAlt(log) : 'Exercise movement reference',
      initial: this.mediaInitial(log),
      chips: this.chipsOf(detail),
      steps: guideSteps({ shortSteps: detail?.shortSteps, instructions }),
      fullSteps: fullGuideSteps({ shortSteps: detail?.shortSteps, instructions }),
      description: detail?.description?.trim() ?? '',
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
    const session = this.live.session();
    const log = this.currentLog();
    if (restSeconds <= 0 || this.isLastTarget() || !session?.sessionId || !log) {
      this.live.clearRun();
      this.advanceTarget();
      return;
    }
    // The rest is the live service's: it counts down by the wall clock and ends on its own.
    this.live.beginRest(
      {
        sessionId: session.sessionId,
        exerciseLogId: log.exerciseLogId,
        setNumber: this.currentSetNumber(),
        exerciseName: log.exerciseNameSnapshot
      },
      restSeconds
    );
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

  /** The next set that is still to do in this exercise, else the next exercise that has one. */
  private advanceTarget(): void {
    const current = this.currentSetNumber();
    const next = this.currentSets().find((set) => set.setNumber > current && !set.logged && !set.skipped);
    if (next) {
      this.currentSetNumber.set(next.setNumber);
      return;
    }
    this.moveToNextExercise();
  }

  /** Goes to the next exercise that still has an open set; none left means the plan is done. */
  private moveToNextExercise(): void {
    const logs = this.orderedLogs();
    for (let index = this.currentExerciseIndex() + 1; index < logs.length; index++) {
      const sets = this.setsByLog().get(logs[index].exerciseLogId) ?? [];
      if (sets.some((set) => !set.logged && !set.skipped)) {
        this.currentExerciseIndex.set(index);
        this.currentSetNumber.set(this.nextTargetSetNumber(logs[index]));
        return;
      }
    }
    this.allTargetsComplete.set(true);
  }

  private canRecordWorkSet(): boolean {
    const session = this.live.session();
    const log = this.currentLog();
    return !!session?.sessionId
      && !!log?.exerciseLogId
      && this.live.canWrite()
      && !this.saving()
      && this.restRemainingSeconds() <= 0
      && !this.allTargetsComplete();
  }

  private isLastTarget(): boolean {
    return this.currentSetNumber() >= this.targetSets()
      && this.currentExerciseIndex() >= this.orderedLogs().length - 1;
  }

  /** The first set of the exercise that is neither done nor skipped; past the last one when none is. */
  private nextTargetSetNumber(log: WorkoutExerciseLog | null): number {
    const sets = (log && this.setsByLog().get(log.exerciseLogId)) || [];
    const open = sets.find((set) => !set.logged && !set.skipped);
    if (open) {
      return open.setNumber;
    }
    const passed = log?.sets.filter((set) => !isOpenSet(set)).map((set) => set.setNumber) ?? [];
    return Math.max(0, ...passed) + 1;
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
