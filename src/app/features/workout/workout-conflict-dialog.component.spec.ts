import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { EMPTY, of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { WorkoutConflictDialogComponent, startedAgoLabel } from './workout-conflict-dialog.component';
import { WorkoutLiveService } from './workout-live.service';

function session(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-new',
    planId: null,
    name: 'New workout',
    workoutType: 'STRENGTH',
    status: 'IN_PROGRESS',
    source: 'PLAN',
    startedAt: new Date().toISOString(),
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

describe('startedAgoLabel', () => {
  const now = Date.parse('2026-10-01T12:00:00Z');

  it('says how long ago in the shortest plain words', () => {
    expect(startedAgoLabel('2026-10-01T11:59:40Z', now)).toBe('just now');
    expect(startedAgoLabel('2026-10-01T11:48:00Z', now)).toBe('12 min ago');
    expect(startedAgoLabel('2026-10-01T10:55:00Z', now)).toBe('1 h 5 min ago');
    expect(startedAgoLabel('2026-10-01T10:00:00Z', now)).toBe('2 h ago');
  });

  it('gives nothing for a start it cannot read, and never a negative time', () => {
    expect(startedAgoLabel('', now)).toBe('');
    expect(startedAgoLabel('2026-10-01T12:05:00Z', now)).toBe('just now');
  });
});

describe('WorkoutConflictDialogComponent', () => {
  let fixture: ComponentFixture<WorkoutConflictDialogComponent>;
  let live: WorkoutLiveService;
  let toast: jasmine.SpyObj<ToastService>;
  let navigate: jasmine.Spy;
  let root: HTMLElement;

  const choice = (label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('dialog button')].find((button) => button.textContent?.trim() === label);

  async function open() {
    live.pendingStart.set({
      info: { sessionId: 'session-old', name: 'Old workout', startedAt: new Date(Date.now() - 12 * 60_000).toISOString() },
      retry: () => of(session()),
      message: 'Workout session started.'
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    const dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getActiveWorkout']);
    dataService.getActiveWorkout.and.returnValue(of(null));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [WorkoutConflictDialogComponent],
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    live = TestBed.inject(WorkoutLiveService);
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(WorkoutConflictDialogComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    live.reset();
    fixture.destroy();
  });

  it('is not there until a start has been refused', () => {
    expect(root.querySelector('dialog')).toBeNull();
  });

  it('names the workout in progress and how long ago it started, with three ways on', async () => {
    await open();

    expect(root.querySelector('h2')?.textContent).toBe('You have a workout in progress');
    expect(root.querySelector('.what')?.textContent).toContain('Old workout');
    expect(root.querySelector('.what')?.textContent).toContain('started 12 min ago');
    expect([...root.querySelectorAll('dialog button')].map((button) => button.textContent?.trim())).toEqual([
      'Resume it',
      'End it and start this one',
      'Cancel'
    ]);
  });

  it('resumes the running workout', async () => {
    spyOn(live, 'resumePending').and.callThrough();
    await open();

    choice('Resume it')?.click();
    fixture.detectChanges();

    expect(live.resumePending).toHaveBeenCalled();
    expect(live.pendingStart()).toBeNull();
    expect(navigate).toHaveBeenCalledOnceWith('/workout');
    expect(root.querySelector('dialog')).toBeNull();
  });

  it('closes on Cancel and on Escape without ending anything', async () => {
    await open();
    choice('Cancel')?.click();
    fixture.detectChanges();
    expect(live.pendingStart()).toBeNull();

    await open();
    root.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(live.pendingStart()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ends the running workout, starts the refused one and opens the screen', async () => {
    const ended = spyOn(live, 'endAndStart').and.returnValue(of(session()));
    const opened = spyOn(live, 'open');
    await open();

    choice('End it and start this one')?.click();
    fixture.detectChanges();

    expect(ended).toHaveBeenCalled();
    expect(opened).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledOnceWith('/workout');
  });

  it('says so when the new workout could not be started, and stays open', async () => {
    spyOn(live, 'endAndStart').and.returnValue(throwError(() => new Error('down')));
    await open();

    choice('End it and start this one')?.click();
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Unable to start this workout. Please retry.');
    expect(root.querySelector('dialog')).not.toBeNull();
    expect(choice('End it and start this one')?.disabled).toBeFalse();
  });

  it('frees the buttons when the repeated start is refused again and completes with nothing', async () => {
    spyOn(live, 'endAndStart').and.returnValue(EMPTY);
    await open();

    choice('End it and start this one')?.click();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    expect(choice('End it and start this one')?.disabled).toBeFalse();
    expect(choice('Resume it')?.disabled).toBeFalse();
    expect(choice('Cancel')?.disabled).toBeFalse();
  });
});
