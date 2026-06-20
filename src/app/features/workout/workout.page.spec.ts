import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutPage } from './workout.page';
import { Exercise, WorkoutPlan, WorkoutSession } from '../../core/fitsync.models';

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

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    exerciseId: 'exercise-1',
    name: 'Back squat',
    exerciseType: 'STRENGTH',
    primaryMuscleGroup: 'QUADS',
    equipment: 'BARBELL',
    difficulty: 'INTERMEDIATE',
    custom: false,
    ...overrides
  };
}

function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    planId: 'plan-1',
    name: 'Strength base',
    description: '',
    goalFocus: 'STRENGTH',
    workoutType: 'STRENGTH',
    difficulty: 'INTERMEDIATE',
    estimatedDurationMinutes: 45,
    status: 'DRAFT',
    exerciseCount: 1,
    exercises: [],
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
      'saveWorkoutSession',
      'createWorkoutPlan',
      'updateWorkoutPlan',
      'activateWorkoutPlan',
      'archiveWorkoutPlan',
      'startWorkoutPlan'
    ]);
    dataService.getWorkoutPlans.and.returnValue(of([]));
    dataService.getWorkoutSessions.and.returnValue(of([]));
    dataService.getExercises.and.returnValue(of([]));
    dataService.getActivePlan.and.returnValue(of(null));
    dataService.saveWorkoutSession.and.returnValue(of({ ok: true }));
    dataService.createWorkoutPlan.and.returnValue(of(plan({ status: 'DRAFT' })));
    dataService.updateWorkoutPlan.and.returnValue(of(plan({ status: 'DRAFT' })));
    dataService.activateWorkoutPlan.and.returnValue(of(plan({ status: 'ACTIVE' })));
    dataService.archiveWorkoutPlan.and.returnValue(of(void 0));
    dataService.startWorkoutPlan.and.returnValue(of(session({ sessionId: 'session-1', status: 'IN_PROGRESS' })));

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

  it('submits a workout plan with a real exercise blueprint', () => {
    component.exercises.set([exercise()]);
    component.planForm.patchValue({
      name: 'Strength base',
      goalFocus: 'STRENGTH',
      workoutType: 'STRENGTH',
      difficulty: 'INTERMEDIATE',
      estimatedDurationMinutes: 50
    });
    component.planExercises.at(0).patchValue({
      exerciseId: 'exercise-1',
      targetSets: 3,
      targetReps: 8,
      targetWeightKg: 60,
      restSeconds: 120,
      notes: 'Controlled'
    });

    component.savePlan();

    expect(dataService.createWorkoutPlan).toHaveBeenCalledWith(
      jasmine.objectContaining({
        name: 'Strength base',
        goalFocus: 'STRENGTH',
        exercises: [
          jasmine.objectContaining({
            exerciseId: 'exercise-1',
            sequence: 1,
            targetSets: 3,
            targetReps: 8,
            targetWeightKg: 60,
            restSeconds: 120,
            setTargets: []
          })
        ]
      })
    );
  });

  it('starts a plan and moves the user to training history', () => {
    const started = session({ sessionId: 'session-1', name: 'Strength base', status: 'IN_PROGRESS' });
    dataService.startWorkoutPlan.and.returnValue(of(started));
    dataService.getWorkoutSessions.and.returnValue(of([started]));

    component.startPlan(plan({ status: 'ACTIVE' }));

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-1');
    expect(component.sessions()[0].sessionId).toBe('session-1');
    expect(component.selectedTab()).toBe('history');
  });
});
