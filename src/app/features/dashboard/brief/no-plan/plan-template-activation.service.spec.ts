import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { Exercise, WorkoutPlan } from '../../../../core/fitsync.models';
import { WORKOUT_PLAN_TEMPLATES } from '../../../workout/plan-templates.component';
import { NoTemplateExercisesError, PlanTemplateActivationService } from './plan-template-activation.service';

function exercise(code: string, id: string | null): Exercise {
  return {
    exerciseId: id,
    code,
    name: code,
    description: '',
    exerciseType: 'STRENGTH',
    primaryMuscleGroup: 'QUADS',
    equipment: 'BODYWEIGHT',
    difficulty: 'BEGINNER',
    status: 'ACTIVE',
    custom: false
  };
}

function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    planId: 'plan-1',
    name: 'Full-body beginner',
    description: '',
    goalFocus: 'GENERAL_FITNESS',
    workoutType: 'STRENGTH',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 35,
    status: 'DRAFT',
    exerciseCount: 3,
    exercises: [],
    ...overrides
  };
}

describe('PlanTemplateActivationService', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let service: PlanTemplateActivationService;
  const template = WORKOUT_PLAN_TEMPLATES[0];

  function queryOf(options: unknown): string {
    return (options as { q: string }).q;
  }

  beforeEach(() => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getExercises', 'createWorkoutPlan', 'activateWorkoutPlan']);
    dataService.getExercises.and.callFake((options) => {
      const code = queryOf(options);
      return of([exercise(code, `id-${code}`)]);
    });
    dataService.createWorkoutPlan.and.returnValue(of(plan()));
    dataService.activateWorkoutPlan.and.returnValue(of(plan({ status: 'ACTIVE' })));
    TestBed.configureTestingModule({ providers: [{ provide: FitSyncDataService, useValue: dataService }] });
    service = TestBed.inject(PlanTemplateActivationService);
  });

  it('creates the plan from the matched exercises and activates it', () => {
    let result: { plan: WorkoutPlan; skipped: number } | undefined;
    service.activate(template).subscribe((value) => (result = value));

    const request = dataService.createWorkoutPlan.calls.mostRecent().args[0];
    expect(request.name).toBe('Full-body beginner');
    expect(request.exercises.map((entry) => entry.exerciseId)).toEqual(['id-GOBLET_SQUAT', 'id-BODYWEIGHT_PUSH_UP', 'id-PLANK_HOLD']);
    expect(request.exercises.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
    expect(request.exercises[2].targetDurationSeconds).toBe(30);
    expect(dataService.activateWorkoutPlan).toHaveBeenCalledOnceWith('plan-1');
    expect(result?.plan.status).toBe('ACTIVE');
    expect(result?.skipped).toBe(0);
  });

  it('leaves out an exercise the catalogue does not have and counts it', () => {
    dataService.getExercises.and.callFake((options) => {
      const code = queryOf(options);
      return of(code === 'PLANK_HOLD' ? [] : [exercise(code, `id-${code}`)]);
    });
    let skipped = -1;
    service.activate(template).subscribe((value) => (skipped = value.skipped));
    expect(dataService.createWorkoutPlan.calls.mostRecent().args[0].exercises.length).toBe(2);
    expect(skipped).toBe(1);
  });

  it('fails without creating anything when no exercise matches', () => {
    dataService.getExercises.and.returnValue(throwError(() => new Error('offline')));
    let error: unknown;
    service.activate(template).subscribe({ error: (value) => (error = value) });
    expect(error).toBeInstanceOf(NoTemplateExercisesError);
    expect(dataService.createWorkoutPlan).not.toHaveBeenCalled();
  });

  it('fails when the created plan has no id', () => {
    dataService.createWorkoutPlan.and.returnValue(of(plan({ planId: null })));
    let failed = false;
    service.activate(template).subscribe({ error: () => (failed = true) });
    expect(failed).toBeTrue();
    expect(dataService.activateWorkoutPlan).not.toHaveBeenCalled();
  });
});
