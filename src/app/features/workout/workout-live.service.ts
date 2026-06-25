import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  StartAdHocSessionInput,
  WorkoutExerciseSetInput,
  WorkoutSessionDetail
} from '../../core/fitsync.models';

@Injectable({ providedIn: 'root' })
export class WorkoutLiveService {
  private readonly dataService = inject(FitSyncDataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly session = signal<WorkoutSessionDetail | null>(null);
  readonly paused = signal(false);
  readonly heartRate = signal<number | null>(null);

  private readonly nowMs = signal(Date.now());
  private timerId: ReturnType<typeof setInterval> | null = null;
  private startedAtMs = 0;
  private accumulatedMs = 0;

  readonly elapsedSeconds = computed(() => {
    if (!this.session()) {
      return 0;
    }
    const activeMs = this.paused() ? 0 : Math.max(0, this.nowMs() - this.startedAtMs);
    return Math.floor((this.accumulatedMs + activeMs) / 1000);
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

  startFromPlan(planId: string): Observable<WorkoutSessionDetail> {
    return this.dataService.startWorkoutPlan(planId).pipe(tap((session) => this.begin(session)));
  }

  startAdHoc(input: StartAdHocSessionInput): Observable<WorkoutSessionDetail> {
    return this.dataService.startAdHocSession(input).pipe(tap((session) => this.begin(session)));
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

  finish(): Observable<WorkoutSessionDetail> {
    const sessionId = this.session()?.sessionId;
    if (!sessionId) {
      return throwError(() => new Error('No live workout session to finish.'));
    }

    const write = this.elapsedSeconds() < 60
      ? this.dataService.cancelSession(sessionId)
      : this.dataService.completeSession(sessionId);

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
    this.stopTimer();
    this.session.set(null);
    this.heartRate.set(null);
    this.paused.set(false);
    this.accumulatedMs = 0;
    this.startedAtMs = 0;
    this.nowMs.set(Date.now());
  }

  private begin(session: WorkoutSessionDetail): void {
    this.reset();
    this.session.set(session);
    this.startedAtMs = Date.now();
    this.nowMs.set(this.startedAtMs);
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
