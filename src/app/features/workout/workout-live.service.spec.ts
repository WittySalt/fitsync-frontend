import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutExerciseLog, WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { STILL_RUNNING_NOTICE, WorkoutLiveService, formatElapsedClock } from './workout-live.service';

function session(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-live',
    planId: 'plan-1',
    name: 'Guided strength',
    workoutType: 'STRENGTH',
    status: 'IN_PROGRESS',
    source: 'PLAN',
    startedAt: '2026-06-20T02:00:00Z',
    completedAt: '',
    durationMinutes: 0,
    caloriesBurned: 0,
    exerciseCount: 1,
    perceivedExertion: null,
    notes: '',
    exercises: [],
    createdAt: '',
    updatedAt: '',
    ...overrides
  };
}

function log(sets: boolean[], overrides: Partial<WorkoutExerciseLog> = {}): WorkoutExerciseLog {
  return {
    exerciseLogId: 'log-1',
    exerciseId: 'exercise-1',
    exerciseNameSnapshot: 'Goblet squat',
    sequence: 1,
    performedSets: null,
    performedReps: null,
    totalVolumeKg: null,
    distanceKm: null,
    durationSeconds: null,
    averageHeartRate: null,
    maxHeartRate: null,
    notes: '',
    sets: sets.map((logged, index) => ({
      setLogId: `set-${index + 1}`,
      setNumber: index + 1,
      reps: 8,
      weightKg: null,
      durationSeconds: null,
      distanceKm: null,
      restSeconds: null,
      perceivedExertion: null,
      logged,
      notes: ''
    })),
    ...overrides
  };
}

function conflict(sessionId = 'session-old') {
  return new HttpErrorResponse({
    status: 409,
    error: { code: 'ACTIVE_SESSION_EXISTS', data: { sessionId, name: 'Old workout', startedAt: '2026-06-20T02:00:00Z' } }
  });
}

describe('WorkoutLiveService', () => {
  let service: WorkoutLiveService;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'startWorkoutPlan',
      'startAdHocSession',
      'repeatSession',
      'repeatLatestSession',
      'getActiveWorkout',
      'upsertSessionSet',
      'completeSession',
      'cancelSession'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    dataService.getActiveWorkout.and.returnValue(of(null));
    // The clock runs from the start the server reports, so the stubs report a start of right now.
    dataService.startWorkoutPlan.and.callFake(() => of(session({ startedAt: new Date().toISOString() })));
    dataService.startAdHocSession.and.callFake(() =>
      of(session({ planId: null, source: 'MANUAL', startedAt: new Date().toISOString() }))
    );
    dataService.upsertSessionSet.and.returnValue(of(session()));
    dataService.completeSession.and.returnValue(of(session({ status: 'COMPLETED' })));
    dataService.cancelSession.and.returnValue(of(session({ status: 'CANCELLED' })));

    TestBed.configureTestingModule({
      providers: [
        WorkoutLiveService,
        { provide: ToastService, useValue: toast },
        { provide: FitSyncDataService, useValue: dataService }
      ]
    });
    service = TestBed.inject(WorkoutLiveService);
  });

  afterEach(() => {
    service.reset();
  });

  it('ramps the mock heart rate from rest toward the working band instead of jumping', () => {
    const early = service.mockHeartRate(2, 'STRENGTH');
    const later = service.mockHeartRate(120, 'STRENGTH');
    expect(early).toBeLessThan(later);
    expect(early).toBeLessThan(100);
    expect(later).toBeGreaterThan(120);
    expect(later).toBeLessThanOrEqual(140);
  });

  it('uses workout-type-specific heart-rate bands', () => {
    const hiit = service.mockHeartRate(120, 'HIIT');
    const cardio = service.mockHeartRate(120, 'CARDIO');
    const mobility = service.mockHeartRate(120, 'MOBILITY');
    const fallback = service.mockHeartRate(120, 'YOGA');
    expect(hiit).toBeGreaterThan(cardio);
    expect(cardio).toBeGreaterThan(mobility);
    expect(fallback).toBeGreaterThan(mobility);
  });

  it('starts from a plan and exposes elapsed time, mock heart rate, and estimated calories', fakeAsync(() => {
    service.startFromPlan('plan-1').subscribe();

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-1');
    expect(service.session()?.sessionId).toBe('session-live');
    expect(service.heartRate()).toBeGreaterThanOrEqual(60);
    expect(service.heartRate()).toBeLessThan(95);

    tick(30_000);

    expect(service.elapsedSeconds()).toBe(30);
    expect(service.estimatedCalories()).toBe(3);
    expect(service.heartRate()).toBeGreaterThan(100);
    expect(service.heartRate()).toBeLessThanOrEqual(140);
  }));

  it('pauses without accumulating elapsed time until resumed', fakeAsync(() => {
    service.startFromPlan('plan-1').subscribe();
    tick(10_000);

    service.pause();
    tick(20_000);

    expect(service.elapsedSeconds()).toBe(10);

    service.resume();
    tick(5_000);

    expect(service.elapsedSeconds()).toBe(15);
  }));

  it('records a set through the live session endpoint and refreshes session state', () => {
    service.startFromPlan('plan-1').subscribe();

    service.recordSet('session-live', 'log-1', 2, {
      reps: 8,
      weightKg: 60,
      durationSeconds: null,
      distanceKm: null,
      restSeconds: 90,
      perceivedExertion: 7,
      notes: null
    }).subscribe();

    expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
      'session-live',
      'log-1',
      2,
      jasmine.objectContaining({ reps: 8, weightKg: 60, restSeconds: 90 })
    );
  });

  it('cancels instead of completing when finished before 60 seconds', fakeAsync(() => {
    service.startFromPlan('plan-1').subscribe();
    tick(59_000);

    service.finish().subscribe();

    expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
    expect(dataService.completeSession).not.toHaveBeenCalled();
  }));

  it('completes when finished after at least 60 seconds', fakeAsync(() => {
    service.startFromPlan('plan-1').subscribe();
    tick(60_000);

    service.finish().subscribe();

    expect(dataService.completeSession).toHaveBeenCalledWith('session-live');
    expect(dataService.cancelSession).not.toHaveBeenCalled();
  }));

  it('aborts by cancelling the session immediately', () => {
    service.startFromPlan('plan-1').subscribe();

    service.abort().subscribe();

    expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
  });

  it('runs the clock from the start the server reports, so a reload keeps it', fakeAsync(() => {
    const startedAt = new Date(Date.now() - 125_000).toISOString();
    dataService.getActiveWorkout.and.returnValue(of({ session: session({ startedAt }), resume: null }));

    service.refresh();

    expect(service.session()?.sessionId).toBe('session-live');
    expect(service.elapsedSeconds()).toBe(125);
    expect(service.elapsedLabel()).toBe('2:05');
    tick(1_000);
    expect(service.elapsedSeconds()).toBe(126);
  }));

  it('leaves things alone when there is no workout in progress', () => {
    service.refresh();

    expect(dataService.getActiveWorkout).toHaveBeenCalled();
    expect(service.session()).toBeNull();
  });

  it('keeps the timer when a load returns the workout that is already running', fakeAsync(() => {
    service.startFromPlan('plan-1').subscribe();
    tick(10_000);
    dataService.getActiveWorkout.and.returnValue(
      of({ session: session({ startedAt: new Date().toISOString(), name: 'Renamed' }), resume: null })
    );

    service.refresh();

    expect(service.session()?.name).toBe('Renamed');
    expect(service.elapsedSeconds()).toBe(10);
  }));

  it('reports the next open set and follows the sets as they are recorded', () => {
    const exercises = [
      log([true, false, false]),
      log([false, false], { exerciseLogId: 'log-2', exerciseId: 'exercise-2', exerciseNameSnapshot: 'Push-up', sequence: 2 })
    ];
    dataService.getActiveWorkout.and.returnValue(of({ session: session({ exercises }), resume: null }));
    service.refresh();

    expect(service.nextSet()).toEqual(jasmine.objectContaining({ exerciseId: 'exercise-1', setNumber: 2 }));
    expect(service.currentLabel()).toBe('Goblet squat \u00b7 set 2 of 3');
    expect(service.playerStart()).toEqual({ exerciseId: 'exercise-1', setNumber: 2, allDone: false });

    service.setSession(session({ exercises: [log([true, true, true]), exercises[1]] }));
    expect(service.currentLabel()).toBe('Push-up \u00b7 set 1 of 2');
  });

  it('opens on the last exercise with Finish next when every set is done', () => {
    const exercises = [log([true]), log([true], { exerciseLogId: 'log-2', exerciseId: 'exercise-2', sequence: 2 })];
    dataService.getActiveWorkout.and.returnValue(of({ session: session({ exercises }), resume: null }));

    service.refresh();

    expect(service.nextSet()).toBeNull();
    expect(service.currentLabel()).toBe('All sets done');
    expect(service.playerStart()).toEqual({ exerciseId: 'exercise-2', setNumber: null, allDone: true });
  });

  it('has no current exercise for a workout without exercises, and falls back to the server answer without set rows', () => {
    service.setSession(session({ exercises: [] }));
    expect(service.currentLabel()).toBe('');

    dataService.getActiveWorkout.and.returnValue(
      of({
        session: session({ sessionId: 'session-b', exercises: [log([])] }),
        resume: {
          doneSets: 0,
          skippedSets: 0,
          pendingSets: 2,
          totalSets: 2,
          nextSet: { exerciseLogId: 'log-1', exerciseId: 'exercise-1', exerciseName: 'Goblet squat', exerciseSequence: 1, setNumber: 1 }
        }
      })
    );
    service.refresh();
    expect(service.nextSet()?.setNumber).toBe(1);
  });

  it('opens the screen on the exercise the person picked', () => {
    service.setSession(session({ exercises: [log([false])] }));
    service.minimise();
    let requests = 0;
    service.openRequests.subscribe(() => requests++);

    service.open('exercise-9');

    expect(service.minimised()).toBeFalse();
    expect(service.playerStart()).toEqual({ exerciseId: 'exercise-9', setNumber: null, allDone: false });
    expect(requests).toBe(1);
  });

  it('tells the person once per workout that it keeps running, only while sets are open', () => {
    service.setSession(session({ exercises: [log([false])] }));

    service.minimise();
    service.minimise();

    expect(toast.info).toHaveBeenCalledOnceWith(STILL_RUNNING_NOTICE, jasmine.any(Number));

    service.setSession(session({ sessionId: 'session-2', exercises: [log([true])] }));
    service.minimise();
    expect(toast.info).toHaveBeenCalledTimes(1);

    service.setSession(session({ sessionId: 'session-3', exercises: [log([false])] }));
    service.minimise();
    expect(toast.info).toHaveBeenCalledTimes(2);
  });

  it('turns a refused start into a pending start and completes without a value or an error', () => {
    dataService.startWorkoutPlan.and.returnValue(throwError(() => conflict()));
    const values: unknown[] = [];
    let failed = false;
    let completed = false;

    service.startFromPlan('plan-1', { planDayId: null, timezone: 'Asia/Singapore' }).subscribe({
      next: (value) => values.push(value),
      error: () => (failed = true),
      complete: () => (completed = true)
    });

    expect(values).toEqual([]);
    expect(failed).toBeFalse();
    expect(completed).toBeTrue();
    expect(service.pendingStart()?.info).toEqual({
      sessionId: 'session-old',
      name: 'Old workout',
      startedAt: '2026-06-20T02:00:00Z'
    });
  });

  it('refuses every kind of start the same way', () => {
    dataService.startAdHocSession.and.returnValue(throwError(() => conflict()));
    dataService.repeatSession.and.returnValue(throwError(() => conflict()));
    dataService.repeatLatestSession.and.returnValue(throwError(() => conflict()));

    service.startAdHoc({ name: 'Free', workoutType: 'CUSTOM' }).subscribe();
    expect(service.pendingStart()?.message).toBe('Workout started.');
    service.repeatSession('session-9').subscribe();
    expect(service.pendingStart()?.message).toBe('Workout repeated.');
    service.repeatLatest().subscribe();
    expect(service.pendingStart()?.message).toBe('Latest workout repeated.');
  });

  it('passes other start errors on to the caller', () => {
    dataService.startWorkoutPlan.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    let failed = false;

    service.startFromPlan('plan-1').subscribe({ error: () => (failed = true) });

    expect(failed).toBeTrue();
    expect(service.pendingStart()).toBeNull();
  });

  it('resumes the workout in the way', () => {
    dataService.startWorkoutPlan.and.returnValue(of(session({ sessionId: 'session-old', exercises: [log([false])] })));
    service.startFromPlan('plan-1').subscribe();
    service.minimise();
    dataService.startWorkoutPlan.and.returnValue(throwError(() => conflict()));
    service.startFromPlan('plan-1').subscribe();

    service.resumePending();

    expect(service.pendingStart()).toBeNull();
    expect(service.minimised()).toBeFalse();
  });

  it('ends a workout that is under a minute, then repeats the refused start once', fakeAsync(() => {
    const now = new Date().toISOString();
    const wanted = session({ sessionId: 'session-new', startedAt: now });
    dataService.startWorkoutPlan.and.returnValues(
      of(session({ sessionId: 'session-old', startedAt: now })),
      throwError(() => conflict()),
      of(wanted)
    );
    service.startFromPlan('plan-1').subscribe();
    service.startFromPlan('plan-1').subscribe();
    const changes: string[] = [];
    service.changedElsewhere.subscribe((value) => changes.push(value.sessionId ?? ''));

    service.endAndStart().subscribe();
    tick();

    expect(dataService.cancelSession).toHaveBeenCalledWith('session-old');
    expect(dataService.completeSession).not.toHaveBeenCalled();
    expect(dataService.startWorkoutPlan).toHaveBeenCalledTimes(3);
    expect(service.session()?.sessionId).toBe('session-new');
    expect(service.pendingStart()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Workout session started.');
    expect(changes).toEqual(['session-new']);
  }));

  it('discards a workout with no set done even after a minute, and saves one with a set done', fakeAsync(() => {
    dataService.startWorkoutPlan.and.callFake(() =>
      of(session({ sessionId: 'session-old', exercises: [log([false, false])], startedAt: new Date().toISOString() }))
    );
    service.startFromPlan('plan-1').subscribe();
    tick(120_000);
    dataService.startWorkoutPlan.and.returnValues(throwError(() => conflict()), of(session({ sessionId: 'session-new' })));
    service.startFromPlan('plan-1').subscribe();

    service.endAndStart().subscribe();
    tick();

    expect(dataService.cancelSession).toHaveBeenCalledWith('session-old');
    expect(dataService.completeSession).not.toHaveBeenCalled();

    dataService.cancelSession.calls.reset();
    dataService.startWorkoutPlan.and.callFake(() =>
      of(session({ sessionId: 'session-busy', exercises: [log([true, false])], startedAt: new Date().toISOString() }))
    );
    service.startFromPlan('plan-1').subscribe();
    tick(120_000);
    dataService.startWorkoutPlan.and.returnValues(throwError(() => conflict('session-busy')), of(session({ sessionId: 'session-next' })));
    service.startFromPlan('plan-1').subscribe();

    service.endAndStart().subscribe();
    tick();

    expect(dataService.completeSession).toHaveBeenCalledWith('session-busy');
    expect(dataService.cancelSession).not.toHaveBeenCalled();
  }));

  it('loads the workout in the way when it is not the one held here, before ending it', fakeAsync(() => {
    dataService.startWorkoutPlan.and.returnValues(throwError(() => conflict('session-elsewhere')), of(session({ sessionId: 'session-new' })));
    dataService.getActiveWorkout.and.returnValues(
      of({ session: session({ sessionId: 'session-elsewhere', startedAt: new Date().toISOString() }), resume: null }),
      of(null)
    );
    service.startFromPlan('plan-1').subscribe();

    service.endAndStart().subscribe();
    tick();

    expect(dataService.getActiveWorkout).toHaveBeenCalled();
    expect(dataService.cancelSession).toHaveBeenCalledWith('session-elsewhere');
    expect(service.session()?.sessionId).toBe('session-new');
  }));

  it('lets the caller see a failure of the repeated start', fakeAsync(() => {
    dataService.startWorkoutPlan.and.returnValues(throwError(() => conflict()), throwError(() => new HttpErrorResponse({ status: 500 })));
    service.startFromPlan('plan-1').subscribe();
    let failed = false;

    service.endAndStart().subscribe({ error: () => (failed = true) });
    tick();

    expect(failed).toBeTrue();
  }));

  it('ends and discards from outside the exercise screen, and clears the workout', fakeAsync(() => {
    service.startFromPlan('plan-1').subscribe();
    tick(61_000);

    service.finishActive().subscribe();
    expect(dataService.completeSession).toHaveBeenCalledWith('session-live');
    expect(service.session()).toBeNull();

    service.startFromPlan('plan-1').subscribe();
    service.discardActive().subscribe();
    expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
    expect(service.session()).toBeNull();
  }));

  it('forgets a deleted workout that was in progress, and keeps another one', () => {
    service.setSession(session({ sessionId: 'session-live' }));
    service.sessionRemoved('someone-else');
    expect(service.session()).not.toBeNull();

    service.sessionRemoved('session-live');
    expect(service.session()).toBeNull();
  });

  it('counts only a workout that is still being trained as active', () => {
    service.setSession(session({ status: 'COMPLETED' }));
    expect(service.active()).toBeNull();
    service.setSession(session({ status: 'IN_PROGRESS' }));
    expect(service.active()).not.toBeNull();
  });

  it('writes the elapsed clock as 12:34 and 1:02:03', () => {
    expect(formatElapsedClock(0)).toBe('0:00');
    expect(formatElapsedClock(754)).toBe('12:34');
    expect(formatElapsedClock(3723)).toBe('1:02:03');
    expect(formatElapsedClock(-5)).toBe('0:00');
  });
});
