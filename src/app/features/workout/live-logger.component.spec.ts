import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { Exercise, WorkoutExerciseLog, WorkoutPlan, WorkoutSessionDetail } from '../../core/fitsync.models';
import { LiveLoggerComponent } from './live-logger.component';

function detail(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-live',
    planId: null,
    name: 'Live upper',
    workoutType: 'STRENGTH',
    status: 'IN_PROGRESS',
    source: 'MANUAL',
    startedAt: '2026-06-20T02:00:00Z',
    completedAt: '',
    durationMinutes: 0,
    caloriesBurned: 0,
    exerciseCount: 0,
    perceivedExertion: null,
    notes: '',
    exercises: [],
    createdAt: '',
    updatedAt: '',
    ...overrides
  };
}

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    exerciseId: 'exercise-1',
    code: 'BACK_SQUAT',
    name: 'Back squat',
    description: '',
    exerciseType: 'STRENGTH',
    primaryMuscleGroup: 'QUADS',
    equipment: 'BARBELL',
    difficulty: 'INTERMEDIATE',
    status: 'ACTIVE',
    custom: false,
    ...overrides
  };
}

function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    planId: 'plan-1',
    name: 'Strength base',
    description: '',
    goalFocus: 'STRENGTH',
    workoutType: 'STRENGTH',
    difficulty: 'INTERMEDIATE',
    estimatedDurationMinutes: 45,
    status: 'ACTIVE',
    exerciseCount: 1,
    exercises: [],
    ...overrides
  };
}

function log(overrides: Partial<WorkoutExerciseLog> = {}): WorkoutExerciseLog {
  return {
    exerciseLogId: 'log-1',
    exerciseId: 'exercise-1',
    exerciseNameSnapshot: 'Back squat',
    sequence: 1,
    performedSets: 0,
    performedReps: 0,
    totalVolumeKg: null,
    distanceKm: null,
    durationSeconds: null,
    averageHeartRate: null,
    maxHeartRate: null,
    notes: '',
    sets: [],
    ...overrides
  };
}

describe('LiveLoggerComponent', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'startWorkoutPlan',
      'startAdHocSession',
      'addSessionExercise',
      'upsertSessionSet',
      'completeSession',
      'cancelSession'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    dataService.startWorkoutPlan.and.returnValue(of(detail()));
    dataService.startAdHocSession.and.returnValue(of(detail()));
    dataService.addSessionExercise.and.returnValue(
      of(
        detail({
          exerciseCount: 1,
          exercises: [
            {
              exerciseLogId: 'log-1',
              exerciseId: 'exercise-1',
              exerciseNameSnapshot: 'Back squat',
              sequence: 1,
              performedSets: 0,
              performedReps: 0,
              totalVolumeKg: null,
              distanceKm: null,
              durationSeconds: null,
              averageHeartRate: null,
              maxHeartRate: null,
              notes: '',
              sets: []
            }
          ]
        })
      )
    );
    dataService.upsertSessionSet.and.returnValue(of(detail()));
    dataService.completeSession.and.returnValue(of(detail({ status: 'COMPLETED' })));
    dataService.cancelSession.and.returnValue(of(detail({ status: 'CANCELLED' })));

    await TestBed.configureTestingModule({
      imports: [LiveLoggerComponent],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('refreshes from the returned session after adding an exercise', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);
    fixture.componentInstance.exercises = [exercise()];
    fixture.componentInstance.session.set(detail());
    fixture.componentInstance.exerciseForm.setValue({ exerciseId: 'exercise-1' });

    fixture.componentInstance.addExercise();

    expect(dataService.addSessionExercise).toHaveBeenCalledWith(
      'session-live',
      jasmine.objectContaining({ exerciseId: 'exercise-1', sequence: 1, sets: [] })
    );
    expect(fixture.componentInstance.session()?.exercises[0].exerciseLogId).toBe('log-1');
  });

  it('upserts a set with the session id, exercise log id, and set number path values', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);
    fixture.componentInstance.session.set(
      detail({
        exercises: [
          {
            exerciseLogId: 'log-1',
            exerciseId: 'exercise-1',
            exerciseNameSnapshot: 'Back squat',
            sequence: 1,
            performedSets: 0,
            performedReps: 0,
            totalVolumeKg: null,
            distanceKm: null,
            durationSeconds: null,
            averageHeartRate: null,
            maxHeartRate: null,
            notes: '',
            sets: []
          }
        ]
      })
    );
    const log = fixture.componentInstance.session()!.exercises[0];
    fixture.componentInstance.setForm(log).patchValue({ reps: 8, weightKg: 55, restSeconds: 120, perceivedExertion: 7 });

    fixture.componentInstance.saveSet(log);

    expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
      'session-live',
      'log-1',
      1,
      jasmine.objectContaining({ reps: 8, weightKg: 55, restSeconds: 120, perceivedExertion: 7 })
    );
  });

  it('emits complete after completing the live workout', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);
    const completedSpy = jasmine.createSpy('completed');
    fixture.componentInstance.completed.subscribe(completedSpy);
    fixture.componentInstance.session.set(detail());

    fixture.componentInstance.completeSession();

    expect(dataService.completeSession).toHaveBeenCalledWith('session-live');
    expect(completedSpy).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'COMPLETED' }));
  });

  it('does not write to terminal sessions', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);
    fixture.componentInstance.session.set(detail({ status: 'COMPLETED' }));
    fixture.componentInstance.exerciseForm.setValue({ exerciseId: 'exercise-1' });

    fixture.componentInstance.addExercise();
    fixture.componentInstance.completeSession();
    fixture.componentInstance.cancelSession();

    expect(dataService.addSessionExercise).not.toHaveBeenCalled();
    expect(dataService.completeSession).not.toHaveBeenCalled();
    expect(dataService.cancelSession).not.toHaveBeenCalled();
  });

  it('surfaces write failures through toast errors', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);
    dataService.addSessionExercise.and.returnValue(throwError(() => new Error('boom')));
    fixture.componentInstance.session.set(detail());
    fixture.componentInstance.exerciseForm.setValue({ exerciseId: 'exercise-1' });

    fixture.componentInstance.addExercise();

    expect(toast.error).toHaveBeenCalledWith('Unable to add exercise. Please retry.');
  });

  it('deduplicates plan options and starts the active fallback plan', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);
    fixture.componentInstance.activePlan = plan({ planId: 'plan-active', name: 'Active plan' });
    fixture.componentInstance.plans = [
      plan({ planId: 'plan-active', name: 'Duplicate active' }),
      plan({ planId: 'plan-draft', name: 'Draft plan', status: 'DRAFT' }),
      plan({ planId: 'plan-archived', name: 'Archived plan', status: 'ARCHIVED' }),
      plan({ planId: null, name: 'Sample plan' })
    ];

    expect(fixture.componentInstance.planOptions().map((item) => item.planId)).toEqual(['plan-active', 'plan-draft']);

    fixture.componentInstance.startSelectedPlan();

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-active');
    expect(fixture.componentInstance.session()?.sessionId).toBe('session-live');
    expect(toast.success).toHaveBeenCalledWith('Workout started.');
    expect(fixture.componentInstance.busy()).toBeFalse();
  });

  it('guards empty and busy plan starts and reports start errors', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);

    fixture.componentInstance.startPlan(null);
    expect(dataService.startWorkoutPlan).not.toHaveBeenCalled();

    fixture.componentInstance.busy.set(true);
    fixture.componentInstance.startPlan('plan-1');
    expect(dataService.startWorkoutPlan).not.toHaveBeenCalled();

    fixture.componentInstance.busy.set(false);
    dataService.startWorkoutPlan.and.returnValue(throwError(() => new Error('start failed')));
    fixture.componentInstance.startPlan('plan-1');

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-1');
    expect(toast.error).toHaveBeenCalledWith('Unable to start this plan. Please retry.');
  });

  it('starts ad hoc sessions only when the form is valid and not busy', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);

    fixture.componentInstance.startAdHoc();
    expect(dataService.startAdHocSession).not.toHaveBeenCalled();

    fixture.componentInstance.adHocForm.setValue({ name: 'Lunch lift', workoutType: 'STRENGTH' });
    fixture.componentInstance.busy.set(true);
    fixture.componentInstance.startAdHoc();
    expect(dataService.startAdHocSession).not.toHaveBeenCalled();

    fixture.componentInstance.busy.set(false);
    fixture.componentInstance.startAdHoc();

    expect(dataService.startAdHocSession).toHaveBeenCalledWith({ name: 'Lunch lift', workoutType: 'STRENGTH' });
    expect(toast.success).toHaveBeenCalledWith('Workout started.');
    expect(fixture.componentInstance.busy()).toBeFalse();
  });

  it('reports ad hoc start errors through toast', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);
    dataService.startAdHocSession.and.returnValue(throwError(() => new Error('ad hoc failed')));
    fixture.componentInstance.adHocForm.setValue({ name: 'Lunch lift', workoutType: 'STRENGTH' });

    fixture.componentInstance.startAdHoc();

    expect(toast.error).toHaveBeenCalledWith('Unable to start a workout. Please retry.');
  });

  it('guards exercise adds without a writable session, exercise, or free add slot', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);

    fixture.componentInstance.addExercise();
    expect(dataService.addSessionExercise).not.toHaveBeenCalled();

    fixture.componentInstance.session.set(detail({ sessionId: null as unknown as string }));
    fixture.componentInstance.exerciseForm.setValue({ exerciseId: 'exercise-1' });
    fixture.componentInstance.addExercise();
    expect(dataService.addSessionExercise).not.toHaveBeenCalled();

    fixture.componentInstance.session.set(detail());
    fixture.componentInstance.exerciseForm.setValue({ exerciseId: '' });
    fixture.componentInstance.addExercise();
    expect(dataService.addSessionExercise).not.toHaveBeenCalled();

    fixture.componentInstance.exerciseForm.setValue({ exerciseId: 'exercise-1' });
    fixture.componentInstance.addingExercise.set(true);
    fixture.componentInstance.addExercise();
    expect(dataService.addSessionExercise).not.toHaveBeenCalled();
  });

  it('reuses set forms, saves existing set numbers, and reports save errors', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);
    const existingSet = {
      setLogId: 'set-1',
      setNumber: 2,
      reps: 5,
      weightKg: 80,
      durationSeconds: null,
      distanceKm: null,
      restSeconds: 120,
      perceivedExertion: 8,
      notes: 'Top set',
      logged: true
    };
    const currentLog = log({ sets: [existingSet] });
    fixture.componentInstance.session.set(detail({ exercises: [currentLog] }));

    const first = fixture.componentInstance.setForm(currentLog, existingSet);
    const second = fixture.componentInstance.setForm(currentLog, existingSet);
    expect(second).toBe(first);

    first.patchValue({ reps: 6 });
    fixture.componentInstance.saveSet(currentLog, existingSet);

    expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
      'session-live',
      'log-1',
      2,
      jasmine.objectContaining({ reps: 6, weightKg: 80 })
    );

    dataService.upsertSessionSet.calls.reset();
    dataService.upsertSessionSet.and.returnValue(throwError(() => new Error('save failed')));
    fixture.componentInstance.saveSet(currentLog, existingSet);

    expect(toast.error).toHaveBeenCalledWith('Unable to save this set. Please retry.');
  });

  it('guards set saves when the form is invalid or another set is saving', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);
    const currentLog = log();
    fixture.componentInstance.session.set(detail({ exercises: [currentLog] }));
    fixture.componentInstance.setForm(currentLog).patchValue({ perceivedExertion: 11 });

    fixture.componentInstance.saveSet(currentLog);
    expect(dataService.upsertSessionSet).not.toHaveBeenCalled();

    fixture.componentInstance.setForm(currentLog).patchValue({ perceivedExertion: 7 });
    fixture.componentInstance.savingSet.set('other-log:1');
    fixture.componentInstance.saveSet(currentLog);

    expect(dataService.upsertSessionSet).not.toHaveBeenCalled();
  });

  it('emits cancel after cancelling the live workout and reports terminal action errors', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);
    const cancelledSpy = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelledSpy);
    fixture.componentInstance.session.set(detail());

    fixture.componentInstance.cancelSession();

    expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
    expect(cancelledSpy).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'CANCELLED' }));

    dataService.completeSession.and.returnValue(throwError(() => new Error('complete failed')));
    fixture.componentInstance.session.set(detail());
    fixture.componentInstance.completeSession();
    expect(toast.error).toHaveBeenCalledWith('Unable to complete workout. Please retry.');

    dataService.cancelSession.and.returnValue(throwError(() => new Error('cancel failed')));
    fixture.componentInstance.busy.set(false);
    fixture.componentInstance.cancelSession();
    expect(toast.error).toHaveBeenCalledWith('Unable to cancel workout. Please retry.');
  });

  it('formats labels, numbers, and next set numbers', () => {
    const fixture = TestBed.createComponent(LiveLoggerComponent);

    expect(fixture.componentInstance.formatLabel(null)).toBe('');
    expect(fixture.componentInstance.formatLabel('PUSH_PRESS')).toBe('Push Press');
    expect(fixture.componentInstance.formatNumber(null)).toBe('\u2014');
    expect(fixture.componentInstance.formatNumber(42, 'kg')).toBe('42kg');
    expect(fixture.componentInstance.nextSetNumber(log({ sets: [{ setNumber: 3 } as any, { setNumber: 1 } as any] }))).toBe(4);
  });
});
