import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { LiveStartCardComponent } from './live-start-card.component';
import { WorkoutLiveService } from './workout-live.service';

function detail(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-live',
    planId: null,
    name: 'Free workout',
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

describe('LiveStartCardComponent', () => {
  let fixture: ComponentFixture<LiveStartCardComponent>;
  let component: LiveStartCardComponent;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let live: WorkoutLiveService;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'startAdHocSession',
      'saveWorkoutSession'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    dataService.startAdHocSession.and.returnValue(of(detail()));
    dataService.saveWorkoutSession.and.returnValue(of({ ok: true }));

    await TestBed.configureTestingModule({
      imports: [LiveStartCardComponent],
      providers: [
        WorkoutLiveService,
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    live = TestBed.inject(WorkoutLiveService);
    fixture = TestBed.createComponent(LiveStartCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    live.reset();
  });

  it('starts goal mode through the ad hoc session endpoint and emits the target', () => {
    const started = jasmine.createSpy('started');
    component.started.subscribe(started);
    component.selectMode('GOAL');
    component.startForm.patchValue({
      name: 'Quick Cardio',
      workoutType: 'CARDIO',
      goalType: 'CALORIES',
      targetMinutes: 30,
      targetCalories: 320
    });

    component.startWorkout();

    expect(dataService.startAdHocSession).toHaveBeenCalledWith({ name: 'Quick Cardio', workoutType: 'CARDIO' });
    expect(started).toHaveBeenCalledWith({
      session: jasmine.objectContaining({ sessionId: 'session-live' }),
      goal: { type: 'CALORIES', target: 320 }
    });
  });

  it('uses the default name preset without showing a required-name error', () => {
    component.startWorkout();
    fixture.detectChanges();

    expect(dataService.startAdHocSession).toHaveBeenCalledWith({ name: 'Morning Strength', workoutType: 'STRENGTH' });
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('A name is required.');
  });

  it('reveals a custom name input and submits its typed value', () => {
    component.startForm.patchValue({ name: 'Custom…', customName: 'Track intervals', workoutType: 'CARDIO' });
    fixture.detectChanges();

    const customInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[formcontrolname="customName"]');
    expect(customInput).not.toBeNull();

    component.startWorkout();

    expect(dataService.startAdHocSession).toHaveBeenCalledWith({ name: 'Track intervals', workoutType: 'CARDIO' });
  });

  it('keeps the past workout form nested and collapsed until expanded', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#past-workout-form')).toBeNull();

    compiled.querySelector<HTMLButtonElement>('.past-workout-disclosure .button')?.click();
    fixture.detectChanges();

    expect(component.pastWorkoutOpen()).toBeTrue();
    expect(compiled.querySelector('#past-workout-form')).not.toBeNull();
  });

  it('submits the nested past workout form through saveWorkoutSession', () => {
    const backfilled = jasmine.createSpy('backfilled');
    component.backfilled.subscribe(backfilled);
    component.pastWorkoutOpen.set(true);
    component.pastWorkoutForm.patchValue({
      name: 'Evening Strength',
      workoutType: 'CARDIO',
      durationMinutes: 35,
      caloriesBurned: 300,
      perceivedExertion: 6,
      notes: 'Backfilled after the run.'
    });
    fixture.detectChanges();

    fixture.debugElement.query(By.css('#past-workout-form')).triggerEventHandler('ngSubmit');

    expect(dataService.saveWorkoutSession).toHaveBeenCalledWith(
      jasmine.objectContaining({ name: 'Evening Strength', workoutType: 'CARDIO', durationMinutes: 35 })
    );
    expect(toast.success).toHaveBeenCalledWith('Workout logged.');
    expect(backfilled).toHaveBeenCalled();
  });

  it('submits a custom past workout name as a plain string', () => {
    component.pastWorkoutOpen.set(true);
    component.pastWorkoutForm.patchValue({
      name: 'Custom…',
      customName: 'Trail run',
      workoutType: 'CARDIO'
    });
    fixture.detectChanges();

    fixture.debugElement.query(By.css('#past-workout-form')).triggerEventHandler('ngSubmit');

    expect(dataService.saveWorkoutSession).toHaveBeenCalledWith(
      jasmine.objectContaining({ name: 'Trail run', workoutType: 'CARDIO' })
    );
  });

  it('surfaces start failures through toast', () => {
    dataService.startAdHocSession.and.returnValue(throwError(() => new Error('boom')));
    component.startForm.patchValue({ name: 'HIIT Session', workoutType: 'HIIT' });

    component.startWorkout();

    expect(toast.error).toHaveBeenCalledWith('Unable to start a workout. Please retry.');
  });
});
