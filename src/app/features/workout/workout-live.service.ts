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
  /** The person has just started this workout, so its exercise screen opens with the countdown.
   *  A workout that is picked up again (a reload, the bar) never has it. */
  readonly freshStart = signal(false);

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

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTimer());
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

  /** The exercise screen asks once whether it opens with the countdown. */
  consumeFreshStart(): boolean {
    const fresh = this.freshStart();
    this.freshStart.set(false);
    return fresh;
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
  }

  /** Continues a paused timer. */
  resume(): void {
    if (!this.session() || !this.paused()) {
      return;
    }
    this.startedAtMs = Date.now();
    this.paused.set(false);
    this.nowMs.set(Date.now());
  }

  setSession(session: WorkoutSessionDetail): void {
    this.session.set(session);
  }

  reset(): void {
    this.refreshToken++;
    this.freshStart.set(false);
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
    this.freshStart.set(true);
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
  }

  private end(session: WorkoutSessionDetail): void {
    this.setSession(session);
    this.stopTimer();
    this.heartRate.set(null);
    this.paused.set(false);
    this.accumulatedMs = 0;
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

/** 12:34, or 1:02:03 once the workout passes the hour. */
export function formatElapsedClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
