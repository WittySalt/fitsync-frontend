import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { ToastService } from '../../core/toast/toast.service';
import { Exercise, WorkoutSessionDetail } from '../../core/fitsync.models';
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
});
