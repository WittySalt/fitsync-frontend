import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutExerciseLog, WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { BAR_LEAVE_MS, WorkoutBarComponent } from './workout-bar.component';
import { WorkoutLiveService } from './workout-live.service';

function log(sets: boolean[]): WorkoutExerciseLog {
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
    }))
  };
}

function session(secondsAgo: number, overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-live',
    planId: 'plan-1',
    name: 'Leg day',
    workoutType: 'STRENGTH',
    status: 'IN_PROGRESS',
    source: 'PLAN',
    startedAt: new Date(Date.now() - secondsAgo * 1000).toISOString(),
    completedAt: '',
    durationMinutes: 0,
    caloriesBurned: 0,
    exerciseCount: 1,
    perceivedExertion: null,
    notes: '',
    exercises: [log([true, false, false])],
    createdAt: '',
    updatedAt: '',
    ...overrides
  };
}

const SPACE = '--workout-bar-space';

describe('WorkoutBarComponent', () => {
  let fixture: ComponentFixture<WorkoutBarComponent>;
  let live: WorkoutLiveService;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let navigate: jasmine.Spy;
  let root: HTMLElement;

  async function start(secondsAgo: number, overrides: Partial<WorkoutSessionDetail> = {}) {
    dataService.startWorkoutPlan.and.returnValue(of(session(secondsAgo, overrides)));
    live.startFromPlan('plan-1').subscribe();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** The bar slides down before it is taken out of the page. */
  const slidDown = async () => {
    await new Promise((resolve) => setTimeout(resolve, BAR_LEAVE_MS + 60));
    fixture.detectChanges();
  };
  const button = (selector: string) => root.querySelector<HTMLButtonElement>(selector);
  const dialog = () => root.querySelector<HTMLDialogElement>('dialog');
  const choice = (label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('dialog button')].find((candidate) => candidate.textContent?.trim() === label);

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'startWorkoutPlan',
      'getActiveWorkout',
      'completeSession',
      'cancelSession'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    dataService.getActiveWorkout.and.returnValue(of(null));
    dataService.completeSession.and.callFake(() => of(session(0, { status: 'COMPLETED' })));
    dataService.cancelSession.and.callFake(() => of(session(0, { status: 'CANCELLED' })));

    await TestBed.configureTestingModule({
      imports: [WorkoutBarComponent],
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    live = TestBed.inject(WorkoutLiveService);
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(WorkoutBarComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    live.reset();
    fixture.destroy();
    document.documentElement.style.removeProperty(SPACE);
  });

  it('shows nothing, and takes no room, while there is no workout in progress', () => {
    expect(root.querySelector('.bar')).toBeNull();
    expect(document.documentElement.style.getPropertyValue(SPACE)).toBe('');
  });

  it('shows the name, the running time and the current exercise and set', async () => {
    await start(754);

    expect(root.querySelector('.bar')).not.toBeNull();
    expect(root.querySelector('.name')?.textContent?.trim()).toBe('Leg day');
    expect(root.querySelector('.time')?.textContent?.trim()).toBe('12:34');
    expect(root.querySelector('.step')?.textContent?.trim()).toBe('Goblet squat · set 2 of 3');
  });

  it('shows a running timed set, a counted set by its reps and a rest in the step slot', async () => {
    await start(120, { exercises: [log([false, false])] });
    const identity = { sessionId: 'session-live', exerciseLogId: 'log-1', setNumber: 1, exerciseName: 'Plank Hold' };
    const run = { targetReps: 0, tempoSeconds: 3, weightKg: null, distanceKm: null, restSeconds: null, restAfterSeconds: 30 };

    live.startRun({ ...identity, ...run, kind: 'timed', targetSeconds: 45 });
    fixture.detectChanges();
    expect(root.querySelector('.step')?.textContent?.trim()).toBe('Plank Hold \u00b7 0:45 left');

    live.startRun({ ...identity, ...run, exerciseName: 'Goblet squat', kind: 'counted', targetSeconds: 0, targetReps: 12 });
    fixture.detectChanges();
    expect(root.querySelector('.step')?.textContent?.trim()).toBe('Goblet squat \u00b7 0 / 12');

    live.beginRest(identity, 42);
    fixture.detectChanges();
    expect(root.querySelector('.step')?.textContent?.trim()).toBe('Rest 0:42');
    live.clearRun();
    fixture.detectChanges();
    expect(root.querySelector('.step')?.textContent?.trim()).toBe('Goblet squat \u00b7 set 1 of 2');
  });

  it('shows the hours once the workout passes the hour', async () => {
    await start(3723);

    expect(root.querySelector('.time')?.textContent?.trim()).toBe('1:02:03');
  });

  it('leaves the exercise out for a workout without exercises', async () => {
    await start(30, { exercises: [], exerciseCount: 0 });

    expect(root.querySelector('.step')).toBeNull();
  });

  it('is one button for the screen reader, with the time kept out of the live regions', async () => {
    await start(754);

    expect(button('.resume')?.getAttribute('aria-label')).toBe('Resume workout, Leg day, 12:34');
    expect(root.querySelector('[aria-live]')).toBeNull();
    expect(root.querySelector('.time')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.dot')?.getAttribute('aria-hidden')).toBe('true');
    expect(button('.end')?.textContent?.trim()).toBe('End');
  });

  it('marks a paused timer on the dot', async () => {
    await start(90);

    live.pause();
    fixture.detectChanges();

    expect(root.querySelector('.dot')?.classList.contains('paused')).toBeTrue();
  });

  it('asks the shell and the coach button for room while it shows, and gives it back', async () => {
    await start(90);

    expect(document.documentElement.style.getPropertyValue(SPACE)).toContain('68px');

    live.reset();
    fixture.detectChanges();

    expect(document.documentElement.style.getPropertyValue(SPACE)).toBe('');
  });

  it('steps aside while the exercise screen is on screen', async () => {
    await start(90);

    live.screenOpen.set(true);
    fixture.detectChanges();

    expect(document.documentElement.style.getPropertyValue(SPACE)).toBe('');
    await slidDown();
    expect(root.querySelector('.bar')).toBeNull();
  });

  it('slides down and keeps what it showed while it is taken out, then goes', async () => {
    await start(754);

    live.setSession(session(754, { status: 'COMPLETED' }));
    fixture.detectChanges();

    const bar = root.querySelector('.bar');
    expect(bar?.classList.contains('leaving')).toBeTrue();
    expect(bar?.querySelector('.name')?.textContent?.trim()).toBe('Leg day');
    expect(bar?.querySelector<HTMLButtonElement>('.resume')?.tabIndex).toBe(-1);

    await slidDown();
    expect(root.querySelector('.bar')).toBeNull();
  });

  it('comes back at once, without the leaving class, when the workout is shown again', async () => {
    await start(90);
    live.screenOpen.set(true);
    fixture.detectChanges();
    live.screenOpen.set(false);
    fixture.detectChanges();

    expect(root.querySelector('.bar')?.classList.contains('leaving')).toBeFalse();
  });

  it('does not show a workout that has already ended', async () => {
    await start(90);

    live.setSession(session(90, { status: 'COMPLETED' }));
    fixture.detectChanges();
    await slidDown();

    expect(root.querySelector('.bar')).toBeNull();
  });

  it('returns to the workout when it is pressed', async () => {
    await start(90);
    live.minimise();
    let requests = 0;
    live.openRequests.subscribe(() => requests++);

    button('.resume')?.click();

    expect(live.minimised()).toBeFalse();
    expect(requests).toBe(1);
    expect(navigate).toHaveBeenCalledOnceWith('/workout');
  });

  describe('the End dialog', () => {
    it('offers three ways out, and Keep going closes it without touching the workout', async () => {
      await start(754);

      button('.end')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(dialog()?.open).toBeTrue();
      expect([...root.querySelectorAll('dialog button')].map((candidate) => candidate.textContent?.trim())).toEqual([
        'Finish and save',
        'Discard workout',
        'Keep going'
      ]);

      choice('Keep going')?.click();
      fixture.detectChanges();

      expect(dialog()).toBeNull();
      expect(live.active()).not.toBeNull();
      expect(dataService.completeSession).not.toHaveBeenCalled();
      expect(dataService.cancelSession).not.toHaveBeenCalled();
    });

    it('closes on Escape as Keep going does', async () => {
      await start(754);
      button('.end')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      dialog()?.dispatchEvent(new Event('cancel', { cancelable: true }));
      fixture.detectChanges();

      expect(dialog()).toBeNull();
      expect(live.active()).not.toBeNull();
    });

    it('finishes and saves a workout of at least a minute', async () => {
      await start(754);
      button('.end')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      choice('Finish and save')?.click();
      fixture.detectChanges();

      expect(dataService.completeSession).toHaveBeenCalledWith('session-live');
      expect(toast.success).toHaveBeenCalledWith('Workout completed.');
      expect(dialog()).toBeNull();
      expect(live.session()).toBeNull();
      await slidDown();
      expect(root.querySelector('.bar')).toBeNull();
    });

    it('says a workout under a minute was too short to save', async () => {
      await start(20);
      button('.end')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      choice('Finish and save')?.click();
      fixture.detectChanges();

      expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
      expect(dataService.completeSession).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith('Workout was under 60 seconds, so it was cancelled and will not be saved.');
      expect(live.session()).toBeNull();
    });

    it('asks once more before it discards, and Keep going there leaves the workout alone', async () => {
      await start(754);
      button('.end')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      choice('Discard workout')?.click();
      fixture.detectChanges();

      expect(root.querySelector('.ask')?.textContent?.trim()).toBe('Discard this workout? It will not be saved.');
      expect(dataService.cancelSession).not.toHaveBeenCalled();

      choice('Keep going')?.click();
      fixture.detectChanges();
      expect(dialog()).toBeNull();
      expect(live.active()).not.toBeNull();
    });

    it('discards after the second confirmation', async () => {
      await start(754);
      button('.end')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      choice('Discard workout')?.click();
      fixture.detectChanges();

      choice('Discard')?.click();
      fixture.detectChanges();

      expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
      expect(toast.info).toHaveBeenCalledWith('Workout cancelled.');
      expect(dialog()).toBeNull();
      expect(live.session()).toBeNull();
    });

    it('stays open and says so when the server refuses to finish', async () => {
      await start(754);
      dataService.completeSession.and.returnValue(throwError(() => new Error('down')));
      button('.end')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      choice('Finish and save')?.click();
      fixture.detectChanges();

      expect(toast.error).toHaveBeenCalledWith('Unable to finish workout. Please retry.');
      expect(dialog()).not.toBeNull();
      expect(live.active()).not.toBeNull();
      expect(choice('Finish and save')?.disabled).toBeFalse();
    });
  });
});
