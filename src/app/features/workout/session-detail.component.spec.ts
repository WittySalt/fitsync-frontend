import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { SessionDetailComponent } from './session-detail.component';

function detail(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-1',
    planId: null,
    name: 'Push day',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    source: 'MANUAL',
    startedAt: '2026-06-20T10:00:00Z',
    completedAt: '2026-06-20T11:00:00Z',
    durationMinutes: 60,
    caloriesBurned: 420,
    exerciseCount: 1,
    perceivedExertion: 8,
    notes: 'Solid work',
    createdAt: '',
    updatedAt: '',
    exercises: [
      {
        exerciseLogId: 'log-1',
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Bench press',
        sequence: 1,
        performedSets: 1,
        performedReps: 5,
        totalVolumeKg: 500,
        distanceKm: null,
        durationSeconds: null,
        averageHeartRate: null,
        maxHeartRate: null,
        notes: 'Top movement',
        sets: [
          {
            setLogId: 'set-1',
            setNumber: 1,
            reps: 5,
            weightKg: 100,
            durationSeconds: null,
            distanceKm: null,
            restSeconds: 180,
            perceivedExertion: 8,
            logged: true,
            notes: 'Top set'
          }
        ]
      }
    ],
    ...overrides
  };
}

describe('SessionDetailComponent', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getSession',
      'updateSession',
      'deleteSession',
      'repeatSession',
      'getExerciseMetadata'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    dataService.getSession.and.returnValue(of(detail()));
    dataService.updateSession.and.returnValue(of(detail({ name: 'Updated push' })));
    dataService.deleteSession.and.returnValue(of(void 0));
    dataService.repeatSession.and.returnValue(of(detail({ sessionId: 'session-2', status: 'IN_PROGRESS' })));
    dataService.getExerciseMetadata.and.returnValue(
      of({
        exerciseTypes: ['STRENGTH'],
        muscleGroups: [],
        equipment: [],
        difficulties: [],
        workoutTypes: ['STRENGTH', 'CARDIO'],
        goalFocuses: []
      })
    );

    await TestBed.configureTestingModule({
      imports: [SessionDetailComponent],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('sends completedAt and preserves exercises when editing a completed session', () => {
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startEdit();
    fixture.componentInstance.editForm.patchValue({ name: 'Updated push', durationMinutes: 55 });
    fixture.componentInstance.saveEdit();

    const [, body] = dataService.updateSession.calls.mostRecent().args;
    expect(dataService.updateSession).toHaveBeenCalledWith('session-1', jasmine.any(Object));
    expect(body.completedAt).toBe('2026-06-20T11:00:00Z');
    expect(body.exercises.length).toBe(1);
    expect(body.exercises[0]).toEqual(
      jasmine.objectContaining({
        exerciseId: 'exercise-1',
        sequence: 1,
        totalVolumeKg: 500
      })
    );
    expect(body.exercises[0].sets[0]).toEqual(
      jasmine.objectContaining({
        setNumber: 1,
        reps: 5,
        weightKg: 100
      })
    );
  });

  it('omits completedAt when editing a non-completed session', () => {
    dataService.getSession.and.returnValue(of(detail({ status: 'IN_PROGRESS', completedAt: '' })));
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startEdit();
    fixture.componentInstance.saveEdit();

    const [, body] = dataService.updateSession.calls.mostRecent().args;
    expect(Object.prototype.hasOwnProperty.call(body, 'completedAt')).toBeFalse();
    expect(body.status).toBe('IN_PROGRESS');
    expect(body.exercises.length).toBe(1);
  });

  it('deletes a session after confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.deleteSession();

    expect(window.confirm).toHaveBeenCalledWith('Delete Push day?');
    expect(dataService.deleteSession).toHaveBeenCalledWith('session-1');
    expect(toast.success).toHaveBeenCalledWith('Session deleted.');
  });

  it('repeats the selected session', () => {
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.repeatThis();

    expect(dataService.repeatSession).toHaveBeenCalledWith('session-1');
    expect(toast.success).toHaveBeenCalledWith('Workout repeated.');
  });

  it('surfaces write failures through toast errors', () => {
    dataService.updateSession.and.returnValue(throwError(() => new Error('nope')));
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startEdit();
    fixture.componentInstance.saveEdit();

    expect(toast.error).toHaveBeenCalledWith('Unable to update session. Please retry.');
    expect(fixture.componentInstance.saving()).toBeFalse();
  });
});
