import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Observable, Subject, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  ActiveSessionConflict,
  ActiveWorkout,
  ActiveWorkoutNextSet,
  ActiveWorkoutResume,
  StartAdHocSessionInput,
  WorkoutExerciseSetInput,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { activeSessionConflictFrom } from './active-session-conflict';
import { isOpenSet } from './player-targets';

/** Where the exercise screen opens: the exercise, the set, or the last exercise when all is done. */
export interface PlayerStart {
  exerciseId: string | null;
  setNumber: number | null;
  allDone: boolean;
}

/** A start the server refused because a workout is already in progress, kept so it can be repeated. */
export interface PendingStart {
  info: ActiveSessionConflict;
  retry: () => Observable<WorkoutSessionDetail>;
  /** What to say once the repeated start has worked. */
  message: string;
}

export const STILL_RUNNING_NOTICE =
  'Still running. It saves itself three hours after your last set, and you can edit it afterwards.';

const MIN_SAVED_SECONDS = 60;

const RUN_KEY_PREFIX = 'fitsync.workout.run.';
/** How the person runs a workout, remembered on this device: follow along, or log each set. */
const MODE_KEY = 'fitsync.workout.mode';
/** A counted set that follows along waits this long on its last rep before it is recorded. */
const LAST_REP_HOLD_MS = 1000;
/** How long the check of a set that was just done stays before the rest is shown. */
export const SET_DONE_MS = 1200;

/** Who a set run belongs to: the session, the exercise and the set. */
export interface SetRunIdentity {
  sessionId: string;
  exerciseLogId: string;
  setNumber: number;
  exerciseName: string;
}

/**
 * The set the person is working on, kept here so it survives minimising the exercise screen, a
 * route change and a reload. Elapsed time and time left are always worked out from the wall clock
 * (`Date.now()` minus the instants stored here), never from counting ticks, so a sleeping tab or a
 * throttled timer cannot make them drift. A countdown is never part of it: it is not resumed.
 */
export interface SetRun extends SetRunIdentity {
  /** "active": the set is running. "rest": the set was recorded and the rest is counting down. */
  phase: 'active' | 'rest';
  kind: 'counted' | 'timed';
  /** The wall-clock instant the active phase began. */
  startedAtMs: number;
  /** Milliseconds the workout was paused during the active phase, and when the open pause began. */
  pausedMs: number;
  pausedAtMs: number | null;
  /** A timed set: how long it lasts. A counted set: 0. */
  targetSeconds: number;
  /** A counted set: the reps asked for and the seconds a rep takes, for the ring that guides the pace. */
  targetReps: number;
  tempoSeconds: number;
  /** Follow along: the set records itself when its reps or its time are reached. */
  auto: boolean;
  /** Seconds added with "+5 sec" to a counted set, before it records itself. */
  extraSeconds: number;
  /** What a recorded timed set carries besides its time. */
  weightKg: number | null;
  distanceKm: number | null;
  restSeconds: number | null;
  /** The rest that follows the set; 0 when none follows (the last set of the workout). */
  restAfterSeconds: number;
  restEndsAtMs: number;
  restTotalSeconds: number;
}

/** What a mounted exercise screen is told when the set state moves on without it being asked to. */
export type SetRunEvent = { kind: 'recorded'; restStarted: boolean } | { kind: 'rest-ended' };

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A stored record is untrusted data: only a well-formed one becomes a run. */
function parseRun(raw: string | null): SetRun | null {
  if (!raw) {
    return null;
  }
  let value: Record<string, unknown> | null;
  try {
    value = JSON.parse(raw) as Record<string, unknown> | null;
  } catch {
    return null;
  }
  if (
    !value
    || typeof value['sessionId'] !== 'string'
    || typeof value['exerciseLogId'] !== 'string'
    || typeof value['exerciseName'] !== 'string'
    || (value['phase'] !== 'active' && value['phase'] !== 'rest')
    || (value['kind'] !== 'counted' && value['kind'] !== 'timed')
    || typeof value['setNumber'] !== 'number'
    || typeof value['startedAtMs'] !== 'number'
    || !Number.isFinite(value['setNumber'])
    || !Number.isFinite(value['startedAtMs'])
  ) {
    return null;
  }
  return {
    sessionId: value['sessionId'],
    exerciseLogId: value['exerciseLogId'],
    setNumber: value['setNumber'],
    exerciseName: value['exerciseName'],
    phase: value['phase'],
    kind: value['kind'],
    startedAtMs: value['startedAtMs'],
    pausedMs: Math.max(0, numberOr(value['pausedMs'], 0)),
    pausedAtMs: numberOrNull(value['pausedAtMs']),
    targetSeconds: Math.max(0, numberOr(value['targetSeconds'], 0)),
    targetReps: Math.max(0, numberOr(value['targetReps'], 0)),
    tempoSeconds: Math.max(1, numberOr(value['tempoSeconds'], 3)),
    auto: value['auto'] === true,
    extraSeconds: Math.max(0, numberOr(value['extraSeconds'], 0)),
    weightKg: numberOrNull(value['weightKg']),
    distanceKm: numberOrNull(value['distanceKm']),
    restSeconds: numberOrNull(value['restSeconds']),
    restAfterSeconds: Math.max(0, numberOr(value['restAfterSeconds'], 0)),
    restEndsAtMs: numberOr(value['restEndsAtMs'], 0),
    restTotalSeconds: Math.max(0, numberOr(value['restTotalSeconds'], 0))
  };
}

export const NOTHING_LOGGED_NOTICE = 'No set was logged, so this workout was not saved.';
const NOTHING_LOGGED = 'NOTHING_LOGGED';

/** The server's refusal to complete a workout that has exercises and not one logged set. */
function isNothingLogged(error: unknown): boolean {
  return error instanceof HttpErrorResponse
    && error.status === 400
    && (error.error as { code?: unknown } | null)?.code === NOTHING_LOGGED;
}

/**
 * The one workout in progress: the session, its timer, where the person left off, and every way
 * of starting or ending it. The bar, the exercise screen and the history list all read from here,
 * so a reload, a route change or a start from another tab does not lose the workout.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutLiveService {
  private readonly dataService = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly session = signal<WorkoutSessionDetail | null>(null);
  readonly paused = signal(false);
  readonly heartRate = signal<number | null>(null);
  /** Where the server said the person left off, from the last load of the active workout. */
  readonly serverResume = signal<ActiveWorkoutResume | null>(null);
  /** The person put the exercise screen away, so opening the Workout page does not bring it back. */
  readonly minimised = signal(false);
  /** The Workout page has the exercise screen on screen, so the bar stays out of the way. */
  readonly screenOpen = signal(false);
  readonly playerStart = signal<PlayerStart>({ exerciseId: null, setNumber: null, allDone: false });
  /** A start that was refused because another workout is in progress; the shared dialog shows it. */
  readonly pendingStart = signal<PendingStart | null>(null);
  /** Asks the Workout page, if it is mounted, to show the exercise screen on its Today tab. */
  readonly openRequests = new Subject<void>();
  /** A workout was ended, or a refused start went through, outside the page's own handlers. */
  readonly changedElsewhere = new Subject<WorkoutSessionDetail>();
  /** True when the last finish cancelled the workout because no set was logged. The service has
   *  already told the person, so a caller does not add a notice of its own. */
  readonly nothingLoggedCancel = signal(false);
  /** Follow along (the default) or log each set by hand; the choice is kept on this device. */
  readonly followAlong = signal(readFollowAlong());

  /** The set in progress or the rest after it; null while the next set waits to be started. */
  private readonly runState = signal<SetRun | null>(null);
  readonly run = this.runState.asReadonly();
  /** A timed set is being saved, by the screen or by the clock reaching zero. */
  readonly recording = signal(false);
  /** Each change of the set that nobody asked for on screen: a timed set that ended, a rest that ended. */
  readonly runEvents = new Subject<SetRunEvent>();
  private readonly runNow = signal(Date.now());
  private runTimerId: ReturnType<typeof setInterval> | null = null;
  /** A timed set that could not be saved waits for the person instead of trying again every second. */
  private autoSaveBlocked = false;

  private readonly nowMs = signal(Date.now());
  private timerId: ReturnType<typeof setInterval> | null = null;
  private startedAtMs = 0;
  private accumulatedMs = 0;
  /** Workouts the person has already been told about, so the notice comes once per workout. */
  private readonly noticed = new Set<string>();
  private refreshToken = 0;

  readonly elapsedSeconds = computed(() => {
    if (!this.session()) {
      return 0;
    }
    const activeMs = this.paused() ? 0 : Math.max(0, this.nowMs() - this.startedAtMs);
    return Math.floor((this.accumulatedMs + activeMs) / 1000);
  });

  /** The session while it is still being trained; null once it is completed or cancelled. */
  readonly active = computed(() => {
    const session = this.session();
    return session && (session.status === 'PLANNED' || session.status === 'IN_PROGRESS') ? session : null;
  });

  readonly elapsedLabel = computed(() => formatElapsedClock(this.elapsedSeconds()));

  /** The next open set: the first one, in exercise and set order, that is neither done nor skipped.
   *  It follows the sets as they are recorded, and falls back to the server's answer for a session
   *  whose sets the list does not carry. */
  readonly nextSet = computed<ActiveWorkoutNextSet | null>(() => {
    const session = this.active();
    if (!session) {
      return null;
    }
    const logs = [...session.exercises].sort((a, b) => a.sequence - b.sequence);
    if (logs.some((log) => log.sets.length > 0)) {
      for (const log of logs) {
        const open = [...log.sets].sort((a, b) => a.setNumber - b.setNumber).find((set) => isOpenSet(set));
        if (open) {
          return {
            exerciseLogId: log.exerciseLogId,
            exerciseId: log.exerciseId,
            exerciseName: log.exerciseNameSnapshot,
            exerciseSequence: log.sequence,
            setNumber: open.setNumber
          };
        }
      }
      return null;
    }
    return this.serverResume()?.nextSet ?? null;
  });

  /** "Goblet squat · set 2 of 3", or an empty string when the workout has no exercises. */
  readonly currentLabel = computed(() => {
    const session = this.active();
    if (!session || session.exercises.length === 0) {
      return '';
    }
    const next = this.nextSet();
    if (!next) {
      return 'All sets done';
    }
    const total = session.exercises.find((log) => log.exerciseLogId === next.exerciseLogId)?.sets.length ?? 0;
    let set = '';
    if (next.setNumber) {
      set = total >= next.setNumber ? `set ${next.setNumber} of ${total}` : `set ${next.setNumber}`;
    }
    return [next.exerciseName, set].filter(Boolean).join(' · ');
  });

  readonly estimatedCalories = computed(() => {
    const session = this.session();
    if (!session) {
      return 0;
    }
    const caloriesPerMinute = this.caloriesPerMinute(session.workoutType);
    return Math.max(0, Math.round((this.elapsedSeconds() / 60) * caloriesPerMinute));
  });

  readonly canWrite = computed(() => {
    const status = this.session()?.status;
    return status === 'PLANNED' || status === 'IN_PROGRESS';
  });

  /** Seconds the active set has run, without the time the workout was paused. */
  readonly runElapsedSeconds = computed(() => {
    const run = this.runState();
    return run && run.phase === 'active' ? Math.floor(this.activeMs(run, this.runNow()) / 1000) : 0;
  });
  /** A timed set: whole seconds left. */
  readonly runRemainingSeconds = computed(() => {
    const run = this.runState();
    return run && run.kind === 'timed' ? Math.max(0, run.targetSeconds - this.runElapsedSeconds()) : 0;
  });
  /** A counted set: the reps the ring has reached at the set's tempo, never past the target. */
  readonly runReps = computed(() => {
    const run = this.runState();
    return run && run.kind === 'counted' && run.targetReps > 0
      ? Math.min(run.targetReps, Math.floor(this.runElapsedSeconds() / run.tempoSeconds))
      : 0;
  });
  readonly restRemainingSeconds = computed(() => {
    const run = this.runState();
    return run && run.phase === 'rest' ? Math.max(0, Math.ceil((run.restEndsAtMs - this.runNow()) / 1000)) : 0;
  });
  /** What the bar says while a set or a rest is running; empty when nothing is. */
  readonly runLabel = computed(() => {
    const run = this.runState();
    if (!run) {
      return '';
    }
    if (run.phase === 'rest') {
      return `Rest ${formatElapsedClock(this.restRemainingSeconds())}`;
    }
    if (run.kind === 'timed') {
      return `${run.exerciseName} \u00b7 ${formatElapsedClock(this.runRemainingSeconds())} left`;
    }
    return run.targetReps > 0
      ? `${run.exerciseName} \u00b7 ${this.runReps()} / ${run.targetReps}`
      : `${run.exerciseName} \u00b7 ${formatElapsedClock(this.runElapsedSeconds())}`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopTimer();
      this.stopRunTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.onVisible);
      }
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisible);
    }
  }

  /** The set starts running now (the countdown is over). */
  startRun(
    input: Pick<
      SetRun,
      'kind' | 'targetSeconds' | 'targetReps' | 'tempoSeconds' | 'weightKg' | 'distanceKm' | 'restSeconds' | 'restAfterSeconds'
    > & SetRunIdentity & { auto?: boolean }
  ): void {
    const now = Date.now();
    this.autoSaveBlocked = false;
    this.setRun({
      ...input,
      auto: input.auto ?? false,
      phase: 'active',
      extraSeconds: 0,
      startedAtMs: now,
      pausedMs: 0,
      pausedAtMs: this.paused() ? now : null,
      restEndsAtMs: 0,
      restTotalSeconds: 0
    });
  }

  /** The set was recorded and the rest begins; the check of the set is shown over its first moment. */
  beginRest(identity: SetRunIdentity, seconds: number): void {
    const previous = this.runState();
    this.setRun({
      ...(previous ?? this.blankRun(identity)),
      sessionId: identity.sessionId,
      exerciseLogId: identity.exerciseLogId,
      setNumber: identity.setNumber,
      exerciseName: identity.exerciseName,
      phase: 'rest',
      restEndsAtMs: Date.now() + seconds * 1000,
      restTotalSeconds: seconds
    });
  }

  /** "+5 sec" during a set: a timed set runs longer, a counted one waits longer before it records itself. */
  extendRun(seconds: number): void {
    const run = this.runState();
    if (run?.phase !== 'active') {
      return;
    }
    this.setRun(run.kind === 'timed'
      ? { ...run, targetSeconds: run.targetSeconds + seconds }
      : { ...run, extraSeconds: run.extraSeconds + seconds });
  }

  setFollowAlong(on: boolean): void {
    this.followAlong.set(on);
    try {
      localStorage.setItem(MODE_KEY, on ? 'follow' : 'log');
    } catch {
      // Without storage the choice lasts until the page is reloaded.
    }
  }

  extendRest(seconds: number): void {
    const run = this.runState();
    if (run?.phase === 'rest') {
      this.setRun({ ...run, restEndsAtMs: run.restEndsAtMs + seconds * 1000 });
    }
  }

  /** Nothing is running any more: the set was recorded or skipped, or the rest was skipped. */
  clearRun(): void {
    const run = this.runState();
    this.runState.set(null);
    this.stopRunTimer();
    this.removeStoredRun(run?.sessionId ?? this.session()?.sessionId);
  }

  /**
   * Records the running timed set with the time it has run (all of it when the clock reached zero)
   * and starts the rest that follows. The screen's "Stop and save" and the clock use this one path.
   */
  finishTimedRun(): void {
    const run = this.runState();
    const session = this.session();
    if (!run || run.kind !== 'timed' || run.phase !== 'active' || this.recording() || !session || session.sessionId !== run.sessionId) {
      return;
    }
    const elapsed = Math.min(run.targetSeconds, this.runElapsedSeconds());
    if (elapsed <= 0) {
      this.clearRun();
      return;
    }
    this.recordRun(run, { reps: null, durationSeconds: elapsed });
  }

  /**
   * Records the running counted set with the reps chosen before it started, then starts the rest.
   * Follow along does it when the reps are reached; "Done" and "Complete set" do it at any moment,
   * because the person says the reps were done.
   */
  finishCountedRun(): void {
    const run = this.runState();
    const session = this.session();
    if (!run || run.kind !== 'counted' || run.phase !== 'active' || this.recording() || !session || session.sessionId !== run.sessionId) {
      return;
    }
    this.recordRun(run, { reps: run.targetReps > 0 ? run.targetReps : null, durationSeconds: null });
  }

  private recordRun(run: SetRun, values: { reps: number | null; durationSeconds: number | null }): void {
    this.recording.set(true);
    this.recordSet(run.sessionId, run.exerciseLogId, run.setNumber, {
      reps: values.reps,
      weightKg: run.weightKg,
      durationSeconds: values.durationSeconds,
      distanceKm: run.distanceKm,
      restSeconds: run.restSeconds,
      perceivedExertion: null,
      notes: null
    }).subscribe({
      next: () => {
        if (this.runState() !== run) {
          return;
        }
        if (run.restAfterSeconds > 0) {
          this.beginRest(run, run.restAfterSeconds);
          this.runEvents.next({ kind: 'recorded', restStarted: true });
        } else {
          this.clearRun();
          this.runEvents.next({ kind: 'recorded', restStarted: false });
        }
      },
      error: () => {
        this.autoSaveBlocked = true;
        this.toast.error('Unable to save this set. Please retry.');
        this.recording.set(false);
      },
      complete: () => this.recording.set(false)
    });
  }

  /**
   * Starts a plan, optionally a specific day of it, in the user's timezone. Every start goes
   * through the same guard: when a workout is already in progress the server refuses, the shared
   * dialog is opened, and the returned stream completes without a value, so the caller neither
   * shows an error nor opens a screen.
   */
  startFromPlan(planId: string, options?: { planDayId?: string | null; timezone?: string }): Observable<WorkoutSessionDetail> {
    return this.guardedStart(
      () => (options ? this.dataService.startWorkoutPlan(planId, options) : this.dataService.startWorkoutPlan(planId)),
      'Workout session started.'
    );
  }

  startAdHoc(input: StartAdHocSessionInput): Observable<WorkoutSessionDetail> {
    return this.guardedStart(() => this.dataService.startAdHocSession(input), 'Workout started.');
  }

  repeatSession(sessionId: string): Observable<WorkoutSessionDetail> {
    return this.guardedStart(() => this.dataService.repeatSession(sessionId), 'Workout repeated.');
  }

  repeatLatest(): Observable<WorkoutSessionDetail> {
    return this.guardedStart(() => this.dataService.repeatLatestSession(), 'Latest workout repeated.');
  }

  /** Loads the workout in progress and adopts it; a missing one leaves things as they are. */
  loadActive(): Observable<ActiveWorkout | null> {
    const token = ++this.refreshToken;
    return this.dataService.getActiveWorkout().pipe(
      tap((active) => {
        if (active && token === this.refreshToken) {
          this.adopt(active);
        }
      })
    );
  }

  refresh(): void {
    this.loadActive().subscribe();
  }

  /** Shows the exercise screen: on the next open set, or on the exercise the person picked. */
  open(exerciseId: string | null = null): void {
    this.minimised.set(false);
    this.capturePlayerStart(exerciseId);
    this.openRequests.next();
  }

  /** Puts the exercise screen away. The workout keeps running, and the person is told once. */
  minimise(): void {
    this.minimised.set(true);
    const sessionId = this.active()?.sessionId;
    if (sessionId && this.nextSet() && !this.noticed.has(sessionId)) {
      this.noticed.add(sessionId);
      this.toast.info(STILL_RUNNING_NOTICE, 8000);
    }
  }

  /** Ends the workout from outside the exercise screen, under the same 60 second rule. */
  finishActive(): Observable<WorkoutSessionDetail> {
    return this.finish().pipe(tap((session) => this.closeOut(session)));
  }

  discardActive(): Observable<WorkoutSessionDetail> {
    return this.abort().pipe(tap((session) => this.closeOut(session)));
  }

  /** A session was deleted; if it was the one in progress it is gone from here too. */
  sessionRemoved(sessionId: string | null | undefined): void {
    if (sessionId && this.session()?.sessionId === sessionId) {
      this.reset();
    }
    this.refresh();
  }

  dismissPendingStart(): void {
    this.pendingStart.set(null);
  }

  /** The dialog's "Resume it": the refused start is dropped and the running workout opens. */
  resumePending(): void {
    this.pendingStart.set(null);
    if (this.active()) {
      this.open();
      return;
    }
    this.loadActive().subscribe((active) => {
      if (active) {
        this.open();
      }
    });
  }

  /**
   * The dialog's "End it and start this one". The workout in the way is finished, or discarded when
   * it was under a minute or had no set done, and the start that was refused is repeated once.
   */
  endAndStart(): Observable<WorkoutSessionDetail | null> {
    const pending = this.pendingStart();
    if (!pending) {
      return of(null);
    }
    const current$ = this.session()?.sessionId === pending.info.sessionId ? of(null) : this.loadActive();
    return current$.pipe(
      switchMap(() => this.endForNewStart()),
      switchMap(() => {
        this.pendingStart.set(null);
        return pending.retry().pipe(tap((session) => this.afterStart(session)));
      }),
      tap((session) => {
        this.toast.success(pending.message);
        this.changedElsewhere.next(session);
      })
    );
  }

  recordSet(
    sessionId: string,
    exerciseLogId: string,
    setNumber: number,
    input: WorkoutExerciseSetInput
  ): Observable<WorkoutSessionDetail> {
    return this.dataService
      .upsertSessionSet(sessionId, exerciseLogId, setNumber, input)
      .pipe(tap((session) => this.setSession(session)));
  }

  /** Records a set as passed over: the same endpoint as a done set, with the status SKIPPED and no values. */
  skipSet(sessionId: string, exerciseLogId: string, setNumber: number): Observable<WorkoutSessionDetail> {
    return this.recordSet(sessionId, exerciseLogId, setNumber, {
      reps: null,
      weightKg: null,
      durationSeconds: null,
      distanceKm: null,
      restSeconds: null,
      perceivedExertion: null,
      notes: null,
      status: 'SKIPPED'
    });
  }

  finish(): Observable<WorkoutSessionDetail> {
    const current = this.session();
    const sessionId = current?.sessionId;
    if (!current || !sessionId) {
      return throwError(() => new Error('No live workout session to finish.'));
    }

    this.nothingLoggedCancel.set(false);
    // A workout with exercises and no logged set is not worth saving, however long it ran.
    if (this.hasNothingLogged(current)) {
      return this.cancelForNothingLogged(sessionId).pipe(tap((session) => this.end(session)));
    }

    const write = this.elapsedSeconds() < MIN_SAVED_SECONDS
      ? this.dataService.cancelSession(sessionId)
      : this.dataService.completeSession(sessionId).pipe(
          // Another device may have changed the sets, so the server can still refuse.
          catchError((error: unknown) => (isNothingLogged(error) ? this.cancelForNothingLogged(sessionId) : throwError(() => error)))
        );

    return write.pipe(tap((session) => this.end(session)));
  }

  abort(): Observable<WorkoutSessionDetail> {
    const sessionId = this.session()?.sessionId;
    if (!sessionId) {
      return throwError(() => new Error('No live workout session to abort.'));
    }
    return this.dataService.cancelSession(sessionId).pipe(tap((session) => this.end(session)));
  }

  pause(): void {
    if (!this.session() || this.paused()) {
      return;
    }
    this.accumulatedMs += Math.max(0, Date.now() - this.startedAtMs);
    this.paused.set(true);
    this.nowMs.set(Date.now());
    const run = this.runState();
    if (run && run.phase === 'active' && run.pausedAtMs === null) {
      this.setRun({ ...run, pausedAtMs: Date.now() });
    }
  }

  /** Continues a paused timer. */
  resume(): void {
    if (!this.session() || !this.paused()) {
      return;
    }
    this.startedAtMs = Date.now();
    this.paused.set(false);
    this.nowMs.set(Date.now());
    const run = this.runState();
    if (run && run.pausedAtMs !== null) {
      this.setRun({ ...run, pausedMs: run.pausedMs + Math.max(0, Date.now() - run.pausedAtMs), pausedAtMs: null });
    }
  }

  setSession(session: WorkoutSessionDetail): void {
    const other = this.session()?.sessionId !== session.sessionId;
    this.session.set(session);
    if (other) {
      this.restoreRun(session);
    }
  }

  reset(): void {
    this.refreshToken++;
    this.clearRun();
    this.recording.set(false);
    this.stopTimer();
    this.session.set(null);
    this.serverResume.set(null);
    this.heartRate.set(null);
    this.paused.set(false);
    this.accumulatedMs = 0;
    this.startedAtMs = 0;
    this.nowMs.set(Date.now());
  }

  private guardedStart(
    start: () => Observable<WorkoutSessionDetail>,
    message: string
  ): Observable<WorkoutSessionDetail> {
    return start().pipe(
      tap((session) => this.afterStart(session)),
      catchError((error: unknown) => {
        const info = activeSessionConflictFrom(error);
        if (!info) {
          return throwError(() => error);
        }
        this.pendingStart.set({ info, retry: start, message });
        return EMPTY;
      })
    );
  }

  private hasNothingLogged(session: WorkoutSessionDetail): boolean {
    return session.exercises.length > 0 && !session.exercises.some((log) => log.sets.some((set) => set.logged));
  }

  private cancelForNothingLogged(sessionId: string): Observable<WorkoutSessionDetail> {
    return this.dataService.cancelSession(sessionId).pipe(
      tap(() => {
        this.nothingLoggedCancel.set(true);
        this.toast.info(NOTHING_LOGGED_NOTICE);
      })
    );
  }

  private afterStart(session: WorkoutSessionDetail): void {
    this.begin(session);
    this.refresh();
  }

  private adopt(active: ActiveWorkout): void {
    if (this.session()?.sessionId === active.session.sessionId) {
      this.session.set(active.session);
      this.serverResume.set(active.resume);
      return;
    }
    this.begin(active.session, active.resume);
    this.capturePlayerStart(null);
  }

  private closeOut(session: WorkoutSessionDetail): void {
    this.reset();
    this.changedElsewhere.next(session);
    this.refresh();
  }

  private endForNewStart(): Observable<null> {
    const session = this.active();
    if (!session) {
      return of(null);
    }
    const rows = session.exercises.flatMap((log) => log.sets);
    const noSetDone = rows.length > 0 && !rows.some((set) => set.logged);
    const ended$ = noSetDone ? this.abort() : this.finish();
    return ended$.pipe(
      tap(() => this.reset()),
      map(() => null)
    );
  }

  private capturePlayerStart(exerciseId: string | null): void {
    if (exerciseId) {
      this.playerStart.set({ exerciseId, setNumber: null, allDone: false });
      return;
    }
    const next = this.nextSet();
    if (next) {
      this.playerStart.set({ exerciseId: next.exerciseId, setNumber: next.setNumber, allDone: false });
      return;
    }
    const logs = [...(this.active()?.exercises ?? [])].sort((a, b) => a.sequence - b.sequence);
    const last = logs[logs.length - 1];
    this.playerStart.set({ exerciseId: last?.exerciseId ?? null, setNumber: null, allDone: logs.length > 0 });
  }

  private begin(session: WorkoutSessionDetail, resume: ActiveWorkoutResume | null = null): void {
    this.reset();
    this.session.set(session);
    this.serverResume.set(resume);
    this.minimised.set(false);
    // The clock runs from the moment the server says the workout started, so a reload keeps it.
    const started = new Date(session.startedAt).getTime();
    this.startedAtMs = Number.isFinite(started) ? Math.min(started, Date.now()) : Date.now();
    this.nowMs.set(Date.now());
    this.refreshMockHeartRate();
    this.startTimer();
    this.restoreRun(session);
  }

  private end(session: WorkoutSessionDetail): void {
    this.clearRun();
    this.recording.set(false);
    this.setSession(session);
    this.stopTimer();
    this.heartRate.set(null);
    this.paused.set(false);
    this.accumulatedMs = 0;
  }

  private blankRun(identity: SetRunIdentity): SetRun {
    return {
      ...identity,
      phase: 'active',
      kind: 'counted',
      startedAtMs: Date.now(),
      pausedMs: 0,
      pausedAtMs: null,
      targetSeconds: 0,
      targetReps: 0,
      tempoSeconds: 3,
      auto: false,
      extraSeconds: 0,
      weightKg: null,
      distanceKm: null,
      restSeconds: null,
      restAfterSeconds: 0,
      restEndsAtMs: 0,
      restTotalSeconds: 0
    };
  }

  private activeMs(run: SetRun, now: number): number {
    const paused = run.pausedMs + (run.pausedAtMs !== null ? Math.max(0, now - run.pausedAtMs) : 0);
    return Math.max(0, now - run.startedAtMs - paused);
  }

  private setRun(run: SetRun): void {
    this.runNow.set(Date.now());
    this.runState.set(run);
    this.storeRun(run);
    this.startRunTimer();
  }

  private startRunTimer(): void {
    if (!this.runTimerId) {
      this.runTimerId = setInterval(() => this.tickRun(), 1000);
    }
  }

  private stopRunTimer(): void {
    if (this.runTimerId) {
      clearInterval(this.runTimerId);
      this.runTimerId = null;
    }
  }

  private readonly onVisible = (): void => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      this.tickRun();
    }
  };

  /** Moves the set on from the wall clock: a timed set that reached zero is recorded, a rest that ended is dropped. */
  private tickRun(): void {
    const run = this.runState();
    if (!run) {
      this.stopRunTimer();
      return;
    }
    const now = Date.now();
    this.runNow.set(now);
    if (run.phase === 'rest') {
      if (now >= run.restEndsAtMs) {
        this.clearRun();
        this.runEvents.next({ kind: 'rest-ended' });
      }
      return;
    }
    if (this.autoSaveBlocked) {
      return;
    }
    if (run.kind === 'timed' && this.activeMs(run, now) >= run.targetSeconds * 1000) {
      this.finishTimedRun();
    } else if (run.kind === 'counted' && run.auto && run.targetReps > 0
      && this.activeMs(run, now) >= (run.targetReps * run.tempoSeconds + run.extraSeconds) * 1000 + LAST_REP_HOLD_MS) {
      this.finishCountedRun();
    }
  }

  private runKey(sessionId: string): string {
    return `${RUN_KEY_PREFIX}${sessionId}`;
  }

  private storeRun(run: SetRun): void {
    try {
      sessionStorage.setItem(this.runKey(run.sessionId), JSON.stringify(run));
    } catch {
      // Without storage a reload simply falls back to the set waiting to be started.
    }
  }

  private removeStoredRun(sessionId: string | null | undefined): void {
    if (!sessionId) {
      return;
    }
    try {
      sessionStorage.removeItem(this.runKey(sessionId));
    } catch {
      // Nothing to clean up when storage is not there.
    }
  }

  /** Takes up the stored set of this workout when it is still true: its set open (or just done, for a rest). */
  private restoreRun(session: WorkoutSessionDetail): void {
    const sessionId = session.sessionId;
    if (!sessionId) {
      return;
    }
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(this.runKey(sessionId));
    } catch {
      return;
    }
    const run = parseRun(raw);
    if (!run) {
      if (raw) {
        this.removeStoredRun(sessionId);
      }
      return;
    }
    const row = session.exercises
      .find((log) => log.exerciseLogId === run.exerciseLogId)
      ?.sets.find((set) => set.setNumber === run.setNumber);
    const valid = run.sessionId === sessionId
      && !!row
      && (run.phase === 'active'
        ? isOpenSet(row) && (run.kind !== 'timed' || run.targetSeconds > 0)
        : !isOpenSet(row) && run.restEndsAtMs > Date.now());
    if (!valid) {
      this.removeStoredRun(sessionId);
      return;
    }
    if (run.pausedAtMs !== null) {
      this.accumulatedMs = this.startedAtMs > 0 ? Math.max(0, run.pausedAtMs - this.startedAtMs) : 0;
      this.paused.set(true);
    }
    this.setRun(run);
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerId = setInterval(() => {
      this.nowMs.set(Date.now());
      if (!this.paused()) {
        this.refreshMockHeartRate();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private refreshMockHeartRate(): void {
    this.heartRate.set(this.mockHeartRate(this.elapsedSeconds(), this.session()?.workoutType));
  }

  /**
   * Deterministic mock heart rate: starts near resting, eases up over the first ~45s,
   * then drifts within a believable band for the workout type (no instant jump to peak).
   */
  mockHeartRate(elapsedSeconds: number, workoutType: string | null | undefined): number {
    const rest = 72;
    const peak = this.peakHeartRate(workoutType);
    const ramp = Math.min(1, Math.max(0, elapsedSeconds) / 45);
    const baseline = rest + (peak - rest) * ramp;
    const wander = Math.sin(elapsedSeconds / 6) * 3 + Math.sin(elapsedSeconds / 2.3) * 1.5;
    return Math.round(baseline + wander);
  }

  private peakHeartRate(workoutType: string | null | undefined): number {
    switch (workoutType) {
      case 'HIIT':
        return 158;
      case 'CARDIO':
        return 150;
      case 'STRENGTH':
        return 134;
      case 'MOBILITY':
        return 104;
      default:
        return 138;
    }
  }

  private caloriesPerMinute(workoutType: string | null | undefined): number {
    switch (workoutType) {
      case 'HIIT':
        return 9;
      case 'CARDIO':
        return 8;
      case 'STRENGTH':
        return 6;
      case 'MOBILITY':
        return 3;
      default:
        return 5;
    }
  }
}

/** Follow along unless the person chose to log each set on this device. */
function readFollowAlong(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) !== 'log';
  } catch {
    return true;
  }
}

/** 12:34, or 1:02:03 once the workout passes the hour. */
export function formatElapsedClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
