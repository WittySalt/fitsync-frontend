import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  WorkoutPlan,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { ExercisePlayerComponent } from './exercise-player.component';
import { WorkoutLiveService } from './workout-live.service';

function detail(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-live',
    planId: 'plan-1',
    name: 'Today strength',
    workoutType: 'STRENGTH',
    status: 'IN_PROGRESS',
    source: 'PLAN',
    startedAt: '2026-06-20T02:00:00Z',
    completedAt: '',
    durationMinutes: 0,
    caloriesBurned: 0,
    exerciseCount: 2,
    perceivedExertion: null,
    notes: '',
    exercises: [
      {
        exerciseLogId: 'log-1',
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Goblet Squat',
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
      },
      {
        exerciseLogId: 'log-2',
        exerciseId: 'exercise-2',
        exerciseNameSnapshot: 'Push-Up',
        sequence: 2,
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
    ],
    createdAt: '',
    updatedAt: '',
    ...overrides
  };
}

function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    planId: 'plan-1',
    name: 'Today plan',
    description: '',
    goalFocus: 'STRENGTH',
    workoutType: 'STRENGTH',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 30,
    status: 'ACTIVE',
    exerciseCount: 2,
    exercises: [
      {
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Goblet Squat',
        sequence: 1,
        targetSets: 1,
        targetReps: 10,
        targetWeightKg: 20,
        targetDurationSeconds: null,
        targetDistanceKm: null,
        restSeconds: 1,
        notes: '',
        setTargets: []
      },
      {
        exerciseId: 'exercise-2',
        exerciseNameSnapshot: 'Push-Up',
        sequence: 2,
        targetSets: 1,
        targetReps: 8,
        targetWeightKg: null,
        targetDurationSeconds: null,
        targetDistanceKm: null,
        restSeconds: 0,
        notes: '',
        setTargets: []
      }
    ],
    ...overrides
  };
}

describe('ExercisePlayerComponent', () => {
  let fixture: ComponentFixture<ExercisePlayerComponent>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let live: WorkoutLiveService;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'startWorkoutPlan',
      'startAdHocSession',
      'upsertSessionSet',
      'completeSession',
      'cancelSession'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    dataService.upsertSessionSet.and.returnValue(of(detail({
      exercises: [
        {
          ...detail().exercises[0],
          performedSets: 1,
          performedReps: 10,
          sets: [{
            setLogId: 'set-1',
            setNumber: 1,
            reps: 10,
            weightKg: 20,
            durationSeconds: null,
            distanceKm: null,
            restSeconds: 1,
            perceivedExertion: null,
            logged: true,
            notes: ''
          }]
        },
        detail().exercises[1]
      ]
    })));
    dataService.completeSession.and.returnValue(of(detail({ status: 'COMPLETED' })));
    dataService.cancelSession.and.returnValue(of(detail({ status: 'CANCELLED' })));

    await TestBed.configureTestingModule({
      imports: [ExercisePlayerComponent],
      providers: [
        WorkoutLiveService,
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    live = TestBed.inject(WorkoutLiveService);
    fixture = TestBed.createComponent(ExercisePlayerComponent);
    fixture.componentRef.setInput('session', detail());
    fixture.componentRef.setInput('activePlan', plan());
    fixture.detectChanges();
  });

  afterEach(() => {
    live.reset();
  });

  it('saves the current set with session, exercise log, set number, and target values', () => {
    fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();

    expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
      'session-live',
      'log-1',
      1,
      jasmine.objectContaining({ reps: 10, weightKg: 20, restSeconds: 1 })
    );
  });

  it('shows the rest countdown after completing a set', () => {
    fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Rest');
    expect(fixture.nativeElement.textContent).toContain('0:01');
  });

  it('advances to the next exercise after rest finishes', fakeAsync(() => {
    fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();
    tick(1_000);
    fixture.detectChanges();

    expect(fixture.componentInstance.currentLog()?.exerciseLogId).toBe('log-2');
    expect(fixture.nativeElement.textContent).toContain('Push-Up');
  }));

  it('labels heart rate as mock and calories as estimated', () => {
    live.heartRate.set(128);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('128 bpm mock');
    expect(fixture.nativeElement.textContent).toContain('kcal estimated');
  });

  it('starts focused on the requested initial exercise', () => {
    const focused = TestBed.createComponent(ExercisePlayerComponent);
    focused.componentRef.setInput('session', detail());
    focused.componentRef.setInput('activePlan', plan());
    focused.componentRef.setInput('initialExerciseId', 'exercise-2');
    focused.detectChanges();

    expect(focused.componentInstance.currentLog()?.exerciseLogId).toBe('log-2');
    expect(focused.nativeElement.textContent).toContain('Push-Up');
  });

  it('surfaces set write failures through toast', () => {
    dataService.upsertSessionSet.and.returnValue(throwError(() => new Error('boom')));

    fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();

    expect(toast.error).toHaveBeenCalledWith('Unable to save this set. Please retry.');
  });
});
