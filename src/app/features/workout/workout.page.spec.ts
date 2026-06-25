import { provideHttpClient } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutPage } from './workout.page';
import { Exercise, WorkoutPlan, WorkoutSession, WorkoutSessionDetail, WorkoutSessionQuery } from '../../core/fitsync.models';
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

function sessionPage(sessions: WorkoutSession[], total = sessions.length, totalPages = 1, page = 0) {
  return { sessions, total, totalPages, page };
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

  it('shows completed-only metrics from server counts and the last completed session', () => {
    component.completedSessionCount.set(42);
    component.weekCompletedCount.set(3);
    component.lastCompletedSession.set(
      session({ name: 'New', workoutType: 'STRENGTH', completedAt: '2026-06-18T10:00:00Z' })
    );

    const metrics = component.metrics();
    expect(metrics[0]).toEqual(jasmine.objectContaining({ label: 'Sessions logged', value: '42', detail: 'completed all time' }));
    expect(metrics[1]).toEqual(jasmine.objectContaining({ label: 'This week', value: '3', detail: 'completed in the last 7 days' }));
    expect(metrics[2].detail).toBe('Strength');
    expect(metrics[2].value).not.toBe('—');
  });

  it('loads completed-only metric counts and last session from the server', () => {
    dataService.getWorkoutSessionPage.and.callFake((query) => {
      const q = query as WorkoutSessionQuery;
      if (q.from) {
        return of(sessionPage([], 5));
      }
      if (q.status === 'COMPLETED' && q.size === 1) {
        return of(sessionPage([session({ sessionId: 'last', workoutType: 'STRENGTH', completedAt: new Date().toISOString() })], 40));
      }
      return of(sessionPage([]));
    });

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    const c = fixture.componentInstance;

    expect(c.completedSessionCount()).toBe(40);
    expect(c.weekCompletedCount()).toBe(5);
    expect(c.lastCompletedSession()?.sessionId).toBe('last');
  });

  it('requests history from the server with the active filters', () => {
    dataService.getWorkoutSessionPage.calls.reset();

    component.setFilterType('STRENGTH');
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledWith(
      jasmine.objectContaining({ workoutType: 'STRENGTH', status: 'COMPLETED', page: 0 })
    );

    component.setFilterDuration('30to60');
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledWith(
      jasmine.objectContaining({ minDurationMinutes: 30, maxDurationMinutes: 60 })
    );

    component.setFilterStatus('');
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledWith(
      jasmine.objectContaining({ status: undefined })
    );

    component.setFilterDateFrom('2026-06-15');
    const lastQuery = dataService.getWorkoutSessionPage.calls.mostRecent().args[0] as WorkoutSessionQuery;
    expect(lastQuery.from).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('drives the history pager from server page metadata', () => {
    dataService.getWorkoutSessionPage.and.callFake((query) => {
      const q = query as WorkoutSessionQuery;
      if (q.size === 1) {
        return of(sessionPage([], 40));
      }
      return of(sessionPage([session({ sessionId: 'loaded', completedAt: new Date().toISOString() })], 30, 4, q.page ?? 0));
    });

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    const c = fixture.componentInstance;

    expect(c.historyTotal()).toBe(30);
    expect(c.historyTotalPages()).toBe(4);
    expect(c.sessions().length).toBe(1);

    dataService.getWorkoutSessionPage.calls.reset();
    c.nextHistoryPage();
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledWith(jasmine.objectContaining({ page: 1 }));
  });

  it('refines the loaded history page client-side by case-insensitive name search', () => {
    component.sessions.set([
      session({ sessionId: 'push', name: 'Push Day', completedAt: '2026-06-14T10:00:00Z' }),
      session({ sessionId: 'run', name: 'Easy Run', workoutType: 'CARDIO', completedAt: '2026-06-15T10:00:00Z' })
    ]);

    component.setHistorySearch('push');

    expect(component.visibleSessions().map((item) => item.sessionId)).toEqual(['push']);
  });

  it('offers canonical history type and status filter options', () => {
    expect(component.historyTypeOptions).toEqual(component.workoutTypeOptions);
    expect(component.historyStatusOptions).toEqual(['COMPLETED', 'CANCELLED', 'IN_PROGRESS']);
  });

  it('maps duration buckets and date filters into server query params', () => {
    dataService.getWorkoutSessionPage.calls.reset();

    component.setFilterDuration('lt30');
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledWith(
      jasmine.objectContaining({ minDurationMinutes: undefined, maxDurationMinutes: 29 })
    );

    component.setFilterDuration('gt60');
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledWith(
      jasmine.objectContaining({ minDurationMinutes: 61, maxDurationMinutes: undefined })
    );

    component.setFilterDateTo('2026-06-15');
    const query = dataService.getWorkoutSessionPage.calls.mostRecent().args[0] as WorkoutSessionQuery;
    expect(query.to).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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

    const listbox = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="listbox"]');
    expect(listbox?.id).toBe('plan-exercise-results-0');
    expect(input?.getAttribute('aria-controls')).toBe(listbox?.id);

    const option = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.typeahead-option');
    expect(option?.getAttribute('role')).toBe('option');
    expect(option?.id).toBe('plan-exercise-option-0-0');
    expect(option?.getAttribute('aria-selected')).toBe('true');
    expect(input?.getAttribute('aria-activedescendant')).toBe(option?.id);

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

  it('shows a visible search error when plan exercise lookup fails', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkoutPage);
    dataService.searchExercisesPage.and.returnValue(throwError(() => new Error('search failed')));
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.exercise-typeahead input');
    input!.value = 'squat';
    input!.dispatchEvent(new Event('input'));
    tick(275);
    fixture.detectChanges();

    const status = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.typeahead-status.error');
    expect(status?.textContent?.trim()).toBe('Unable to search exercises. Please retry.');
    expect(status?.getAttribute('aria-live')).toBe('assertive');
    expect(input?.getAttribute('aria-activedescendant')).toBeNull();
  }));

  it('ignores stale exercise search responses after the row query changes', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkoutPage);
    const staleSearch = new Subject<{
      items: Exercise[];
      page: number;
      size: number;
      totalPages: number;
      totalElements: number;
    }>();
    dataService.searchExercisesPage.and.returnValues(
      staleSearch.asObservable(),
      of({ items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 })
    );
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.exercise-typeahead input');
    input!.value = 'squat';
    input!.dispatchEvent(new Event('input'));
    tick(275);
    expect(dataService.searchExercisesPage).toHaveBeenCalledTimes(1);

    input!.value = 'press';
    input!.dispatchEvent(new Event('input'));
    staleSearch.next({
      items: [exercise({ exerciseId: 'stale-exercise', name: 'Stale squat' })],
      page: 0,
      size: 20,
      totalPages: 1,
      totalElements: 1
    });
    staleSearch.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance.exercisePickerState(0).query).toBe('press');
    expect(fixture.componentInstance.exercisePickerState(0).results).toEqual([]);

    tick(275);
    fixture.detectChanges();

    expect(dataService.searchExercisesPage).toHaveBeenCalledTimes(2);
  }));

  it('supports keyboard navigation through typeahead results', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkoutPage);
    dataService.searchExercisesPage.and.returnValue(of({
      items: [
        exercise({ exerciseId: 'exercise-1', name: 'Back squat' }),
        exercise({ exerciseId: 'exercise-2', name: 'Front squat' })
      ],
      page: 0,
      size: 20,
      totalPages: 1,
      totalElements: 2
    }));
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.exercise-typeahead input');
    input!.value = 'squat';
    input!.dispatchEvent(new Event('input'));
    tick(275);
    fixture.detectChanges();

    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();

    const secondOption = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('#plan-exercise-option-0-1');
    expect(input?.getAttribute('aria-activedescendant')).toBe(secondOption?.id);
    expect(secondOption?.getAttribute('role')).toBe('option');
    expect(secondOption?.getAttribute('aria-selected')).toBe('true');

    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    fixture.detectChanges();
    expect(input?.getAttribute('aria-activedescendant')).toBe('plan-exercise-option-0-0');

    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.planExercises.at(0).value.exerciseId).toBe('exercise-1');
    expect(input!.value).toBe('Back squat');
  }));

  it('opens an empty picker with ArrowDown and closes it with Escape', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.exercise-typeahead input');
    expect(fixture.componentInstance.exercisePickerState(0).open).toBeFalse();

    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.exercisePickerState(0).open).toBeTrue();

    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.exercisePickerState(0).open).toBeFalse();
  });

  it('keeps an empty typeahead picker stable when arrowing through no results', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    fixture.componentInstance.openExercisePicker(0);
    fixture.componentInstance.handleExercisePickerKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }), 0);

    expect(fixture.componentInstance.exercisePickerState(0).activeIndex).toBe(-1);
    expect(fixture.componentInstance.exercisePickerState(99).open).toBeFalse();
  });

  it('does not select a typeahead result without an exercise id', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    fixture.componentInstance.selectExerciseResult(0, exercise({ exerciseId: undefined }));

    expect(fixture.componentInstance.planExercises.at(0).value.exerciseId).toBe('');
    expect(fixture.componentInstance.exerciseHint(exercise({ primaryMuscleGroup: '', equipment: '' }))).toBe('');
  });

  it('keeps exercise picker state aligned when removing plan rows', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    fixture.componentInstance.addPlanExercise();
    fixture.componentInstance.setExerciseSearchQuery(0, 'squat');
    fixture.componentInstance.setExerciseSearchQuery(1, 'press');

    fixture.componentInstance.removePlanExercise(0);

    expect(fixture.componentInstance.exercisePickerState(0).query).toBe('press');
  });

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

  it('renders missing history duration without fake zeroes', () => {
    dataService.getWorkoutSessionPage.and.returnValue(
      of(
        sessionPage([
          session({
            sessionId: 'session-1',
            name: 'Push day',
            status: 'COMPLETED',
            durationMinutes: null,
            caloriesBurned: null,
            completedAt: ''
          })
        ])
      )
    );

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    fixture.componentInstance.selectedTab.set('history');
    fixture.detectChanges();

    const rowText = (fixture.nativeElement as HTMLElement).querySelector('.history-row')?.textContent ?? '';
    expect(rowText).toContain('—');
    expect(rowText).not.toContain('0 min');
  });

  it('shows a filter-aware empty state and keeps the filter bar reachable when empty', () => {
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
    expect(compiled.querySelector('.history-filter-bar')).not.toBeNull();

    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([])));
    const emptyFixture = TestBed.createComponent(WorkoutPage);
    emptyFixture.detectChanges();
    emptyFixture.componentInstance.selectedTab.set('history');
    emptyFixture.detectChanges();

    const emptyEl = emptyFixture.nativeElement as HTMLElement;
    expect(emptyEl.textContent).toContain('No sessions match these filters');
    expect(emptyEl.querySelector('.history-filter-bar')).not.toBeNull();
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
    component.lastCompletedSession.set(session({ workoutType: 'STRENGTH', completedAt: '2026-06-18T10:00:00Z' }));

    expect(component.formatLabel(null)).toBe('');
    expect(component.formatLabel('MUSCLE_GAIN')).toBe('Muscle Gain');
    expect(component.formatDate(null)).toBe('\u2014');
    expect(component.formatDate('not-a-date')).toBe('\u2014');
    expect(component.metrics()[2].detail).toBe('Strength');
  });
});
