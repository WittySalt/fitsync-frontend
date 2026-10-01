import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutExerciseLog, WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { NOTHING_LOGGED_NOTICE, STILL_RUNNING_NOTICE, SetRunIdentity, WorkoutLiveService, formatElapsedClock } from './workout-live.service';

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

  it('records a skipped set through the same endpoint with the status SKIPPED and no values', () => {
    service.startFromPlan('plan-1').subscribe();

    service.skipSet('session-live', 'log-1', 3).subscribe();

    expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
      'session-live',
      'log-1',
      3,
      jasmine.objectContaining({ status: 'SKIPPED', reps: null, weightKg: null, durationSeconds: null })
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

  describe('finishing with nothing logged', () => {
    function startWith(sets: boolean[][]): void {
      dataService.startWorkoutPlan.and.callFake(() =>
        of(
          session({
            startedAt: new Date().toISOString(),
            exercises: sets.map((flags, index) => log(flags, { exerciseLogId: `log-${index + 1}`, sequence: index + 1 }))
          })
        )
      );
      service.startFromPlan('plan-1').subscribe();
    }

    it('cancels a workout with exercises and no logged set, however long it ran, and says so', fakeAsync(() => {
      startWith([[false, false], [false]]);
      tick(10 * 60_000);

      let result: WorkoutSessionDetail | undefined;
      service.finish().subscribe((value) => (result = value));

      expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
      expect(dataService.completeSession).not.toHaveBeenCalled();
      expect(result?.status).toBe('CANCELLED');
      expect(toast.info).toHaveBeenCalledOnceWith(NOTHING_LOGGED_NOTICE);
      expect(NOTHING_LOGGED_NOTICE).toBe('No set was logged, so this workout was not saved.');
      expect(service.nothingLoggedCancel()).toBeTrue();
    }));

    it('completes a workout with a logged set after a minute, without the notice', fakeAsync(() => {
      startWith([[true, false]]);
      tick(60_000);

      service.finish().subscribe();

      expect(dataService.completeSession).toHaveBeenCalledWith('session-live');
      expect(dataService.cancelSession).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
      expect(service.nothingLoggedCancel()).toBeFalse();
    }));

    it('keeps the 60 second rule for a workout with logged sets, with its own notice left to the caller', fakeAsync(() => {
      startWith([[true]]);
      tick(30_000);

      service.finish().subscribe();

      expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
      expect(toast.info).not.toHaveBeenCalled();
      expect(service.nothingLoggedCancel()).toBeFalse();
    }));

    it('keeps the 60 second rule for a workout without exercises', fakeAsync(() => {
      service.startFromPlan('plan-1').subscribe();
      tick(30_000);

      service.finish().subscribe();

      expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
      expect(toast.info).not.toHaveBeenCalled();
    }));

    it('cancels in the same way when the server still refuses with NOTHING_LOGGED', fakeAsync(() => {
      startWith([[true]]);
      tick(120_000);
      dataService.completeSession.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'NOTHING_LOGGED' } }))
      );

      let result: WorkoutSessionDetail | undefined;
      service.finish().subscribe((value) => (result = value));

      expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
      expect(result?.status).toBe('CANCELLED');
      expect(toast.info).toHaveBeenCalledOnceWith(NOTHING_LOGGED_NOTICE);
      expect(service.nothingLoggedCancel()).toBeTrue();
    }));

    it('lets any other refusal through untouched', fakeAsync(() => {
      startWith([[true]]);
      tick(120_000);
      dataService.completeSession.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'OTHER' } })));

      let failed = false;
      service.finish().subscribe({ error: () => (failed = true) });

      expect(failed).toBeTrue();
      expect(dataService.cancelSession).not.toHaveBeenCalled();
    }));

    it('follows the same rule when the end dialog finishes the workout from the bar', fakeAsync(() => {
      startWith([[false]]);
      tick(5 * 60_000);

      service.finishActive().subscribe();

      expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
      expect(toast.info).toHaveBeenCalledOnceWith(NOTHING_LOGGED_NOTICE);
    }));
  });

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

  it('does not take a skipped set for the next set', () => {
    const bench = log([true, false, false]);
    bench.sets[1].status = 'SKIPPED';
    service.setSession(session({ exercises: [bench] }));

    expect(service.nextSet()).toEqual(jasmine.objectContaining({ exerciseId: 'exercise-1', setNumber: 3 }));
    expect(service.currentLabel()).toBe('Goblet squat · set 3 of 3');
  });

  it('follows the person to the next exercise once every set of one is skipped', () => {
    const first = log([false, false, false]);
    first.sets.forEach((row) => (row.status = 'SKIPPED'));
    const second = log([false, false], { exerciseLogId: 'log-2', exerciseId: 'exercise-2', exerciseNameSnapshot: 'Push-up', sequence: 2 });
    dataService.getActiveWorkout.and.returnValue(of({ session: session({ exercises: [first, second] }), resume: null }));

    service.refresh();

    expect(service.nextSet()).toEqual(jasmine.objectContaining({ exerciseId: 'exercise-2', setNumber: 1 }));
    expect(service.playerStart()).toEqual({ exerciseId: 'exercise-2', setNumber: 1, allDone: false });
  });

  it('is all done when every set is either done or skipped', () => {
    const only = log([true, false]);
    only.sets[1].status = 'SKIPPED';
    service.setSession(session({ exercises: [only] }));

    expect(service.nextSet()).toBeNull();
    expect(service.currentLabel()).toBe('All sets done');
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

  describe('the set in progress', () => {
    const identity: SetRunIdentity = {
      sessionId: 'session-live',
      exerciseLogId: 'log-1',
      setNumber: 1,
      exerciseName: 'Plank Hold'
    };
    const key = 'fitsync.workout.run.session-live';
    const timed = (overrides: object = {}) => ({
      ...identity,
      kind: 'timed' as const,
      targetSeconds: 45,
      targetReps: 0,
      tempoSeconds: 3,
      weightKg: null,
      distanceKm: null,
      restSeconds: 30,
      restAfterSeconds: 30,
      ...overrides
    });
    const counted = (overrides: object = {}) => ({
      ...identity,
      exerciseName: 'Goblet Squat',
      kind: 'counted' as const,
      targetSeconds: 0,
      targetReps: 12,
      tempoSeconds: 3,
      weightKg: 16,
      distanceKm: null,
      restSeconds: 30,
      restAfterSeconds: 30,
      ...overrides
    });
    const open = () => session({ exercises: [log([false, false, false])] });
    const afterFirstSet = () => session({ exercises: [log([true, false, false])] });
    const stored = () => sessionStorage.getItem(key);

    beforeEach(() => {
      sessionStorage.clear();
      service.setSession(open());
    });

    afterEach(() => {
      sessionStorage.clear();
    });

    it('keeps the time left of a timed set while the screen is put away, from the wall clock', fakeAsync(() => {
      service.startRun(timed());
      tick(10_000);
      expect(service.runRemainingSeconds()).toBe(35);

      service.minimise();
      tick(5_000);

      expect(service.runRemainingSeconds()).toBe(30);
      expect(service.runLabel()).toBe('Plank Hold · 0:30 left');
      service.reset();
    }));

    it('shows a counted set by its reps in the bar, and never ends it by itself', fakeAsync(() => {
      service.startRun(counted());
      tick(21_000);

      expect(service.runReps()).toBe(7);
      expect(service.runLabel()).toBe('Goblet Squat · 7 / 12');

      tick(600_000);
      expect(service.runReps()).toBe(12);
      expect(service.run()?.phase).toBe('active');
      expect(dataService.upsertSessionSet).not.toHaveBeenCalled();
      service.reset();
    }));

    it('shows the set time in the bar when a counted set has no reps to count', fakeAsync(() => {
      service.startRun(counted({ targetReps: 0 }));
      tick(23_000);

      expect(service.runLabel()).toBe('Goblet Squat · 0:23');
      service.reset();
    }));

    it('records a timed set that reaches zero while the screen is away, once, and starts the rest', fakeAsync(() => {
      dataService.upsertSessionSet.and.returnValue(of(afterFirstSet()));
      const events: string[] = [];
      service.runEvents.subscribe((event) => events.push(event.kind));
      service.startRun(timed({ targetSeconds: 3, restAfterSeconds: 2 }));
      service.minimise();

      tick(3_000);

      expect(dataService.upsertSessionSet).toHaveBeenCalledTimes(1);
      expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
        'session-live',
        'log-1',
        1,
        jasmine.objectContaining({ reps: null, durationSeconds: 3, restSeconds: 30 })
      );
      expect(service.run()?.phase).toBe('rest');
      expect(service.runLabel()).toBe('Rest 0:02');
      tick(1_000);
      expect(service.runLabel()).toBe('Rest 0:01');

      tick(1_000);
      expect(service.run()).toBeNull();
      expect(stored()).toBeNull();
      expect(events).toEqual(['recorded', 'rest-ended']);
      expect(dataService.upsertSessionSet).toHaveBeenCalledTimes(1);
    }));

    it('goes straight to the next set when no rest follows a timed set that ended', fakeAsync(() => {
      dataService.upsertSessionSet.and.returnValue(of(afterFirstSet()));
      service.startRun(timed({ targetSeconds: 2, restAfterSeconds: 0 }));

      tick(2_000);

      expect(service.run()).toBeNull();
      expect(stored()).toBeNull();
    }));

    it('keeps the set and does not retry every second when saving fails', fakeAsync(() => {
      dataService.upsertSessionSet.and.returnValue(throwError(() => new Error('down')));
      service.startRun(timed({ targetSeconds: 2 }));

      tick(5_000);

      expect(dataService.upsertSessionSet).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalled();
      expect(service.run()?.phase).toBe('active');
      service.reset();
    }));

    it('holds the set clock and the workout clock together while paused, through a minimise', fakeAsync(() => {
      service.startRun(timed());
      tick(10_000);
      service.pause();
      service.minimise();
      tick(20_000);

      expect(service.paused()).toBeTrue();
      expect(service.runRemainingSeconds()).toBe(35);
      expect(JSON.parse(stored() ?? '{}').pausedAtMs).not.toBeNull();

      service.resume();
      tick(5_000);

      expect(service.runRemainingSeconds()).toBe(30);
      service.reset();
    }));

    it('does not finish a timed set while the workout is paused', fakeAsync(() => {
      service.startRun(timed({ targetSeconds: 5 }));
      tick(2_000);
      service.pause();
      tick(60_000);

      expect(dataService.upsertSessionSet).not.toHaveBeenCalled();
      service.reset();
    }));

    it('stores the set under its session and takes it up again after a reload', fakeAsync(() => {
      service.startRun(timed());
      tick(10_000);
      expect(stored()).not.toBeNull();

      const reloaded = TestBed.runInInjectionContext(() => new WorkoutLiveService());
      reloaded.setSession(open());
      tick(5_000);

      expect(reloaded.run()?.exerciseName).toBe('Plank Hold');
      expect(reloaded.runRemainingSeconds()).toBe(30);
      service.reset();
      reloaded.reset();
    }));

    it('restores a paused set as paused after a reload', fakeAsync(() => {
      service.startRun(timed());
      tick(10_000);
      service.pause();

      const reloaded = TestBed.runInInjectionContext(() => new WorkoutLiveService());
      reloaded.setSession(open());
      tick(30_000);

      expect(reloaded.paused()).toBeTrue();
      expect(reloaded.runRemainingSeconds()).toBe(35);
      service.reset();
      reloaded.reset();
    }));

    it('takes up a rest that is still running after a reload', fakeAsync(() => {
      service.beginRest(identity, 30);
      tick(10_000);

      const reloaded = TestBed.runInInjectionContext(() => new WorkoutLiveService());
      reloaded.setSession(afterFirstSet());

      expect(reloaded.run()?.phase).toBe('rest');
      expect(reloaded.runLabel()).toBe('Rest 0:20');
      service.reset();
      reloaded.reset();
    }));

    it('carries on when storage throws', fakeAsync(() => {
      const write = spyOn(Storage.prototype, 'setItem').and.throwError('full');
      const read = spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
      spyOn(Storage.prototype, 'removeItem').and.throwError('blocked');

      expect(() => service.startRun(timed())).not.toThrow();
      tick(3_000);
      expect(service.runElapsedSeconds()).toBe(3);

      const reloaded = TestBed.runInInjectionContext(() => new WorkoutLiveService());
      expect(() => reloaded.setSession(open())).not.toThrow();
      expect(reloaded.run()).toBeNull();
      expect(write).toHaveBeenCalled();
      expect(read).toHaveBeenCalled();
      expect(() => service.clearRun()).not.toThrow();
      reloaded.reset();
    }));

    it('ignores a stored set that belongs to another workout, one that is closed, and one that is garbled', () => {
      const record = (overrides: object = {}) => JSON.stringify({
        ...timed(), phase: 'active', startedAtMs: Date.now(), pausedMs: 0, pausedAtMs: null, restEndsAtMs: 0, restTotalSeconds: 0, ...overrides
      });
      const reloadWith = (raw: string, current = open()) => {
        sessionStorage.setItem(key, raw);
        const reloaded = TestBed.runInInjectionContext(() => new WorkoutLiveService());
        reloaded.setSession(current);
        const run = reloaded.run();
        reloaded.reset();
        return run;
      };

      expect(reloadWith(record({ sessionId: 'session-other' }))).toBeNull();
      expect(stored()).toBeNull();
      expect(reloadWith(record(), afterFirstSet())).toBeNull();
      expect(stored()).toBeNull();
      expect(reloadWith('{not json')).toBeNull();
      expect(reloadWith(record({ phase: 'resting' }))).toBeNull();
      expect(reloadWith(record({ phase: 'rest', restEndsAtMs: Date.now() - 1000 }), afterFirstSet())).toBeNull();
      expect(reloadWith(record())).not.toBeNull();
    });

    it('clears the stored set when the workout is finished', fakeAsync(() => {
      service.startRun(timed());
      tick(1_000);
      expect(stored()).not.toBeNull();

      service.finishActive().subscribe();

      expect(stored()).toBeNull();
      expect(service.run()).toBeNull();
    }));

    it('clears the stored set when the workout is discarded', fakeAsync(() => {
      service.startRun(timed());
      tick(1_000);

      service.discardActive().subscribe();

      expect(stored()).toBeNull();
      expect(service.run()).toBeNull();
    }));

    it('clears the stored set when it is cleared, as after a set is skipped or recorded', fakeAsync(() => {
      service.startRun(counted());
      expect(stored()).not.toBeNull();

      service.clearRun();

      expect(stored()).toBeNull();
    }));

    it('lengthens a rest by the wall clock', fakeAsync(() => {
      service.beginRest(identity, 30);
      service.extendRest(15);

      expect(service.restRemainingSeconds()).toBe(45);
      service.reset();
    }));
  });
});
