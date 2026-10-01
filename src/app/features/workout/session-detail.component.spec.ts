import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { SessionDetailComponent } from './session-detail.component';
import { WorkoutLiveService } from './workout-live.service';

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
      'getActiveWorkout',
      'getExerciseMetadata',
      'getExercises'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    dataService.getSession.and.returnValue(of(detail()));
    dataService.updateSession.and.returnValue(of(detail({ name: 'Updated push' })));
    dataService.deleteSession.and.returnValue(of(void 0));
    dataService.getActiveWorkout.and.returnValue(of(null));
    dataService.repeatSession.and.returnValue(of(detail({ sessionId: 'session-2', status: 'IN_PROGRESS' })));
    dataService.getExerciseMetadata.and.returnValue(
      of({
        exerciseTypes: ['STRENGTH'],
        muscleGroups: [],
        equipment: [],
        difficulties: [],
        workoutTypes: ['STRENGTH', 'CARDIO'],
        goalFocuses: [],
        sportActivities: []
      })
    );
    dataService.getExercises.and.returnValue(
      of([
        {
          exerciseId: 'exercise-1',
          code: 'bench-press',
          name: 'Bench press',
          description: '',
          exerciseType: 'STRENGTH',
          primaryMuscleGroup: 'CHEST',
          equipment: 'BARBELL',
          difficulty: 'INTERMEDIATE',
          status: 'ACTIVE',
          custom: false
        },
        {
          exerciseId: 'exercise-2',
          code: 'row',
          name: 'Row',
          description: '',
          exerciseType: 'STRENGTH',
          primaryMuscleGroup: 'BACK',
          equipment: 'CABLE',
          difficulty: 'BEGINNER',
          status: 'ACTIVE',
          custom: false
        }
      ])
    );

    await TestBed.configureTestingModule({
      imports: [SessionDetailComponent],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('shows the distance and the sport label of a sport session', () => {
    dataService.getSession.and.returnValue(
      of(detail({ workoutType: 'SPORTS', sportActivity: 'CYCLING', sportLabel: 'Cycling', distanceKm: 24.5 }))
    );
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.sub')?.textContent).toContain('Cycling');
    expect(root.querySelector('.sub')?.textContent).not.toContain('Sports');
    expect(root.querySelector('app-session-record .stats')?.textContent?.replace(/\s+/g, '')).toContain('Distance24.5km');
  });

  it('shows no distance for a session without one', () => {
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-session-record .stats')?.textContent).not.toContain('Distance');
  });

  it('sends completedAt and preserves session timing and exercises when editing details', () => {
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startEdit();
    fixture.componentInstance.editForm.patchValue({ name: 'Updated push' });
    fixture.componentInstance.saveEdit();

    const [, body] = dataService.updateSession.calls.mostRecent().args;
    expect(dataService.updateSession).toHaveBeenCalledWith('session-1', jasmine.any(Object));
    expect(body.completedAt).toBe('2026-06-20T11:00:00Z');
    expect(body.durationMinutes).toBe(60);
    expect(body.caloriesBurned).toBe(420);
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

  it('derives duration from timestamps and preserves blank calorie estimates', () => {
    dataService.getSession.and.returnValue(of(detail({ durationMinutes: null, caloriesBurned: null })));
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startEdit();
    fixture.componentInstance.editForm.patchValue({ caloriesBurned: null });
    fixture.componentInstance.saveEdit();

    const [, body] = dataService.updateSession.calls.mostRecent().args;
    expect(body.durationMinutes).toBe(60);
    expect(body.caloriesBurned).toBeNull();
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

  it('sends edited set values in the full exercise update request and reflects the response', () => {
    const initial = detail();
    const updated = detail({
      exercises: [
        {
          ...initial.exercises[0],
          performedReps: 6,
          totalVolumeKg: 600,
          sets: [{ ...initial.exercises[0].sets[0], reps: 6 }]
        }
      ]
    });
    dataService.getSession.and.returnValues(of(initial), of(updated));
    dataService.updateSession.and.returnValue(of(updated));
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startExerciseEdit();
    fixture.componentInstance.exerciseSetGroups(0)[0].controls.reps.setValue(6);
    fixture.componentInstance.saveExerciseEdit();

    const [, body] = dataService.updateSession.calls.mostRecent().args;
    expect(body.exercises[0]).toEqual(
      jasmine.objectContaining({
        exerciseId: 'exercise-1',
        sequence: 1,
        performedSets: 1,
        performedReps: 6,
        totalVolumeKg: 600
      })
    );
    expect(body.exercises[0].sets[0]).toEqual(
      jasmine.objectContaining({
        setNumber: 1,
        reps: 6,
        weightKg: 100,
        restSeconds: 180,
        perceivedExertion: 8
      })
    );
    expect(fixture.componentInstance.session()?.exercises[0].totalVolumeKg).toBe(600);
    expect(dataService.getSession).toHaveBeenCalledWith('session-1');
    expect(toast.success).toHaveBeenCalledWith('Exercises updated.');
  });

  it('adds and removes exercises and sets before saving', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startExerciseEdit();
    fixture.componentInstance.addSet(0);
    fixture.componentInstance.exerciseSetGroups(0)[1].patchValue({ reps: 8, weightKg: 80 });
    fixture.componentInstance.removeSet(0, 0);
    fixture.componentInstance.addExerciseForm.setValue({ exerciseId: 'exercise-2' });
    fixture.componentInstance.addExercise();
    fixture.componentInstance.removeExercise(0);
    fixture.componentInstance.saveExerciseEdit();

    const [, body] = dataService.updateSession.calls.mostRecent().args;
    expect(window.confirm).toHaveBeenCalledWith('Remove set 1?');
    expect(window.confirm).toHaveBeenCalledWith('Remove Bench press?');
    expect(body.exercises.length).toBe(1);
    expect(body.exercises[0]).toEqual(
      jasmine.objectContaining({
        exerciseId: 'exercise-2',
        sequence: 1,
        performedSets: null,
        performedReps: null,
        totalVolumeKg: null
      })
    );
    expect(body.exercises[0].sets).toEqual([]);
  });

  it('blocks exercise saves when edited set values are invalid', () => {
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startExerciseEdit();
    fixture.componentInstance.exerciseSetGroups(0)[0].controls.reps.setValue(1.5);
    fixture.componentInstance.saveExerciseEdit();

    expect(fixture.componentInstance.exerciseEditForm.invalid).toBeTrue();
    expect(dataService.updateSession).not.toHaveBeenCalled();
  });

  it('allows exercise editing for a completed session whatever its source', () => {
    dataService.getSession.and.returnValue(of(detail({ source: 'LIVE' })));
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startExerciseEdit();

    expect(fixture.componentInstance.exerciseEditing()).toBeTrue();
  });

  it('keeps exercise editing read-only until the session is completed', () => {
    dataService.getSession.and.returnValue(of(detail({ status: 'CANCELLED' })));
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startExerciseEdit();

    expect(fixture.componentInstance.exerciseEditing()).toBeFalse();
    expect(fixture.componentInstance.exerciseEditUnavailableLabel(detail({ status: 'CANCELLED' }))).toBe(
      'Only completed sessions can edit exercises'
    );
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

  it('reorders exercises and ignores out-of-range moves', () => {
    const second = { ...detail().exercises[0], exerciseLogId: 'log-2', exerciseId: 'exercise-2', exerciseNameSnapshot: 'Row', sequence: 2 };
    const twoExercises = detail({ exercises: [detail().exercises[0], second] });
    dataService.getSession.and.returnValue(of(twoExercises));
    dataService.updateSession.and.returnValue(of(twoExercises));
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startExerciseEdit();
    fixture.componentInstance.moveExercise(0, -1);
    fixture.componentInstance.moveExercise(1, 1);
    fixture.componentInstance.moveExercise(1, -1);
    fixture.componentInstance.saveExerciseEdit();

    const [, body] = dataService.updateSession.calls.mostRecent().args;
    expect(body.exercises[0].exerciseId).toBe('exercise-2');
    expect(body.exercises[1].exerciseId).toBe('exercise-1');
  });

  it('cancels detail and exercise edit modes', () => {
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startEdit();
    fixture.componentInstance.cancelEdit();
    expect(fixture.componentInstance.editing()).toBeFalse();

    fixture.componentInstance.startExerciseEdit();
    expect(fixture.componentInstance.exerciseEditing()).toBeTrue();
    fixture.componentInstance.cancelExerciseEdit();
    expect(fixture.componentInstance.exerciseEditing()).toBeFalse();
  });

  it('surfaces exercise update failures through toast errors', () => {
    dataService.updateSession.and.returnValue(throwError(() => new Error('nope')));
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startExerciseEdit();
    fixture.componentInstance.saveExerciseEdit();

    expect(toast.error).toHaveBeenCalledWith('Unable to update exercises. Please retry.');
    expect(fixture.componentInstance.saving()).toBeFalse();
  });

  it('surfaces delete and repeat failures through toast errors', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    dataService.deleteSession.and.returnValue(throwError(() => new Error('nope')));
    dataService.repeatSession.and.returnValue(throwError(() => new Error('nope')));
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.deleteSession();
    expect(toast.error).toHaveBeenCalledWith('Unable to delete session. Please retry.');

    fixture.componentInstance.repeatThis();
    expect(toast.error).toHaveBeenCalledWith('Unable to repeat session. Please retry.');
  });

  it('keeps exercises and sets when removal is not confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.startExerciseEdit();
    const setsBefore = fixture.componentInstance.exerciseSetGroups(0).length;
    fixture.componentInstance.removeSet(0, 0);
    fixture.componentInstance.removeExercise(0);

    expect(fixture.componentInstance.exerciseSetGroups(0).length).toBe(setsBefore);
    expect(fixture.componentInstance.exerciseGroups().length).toBe(1);
  });

  it('formats missing or invalid dates as a dash', () => {
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    expect(fixture.componentInstance.formatDate(null)).toBe('-');
    expect(fixture.componentInstance.formatDate('not-a-date')).toBe('-');
  });

  it('clears the session when no id is provided', () => {
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = null;
    fixture.detectChanges();

    expect(fixture.componentInstance.session()).toBeNull();
  });

  it('surfaces load failures through toast errors', () => {
    dataService.getSession.and.returnValue(throwError(() => new Error('nope')));
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Unable to load session detail.');
    expect(fixture.componentInstance.session()).toBeNull();
  });

  describe('a workout the server closed by itself', () => {
    function opened(overrides: Partial<WorkoutSessionDetail>) {
      dataService.getSession.and.returnValue(of(detail(overrides)));
      const fixture = TestBed.createComponent(SessionDetailComponent);
      fixture.componentInstance.sessionId = 'session-1';
      fixture.detectChanges();
      return fixture;
    }

    const clock = (iso: string) => {
      const date = new Date(iso);
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    it('says when a completed session ended automatically', () => {
      const fixture = opened({ autoClosedAt: '2026-06-20T11:05:00Z' });

      const line = (fixture.nativeElement as HTMLElement).querySelector('.session-notes')?.textContent?.trim();
      expect(line).toBe(`Ended automatically at ${clock('2026-06-20T11:00:00Z')}, the time of your last set.`);
    });

    it('says that a cancelled session was closed with no set logged', () => {
      const fixture = opened({ status: 'CANCELLED', completedAt: '', autoClosedAt: '2026-06-20T14:00:00Z' });

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Closed automatically. No set was logged.');
    });

    it('adds no line for a session the person ended', () => {
      const fixture = opened({ autoClosedAt: null, notes: '' });

      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('automatically');
    });
  });

  describe('editing when a completed session ended', () => {
    const clock = (iso: string) => {
      const date = new Date(iso);
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    function editing(overrides: Partial<WorkoutSessionDetail> = {}) {
      dataService.getSession.and.returnValue(of(detail(overrides)));
      const fixture = TestBed.createComponent(SessionDetailComponent);
      fixture.componentInstance.sessionId = 'session-1';
      fixture.detectChanges();
      fixture.componentInstance.startEdit();
      fixture.detectChanges();
      return fixture;
    }

    it('offers Ended at for a completed session, filled with the time it ended', () => {
      const fixture = editing();

      expect(fixture.componentInstance.editForm.controls.endedAt.value).toBe(clock('2026-06-20T11:00:00Z'));
      expect((fixture.nativeElement as HTMLElement).querySelector('input[type="time"]')).not.toBeNull();
    });

    it('offers no Ended at for a cancelled session', () => {
      const fixture = editing({ status: 'CANCELLED' });

      expect((fixture.nativeElement as HTMLElement).querySelector('input[type="time"]')).toBeNull();
    });

    it('sends the new end as completedAt on the day it ended, and the duration follows it', () => {
      const fixture = editing();
      const started = new Date('2026-06-20T10:00:00Z');
      const target = new Date('2026-06-20T11:00:00Z');
      target.setHours(target.getHours(), target.getMinutes() + 30, 0, 0);
      fixture.componentInstance.editForm.patchValue({ endedAt: clock(target.toISOString()) });

      fixture.componentInstance.saveEdit();

      const sent = dataService.updateSession.calls.mostRecent().args[1];
      expect(new Date(sent.completedAt as string).getTime()).toBe(target.getTime());
      expect(sent.durationMinutes).toBe(Math.round((target.getTime() - started.getTime()) / 60_000));
    });

    it('keeps the stored end when the time is left alone', () => {
      const fixture = editing();

      fixture.componentInstance.saveEdit();

      expect(dataService.updateSession.calls.mostRecent().args[1].completedAt).toBe('2026-06-20T11:00:00Z');
    });

    it('refuses an end before the start', () => {
      const fixture = editing();
      fixture.componentInstance.editForm.patchValue({ endedAt: '00:01' });
      fixture.detectChanges();

      fixture.componentInstance.saveEdit();

      expect(fixture.componentInstance.endedAtBeforeStart()).toBeTrue();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('The end cannot come before the start.');
      expect(dataService.updateSession).not.toHaveBeenCalled();
    });
  });

  it('starts the repeat through the one start path, and leaves a refused repeat to the shared dialog', () => {
    dataService.repeatSession.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'ACTIVE_SESSION_EXISTS', data: { sessionId: 'running', name: 'Running', startedAt: '2026-06-20T10:00:00Z' } }
          })
      )
    );
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.componentInstance.sessionId = 'session-1';
    fixture.detectChanges();

    fixture.componentInstance.repeatThis();

    expect(toast.error).not.toHaveBeenCalled();
    expect(TestBed.inject(WorkoutLiveService).pendingStart()?.info.sessionId).toBe('running');
    expect(fixture.componentInstance.saving()).toBeFalse();
  });
});
