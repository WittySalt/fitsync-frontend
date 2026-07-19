import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Exercise, ExerciseDetail, WorkoutPlan, WorkoutSession } from '../../core/fitsync.models';
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

function exerciseDetail(overrides: Partial<ExerciseDetail> = {}): ExerciseDetail {
  return {
    ...exercise(),
    images: [],
    imageUrls: [],
    instructions: [],
    secondaryMuscleGroups: [],
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
      'getExercise',
      'createWorkoutPlan',
      'activateWorkoutPlan'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    dataService.getExercises.and.returnValue(of([exercise()]));
    dataService.getExercise.and.returnValue(of(null));
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

  it('formats a duration-only target as a hold instead of "x -"', () => {
    const fixture = TestBed.createComponent(TodayOverviewComponent);
    const component = fixture.componentInstance;
    const summary = component.exerciseTarget({
      ...plan().exercises[0],
      targetSets: 3,
      targetReps: null,
      targetWeightKg: null,
      targetDurationSeconds: 45
    });
    expect(summary).toContain('3 x 45 sec hold');
    expect(summary).not.toContain('x -');
  });

  it('formats reps-with-duration and sets-only targets', () => {
    const component = TestBed.createComponent(TodayOverviewComponent).componentInstance;
    const repsDuration = component.exerciseTarget({
      ...plan().exercises[0],
      targetSets: 3,
      targetReps: 10,
      targetWeightKg: null,
      targetDurationSeconds: 30,
      restSeconds: 0
    });
    expect(repsDuration).toContain('3 x 10');
    expect(repsDuration).toContain('30 sec');

    const setsOnly = component.exerciseTarget({
      ...plan().exercises[0],
      targetSets: 4,
      targetReps: null,
      targetWeightKg: null,
      targetDurationSeconds: null,
      restSeconds: 0
    });
    expect(setsOnly).toContain('4 sets');
  });

  it('renders active plan details and emits start from the CTA', () => {
    const fixture = TestBed.createComponent(TodayOverviewComponent);
    const component = fixture.componentInstance;
    spyOn(component.startPlan, 'emit');
    fixture.componentRef.setInput('activePlan', plan());
    fixture.componentRef.setInput('sessions', [session()]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.hero-start')?.click();

    expect(compiled.textContent).toContain('Strength base');
    expect(compiled.textContent).toContain('Push up');
    expect(compiled.textContent).toContain('Back squat');
    expect(compiled.textContent).toContain('Last lift');
    expect(component.startPlan.emit).toHaveBeenCalledWith(plan());
  });

  it('uses the latest completed session for recent context', () => {
    const fixture = TestBed.createComponent(TodayOverviewComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('activePlan', plan());
    fixture.componentRef.setInput('sessions', [
      session({
        sessionId: 'completed',
        name: 'Completed lift',
        status: 'COMPLETED',
        completedAt: '2026-06-18T11:00:00Z',
        startedAt: '2026-06-18T10:00:00Z'
      }),
      session({
        sessionId: 'cancelled',
        name: 'Cancelled draft',
        status: 'CANCELLED',
        completedAt: '2026-06-19T11:00:00Z',
        startedAt: '2026-06-19T10:00:00Z'
      }),
      session({
        sessionId: 'in-progress',
        name: 'In-progress zombie',
        status: 'IN_PROGRESS',
        completedAt: '',
        startedAt: '2026-06-20T10:00:00Z',
        durationMinutes: 0
      })
    ]);

    fixture.detectChanges();

    expect(component.latestSession()?.sessionId).toBe('completed');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Completed lift');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Cancelled draft');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('In-progress zombie');
  });

  it('emits the selected exercise when a movement card is opened', () => {
    const fixture = TestBed.createComponent(TodayOverviewComponent);
    const component = fixture.componentInstance;
    const activePlan = plan();
    spyOn(component.startExercise, 'emit');
    fixture.componentRef.setInput('activePlan', activePlan);
    fixture.componentRef.setInput('sessions', []);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.hero-step')?.click();

    expect(component.startExercise.emit).toHaveBeenCalledWith(activePlan.exercises[1]);
  });

  it('shows catalog thumbnails when available and numbered badges otherwise', () => {
    dataService.getExercise.and.callFake((exerciseId: string) =>
      exerciseId === 'exercise-1'
        ? of(exerciseDetail({ imageUrls: ['http://media.local/back-squat.png'] }))
        : of(null));
    const fixture = TestBed.createComponent(TodayOverviewComponent);
    fixture.componentRef.setInput('activePlan', plan());
    fixture.componentRef.setInput('sessions', []);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const steps = [...compiled.querySelectorAll('.hero-step')];
    // Sequence 1 = Push up (no media -> numbered badge), sequence 2 = Back squat (thumbnail).
    expect(steps[0].querySelector('.step-index')?.textContent?.trim()).toBe('1');
    expect(steps[1].querySelector('img')?.getAttribute('src')).toBe('http://media.local/back-squat.png');
  });

  it('shows the template gallery and browse plans action when no active plan exists', () => {
    const fixture = TestBed.createComponent(TodayOverviewComponent);
    const component = fixture.componentInstance;
    spyOn(component.browsePlans, 'emit');
    fixture.componentRef.setInput('activePlan', null);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.hero-ghost')?.click();

    expect(compiled.textContent).toContain('Pick a plan for today');
    expect(compiled.querySelector('app-plan-templates')).not.toBeNull();
    expect(component.browsePlans.emit).toHaveBeenCalled();
  });
});
