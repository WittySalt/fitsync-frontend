import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Exercise, WorkoutPlan, WorkoutSession } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { TodayOverviewComponent } from './today-overview.component';

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    exerciseId: 'exercise-1',
    code: 'BODYWEIGHT_SQUAT',
    name: 'Bodyweight squat',
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
    name: 'Strength base',
    description: '',
    goalFocus: 'STRENGTH',
    workoutType: 'STRENGTH',
    difficulty: 'INTERMEDIATE',
    estimatedDurationMinutes: 45,
    status: 'ACTIVE',
    exerciseCount: 2,
    exercises: [
      {
        planExerciseId: 'pe-1',
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Back squat',
        sequence: 2,
        targetSets: 4,
        targetReps: 6,
        targetWeightKg: 80,
        targetDurationSeconds: null,
        targetDistanceKm: null,
        restSeconds: 120,
        notes: 'Keep two reps in reserve.',
        setTargets: []
      },
      {
        planExerciseId: 'pe-2',
        exerciseId: 'exercise-2',
        exerciseNameSnapshot: 'Push up',
        sequence: 1,
        targetSets: 3,
        targetReps: 10,
        targetWeightKg: null,
        targetDurationSeconds: null,
        targetDistanceKm: null,
        restSeconds: 75,
        notes: '',
        setTargets: []
      }
    ],
    ...overrides
  };
}

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    sessionId: 'session-1',
    name: 'Last lift',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-06-18T10:00:00Z',
    completedAt: '2026-06-18T11:00:00Z',
    durationMinutes: 60,
    caloriesBurned: 400,
    exerciseCount: 4,
    ...overrides
  };
}

describe('TodayOverviewComponent', () => {
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
      imports: [TodayOverviewComponent],
      providers: [
        provideHttpClient(),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('renders active plan details and emits start from the CTA', () => {
    const fixture = TestBed.createComponent(TodayOverviewComponent);
    const component = fixture.componentInstance;
    spyOn(component.startPlan, 'emit');
    fixture.componentRef.setInput('activePlan', plan());
    fixture.componentRef.setInput('sessions', [session()]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.today-hero .button.workout')?.click();

    expect(compiled.textContent).toContain('Strength base');
    expect(compiled.textContent).toContain('Push up');
    expect(compiled.textContent).toContain('Back squat');
    expect(compiled.textContent).toContain('Last lift');
    expect(component.startPlan.emit).toHaveBeenCalledWith(plan());
  });

  it('shows the template gallery and browse plans action when no active plan exists', () => {
    const fixture = TestBed.createComponent(TodayOverviewComponent);
    const component = fixture.componentInstance;
    spyOn(component.browsePlans, 'emit');
    fixture.componentRef.setInput('activePlan', null);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.today-hero .button.secondary')?.click();

    expect(compiled.textContent).toContain('Pick a plan for today');
    expect(compiled.querySelector('app-plan-templates')).not.toBeNull();
    expect(component.browsePlans.emit).toHaveBeenCalled();
  });
});
