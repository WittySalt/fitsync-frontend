import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { ExerciseMetadata, SportActivityOption, WorkoutSessionDetail } from '../../core/fitsync.models';
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

const SPORTS: SportActivityOption[] = [
  { code: 'BADMINTON', label: 'Badminton', effort: 'MODERATE', measure: 'TIME' },
  { code: 'CYCLING', label: 'Cycling', effort: 'MODERATE', measure: 'TIME_AND_DISTANCE' }
];

function metadata(sportActivities: SportActivityOption[] = SPORTS): ExerciseMetadata {
  return {
    exerciseTypes: [],
    muscleGroups: [],
    equipment: [],
    difficulties: [],
    workoutTypes: [],
    goalFocuses: [],
    sportActivities
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
      'getActiveWorkout',
      'saveWorkoutSession',
      'getExerciseMetadata'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    dataService.startAdHocSession.and.returnValue(of(detail()));
    dataService.getActiveWorkout.and.returnValue(of(null));
    dataService.saveWorkoutSession.and.returnValue(of({ ok: true }));
    dataService.getExerciseMetadata.and.returnValue(of(metadata()));

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

  it('starts with one STEADY segment for a minutes goal, the interval set for HIIT, and none for a calorie goal or free mode', () => {
    component.startForm.patchValue({ name: 'Quick Cardio', workoutType: 'CARDIO', goalType: 'MINUTES', targetMinutes: 25 });
    component.selectMode('GOAL');
    component.startWorkout();
    expect(dataService.startAdHocSession).toHaveBeenCalledWith({
      name: 'Quick Cardio', workoutType: 'CARDIO', segments: [{ kind: 'STEADY', label: 'Steady', plannedSeconds: 1500 }]
    });

    dataService.startAdHocSession.calls.reset();
    component.selectMode('FREE');
    component.startForm.patchValue({ name: 'HIIT Session', workoutType: 'HIIT' });
    component.startWorkout();
    const hiit = dataService.startAdHocSession.calls.mostRecent().args[0].segments ?? [];
    expect(hiit.some((segment) => segment.kind === 'WORK')).toBeTrue();

    dataService.startAdHocSession.calls.reset();
    component.startForm.patchValue({ name: 'Quick Cardio', workoutType: 'CARDIO' });
    component.startWorkout();
    expect(dataService.startAdHocSession.calls.mostRecent().args[0].segments).toBeUndefined();
  });

  it('uses the default name preset without showing a required-name error', () => {
    component.startWorkout();
    fixture.detectChanges();

    expect(dataService.startAdHocSession).toHaveBeenCalledWith({ name: 'Morning Strength', workoutType: 'STRENGTH' });
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('A name is required.');
  });

  it('reveals a custom name input and submits its typed value', () => {
    component.freeOpen.set(true);
    component.startForm.patchValue({ name: 'Custom…', customName: 'Track intervals', workoutType: 'CARDIO' });
    fixture.detectChanges();

    const customInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[formcontrolname="customName"]');
    expect(customInput).not.toBeNull();

    component.startWorkout();

    expect(dataService.startAdHocSession).toHaveBeenCalledWith({ name: 'Track intervals', workoutType: 'CARDIO' });
  });

  describe('the sheets, opened from the Today card', () => {
    const root = () => fixture.nativeElement as HTMLElement;

    it('draws nothing on the page until a sheet is opened, with no row of links of its own', () => {
      expect(root().querySelector('.quick-row')).toBeNull();
      expect(root().querySelector('.quiet-link')).toBeNull();
      expect(root().querySelector('.start-form')).toBeNull();
      expect(root().querySelector('#past-workout-form')).toBeNull();
      expect(root().querySelector('select')).toBeNull();
    });

    it('opens the name and type on the free workout sheet, and closes it on start', () => {
      component.openFree();
      fixture.detectChanges();
      expect(root().querySelector('[role="dialog"] h2')?.textContent).toBe('Free workout');
      expect(root().querySelector('select[formcontrolname="name"]')).not.toBeNull();
      expect(root().querySelector('select[formcontrolname="workoutType"]')).not.toBeNull();

      component.startWorkout();
      fixture.detectChanges();
      expect(component.freeOpen()).toBeFalse();
      expect(root().querySelector('[role="dialog"]')).toBeNull();
    });

    it('opens the past workout form and keeps one sheet open at a time', () => {
      component.openPastWorkout();
      fixture.detectChanges();
      expect(component.pastWorkoutOpen()).toBeTrue();
      expect(root().querySelector('#past-workout-form')).not.toBeNull();

      component.openPastWorkout();
      expect(component.pastWorkoutOpen()).toBeTrue();

      component.openFree();
      fixture.detectChanges();
      expect(component.pastWorkoutOpen()).toBeFalse();
      expect(component.freeOpen()).toBeTrue();
    });

    it('closes a sheet with Close, the scrim and Escape', () => {
      component.openFree();
      fixture.detectChanges();
      root().querySelector<HTMLButtonElement>('.sheet-top .quiet-link')!.click();
      fixture.detectChanges();
      expect(component.freeOpen()).toBeFalse();

      component.openPastWorkout();
      fixture.detectChanges();
      root().querySelector<HTMLButtonElement>('.scrim')!.click();
      fixture.detectChanges();
      expect(component.pastWorkoutOpen()).toBeFalse();

      component.openFree();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(component.freeOpen()).toBeFalse();
    });
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

  describe('the past workout form by how the session is measured', () => {
    const root = () => fixture.nativeElement as HTMLElement;
    const field = (name: string) => root().querySelector(`#past-workout-form [formcontrolname="${name}"]`);
    const distanceField = () => field('distanceKm') as HTMLInputElement | null;
    const lastRequest = () => dataService.saveWorkoutSession.calls.mostRecent().args[0];

    function openPast(values: Record<string, unknown> = {}): void {
      component.pastWorkoutOpen.set(true);
      component.pastWorkoutForm.patchValue(values);
      fixture.detectChanges();
    }

    function submit(): void {
      fixture.debugElement.query(By.css('#past-workout-form')).triggerEventHandler('ngSubmit');
      fixture.detectChanges();
    }

    it('lists Sport after Mobility for a past workout only', () => {
      openPast();

      const options = Array.from(root().querySelectorAll<HTMLOptionElement>('#past-workout-form select[formcontrolname="workoutType"] option'));
      expect(options.map((option) => option.textContent?.trim())).toEqual(['Strength', 'Cardio', 'Hiit', 'Mobility', 'Sport', 'Custom']);
      expect(component.workoutTypes).not.toContain('SPORTS');
    });

    it('shows the sport select with its required error and hides the name controls', () => {
      openPast({ workoutType: 'SPORTS' });

      expect(field('sportActivity')).not.toBeNull();
      expect(field('name')).toBeNull();
      expect(Array.from(field('sportActivity')!.querySelectorAll('option')).map((option) => option.textContent?.trim())).toEqual([
        'Choose a sport',
        'Badminton',
        'Cycling'
      ]);

      submit();

      expect(root().querySelector('.field-error')?.textContent).toContain('Choose a sport.');
      expect(dataService.saveWorkoutSession).not.toHaveBeenCalled();
    });

    it('shows the distance field for cardio only, with its range error', () => {
      openPast({ workoutType: 'STRENGTH' });
      expect(distanceField()).toBeNull();

      component.pastWorkoutForm.patchValue({ workoutType: 'CARDIO' });
      fixture.detectChanges();
      expect(distanceField()).not.toBeNull();
      expect(distanceField()?.step).toBe('0.01');

      component.pastWorkoutForm.patchValue({ distanceKm: 1200 });
      component.pastWorkoutForm.controls.distanceKm.markAsTouched();
      fixture.detectChanges();
      expect(root().textContent).toContain('Enter a distance from 0 to 1000 km.');

      component.pastWorkoutForm.patchValue({ distanceKm: -1 });
      fixture.detectChanges();
      expect(root().textContent).toContain('Enter a distance from 0 to 1000 km.');
    });

    it('shows the distance field for a time-and-distance sport and hides it for a time sport', () => {
      openPast({ workoutType: 'SPORTS', sportActivity: 'CYCLING' });
      expect(distanceField()).not.toBeNull();

      component.pastWorkoutForm.patchValue({ sportActivity: 'BADMINTON' });
      fixture.detectChanges();
      expect(distanceField()).toBeNull();
    });

    it('clears the distance when its field is hidden', () => {
      openPast({ workoutType: 'CARDIO', distanceKm: 5 });

      component.pastWorkoutForm.patchValue({ workoutType: 'STRENGTH' });
      expect(component.pastWorkoutForm.controls.distanceKm.value).toBeNull();

      component.pastWorkoutForm.patchValue({ workoutType: 'SPORTS', sportActivity: 'CYCLING' });
      component.pastWorkoutForm.patchValue({ distanceKm: 20 });
      component.pastWorkoutForm.patchValue({ sportActivity: 'BADMINTON' });
      expect(component.pastWorkoutForm.controls.distanceKm.value).toBeNull();
    });

    it('sends a strength session without the new keys', () => {
      openPast({ name: 'Evening Strength', workoutType: 'STRENGTH', notes: '' });

      submit();

      expect(lastRequest()).toEqual({
        name: 'Evening Strength',
        workoutType: 'STRENGTH',
        durationMinutes: 45,
        caloriesBurned: 350,
        perceivedExertion: 7,
        notes: ''
      });
      expect(JSON.stringify(lastRequest())).toBe(
        '{"name":"Evening Strength","workoutType":"STRENGTH","durationMinutes":45,"caloriesBurned":350,"perceivedExertion":7,"notes":""}'
      );
    });

    it('sends cardio with a distance, and without one when it is left empty', () => {
      openPast({ name: 'Quick Cardio', workoutType: 'CARDIO', distanceKm: 5.755 });
      submit();
      expect(lastRequest()).toEqual(jasmine.objectContaining({ workoutType: 'CARDIO', distanceKm: 5.76 }));

      openPast({ name: 'Quick Cardio', workoutType: 'CARDIO', distanceKm: null });
      submit();
      expect('distanceKm' in lastRequest()).toBeFalse();
      expect('sportActivity' in lastRequest()).toBeFalse();
    });

    it('sends badminton named after the sport, with no distance', () => {
      openPast({ workoutType: 'SPORTS', sportActivity: 'BADMINTON', durationMinutes: 60 });

      submit();

      expect(lastRequest()).toEqual({
        name: 'Badminton',
        workoutType: 'SPORTS',
        sportActivity: 'BADMINTON',
        durationMinutes: 60,
        caloriesBurned: 350,
        perceivedExertion: 7,
        notes: ''
      });
      expect('distanceKm' in lastRequest()).toBeFalse();
    });

    it('sends cycling with its distance', () => {
      openPast({ workoutType: 'SPORTS', sportActivity: 'CYCLING' });
      component.pastWorkoutForm.patchValue({ distanceKm: 32.5 });

      submit();

      expect(lastRequest()).toEqual(
        jasmine.objectContaining({ name: 'Cycling', workoutType: 'SPORTS', sportActivity: 'CYCLING', distanceKm: 32.5 })
      );
    });

    it('resets the sport and distance after saving', () => {
      openPast({ workoutType: 'SPORTS', sportActivity: 'CYCLING' });
      component.pastWorkoutForm.patchValue({ distanceKm: 32.5 });

      submit();

      const form = component.pastWorkoutForm.getRawValue();
      expect(form.workoutType).toBe('STRENGTH');
      expect(form.sportActivity).toBe('');
      expect(form.distanceKm).toBeNull();
      expect(component.pastWorkoutOpen()).toBeFalse();
    });

    it('offers one disabled option and blocks saving when the sports cannot be loaded', () => {
      dataService.getExerciseMetadata.and.returnValue(of(null));
      openPast({ workoutType: 'SPORTS' });

      const options = Array.from(field('sportActivity')!.querySelectorAll('option'));
      expect(options.map((option) => option.textContent?.trim())).toEqual(['Sports could not be loaded']);
      expect(options[0].disabled).toBeTrue();

      submit();

      expect(dataService.saveWorkoutSession).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Sports could not be loaded. Try again in a moment.');
    });

    it('asks for the sports once and reuses them', () => {
      openPast({ workoutType: 'SPORTS' });
      component.pastWorkoutForm.patchValue({ workoutType: 'STRENGTH' });
      component.pastWorkoutForm.patchValue({ workoutType: 'SPORTS' });

      expect(dataService.getExerciseMetadata).toHaveBeenCalledTimes(1);
    });
  });
});
