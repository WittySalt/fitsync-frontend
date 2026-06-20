import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { throwError, of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Exercise, WorkoutPlan } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { PlanTemplatesComponent, WORKOUT_PLAN_TEMPLATES } from './plan-templates.component';

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    exerciseId: 'exercise-1',
    code: 'GOBLET_SQUAT',
    name: 'Goblet Squat',
    description: '',
    exerciseType: 'STRENGTH',
    primaryMuscleGroup: 'QUADS',
    equipment: 'BODYWEIGHT',
    difficulty: 'BEGINNER',
    status: 'ACTIVE',
    custom: false,
    ...overrides
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
    exerciseCount: 1,
    exercises: [],
    ...overrides
  };
}

describe('PlanTemplatesComponent', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getExercises',
      'createWorkoutPlan',
      'activateWorkoutPlan'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    dataService.getExercises.and.returnValue(of([exercise()]));
    dataService.createWorkoutPlan.and.returnValue(of(plan()));
    dataService.activateWorkoutPlan.and.returnValue(of(plan({ status: 'ACTIVE' })));

    await TestBed.configureTestingModule({
      imports: [PlanTemplatesComponent],
      providers: [
        provideHttpClient(),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('renders the curated template gallery', () => {
    const fixture = TestBed.createComponent(PlanTemplatesComponent);
    fixture.detectChanges();

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.template-card');

    expect(cards.length).toBe(WORKOUT_PLAN_TEMPLATES.length);
    expect(cards[0].textContent).toContain('Full-body beginner');
    expect(cards[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('resolves template exercises and activates a plan with real exercise ids', () => {
    const fixture = TestBed.createComponent(PlanTemplatesComponent);
    const component = fixture.componentInstance;
    const activated = plan({ planId: 'plan-active', status: 'ACTIVE' });
    dataService.getExercises.and.callFake((options) => {
      const q = typeof options === 'string' ? options : options?.q ?? '';
      return of([exercise({ exerciseId: `${q}-id`, code: q, name: q })]);
    });
    dataService.createWorkoutPlan.and.returnValue(of(plan({ planId: 'plan-created' })));
    dataService.activateWorkoutPlan.and.returnValue(of(activated));
    spyOn(component.planActivated, 'emit');

    component.useTemplate(WORKOUT_PLAN_TEMPLATES[0]);

    const request = dataService.createWorkoutPlan.calls.mostRecent().args[0];
    expect(dataService.getExercises).toHaveBeenCalled();
    expect(request.exercises.length).toBe(WORKOUT_PLAN_TEMPLATES[0].exercises.length);
    expect(request.exercises[0].exerciseId).toBe('GOBLET_SQUAT-id');
    expect(dataService.activateWorkoutPlan).toHaveBeenCalledWith('plan-created');
    expect(component.planActivated.emit).toHaveBeenCalledWith(activated);
    expect(toast.success).toHaveBeenCalledWith('Template activated for today.');
  });

  it('skips unavailable template exercises while preserving resolved exercises', () => {
    const fixture = TestBed.createComponent(PlanTemplatesComponent);
    const component = fixture.componentInstance;
    dataService.getExercises.and.callFake((options) => {
      const q = typeof options === 'string' ? options : options?.q ?? '';
      return q === 'BODYWEIGHT_PUSH_UP' ? of([]) : of([exercise({ exerciseId: `${q}-id`, code: q, name: q })]);
    });

    component.useTemplate(WORKOUT_PLAN_TEMPLATES[0]);

    const request = dataService.createWorkoutPlan.calls.mostRecent().args[0];
    expect(request.exercises.length).toBe(WORKOUT_PLAN_TEMPLATES[0].exercises.length - 1);
    expect(request.exercises.every((item) => item.exerciseId)).toBeTrue();
    expect(toast.info).toHaveBeenCalledWith('1 template exercise unavailable and skipped.');
  });

  it('does not create an empty plan when no exercises resolve', () => {
    const fixture = TestBed.createComponent(PlanTemplatesComponent);
    dataService.getExercises.and.returnValue(of([]));

    fixture.componentInstance.useTemplate(WORKOUT_PLAN_TEMPLATES[0]);

    expect(dataService.createWorkoutPlan).not.toHaveBeenCalled();
    expect(dataService.activateWorkoutPlan).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('None of this template\'s exercises are available yet.');
  });

  it('shows a toast when template activation fails', () => {
    const fixture = TestBed.createComponent(PlanTemplatesComponent);
    dataService.createWorkoutPlan.and.returnValue(throwError(() => new Error('nope')));

    fixture.componentInstance.useTemplate(WORKOUT_PLAN_TEMPLATES[0]);

    expect(toast.error).toHaveBeenCalledWith('Unable to use this template. Please retry.');
  });
});
