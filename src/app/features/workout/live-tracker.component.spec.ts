import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { AnalyticsApiService } from '../../core/analytics-api.service';
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
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'startWorkoutPlan',
      'startAdHocSession',
      'getActiveWorkout',
      'upsertSessionSet',
      'completeSession',
      'cancelSession',
      'updateSessionSegment'
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
        { provide: ToastService, useValue: toast },
        { provide: AnalyticsApiService, useValue: { getAchievements: () => of({ achievements: [] }) } }
      ]
    }).compileComponents();

    live = TestBed.inject(WorkoutLiveService);
    fixture = TestBed.createComponent(LiveTrackerComponent);
  });

  afterEach(() => {
    live.reset();
  });

  function endWorkout(): void {
    fixture.debugElement.query(By.css('.tracker-actions .button.danger')).nativeElement.click();
    fixture.detectChanges();
    fixture.debugElement.query(By.css('.tracker-actions .end-workout')).nativeElement.click();
  }

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

  it('carries the "?" of the guide beside Pause, and anchors the figures and the end of the workout', fakeAsync(() => {
    startTracker({ type: 'MINUTES', target: 2 });

    const entry = fixture.nativeElement.querySelector('.tracker-tools app-how-this-works') as HTMLElement;
    expect(entry.querySelector('.round')?.getAttribute('aria-label')).toBe('How this works');
    (entry.querySelector('.round') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(entry.querySelector('.eyebrow')?.textContent?.trim()).toBe('The live tracker');
    const steps = Array.from(fixture.nativeElement.querySelectorAll('[appspotlight="workout-live"]')).map((anchor) => (anchor as HTMLElement).getAttribute('spotlightstep'));
    expect(steps).toEqual(['figures', 'finish']);
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
    endWorkout();

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
    endWorkout();

    expect(dataService.completeSession).toHaveBeenCalledWith('session-live');
    expect(dataService.cancelSession).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Workout completed.');
    expect(completed).toHaveBeenCalled();
  }));

  it('surfaces finish failures through toast', fakeAsync(() => {
    dataService.completeSession.and.returnValue(throwError(() => new Error('boom')));
    startTracker();

    tick(60_000);
    endWorkout();

    expect(toast.error).toHaveBeenCalledWith('Unable to finish workout. Please retry.');
  }));

  it('asks inline before ending, and Keep going leaves the workout running', fakeAsync(() => {
    startTracker();
    tick(60_000);
    fixture.debugElement.query(By.css('.tracker-actions .button.danger')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tracker-actions').textContent).toContain('End this workout? Sessions under 60 seconds are not saved.');
    expect(dataService.completeSession).not.toHaveBeenCalled();
    fixture.debugElement.query(By.css('.tracker-actions .quiet')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.end-workout')).toBeNull();
    expect(dataService.completeSession).not.toHaveBeenCalled();
    expect(dataService.cancelSession).not.toHaveBeenCalled();
    fixture.componentInstance.terminate();
    tick(1000);
  }));

  it('offers a Minimise control that says so to its owner', () => {
    const minimised = jasmine.createSpy('minimise');
    fixture.componentInstance.minimise.subscribe(minimised);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.minimise')?.click();

    expect(minimised).toHaveBeenCalledTimes(1);
  });

  describe('with segments', () => {
    const segments = [
      { entryId: 'e1', position: 1, kind: 'WARMUP' as const, label: 'Warm-up', plannedSeconds: 5, actualSeconds: null, startedAt: null, status: 'PENDING' as const },
      { entryId: 'e2', position: 2, kind: 'STEADY' as const, label: 'Steady', plannedSeconds: 20, actualSeconds: null, startedAt: null, status: 'PENDING' as const }
    ];

    function startSegmented(entryIds = true): void {
      const withIds = entryIds ? segments : segments.map((segment) => ({ ...segment, entryId: null }));
      dataService.startAdHocSession.and.callFake(() => of(detail({ startedAt: new Date().toISOString(), segments: withIds })));
      dataService.updateSessionSegment.and.returnValue(of(detail({ segments })));
      startTracker();
    }

    const text = () => fixture.nativeElement.textContent as string;

    it('shows the strip and the line above the clock', fakeAsync(() => {
      startSegmented();
      expect(fixture.nativeElement.querySelector('app-segment-strip')).not.toBeNull();
      expect(text()).toContain('Warm-up · 0:05 left · Next: Steady 0:20');
      tick(1000);
      fixture.detectChanges();
      expect(text()).toContain('Warm-up · 0:04 left');
      fixture.componentInstance.terminate();
      tick(1000);
    }));

    it('counts 3-2-1, then advances on the planned time and writes the segment', fakeAsync(() => {
      startSegmented();
      tick(2000);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.cue')).not.toBeNull();
      tick(3000);
      fixture.detectChanges();
      expect(dataService.updateSessionSegment).toHaveBeenCalledWith('session-live', 'e1', jasmine.objectContaining({ actualSeconds: 5, status: 'DONE' }));
      expect(text()).toContain('Steady · 0:20 left');
      expect(fixture.nativeElement.querySelector('.cue')).toBeNull();
      fixture.componentInstance.terminate();
      tick(1000);
    }));

    it('skips a segment and adds a minute from the quiet controls', fakeAsync(() => {
      startSegmented();
      tick(2000);
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('.segment-actions button') as NodeListOf<HTMLButtonElement>;
      expect(Array.from(buttons).map((button) => button.textContent?.trim())).toEqual(['Skip segment', '+1 min']);
      buttons[1].click();
      fixture.detectChanges();
      expect(text()).toContain('Warm-up · 1:03 left');
      buttons[0].click();
      fixture.detectChanges();
      expect(dataService.updateSessionSegment).toHaveBeenCalledWith('session-live', 'e1', jasmine.objectContaining({ actualSeconds: 2, status: 'SKIPPED' }));
      expect(text()).toContain('Steady · 0:20 left');
      fixture.componentInstance.terminate();
      tick(1000);
    }));

    it('queues the write while the entry id is missing and sends it once an answer brings it', fakeAsync(() => {
      startSegmented(false);
      tick(5000);
      fixture.detectChanges();
      expect(dataService.updateSessionSegment).not.toHaveBeenCalled();
      fixture.componentRef.setInput('session', detail({ startedAt: new Date().toISOString(), segments }));
      fixture.detectChanges();
      expect(dataService.updateSessionSegment).toHaveBeenCalledOnceWith('session-live', 'e1', jasmine.objectContaining({ status: 'DONE' }));
      fixture.componentInstance.terminate();
      tick(1000);
    }));

    it('opens the completion page with the strip after a finished session with segments', fakeAsync(() => {
      const completed = jasmine.createSpy('completed');
      fixture.componentInstance.completed.subscribe(completed);
      dataService.completeSession.and.returnValue(of(detail({ status: 'COMPLETED', durationMinutes: 1, segments })));
      startSegmented();
      tick(60_000);
      fixture.detectChanges();
      fixture.componentInstance.terminate();
      fixture.detectChanges();
      expect(completed).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('app-workout-celebration app-segment-strip')).not.toBeNull();
      fixture.componentInstance.continueAfterFinish();
      expect(completed).toHaveBeenCalledTimes(1);
      tick(2000);
    }));

    it('shows nothing new for a session without segments', fakeAsync(() => {
      startTracker();
      expect(fixture.nativeElement.querySelector('app-segment-strip')).toBeNull();
      expect(fixture.nativeElement.querySelector('.segments')).toBeNull();
      fixture.componentInstance.terminate();
      tick(1000);
    }));
  });
});
