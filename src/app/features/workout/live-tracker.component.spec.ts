import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { LiveTrackerComponent } from './live-tracker.component';
import { LiveTrackerGoal } from './live-tracker.models';
import { WorkoutLiveService } from './workout-live.service';

function detail(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-live',
    planId: null,
    name: 'Goal workout',
    workoutType: 'CARDIO',
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

describe('LiveTrackerComponent', () => {
  let fixture: ComponentFixture<LiveTrackerComponent>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let live: WorkoutLiveService;

  beforeEach(async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'startWorkoutPlan',
      'startAdHocSession',
      'getActiveWorkout',
      'upsertSessionSet',
      'completeSession',
      'cancelSession'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    dataService.startAdHocSession.and.callFake(() => of(detail({ startedAt: new Date().toISOString() })));
    dataService.getActiveWorkout.and.returnValue(of(null));
    dataService.completeSession.and.returnValue(of(detail({ status: 'COMPLETED' })));
    dataService.cancelSession.and.returnValue(of(detail({ status: 'CANCELLED' })));

    await TestBed.configureTestingModule({
      imports: [LiveTrackerComponent],
      providers: [
        WorkoutLiveService,
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    live = TestBed.inject(WorkoutLiveService);
    fixture = TestBed.createComponent(LiveTrackerComponent);
  });

  afterEach(() => {
    live.reset();
  });

  function startTracker(goal: LiveTrackerGoal = { type: 'MINUTES', target: 2 }): void {
    live.startAdHoc({ name: 'Goal workout', workoutType: 'CARDIO' }).subscribe((session) => {
      fixture.componentRef.setInput('session', session);
      fixture.componentRef.setInput('goal', goal);
    });
    fixture.detectChanges();
  }

  it('updates elapsed time and goal progress for target minutes', fakeAsync(() => {
    startTracker({ type: 'MINUTES', target: 2 });

    tick(60_000);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1:00');
    expect(fixture.nativeElement.textContent).toContain('1 min / 2 min');
    expect(fixture.nativeElement.textContent).toContain('50% complete');
  }));

  it('shows estimated calories and labels heart rate as mock', fakeAsync(() => {
    startTracker({ type: 'CALORIES', target: 100 });

    tick(30_000);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('estimated');
    expect(fixture.nativeElement.textContent).toContain('mock bpm');
  }));

  it('terminates short sessions by cancelling them', fakeAsync(() => {
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelled);
    startTracker();

    tick(30_000);
    fixture.debugElement.query(By.css('.tracker-actions .button.danger')).nativeElement.click();

    expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
    expect(dataService.completeSession).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Workout was under 60 seconds, so it was cancelled and will not count toward metrics.');
    expect(cancelled).toHaveBeenCalled();
  }));

  it('terminates sessions of at least 60 seconds by completing them', fakeAsync(() => {
    const completed = jasmine.createSpy('completed');
    fixture.componentInstance.completed.subscribe(completed);
    startTracker();

    tick(60_000);
    fixture.debugElement.query(By.css('.tracker-actions .button.danger')).nativeElement.click();

    expect(dataService.completeSession).toHaveBeenCalledWith('session-live');
    expect(dataService.cancelSession).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Workout completed.');
    expect(completed).toHaveBeenCalled();
  }));

  it('surfaces finish failures through toast', fakeAsync(() => {
    dataService.completeSession.and.returnValue(throwError(() => new Error('boom')));
    startTracker();

    tick(60_000);
    fixture.debugElement.query(By.css('.tracker-actions .button.danger')).nativeElement.click();

    expect(toast.error).toHaveBeenCalledWith('Unable to finish workout. Please retry.');
  }));

  it('does not terminate when the confirmation is dismissed', fakeAsync(() => {
    (window.confirm as jasmine.Spy).and.returnValue(false);
    startTracker();

    tick(60_000);
    fixture.componentInstance.terminate();

    expect(dataService.completeSession).not.toHaveBeenCalled();
    expect(dataService.cancelSession).not.toHaveBeenCalled();
  }));

  it('offers a Minimise control that says so to its owner', () => {
    const minimised = jasmine.createSpy('minimise');
    fixture.componentInstance.minimise.subscribe(minimised);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.minimise')?.click();

    expect(minimised).toHaveBeenCalledTimes(1);
  });
});
