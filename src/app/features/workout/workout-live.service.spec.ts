import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { WorkoutLiveService } from './workout-live.service';

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

describe('WorkoutLiveService', () => {
  let service: WorkoutLiveService;
  let dataService: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(() => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'startWorkoutPlan',
      'startAdHocSession',
      'upsertSessionSet',
      'completeSession',
      'cancelSession'
    ]);
    dataService.startWorkoutPlan.and.returnValue(of(session()));
    dataService.startAdHocSession.and.returnValue(of(session({ planId: null, source: 'MANUAL' })));
    dataService.upsertSessionSet.and.returnValue(of(session()));
    dataService.completeSession.and.returnValue(of(session({ status: 'COMPLETED' })));
    dataService.cancelSession.and.returnValue(of(session({ status: 'CANCELLED' })));

    TestBed.configureTestingModule({
      providers: [
        WorkoutLiveService,
        { provide: FitSyncDataService, useValue: dataService }
      ]
    });
    service = TestBed.inject(WorkoutLiveService);
  });

  afterEach(() => {
    service.reset();
  });

  it('starts from a plan and exposes elapsed time, mock heart rate, and estimated calories', fakeAsync(() => {
    service.startFromPlan('plan-1').subscribe();

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-1');
    expect(service.session()?.sessionId).toBe('session-live');
    expect(service.heartRate()).toBeGreaterThanOrEqual(110);
    expect(service.heartRate()).toBeLessThanOrEqual(150);

    tick(30_000);

    expect(service.elapsedSeconds()).toBe(30);
    expect(service.estimatedCalories()).toBe(3);
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
});
