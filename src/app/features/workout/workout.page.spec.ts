import { provideHttpClient } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutPage } from './workout.page';
import { Exercise, WorkoutPlan, WorkoutSession, WorkoutSessionDetail } from '../../core/fitsync.models';
import { LiveStartCardComponent } from './live-start-card.component';
import { TodayOverviewComponent } from './today-overview.component';
import { WorkoutDataIoComponent } from './workout-data-io.component';

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

function sessionPage(sessions: WorkoutSession[], total = sessions.length) {
  return { sessions, total };
}

function sessionDetail(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    ...session({ sessionId: 'session-1', name: 'Session', status: 'IN_PROGRESS' }),
    perceivedExertion: null,
    notes: '',
    exercises: [],
    createdAt: '',
    updatedAt: '',
    ...overrides
  };
}

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    exerciseId: 'exercise-1',
    code: 'BACK_SQUAT',
    name: 'Back squat',
    description: '',
    exerciseType: 'STRENGTH',
    primaryMuscleGroup: 'QUADS',
    equipment: 'BARBELL',
    difficulty: 'INTERMEDIATE',
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
      'getWorkoutSessionPage',
      'searchExercisesPage',
      'getActivePlan',
      'saveWorkoutSession',
      'createWorkoutPlan',
      'updateWorkoutPlan',
      'activateWorkoutPlan',
      'archiveWorkoutPlan',
      'startWorkoutPlan',
      'startAdHocSession',
      'addSessionExercise',
      'upsertSessionSet',
      'completeSession',
      'cancelSession',
      'getExerciseMetadata',
      'createExercise',
      'updateExercise',
      'archiveExercise',
      'getSession',
      'updateSession',
      'deleteSession',
      'repeatSession',
      'repeatLatestSession',
      'exportWorkoutData',
      'importSessions'
    ]);
    dataService.getWorkoutPlans.and.returnValue(of([]));
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([])));
    dataService.searchExercisesPage.and.returnValue(of({ items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 }));
    dataService.getActivePlan.and.returnValue(of(null));
    dataService.saveWorkoutSession.and.returnValue(of({ ok: true }));
    dataService.createWorkoutPlan.and.returnValue(of(plan({ status: 'DRAFT' })));
    dataService.updateWorkoutPlan.and.returnValue(of(plan({ status: 'DRAFT' })));
    dataService.activateWorkoutPlan.and.returnValue(of(plan({ status: 'ACTIVE' })));
    dataService.archiveWorkoutPlan.and.returnValue(of(void 0));
    dataService.startWorkoutPlan.and.returnValue(of(sessionDetail()));
    dataService.startAdHocSession.and.returnValue(of(sessionDetail()));
    dataService.addSessionExercise.and.returnValue(of(sessionDetail()));
    dataService.upsertSessionSet.and.returnValue(of(sessionDetail()));
    dataService.completeSession.and.returnValue(of(sessionDetail({ status: 'COMPLETED' })));
    dataService.cancelSession.and.returnValue(of(sessionDetail({ status: 'CANCELLED' })));
    dataService.getExerciseMetadata.and.returnValue(
      of({
        exerciseTypes: ['STRENGTH'],
        muscleGroups: ['QUADS'],
        equipment: ['BARBELL'],
        difficulties: ['INTERMEDIATE'],
        workoutTypes: ['STRENGTH'],
        goalFocuses: ['STRENGTH']
      })
    );
    dataService.createExercise.and.returnValue(of(exercise({ custom: true })));
    dataService.updateExercise.and.returnValue(of(exercise({ custom: true })));
    dataService.archiveExercise.and.returnValue(of(void 0));
    dataService.getSession.and.returnValue(of(sessionDetail({ status: 'COMPLETED' })));
    dataService.updateSession.and.returnValue(of(sessionDetail({ status: 'COMPLETED' })));
    dataService.deleteSession.and.returnValue(of(void 0));
    dataService.repeatSession.and.returnValue(of(sessionDetail({ sessionId: 'session-repeat', status: 'IN_PROGRESS' })));
    dataService.repeatLatestSession.and.returnValue(of(sessionDetail({ sessionId: 'session-latest', status: 'IN_PROGRESS' })));
    dataService.exportWorkoutData.and.returnValue(
      of({
        schemaVersion: 1,
        exportedAt: '2026-06-20T10:00:00Z',
        exercises: [],
        plans: [],
        sessions: []
      })
    );
    dataService.importSessions.and.returnValue(of({ imported: 0, skippedDuplicate: 0, rejected: 0, results: [] }));

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

  it('counts total sessions from the paged total and this-week sessions from loaded rows', () => {
    component.sessions.set([
      session({ name: 'recent', completedAt: new Date().toISOString() }),
      session({ name: 'old', completedAt: '2025-01-01T00:00:00Z' })
    ]);
    component.totalSessionCount.set(42);

    const metrics = component.metrics();
    expect(metrics[0].value).toBe('42');
    expect(metrics[1].value).toBe('1');
  });

  it('uses only completed sessions for client-derived metrics and default history', () => {
    component.totalSessionCount.set(4);
    component.sessions.set([
      session({
        sessionId: 'completed-recent',
        name: 'Completed recent',
        status: 'COMPLETED',
        workoutType: 'STRENGTH',
        completedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        durationMinutes: 45
      }),
      session({
        sessionId: 'completed-old',
        name: 'Completed old',
        status: 'COMPLETED',
        workoutType: 'CARDIO',
        completedAt: '2025-01-01T10:00:00Z',
        startedAt: '2025-01-01T09:00:00Z',
        durationMinutes: 30
      }),
      session({
        sessionId: 'cancelled-newest',
        name: 'Cancelled newest',
        status: 'CANCELLED',
        workoutType: 'HIIT',
        completedAt: new Date(Date.now() + 60_000).toISOString(),
        startedAt: new Date(Date.now() + 60_000).toISOString(),
        durationMinutes: 0
      }),
      session({
        sessionId: 'in-progress-zombie',
        name: 'In progress zombie',
        status: 'IN_PROGRESS',
        workoutType: 'YOGA',
        completedAt: '',
        startedAt: new Date(Date.now() + 120_000).toISOString(),
        durationMinutes: 0
      })
    ]);

    const metrics = component.metrics();

    expect(metrics[0]).toEqual(jasmine.objectContaining({ label: 'Sessions tracked', value: '4', detail: 'all statuses' }));
    expect(metrics[1]).toEqual(jasmine.objectContaining({ label: 'This week', value: '1', detail: 'completed in the last 7 days' }));
    expect(component.latestSession()?.sessionId).toBe('completed-recent');
    expect(metrics[2].detail).toBe('Strength');
    expect(component.filteredSessions().map((item) => item.sessionId)).toEqual(['completed-recent', 'completed-old']);

    component.setFilterStatus('');
    expect(component.filteredSessions().map((item) => item.sessionId)).toEqual([
      'in-progress-zombie',
      'cancelled-newest',
      'completed-recent',
      'completed-old'
    ]);

    component.setFilterStatus('CANCELLED');

    expect(component.filteredSessions().map((item) => item.sessionId)).toEqual(['cancelled-newest']);
  });

  it('loads a small workout history page for client-side history display', () => {
    dataService.getWorkoutSessionPage.and.returnValue(
      of(sessionPage([session({ sessionId: 'loaded', completedAt: new Date().toISOString() })], 37))
    );
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const requestedSize = dataService.getWorkoutSessionPage.calls.mostRecent().args[0];
    expect(requestedSize).toBe(10);
    expect(requestedSize).toBeLessThanOrEqual(100);
    expect(fixture.componentInstance.sessions().length).toBe(1);
    expect(fixture.componentInstance.metrics()[0].value).toBe('37');
  });

  it('filters history by case-insensitive session name search', () => {
    component.sessions.set([
      session({ sessionId: 'push', name: 'Push Day', completedAt: '2026-06-14T10:00:00Z' }),
      session({ sessionId: 'run', name: 'Easy Run', workoutType: 'CARDIO', completedAt: '2026-06-15T10:00:00Z' })
    ]);

    component.setHistorySearch('push');

    expect(component.filteredSessions().map((item) => item.sessionId)).toEqual(['push']);
  });

  it('derives history type and status options from loaded sessions', () => {
    component.sessions.set([
      session({ workoutType: 'STRENGTH', status: 'COMPLETED' }),
      session({ workoutType: 'CARDIO', status: 'CANCELLED' }),
      session({ workoutType: 'STRENGTH', status: 'COMPLETED' })
    ]);

    expect(component.historyTypeOptions()).toEqual(['CARDIO', 'STRENGTH']);
    expect(component.historyStatusOptions).toEqual(['COMPLETED', 'CANCELLED', 'IN_PROGRESS']);
  });

  it('filters history by type, status, duration bucket, and date range', () => {
    component.sessions.set([
      session({
        sessionId: 'match',
        name: 'Tempo strength',
        workoutType: 'STRENGTH',
        status: 'COMPLETED',
        durationMinutes: 45,
        completedAt: '2026-06-15T10:00:00Z'
      }),
      session({
        sessionId: 'wrong-type',
        workoutType: 'CARDIO',
        status: 'COMPLETED',
        durationMinutes: 45,
        completedAt: '2026-06-15T10:00:00Z'
      }),
      session({
        sessionId: 'wrong-status',
        workoutType: 'STRENGTH',
        status: 'CANCELLED',
        durationMinutes: 45,
        completedAt: '2026-06-15T10:00:00Z'
      }),
      session({
        sessionId: 'too-short',
        workoutType: 'STRENGTH',
        status: 'COMPLETED',
        durationMinutes: 20,
        completedAt: '2026-06-15T10:00:00Z'
      }),
      session({
        sessionId: 'too-early',
        workoutType: 'STRENGTH',
        status: 'COMPLETED',
        durationMinutes: 45,
        completedAt: '2026-06-10T10:00:00Z'
      })
    ]);

    component.setFilterType('STRENGTH');
    component.setFilterStatus('COMPLETED');
    component.setFilterDuration('30to60');
    component.setFilterDateFrom('2026-06-15');
    component.setFilterDateTo('2026-06-15');

    expect(component.filteredSessions().map((item) => item.sessionId)).toEqual(['match']);

    component.setFilterDuration('lt30');
    expect(component.filteredSessions().map((item) => item.sessionId)).toEqual(['too-short']);

    component.setFilterDuration('gt60');
    expect(component.filteredSessions()).toEqual([]);
  });

  it('sorts history newest-first and pages through filtered sessions', () => {
    component.sessions.set(
      Array.from({ length: 10 }, (_, index) =>
        session({
          sessionId: `session-${index + 1}`,
          name: `Session ${index + 1}`,
          completedAt: `2026-06-${String(index + 1).padStart(2, '0')}T10:00:00Z`
        })
      )
    );

    expect(component.totalHistoryPages()).toBe(2);
    expect(component.pagedSessions().map((item) => item.sessionId)).toEqual([
      'session-10',
      'session-9',
      'session-8',
      'session-7',
      'session-6',
      'session-5',
      'session-4',
      'session-3'
    ]);

    component.nextHistoryPage();
    expect(component.page()).toBe(1);
    expect(component.pagedSessions().map((item) => item.sessionId)).toEqual(['session-2', 'session-1']);

    component.nextHistoryPage();
    expect(component.page()).toBe(1);

    component.setHistorySearch('Session 1');
    expect(component.page()).toBe(0);
    expect(component.filteredSessions().map((item) => item.sessionId)).toEqual(['session-10', 'session-1']);
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

  it('renders the live start card behind guided today without a top-level past workout form', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const overviewPanel = compiled.querySelector<HTMLElement>('#workout-panel-overview');
    const firstContent = overviewPanel?.firstElementChild;

    expect(firstContent?.tagName.toLowerCase()).toBe('app-today-overview');
    expect(compiled.querySelector('app-live-start-card')).not.toBeNull();
    expect(compiled.querySelector('.log-workout-card')).toBeNull();
    expect(compiled.querySelector('#past-workout-form')).toBeNull();
  });

  it('opens the free or goal live tracker when the start card emits a started session', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const startCard = fixture.debugElement.query(By.directive(LiveStartCardComponent)).componentInstance as LiveStartCardComponent;
    startCard.started.emit({
      session: sessionDetail({ sessionId: 'session-live', name: 'Goal run', workoutType: 'CARDIO' }),
      goal: { type: 'MINUTES', target: 30 }
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.liveTrackerSession()?.sessionId).toBe('session-live');
    expect(fixture.componentInstance.liveTrackerGoal()).toEqual({ type: 'MINUTES', target: 30 });
    expect((fixture.nativeElement as HTMLElement).querySelector('app-live-tracker')).not.toBeNull();
  });

  it('starts today from the guided overview and opens the exercise player', () => {
    const active = plan({
      planId: 'plan-today',
      name: 'Today plan',
      status: 'ACTIVE',
      exercises: [{
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Goblet Squat',
        sequence: 1,
        targetSets: 1,
        targetReps: 10,
        targetWeightKg: null,
        targetDurationSeconds: null,
        targetDistanceKm: null,
        restSeconds: 60,
        notes: '',
        setTargets: []
      }]
    });
    const started = sessionDetail({ sessionId: 'session-today', planId: 'plan-today', name: 'Today plan' });
    dataService.getActivePlan.and.returnValue(of(active));
    dataService.startWorkoutPlan.and.returnValue(of(started));

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const today = fixture.debugElement.query(By.directive(TodayOverviewComponent)).componentInstance as TodayOverviewComponent;
    today.startPlan.emit(active);
    fixture.detectChanges();

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-today');
    expect(fixture.componentInstance.guidedPlayerSession()?.sessionId).toBe('session-today');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-exercise-player')).not.toBeNull();
  });

  it('opens the exercise player at the selected movement from Today', () => {
    const active = plan({
      planId: 'plan-today',
      name: 'Today plan',
      status: 'ACTIVE',
      exercises: [{
        exerciseId: 'exercise-2',
        exerciseNameSnapshot: 'Push-Up',
        sequence: 1,
        targetSets: 1,
        targetReps: 8,
        targetWeightKg: null,
        targetDurationSeconds: null,
        targetDistanceKm: null,
        restSeconds: 45,
        notes: '',
        setTargets: []
      }]
    });
    const started = sessionDetail({ sessionId: 'session-today', planId: 'plan-today', name: 'Today plan' });
    dataService.getActivePlan.and.returnValue(of(active));
    dataService.startWorkoutPlan.and.returnValue(of(started));

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const today = fixture.debugElement.query(By.directive(TodayOverviewComponent)).componentInstance as TodayOverviewComponent;
    today.startExercise.emit(active.exercises[0]);
    fixture.detectChanges();

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-today');
    expect(fixture.componentInstance.guidedInitialExerciseId()).toBe('exercise-2');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-exercise-player')).not.toBeNull();
  });

  it('refreshes sessions when the nested past workout flow finishes', () => {
    const backfilled = session({ sessionId: 'session-backfilled', name: 'Backfilled', status: 'COMPLETED' });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([backfilled])));

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const startCard = fixture.debugElement.query(By.directive(LiveStartCardComponent)).componentInstance as LiveStartCardComponent;
    startCard.backfilled.emit();

    expect(dataService.getWorkoutSessionPage).toHaveBeenCalled();
    expect(fixture.componentInstance.sessions()[0].sessionId).toBe('session-backfilled');
  });

  it('submits a workout plan with a real exercise blueprint', () => {
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

  it('searches and selects a deep-catalog exercise in the plan picker', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkoutPage);
    const deepCatalogExercise = exercise({
      exerciseId: 'exercise-57',
      name: 'Paused squat',
      primaryMuscleGroup: 'QUADS',
      equipment: 'BARBELL'
    });
    dataService.searchExercisesPage.and.returnValue(of({
      items: [deepCatalogExercise],
      page: 0,
      size: 20,
      totalPages: 1,
      totalElements: 1
    }));
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.exercise-typeahead input');
    input!.value = 'squat';
    input!.dispatchEvent(new Event('input'));
    tick(275);
    fixture.detectChanges();

    const option = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="option"]');
    option!.click();
    fixture.detectChanges();

    expect(dataService.searchExercisesPage).toHaveBeenCalledWith({ q: 'squat', page: 0, size: 20 });
    expect(fixture.componentInstance.planExercises.at(0).value.exerciseId).toBe('exercise-57');
    expect(input!.value).toBe('Paused squat');
  }));

  it('prefills existing plan exercise names without searching', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();
    dataService.searchExercisesPage.calls.reset();

    fixture.componentInstance.editPlan(
      plan({
        planId: 'plan-edit',
        exercises: [
          {
            exerciseId: 'exercise-deep',
            exerciseNameSnapshot: 'Zercher squat',
            sequence: 1,
            targetSets: 4,
            targetReps: 6,
            targetWeightKg: 80,
            targetDurationSeconds: null,
            targetDistanceKm: null,
            restSeconds: 150,
            notes: 'Strong',
            setTargets: []
          }
        ]
      })
    );
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.exercise-typeahead input');
    expect(input?.value).toBe('Zercher squat');
    expect(dataService.searchExercisesPage).not.toHaveBeenCalled();
  });

  it('debounces plan exercise search and only sends the latest query', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkoutPage);
    dataService.searchExercisesPage.and.returnValue(of({
      items: [exercise({ exerciseId: 'exercise-57', name: 'Paused squat' })],
      page: 0,
      size: 20,
      totalPages: 1,
      totalElements: 1
    }));
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.exercise-typeahead input');
    ['s', 'sq', 'squ', 'squa', 'squat'].forEach((query) => {
      input!.value = query;
      input!.dispatchEvent(new Event('input'));
      tick(50);
    });

    expect(dataService.searchExercisesPage).not.toHaveBeenCalled();

    tick(275);
    fixture.detectChanges();

    expect(dataService.searchExercisesPage).toHaveBeenCalledTimes(1);
    expect(dataService.searchExercisesPage).toHaveBeenCalledWith({ q: 'squat', page: 0, size: 20 });
  }));

  it('closes the plan exercise picker and marks exerciseId touched on blur', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.exercise-typeahead input');
    input!.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(fixture.componentInstance.exercisePickerState(0).open).toBeTrue();

    input!.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(fixture.componentInstance.exercisePickerState(0).open).toBeFalse();
    expect(fixture.componentInstance.planExercises.at(0).get('exerciseId')?.touched).toBeTrue();
  });

  it('starts a plan and moves the user to training history', () => {
    const started = sessionDetail({ sessionId: 'session-1', name: 'Strength base', status: 'IN_PROGRESS' });
    dataService.startWorkoutPlan.and.returnValue(of(started));
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([started])));

    component.startPlan(plan({ status: 'ACTIVE' }));

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-1');
    expect(component.sessions()[0].sessionId).toBe('session-1');
    expect(component.selectedTab()).toBe('history');
  });

  it('refreshes sessions and opens history when the live tracker completes', () => {
    const completed = session({ sessionId: 'session-2', name: 'Finished', status: 'COMPLETED' });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([completed])));
    component.liveTrackerSession.set(sessionDetail({ sessionId: 'session-live' }));

    component.handleLiveTrackerFinished();

    expect(dataService.getWorkoutSessionPage).toHaveBeenCalled();
    expect(component.sessions()[0].sessionId).toBe('session-2');
    expect(component.liveTrackerSession()).toBeNull();
    expect(component.selectedTab()).toBe('history');
  });

  it('opens session detail from a history row', () => {
    const completed = session({ sessionId: 'session-1', name: 'Push day', status: 'COMPLETED' });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([completed])));
    dataService.getSession.and.returnValue(of(sessionDetail({ sessionId: 'session-1', name: 'Push day' })));

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    fixture.componentInstance.selectedTab.set('history');
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.history-row')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedSessionId()).toBe('session-1');
    expect(dataService.getSession).toHaveBeenCalledWith('session-1');
  });

  it('renders a filtered history empty state separately from no logged sessions', () => {
    dataService.getWorkoutSessionPage.and.returnValue(
      of(sessionPage([session({ sessionId: 'session-1', name: 'Push day', status: 'COMPLETED' })]))
    );

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    fixture.componentInstance.selectedTab.set('history');
    fixture.detectChanges();

    fixture.componentInstance.setHistorySearch('missing');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No sessions match these filters');
    expect(compiled.textContent).not.toContain('No sessions logged');

    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([])));
    const emptyFixture = TestBed.createComponent(WorkoutPage);
    emptyFixture.detectChanges();
    emptyFixture.componentInstance.selectedTab.set('history');
    emptyFixture.detectChanges();

    expect((emptyFixture.nativeElement as HTMLElement).textContent).toContain('No sessions logged');
  });

  it('repeats the latest session and refreshes history', () => {
    const repeated = sessionDetail({ sessionId: 'session-latest', name: 'Repeated', status: 'IN_PROGRESS' });
    dataService.repeatLatestSession.and.returnValue(of(repeated));
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([repeated])));

    component.repeatLatestSession();

    expect(dataService.repeatLatestSession).toHaveBeenCalled();
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalled();
    expect(component.sessions()[0].sessionId).toBe('session-latest');
  });

  it('refreshes history after workout data import finishes', () => {
    const imported = session({ sessionId: 'session-imported', name: 'Imported', status: 'COMPLETED' });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([imported])));

    component.handleWorkoutImportFinished();

    expect(dataService.getWorkoutSessionPage).toHaveBeenCalled();
    expect(component.sessions()[0].sessionId).toBe('session-imported');
  });

  it('keeps workout data tools collapsed by default in history', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    fixture.componentInstance.selectedTab.set('history');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector<HTMLButtonElement>('.data-tools-toggle');

    expect(fixture.componentInstance.dataToolsOpen()).toBeFalse();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-controls')).toBe('workout-data-tools');
    expect(compiled.querySelector('app-workout-data-io')).toBeNull();
  });

  it('expands workout data tools from the history disclosure', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    fixture.componentInstance.selectedTab.set('history');
    fixture.detectChanges();

    const toggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.data-tools-toggle');
    toggle?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.dataToolsOpen()).toBeTrue();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect((fixture.nativeElement as HTMLElement).querySelector('#workout-data-tools app-workout-data-io')).not.toBeNull();
  });

  it('refreshes history when the expanded data tools emit imported', () => {
    const imported = session({ sessionId: 'session-imported', name: 'Imported', status: 'COMPLETED' });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([imported])));

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    fixture.componentInstance.selectedTab.set('history');
    fixture.componentInstance.dataToolsOpen.set(true);
    fixture.detectChanges();

    fixture.debugElement.query(By.directive(WorkoutDataIoComponent)).componentInstance.imported.emit();

    expect(dataService.getWorkoutSessionPage).toHaveBeenCalled();
    expect(fixture.componentInstance.sessions()[0].sessionId).toBe('session-imported');
  });

  it('loads plan errors and refilters plans by status', () => {
    dataService.getWorkoutPlans.and.returnValue(throwError(() => new Error('offline')));

    component.load();

    expect(component.loading()).toBeFalse();
    expect(component.planError()).toBe('Unable to load workout plans. Please retry.');
    expect(component.plans()).toEqual([]);

    dataService.getWorkoutPlans.and.returnValue(of([plan({ status: 'ARCHIVED' })]));
    component.selectPlanStatus('ARCHIVED');

    expect(dataService.getWorkoutPlans).toHaveBeenCalledWith('ARCHIVED');
    expect(component.planError()).toBeNull();
    expect(component.plans()[0].status).toBe('ARCHIVED');
  });

  it('resets the only plan exercise row and removes additional rows', () => {
    component.planExercises.at(0).patchValue({
      exerciseId: 'exercise-1',
      targetSets: 5,
      targetReps: 3,
      targetWeightKg: 100,
      restSeconds: 180,
      notes: 'Heavy'
    });

    component.removePlanExercise(0);

    expect(component.planExercises.length).toBe(1);
    expect(component.planExercises.at(0).value).toEqual(
      jasmine.objectContaining({
        exerciseId: '',
        targetSets: 3,
        targetReps: 8,
        targetWeightKg: null,
        restSeconds: 90,
        notes: ''
      })
    );

    component.addPlanExercise();
    component.planExercises.at(1).patchValue({ exerciseId: 'exercise-2' });
    component.removePlanExercise(1);

    expect(component.planExercises.length).toBe(1);
  });

  it('edits concrete plans, skips sample plans, and cancels edit mode', () => {
    component.editPlan(plan({ planId: null as unknown as string }));

    expect(component.editingPlanId()).toBeNull();

    component.editPlan(
      plan({
        planId: 'plan-edit',
        name: 'Loaded plan',
        description: 'Existing notes',
        estimatedDurationMinutes: 35,
        exercises: [
          {
            exerciseId: 'exercise-1',
            exerciseNameSnapshot: 'Back squat',
            sequence: 1,
            targetSets: 4,
            targetReps: 6,
            targetWeightKg: 80,
            targetDurationSeconds: null,
            targetDistanceKm: null,
            restSeconds: 150,
            notes: 'Strong',
            setTargets: []
          }
        ]
      })
    );

    expect(component.editingPlanId()).toBe('plan-edit');
    expect(component.planForm.value.name).toBe('Loaded plan');
    expect(component.planExercises.at(0).value).toEqual(
      jasmine.objectContaining({
        exerciseId: 'exercise-1',
        targetSets: 4,
        targetReps: 6,
        targetWeightKg: 80,
        restSeconds: 150,
        notes: 'Strong'
      })
    );

    component.cancelEdit();

    expect(component.editingPlanId()).toBeNull();
    expect(component.planForm.value.name).toBe('');
    expect(component.planExercises.length).toBe(1);
  });

  it('handles plan create and update error callbacks', () => {
    component.planForm.patchValue({
      name: 'Strength base',
      goalFocus: 'STRENGTH',
      workoutType: 'STRENGTH',
      difficulty: 'INTERMEDIATE',
      estimatedDurationMinutes: 50
    });
    component.planExercises.at(0).patchValue({ exerciseId: 'exercise-1' });
    dataService.createWorkoutPlan.and.returnValue(throwError(() => new Error('create failed')));

    component.savePlan();

    expect(component.savingPlan()).toBeFalse();
    expect(dataService.createWorkoutPlan).toHaveBeenCalled();

    component.editPlan(plan({ planId: 'plan-edit', exercises: [] }));
    component.planExercises.at(0).patchValue({ exerciseId: 'exercise-1' });
    dataService.updateWorkoutPlan.and.returnValue(throwError(() => new Error('update failed')));

    component.savePlan();

    expect(component.savingPlan()).toBeFalse();
    expect(dataService.updateWorkoutPlan).toHaveBeenCalledWith('plan-edit', jasmine.any(Object));
  });

  it('guards and recovers plan activation, archiving, and starting mutations', () => {
    const noId = plan({ planId: null as unknown as string });
    const activePlan = plan({ planId: 'plan-active', status: 'ACTIVE' });

    component.activatePlan(noId);
    component.archivePlan(noId);
    component.startPlan(plan({ ...noId, status: 'ACTIVE' }));
    component.startPlan(plan({ status: 'ARCHIVED' }));

    expect(dataService.activateWorkoutPlan).not.toHaveBeenCalled();
    expect(dataService.archiveWorkoutPlan).not.toHaveBeenCalled();
    expect(dataService.startWorkoutPlan).not.toHaveBeenCalled();

    component.planMutations.set(new Set(['plan-active']));
    component.activatePlan(activePlan);
    component.archivePlan(activePlan);
    component.startPlan(activePlan);

    expect(dataService.activateWorkoutPlan).not.toHaveBeenCalled();
    expect(dataService.archiveWorkoutPlan).not.toHaveBeenCalled();
    expect(dataService.startWorkoutPlan).not.toHaveBeenCalled();

    component.planMutations.set(new Set());
    dataService.activateWorkoutPlan.and.returnValue(throwError(() => new Error('activate failed')));
    component.activatePlan(activePlan);
    expect(component.isPlanMutating(activePlan)).toBeFalse();

    dataService.archiveWorkoutPlan.and.returnValue(throwError(() => new Error('archive failed')));
    component.archivePlan(activePlan);
    expect(component.isPlanMutating(activePlan)).toBeFalse();

    dataService.startWorkoutPlan.and.returnValue(throwError(() => new Error('start failed')));
    component.startPlan(activePlan);
    expect(component.isPlanMutating(activePlan)).toBeFalse();
  });

  it('handles guided workout guards, errors, and cancellation paths', () => {
    const exerciseTarget = {
      exerciseId: 'exercise-2',
      exerciseNameSnapshot: 'Push-Up',
      sequence: 1,
      targetSets: 1,
      targetReps: 8,
      targetWeightKg: null,
      targetDurationSeconds: null,
      targetDistanceKm: null,
      restSeconds: 45,
      notes: '',
      setTargets: []
    };
    const active = plan({ planId: 'plan-guided', status: 'ACTIVE', exercises: [exerciseTarget] });

    component.handleTodayExerciseStart(exerciseTarget);

    expect(dataService.startWorkoutPlan).not.toHaveBeenCalled();

    component.activePlan.set(active);
    component.planMutations.set(new Set(['plan-guided']));
    component.handleTodayStart(active);

    expect(dataService.startWorkoutPlan).not.toHaveBeenCalled();

    component.planMutations.set(new Set());
    dataService.startWorkoutPlan.and.returnValue(throwError(() => new Error('guided failed')));
    component.handleTodayExerciseStart(exerciseTarget);

    expect(component.guidedInitialExerciseId()).toBeNull();
    expect(component.isPlanMutating(active)).toBeFalse();

    component.guidedPlayerSession.set(sessionDetail({ sessionId: 'guided-open' }));
    component.guidedInitialExerciseId.set('exercise-2');
    component.handleGuidedPlayerCancelled();

    expect(component.guidedPlayerSession()).toBeNull();
    expect(component.guidedInitialExerciseId()).toBeNull();
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalled();
  });

  it('updates session detail state and handles empty history selections', () => {
    const first = session({ sessionId: 'session-1', name: 'First', status: 'COMPLETED' });
    const second = session({ sessionId: 'session-2', name: 'Second', status: 'COMPLETED' });
    component.sessions.set([first, second]);

    component.openSessionDetail(session({ status: 'COMPLETED' }));

    expect(component.selectedSessionId()).toBeNull();

    component.openSessionDetail(first);
    expect(component.selectedSessionId()).toBe('session-1');

    const updated = sessionDetail({ sessionId: 'session-1', name: 'Updated', status: 'COMPLETED' });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([updated, second])));

    component.handleSessionUpdated(updated);
    expect(component.sessions()[0].name).toBe('Updated');

    component.handleSessionDeleted();
    expect(component.selectedSessionId()).toBeNull();

    const repeated = sessionDetail({ sessionId: 'session-2', name: 'Repeated' });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([repeated, first])));

    component.handleSessionRepeated(repeated);
    expect(component.sessions()[0].name).toBe('Repeated');

    component.closeSessionDetail();
    expect(component.selectedSessionId()).toBeNull();
  });

  it('guards latest-session repeat and handles repeat errors', () => {
    component.repeatingLatest.set(true);
    component.repeatLatestSession();
    expect(dataService.repeatLatestSession).not.toHaveBeenCalled();

    component.repeatingLatest.set(false);
    dataService.repeatLatestSession.and.returnValue(throwError(() => new Error('repeat failed')));

    component.repeatLatestSession();

    expect(dataService.repeatLatestSession).toHaveBeenCalled();
    expect(component.repeatingLatest()).toBeFalse();
  });

  it('formats missing labels and invalid dates for summary cards', () => {
    component.sessions.set([session({ completedAt: 'not-a-date', startedAt: '' })]);

    expect(component.formatLabel(null)).toBe('');
    expect(component.formatLabel('MUSCLE_GAIN')).toBe('Muscle Gain');
    expect(component.formatDate(null)).toBe('\u2014');
    expect(component.formatDate('not-a-date')).toBe('\u2014');
    expect(component.metrics()[2].detail).toBe('Strength');
  });
});
