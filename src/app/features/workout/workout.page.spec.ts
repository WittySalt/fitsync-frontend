import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutPage } from './workout.page';
import { WorkoutSession } from '../../core/fitsync.models';

function session(overrides: Partial<WorkoutSession>): WorkoutSession {
  return {
    name: 'Session',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '',
    durationMinutes: 0,
    caloriesBurned: 0,
    completedAt: '',
    exerciseCount: 0,
    ...overrides
  };
}

describe('WorkoutPage', () => {
  let component: WorkoutPage;
  let dataService: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getWorkoutPlans',
      'getWorkoutSessions',
      'getExercises',
      'getActivePlan',
      'saveWorkoutSession'
    ]);
    dataService.getWorkoutPlans.and.returnValue(of([]));
    dataService.getWorkoutSessions.and.returnValue(of([]));
    dataService.getExercises.and.returnValue(of([]));
    dataService.getActivePlan.and.returnValue(of(null));
    dataService.saveWorkoutSession.and.returnValue(of({ ok: true }));

    await TestBed.configureTestingModule({
      imports: [WorkoutPage],
      providers: [provideHttpClient(), { provide: FitSyncDataService, useValue: dataService }]
    }).compileComponents();

    component = TestBed.createComponent(WorkoutPage).componentInstance;
  });

  it('derives the latest session by completion time', () => {
    component.sessions.set([
      session({ name: 'Old', completedAt: '2026-06-10T10:00:00Z' }),
      session({ name: 'New', completedAt: '2026-06-18T10:00:00Z' })
    ]);

    expect(component.latestSession()?.name).toBe('New');
  });

  it('counts total and this-week sessions in the metric strip', () => {
    component.sessions.set([
      session({ name: 'recent', completedAt: new Date().toISOString() }),
      session({ name: 'old', completedAt: '2025-01-01T00:00:00Z' })
    ]);

    const metrics = component.metrics();
    expect(metrics[0].value).toBe('2');
    expect(metrics[1].value).toBe('1');
  });

  it('wires workout tabs to their active tabpanel', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const todayTab = compiled.querySelector<HTMLButtonElement>('#workout-tab-overview');
    const todayPanel = compiled.querySelector<HTMLElement>('#workout-panel-overview');

    expect(todayTab?.getAttribute('role')).toBe('tab');
    expect(todayTab?.getAttribute('aria-selected')).toBe('true');
    expect(todayTab?.getAttribute('aria-controls')).toBe('workout-panel-overview');
    expect(todayPanel?.getAttribute('role')).toBe('tabpanel');
    expect(todayPanel?.getAttribute('aria-labelledby')).toBe('workout-tab-overview');

    compiled.querySelector<HTMLButtonElement>('#workout-tab-plans')?.click();
    fixture.detectChanges();

    const plansPanel = compiled.querySelector<HTMLElement>('#workout-panel-plans');
    expect(compiled.querySelector('#workout-tab-plans')?.getAttribute('aria-selected')).toBe('true');
    expect(plansPanel?.getAttribute('role')).toBe('tabpanel');
    expect(plansPanel?.getAttribute('aria-labelledby')).toBe('workout-tab-plans');
  });

  it('logs a workout through the data service when the form is valid', () => {
    component.logForm.setValue({
      name: 'Leg day',
      workoutType: 'STRENGTH',
      durationMinutes: 50,
      caloriesBurned: 380,
      perceivedExertion: 7,
      notes: ''
    });

    component.logWorkout();

    expect(dataService.saveWorkoutSession).toHaveBeenCalled();
  });

  it('does not log when the workout name is missing', () => {
    component.logForm.setValue({
      name: '',
      workoutType: 'STRENGTH',
      durationMinutes: 50,
      caloriesBurned: 380,
      perceivedExertion: 7,
      notes: ''
    });

    component.logWorkout();

    expect(dataService.saveWorkoutSession).not.toHaveBeenCalled();
  });
});
