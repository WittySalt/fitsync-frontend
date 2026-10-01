import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { CoachApiService } from '../../core/coach/coach-api.service';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutPage } from './workout.page';
import { FormBuilder } from '@angular/forms';
import { CoachContextService } from '../../core/coach/coach-context.service';
import {
  DayInsight,
  Exercise,
  TodayInsight,
  UserGoal,
  WeeklyTrainingInsight,
  WorkoutPlan,
  WorkoutPlanDay,
  WorkoutPlanExercise,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSessionQuery
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { createExerciseGroup } from './plan-exercise-form';
import { applyDayKind } from './plan-week-form';
import { LiveStartCardComponent } from './live-start-card.component';
import { PlanExerciseRowsComponent } from './plan-exercise-rows.component';
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

/** A workout in progress with one exercise and one open set, which the guided player runs. */
function guidedSession(overrides: Partial<WorkoutSessionDetail> = {}, exerciseId = 'exercise-1'): WorkoutSessionDetail {
  return sessionDetail({
    exercises: [
      {
        exerciseLogId: 'log-1',
        exerciseId,
        exerciseNameSnapshot: 'Goblet squat',
        sequence: 1,
        performedSets: null,
        performedReps: null,
        totalVolumeKg: null,
        distanceKm: null,
        durationSeconds: null,
        averageHeartRate: null,
        maxHeartRate: null,
        notes: '',
        sets: [
          {
            setLogId: 'set-1',
            setNumber: 1,
            reps: 8,
            weightKg: null,
            durationSeconds: null,
            distanceKm: null,
            restSeconds: null,
            perceivedExertion: null,
            logged: false,
            notes: ''
          }
        ]
      }
    ],
    ...overrides
  });
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

function planExercise(overrides: Partial<WorkoutPlanExercise> = {}): WorkoutPlanExercise {
  return {
    exerciseId: 'exercise-1',
    exerciseNameSnapshot: 'Back squat',
    sequence: 1,
    targetSets: 3,
    targetReps: 8,
    targetWeightKg: 60,
    targetDurationSeconds: null,
    targetDistanceKm: null,
    restSeconds: 90,
    notes: '',
    setTargets: [],
    ...overrides
  };
}

function planDay(overrides: Partial<WorkoutPlanDay> = {}): WorkoutPlanDay {
  return {
    planDayId: 'day-1',
    dayOfWeek: 1,
    kind: 'STRENGTH',
    title: 'Full body',
    sportActivity: null,
    sportLabel: null,
    estimatedDurationMinutes: 50,
    exercises: [planExercise()],
    ...overrides
  };
}

function weeklyInsight(overrides: Partial<WeeklyTrainingInsight> = {}): WeeklyTrainingInsight {
  return {
    timezone: 'Asia/Singapore',
    referenceDate: '2026-09-30',
    weekStart: '2026-09-28',
    weekEnd: '2026-10-04',
    completedSessions: 0,
    totalMinutes: 0,
    previousWeekCompletedSessions: 0,
    previousWeekTotalMinutes: 0,
    muscleGroups: [],
    volume: { thisWeekKg: 0, previousWeekKg: 0, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 0 },
    days: null,
    today: null,
    nextTraining: null,
    ...overrides
  };
}

function todayInsight(overrides: Partial<TodayInsight> = {}): TodayInsight {
  return {
    date: '2026-09-30',
    kind: 'STRENGTH',
    label: 'Strength',
    source: 'PLAN',
    planDayId: 'day-strength',
    title: 'Full body',
    estimatedMinutes: 50,
    moves: 1,
    lastOfKind: null,
    carriedOver: [],
    ...overrides
  };
}

function goal(overrides: Partial<UserGoal> = {}): UserGoal {
  return {
    goalId: 'goal-1',
    goalType: 'WORKOUT_FREQUENCY',
    targetValue: 3,
    targetUnit: 'sessions/week',
    targetDate: null,
    status: 'ACTIVE',
    notes: null,
    ...overrides
  };
}

// The page carries the coach's insight panel. Only the wire is stubbed, and the reading request
// fails, so the panel takes no space and these specs stay about the page.
const coachApiStub = {
  listRecommendations: () => of([]),
  refreshRecommendations: () => of(undefined),
  getReading: () => throwError(() => new Error('not under test'))
};

function rows(fixture: ComponentFixture<WorkoutPage>): PlanExerciseRowsComponent {
  return fixture.debugElement.query(By.directive(PlanExerciseRowsComponent)).componentInstance;
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
      'getWeeklyTrainingInsight',
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
      'getExercise',
      'getExerciseMetadata',
      'getGoals',
      'upsertGoal',
      'createExercise',
      'updateExercise',
      'archiveExercise',
      'getSession',
      'getActiveWorkout',
      'getExercises',
      'updateSession',
      'deleteSession',
      'repeatSession',
      'repeatLatestSession',
      'exportWorkoutData',
      'importSessions'
    ]);
    dataService.getExercise.and.returnValue(of(null));
    dataService.getActiveWorkout.and.returnValue(of(null));
    dataService.getWorkoutPlans.and.returnValue(of([]));
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([])));
    dataService.searchExercisesPage.and.returnValue(of({ items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 }));
    dataService.getActivePlan.and.returnValue(of(null));
    dataService.getWeeklyTrainingInsight.and.returnValue(of(weeklyInsight()));
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
        goalFocuses: ['STRENGTH'],
        sportActivities: [
          { code: 'BADMINTON', label: 'Badminton', effort: 'MODERATE', measure: 'TIME' },
          { code: 'TENNIS', label: 'Tennis', effort: 'MODERATE', measure: 'TIME' }
        ]
      })
    );
    dataService.getGoals.and.returnValue(of([]));
    dataService.upsertGoal.and.returnValue(of(goal({ targetValue: 4 })));
    dataService.createExercise.and.returnValue(of(exercise({ custom: true })));
    dataService.updateExercise.and.returnValue(of(exercise({ custom: true })));
    dataService.archiveExercise.and.returnValue(of(void 0));
    dataService.getSession.and.returnValue(of(sessionDetail({ status: 'COMPLETED' })));
    dataService.getExercises.and.returnValue(of([exercise()]));
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
      providers: [
        // The page carries a coach anchor, whose store reaches HttpClient through the API client.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CoachApiService, useValue: coachApiStub },
        // The page reads an optional ?tab= on init; these specs land on the default.
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        provideHttpClient(), { provide: FitSyncDataService, useValue: dataService }]
    }).compileComponents();

    component = TestBed.createComponent(WorkoutPage).componentInstance;
  });

  it('opens the active plan for editing when the address asks for it', () => {
    const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { queryParamMap: unknown } };
    route.snapshot.queryParamMap = convertToParamMap({ tab: 'plans', edit: 'active' });
    dataService.getActivePlan.and.returnValue(of(plan({ planId: 'plan-active', name: 'Active plan', status: 'ACTIVE' })));

    component.ngOnInit();

    expect(component.selectedTab()).toBe('plans');
    expect(component.editingPlanId()).toBe('plan-active');
  });

  it('leaves the editor closed on a plain arrival, and when the address asks but no plan is active', () => {
    dataService.getActivePlan.and.returnValue(of(plan({ planId: 'plan-active', status: 'ACTIVE' })));
    component.ngOnInit();
    expect(component.editingPlanId()).toBeNull();

    const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { queryParamMap: unknown } };
    route.snapshot.queryParamMap = convertToParamMap({ edit: 'active' });
    dataService.getActivePlan.and.returnValue(of(null));
    component.ngOnInit();
    expect(component.editingPlanId()).toBeNull();
  });

  it('shows completed-only metrics from server counts and the last completed session', () => {
    component.completedSessionCount.set(42);
    component.weekCompletedCount.set(3);
    component.lastCompletedSession.set(
      session({ name: 'New', workoutType: 'STRENGTH', completedAt: '2026-06-18T10:00:00Z' })
    );

    const metrics = component.metrics();
    expect(metrics[0]).toEqual(jasmine.objectContaining({ label: 'Sessions logged', value: '42', detail: 'completed all time' }));
    expect(metrics[1]).toEqual(jasmine.objectContaining({ label: 'Last 7 days', value: '3', detail: 'completed sessions' }));
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

  it('opens the free or goal live tracker when the start card has started a workout', () => {
    dataService.startAdHocSession.and.returnValue(of(sessionDetail({ sessionId: 'session-live', name: 'Goal run', workoutType: 'CARDIO' })));
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const startCard = fixture.debugElement.query(By.directive(LiveStartCardComponent)).componentInstance as LiveStartCardComponent;
    startCard.selectMode('GOAL');
    startCard.startForm.patchValue({ goalType: 'MINUTES', targetMinutes: 30 });
    startCard.startWorkout();
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
    const started = guidedSession({ sessionId: 'session-today', planId: 'plan-today', name: 'Today plan' });
    dataService.getActivePlan.and.returnValue(of(active));
    dataService.startWorkoutPlan.and.returnValue(of(started));

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const today = fixture.debugElement.query(By.directive(TodayOverviewComponent)).componentInstance as TodayOverviewComponent;
    today.startPlan.emit({ plan: active, planDayId: null });
    fixture.detectChanges();

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-today', { planDayId: null, timezone: jasmine.any(String) });
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
    const started = guidedSession({ sessionId: 'session-today', planId: 'plan-today', name: 'Today plan' }, 'exercise-2');
    dataService.getActivePlan.and.returnValue(of(active));
    dataService.startWorkoutPlan.and.returnValue(of(started));

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const today = fixture.debugElement.query(By.directive(TodayOverviewComponent)).componentInstance as TodayOverviewComponent;
    today.startExercise.emit(active.exercises[0]);
    fixture.detectChanges();

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-today', { planDayId: null, timezone: jasmine.any(String) });
    expect(fixture.componentInstance.guidedInitialExerciseId()).toBe('exercise-2');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-exercise-player')).not.toBeNull();
  });

  describe('the Today card and the weekly insight', () => {
    const dayPlan = () =>
      plan({
        planId: 'plan-days',
        name: 'Week plan',
        status: 'ACTIVE',
        days: [
          {
            planDayId: 'day-strength',
            dayOfWeek: 3,
            kind: 'STRENGTH',
            title: 'Full body',
            sportActivity: null,
            sportLabel: null,
            estimatedDurationMinutes: 50,
            exercises: [
              {
                planExerciseId: 'pe-1',
                exerciseId: 'exercise-9',
                exerciseNameSnapshot: 'Goblet squat',
                sequence: 1,
                targetSets: 3,
                targetReps: 12,
                targetWeightKg: 18,
                targetDurationSeconds: null,
                targetDistanceKm: null,
                restSeconds: 75,
                notes: '',
                setTargets: []
              }
            ]
          }
        ]
      });

    function todayCard(fixture: ComponentFixture<WorkoutPage>): TodayOverviewComponent {
      return fixture.debugElement.query(By.directive(TodayOverviewComponent)).componentInstance as TodayOverviewComponent;
    }

    it('passes today, the next training day and the timezone to the card', () => {
      const insight = weeklyInsight({
        today: todayInsight(),
        nextTraining: { date: '2026-10-01', kind: 'CARDIO', label: 'Cardio', title: 'Run', estimatedMinutes: 35 }
      });
      dataService.getWeeklyTrainingInsight.and.returnValue(of(insight));

      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      const card = todayCard(fixture);

      expect(dataService.getWeeklyTrainingInsight).toHaveBeenCalledWith(fixture.componentInstance.timezone);
      expect(card.today()).toEqual(insight.today);
      expect(card.nextTraining()).toEqual(insight.nextTraining);
      expect(card.timezone()).toBe(fixture.componentInstance.timezone);
    });

    it('passes the entry of today in the week to the card', () => {
      const entry: DayInsight = {
        date: '2026-09-30',
        dayOfWeek: 3,
        kind: 'STRENGTH',
        label: 'Strength',
        source: 'DONE',
        minutes: 50,
        sessions: [],
        planned: null
      };
      const other: DayInsight = { ...entry, date: '2026-09-29', minutes: 20 };
      dataService.getWeeklyTrainingInsight.and.returnValue(
        of(weeklyInsight({ today: todayInsight({ source: 'DONE' }), days: [other, entry] }))
      );

      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();

      expect(todayCard(fixture).todayDay()).toEqual(entry);
    });

    it('tells the coach what kind of day today is', () => {
      dataService.getWeeklyTrainingInsight.and.returnValue(of(weeklyInsight({ today: todayInsight({ kind: 'CARDIO' }) })));

      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();

      expect(TestBed.inject(CoachContextService).todayKind()).toBe('CARDIO');
    });

    it('starts the plan day the card names, in the page timezone', () => {
      const active = dayPlan();
      dataService.getActivePlan.and.returnValue(of(active));
      dataService.startWorkoutPlan.and.returnValue(of(guidedSession()));
      dataService.getWeeklyTrainingInsight.and.returnValue(of(weeklyInsight({ today: todayInsight() })));

      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      todayCard(fixture).startPlan.emit({ plan: active, planDayId: 'day-strength' });
      fixture.detectChanges();

      expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-days', {
        planDayId: 'day-strength',
        timezone: fixture.componentInstance.timezone
      });
      expect(fixture.componentInstance.guidedPlayerSession()).not.toBeNull();
    });

    it('starts the day a pressed move belongs to', () => {
      const active = dayPlan();
      dataService.getActivePlan.and.returnValue(of(active));

      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      todayCard(fixture).startExercise.emit(active.days![0].exercises[0]);

      expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-days', {
        planDayId: 'day-strength',
        timezone: fixture.componentInstance.timezone
      });
      expect(fixture.componentInstance.guidedInitialExerciseId()).toBe('exercise-9');
    });

    it('keeps working when the insight request fails', () => {
      const active = plan({ planId: 'plan-plain', name: 'Plain plan', status: 'ACTIVE' });
      dataService.getActivePlan.and.returnValue(of(active));
      dataService.getWeeklyTrainingInsight.and.returnValue(throwError(() => new Error('insight down')));

      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      const card = todayCard(fixture);

      expect(card.today()).toBeNull();
      expect(card.nextTraining()).toBeNull();
      expect(card.todayDay()).toBeNull();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('app-today-overview h2')?.textContent).toContain('Plain plan');

      root.querySelector<HTMLButtonElement>('app-today-overview .action-primary')?.click();
      expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-plain', {
        planDayId: null,
        timezone: fixture.componentInstance.timezone
      });
    });

    it('refreshes the insight after the sessions change', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      dataService.getWeeklyTrainingInsight.calls.reset();

      fixture.componentInstance.handlePastWorkoutLogged();

      expect(dataService.getWeeklyTrainingInsight).toHaveBeenCalledTimes(1);
    });

    it('opens the past workout form, set to the kind, when the card asks to log manually', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      const startCard = fixture.debugElement.query(By.directive(LiveStartCardComponent)).componentInstance as LiveStartCardComponent;

      todayCard(fixture).logManually.emit('CARDIO');
      expect(startCard.pastWorkoutOpen()).toBeTrue();
      expect(startCard.pastWorkoutForm.controls.workoutType.value).toBe('CARDIO');

      todayCard(fixture).logManually.emit('SPORT');
      expect(startCard.pastWorkoutForm.controls.workoutType.value).toBe('SPORTS');
      expect(startCard.pastWorkoutForm.controls.sportActivity.value).toBe('');

      todayCard(fixture).logManually.emit('OPEN');
      expect(startCard.pastWorkoutForm.controls.workoutType.value).toBe('CUSTOM');
    });

    it('preselects the sport named by the plan of today', () => {
      const entry: DayInsight = {
        date: '2026-09-30',
        dayOfWeek: 3,
        kind: 'SPORT',
        label: 'Sport',
        source: 'PLAN',
        minutes: null,
        sessions: [],
        planned: {
          planDayId: 'day-sport',
          kind: 'SPORT',
          title: 'Badminton',
          sportActivity: 'BADMINTON',
          estimatedMinutes: 60,
          moves: null,
          fulfilled: false
        }
      };
      dataService.getWeeklyTrainingInsight.and.returnValue(
        of(weeklyInsight({ today: todayInsight({ kind: 'SPORT' }), days: [entry] }))
      );

      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      const startCard = fixture.debugElement.query(By.directive(LiveStartCardComponent)).componentInstance as LiveStartCardComponent;

      todayCard(fixture).logManually.emit('SPORT');

      expect(startCard.pastWorkoutForm.controls.workoutType.value).toBe('SPORTS');
      expect(startCard.pastWorkoutForm.controls.sportActivity.value).toBe('BADMINTON');
    });

    it('opens the exercise screen when Continue is pressed, and leaves the History filter alone', () => {
      dataService.getActiveWorkout.and.returnValue(
        of({ session: guidedSession({ sessionId: 'session-running' }), resume: null })
      );
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      fixture.componentInstance.workoutLive.minimise();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('app-exercise-player')).toBeNull();

      todayCard(fixture).openSession.emit({ sessionId: 'session-running', status: 'IN_PROGRESS' });
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedTab()).toBe('overview');
      expect(fixture.componentInstance.filterStatus()).toBe('COMPLETED');
      expect((fixture.nativeElement as HTMLElement).querySelector('app-exercise-player')).not.toBeNull();
    });

    it('falls back to the session in History when Continue finds no workout in progress', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();

      todayCard(fixture).openSession.emit({ sessionId: 'session-running', status: 'IN_PROGRESS' });
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedTab()).toBe('history');
      expect(fixture.componentInstance.filterStatus()).toBe('COMPLETED');
      expect(fixture.componentInstance.selectedSessionId()).toBe('session-running');
    });

    it('opens a finished session in History with its own status selected', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();

      todayCard(fixture).openSession.emit({ sessionId: 'session-done', status: 'COMPLETED' });
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedTab()).toBe('history');
      expect(fixture.componentInstance.selectedSessionId()).toBe('session-done');
    });

    it('opens History without a selection when the insight names no session', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();

      todayCard(fixture).openSession.emit({ sessionId: null, status: 'COMPLETED' });

      expect(fixture.componentInstance.selectedTab()).toBe('history');
      expect(fixture.componentInstance.selectedSessionId()).toBeNull();
    });
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

    expect(rows(fixture).pickerState(0).query).toBe('press');
    expect(rows(fixture).pickerState(0).results).toEqual([]);

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
    expect(rows(fixture).pickerState(0).open).toBeFalse();

    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    expect(rows(fixture).pickerState(0).open).toBeTrue();

    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(rows(fixture).pickerState(0).open).toBeFalse();
  });

  it('keeps an empty typeahead picker stable when arrowing through no results', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    rows(fixture).openPicker(0);
    rows(fixture).handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }), 0);

    expect(rows(fixture).pickerState(0).activeIndex).toBe(-1);
    expect(rows(fixture).pickerState(99).open).toBeFalse();
  });

  it('does not select a typeahead result without an exercise id', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    rows(fixture).selectResult(0, exercise({ exerciseId: undefined }));

    expect(fixture.componentInstance.planExercises.at(0).value.exerciseId).toBe('');
    expect(rows(fixture).exerciseHint(exercise({ primaryMuscleGroup: '', equipment: '' }))).toBe('');
  });

  it('keeps exercise picker state aligned when removing plan rows', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    fixture.componentInstance.addPlanExercise();
    rows(fixture).setSearchQuery(0, 'squat');
    rows(fixture).setSearchQuery(1, 'press');

    fixture.componentInstance.removePlanExercise(0);

    expect(rows(fixture).pickerState(0).query).toBe('press');
  });

  it('closes the plan exercise picker and marks exerciseId touched on blur', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.exercise-typeahead input');
    input!.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(rows(fixture).pickerState(0).open).toBeTrue();

    input!.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(rows(fixture).pickerState(0).open).toBeFalse();
    expect(fixture.componentInstance.planExercises.at(0).get('exerciseId')?.touched).toBeTrue();
  });

  it('starts a plan from the plan card in the browser timezone and opens the exercise screen on Today', () => {
    const started = guidedSession({ sessionId: 'session-1', name: 'Strength base', status: 'IN_PROGRESS' });
    dataService.startWorkoutPlan.and.returnValue(of(started));
    component.selectedTab.set('plans');

    component.startPlan(plan({ status: 'ACTIVE' }));

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-1', { planDayId: null, timezone: component.timezone });
    expect(component.selectedTab()).toBe('overview');
    expect(component.workoutLive.session()?.sessionId).toBe('session-1');
    expect(component.workoutLive.minimised()).toBeFalse();
    expect(component.guidedPlayerSession()?.sessionId).toBe('session-1');
  });

  it('refreshes sessions and opens history when the live tracker completes', () => {
    const completed = session({ sessionId: 'session-2', name: 'Finished', status: 'COMPLETED' });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([completed])));
    component.workoutLive.setSession(sessionDetail({ sessionId: 'session-live' }));

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

  it('shows the sport label and the distance in a history row', () => {
    dataService.getWorkoutSessionPage.and.returnValue(
      of(
        sessionPage([
          session({ sessionId: 'session-1', name: 'Cycling', workoutType: 'SPORTS', sportLabel: 'Cycling', distanceKm: 24.5, status: 'COMPLETED' })
        ])
      )
    );

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    fixture.componentInstance.selectedTab.set('history');
    fixture.detectChanges();

    const rowText = (fixture.nativeElement as HTMLElement).querySelector('.history-row')?.textContent ?? '';
    expect(rowText).toContain('24.5 km');
    expect(rowText).not.toContain('Sports');
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
    // The repeated session is now the workout in progress, shown on the exercise screen.
    expect(component.workoutLive.session()?.sessionId).toBe('session-latest');
    expect(component.selectedTab()).toBe('overview');
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
    component.handleTodayStart({ plan: active, planDayId: null });

    expect(dataService.startWorkoutPlan).not.toHaveBeenCalled();

    component.planMutations.set(new Set());
    dataService.startWorkoutPlan.and.returnValue(throwError(() => new Error('guided failed')));
    component.handleTodayExerciseStart(exerciseTarget);

    expect(component.workoutLive.session()).toBeNull();
    expect(component.isPlanMutating(active)).toBeFalse();

    component.workoutLive.setSession(guidedSession({ sessionId: 'guided-open' }));
    component.handleGuidedPlayerCancelled();

    expect(component.workoutLive.session()).toBeNull();
    expect(component.guidedPlayerSession()).toBeNull();
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

    component.handleSessionRepeated();
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

  it('saves a new plan as one list with exactly the request it always sent', () => {
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

    expect(dataService.createWorkoutPlan).toHaveBeenCalledWith({
      name: 'Strength base',
      description: '',
      goalFocus: 'STRENGTH',
      workoutType: 'STRENGTH',
      difficulty: 'INTERMEDIATE',
      estimatedDurationMinutes: 50,
      exercises: [
        {
          exerciseId: 'exercise-1',
          sequence: 1,
          targetSets: 3,
          targetReps: 8,
          targetWeightKg: 60,
          targetDurationSeconds: null,
          targetDistanceKm: null,
          restSeconds: 120,
          notes: 'Controlled',
          setTargets: []
        }
      ]
    });
    expect(component.planMode()).toBe('list');
  });

  it('moves the typed exercises into a Monday strength day named after the plan when switching to a week', () => {
    component.planForm.patchValue({ name: 'Recomp' });
    component.planExercises.at(0).patchValue({ exerciseId: 'exercise-1', exerciseName: 'Back squat' });
    component.addPlanExercise();

    component.setPlanMode('week');

    const monday = component.planWeek.at(0);
    expect(component.planMode()).toBe('week');
    expect(monday.controls.kind.value).toBe('STRENGTH');
    expect(monday.controls.title.value).toBe('Recomp');
    expect(monday.controls.exercises.length).toBe(1);
    expect(monday.controls.exercises.at(0).controls.exerciseId.value).toBe('exercise-1');
    expect(component.planExercises.length).toBe(0);
    expect(component.planWeek.controls.slice(1).every((day) => day.controls.kind.value === 'REST')).toBeTrue();
    expect(dataService.getExerciseMetadata).toHaveBeenCalledTimes(1);
  });

  it('shows the week editor with the sport list once a week is chosen', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-plan-week-editor')).toBeNull();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[aria-label="Plan layout"] button')
    );
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['One list', 'A week']);
    buttons[1].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-plan-week-editor')).not.toBeNull();
    expect(fixture.componentInstance.sportActivities().map((sport) => sport.code)).toEqual(['BADMINTON', 'TENNIS']);
  });

  it('saves a week as days with an empty exercise list and keeps the ids of days from the server', () => {
    component.editPlan(
      plan({
        planId: 'plan-week',
        days: [
          planDay({
            planDayId: 'day-mon',
            dayOfWeek: 1,
            exercises: [planExercise({ sequence: 4 }), planExercise({ exerciseId: 'exercise-2', sequence: 9 })]
          }),
          planDay({
            planDayId: 'day-sat',
            dayOfWeek: 6,
            kind: 'SPORT',
            title: 'Badminton',
            sportActivity: 'BADMINTON',
            sportLabel: 'Badminton',
            estimatedDurationMinutes: 60,
            exercises: []
          })
        ]
      })
    );
    const wednesday = component.planWeek.at(2);
    wednesday.controls.title.setValue('Stretch');
    wednesday.controls.exercises.push(createExerciseGroup(TestBed.inject(FormBuilder)));
    wednesday.controls.exercises.at(0).patchValue({
      exerciseId: 'exercise-3',
      exerciseName: 'Cat cow',
      exerciseType: 'MOBILITY',
      targetDurationSeconds: 45
    });
    applyDayKind(wednesday, 'MOBILITY');

    component.savePlan();

    const [id, request] = dataService.updateWorkoutPlan.calls.mostRecent().args;
    expect(id).toBe('plan-week');
    expect(request.exercises).toEqual([]);
    expect(request.days?.map((day) => day.dayOfWeek)).toEqual([1, 3, 6]);
    expect(request.days?.[0]).toEqual(
      jasmine.objectContaining({ planDayId: 'day-mon', kind: 'STRENGTH', title: 'Full body', estimatedDurationMinutes: 50 })
    );
    expect(request.days?.[0].exercises.map((row) => [row.exerciseId, row.sequence])).toEqual([
      ['exercise-1', 1],
      ['exercise-2', 2]
    ]);
    expect('planDayId' in (request.days?.[1] ?? {})).toBeFalse();
    expect(request.days?.[1]).toEqual(
      jasmine.objectContaining({ kind: 'MOBILITY', sportActivity: null, estimatedDurationMinutes: null })
    );
    expect(request.days?.[1].exercises[0]).toEqual(
      jasmine.objectContaining({ sequence: 1, targetSets: null, targetDurationSeconds: 45 })
    );
    expect(request.days?.[2]).toEqual(
      jasmine.objectContaining({
        planDayId: 'day-sat',
        kind: 'SPORT',
        sportActivity: 'BADMINTON',
        estimatedDurationMinutes: 60,
        exercises: []
      })
    );
  });

  it('blocks saving a week with an unfinished day and selects that day', () => {
    const toast = TestBed.inject(ToastService);
    spyOn(toast, 'error');
    component.planForm.patchValue({ name: 'Week', estimatedDurationMinutes: 45 });
    component.setPlanMode('week');
    component.planWeek.at(0).controls.title.setValue('Push');
    applyDayKind(component.planWeek.at(3), 'CARDIO');

    component.savePlan();

    expect(dataService.createWorkoutPlan).not.toHaveBeenCalled();
    expect(component.selectedPlanDay()).toBe(0);
    expect(toast.error).toHaveBeenCalledWith('Complete this day before saving the week.');

    component.planWeek.at(0).controls.exercises.push(createExerciseGroup(TestBed.inject(FormBuilder)));
    component.savePlan();
    expect(component.selectedPlanDay()).toBe(0);
    component.planWeek.at(0).controls.exercises.at(0).controls.exerciseId.setValue('exercise-1');
    component.savePlan();
    expect(component.selectedPlanDay()).toBe(3);
    expect(dataService.createWorkoutPlan).not.toHaveBeenCalled();
  });

  it('refuses a week without a training day', () => {
    const toast = TestBed.inject(ToastService);
    spyOn(toast, 'error');
    component.planForm.patchValue({ name: 'Empty week' });
    component.setPlanMode('week');
    applyDayKind(component.planWeek.at(0), 'REST');

    component.savePlan();

    expect(dataService.createWorkoutPlan).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Plan at least one training day before saving the week.');
  });

  it('opens a plan that has a week in week mode', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    fixture.componentInstance.editPlan(
      plan({
        planId: 'plan-week',
        days: [planDay({ dayOfWeek: 2, title: 'Tuesday lift' }), planDay({ planDayId: 'day-5', dayOfWeek: 5, title: 'Friday lift' })]
      })
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.planMode()).toBe('week');
    expect(fixture.componentInstance.selectedPlanDay()).toBe(1);
    expect(fixture.componentInstance.planExercises.length).toBe(0);
    expect(fixture.nativeElement.querySelector('app-plan-week-editor')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.day-heading')?.textContent).toContain('Tuesday');
  });

  it('merges the days into one list in day order when switching back, after a confirmation', () => {
    component.editPlan(
      plan({
        planId: 'plan-week',
        days: [
          planDay({ dayOfWeek: 5, exercises: [planExercise({ exerciseId: 'friday-1' })] }),
          planDay({
            planDayId: 'day-1',
            dayOfWeek: 1,
            exercises: [planExercise({ exerciseId: 'monday-1' }), planExercise({ exerciseId: 'monday-2' })]
          })
        ]
      })
    );
    const confirm = spyOn(window, 'confirm').and.returnValue(false);

    component.setPlanMode('list');
    expect(confirm).toHaveBeenCalled();
    expect(component.planMode()).toBe('week');

    confirm.and.returnValue(true);
    component.setPlanMode('list');

    expect(component.planMode()).toBe('list');
    expect(component.planExercises.controls.map((group) => group.controls.exerciseId.value)).toEqual([
      'monday-1',
      'monday-2',
      'friday-1'
    ]);
    expect(component.planWeek.controls.every((day) => day.controls.kind.value === 'REST')).toBeTrue();

    component.planForm.patchValue({ name: 'Merged' });
    component.savePlan();
    const request = dataService.updateWorkoutPlan.calls.mostRecent().args[1];
    expect(request.days).toBeUndefined();
    expect(request.exercises.map((row) => row.sequence)).toEqual([1, 2, 3]);
  });

  it('switches back to one list without asking when the week holds nothing', () => {
    const confirm = spyOn(window, 'confirm');
    component.setPlanMode('week');
    applyDayKind(component.planWeek.at(0), 'REST');

    component.setPlanMode('list');

    expect(confirm).not.toHaveBeenCalled();
    expect(component.planMode()).toBe('list');
    expect(component.planExercises.length).toBe(1);
  });

  it('summarises a plan with a week on its card in place of the exercise count', () => {
    dataService.getWorkoutPlans.and.returnValue(
      of([
        plan({
          planId: 'week',
          name: 'Weekly',
          days: [planDay({ dayOfWeek: 1 }), planDay({ dayOfWeek: 4, kind: 'CARDIO', title: 'Run' })],
          sessionsPerWeek: 2
        }),
        plan({ planId: 'flat', name: 'Flat', exerciseCount: 5 })
      ])
    );
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();

    const cards = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.plan-card'));
    const summary = cards[0].querySelector('app-plan-week-summary') as HTMLElement;
    expect(summary.textContent).toContain('2 sessions a week');
    expect(summary.querySelectorAll('.tile').length).toBe(7);
    expect(summary.querySelectorAll('.tile.training').length).toBe(2);
    expect(cards[0].textContent).not.toContain('exercises');
    expect(cards[1].querySelector('app-plan-week-summary')).toBeNull();
    expect(cards[1].textContent).toContain('5 exercises');
  });

  describe('weekly goal prompt', () => {
    let toast: ToastService;

    beforeEach(() => {
      toast = TestBed.inject(ToastService);
      spyOn(toast, 'success');
      spyOn(toast, 'error');
    });

    function activateWeekPlan(sessionsPerWeek: number | null): void {
      dataService.activateWorkoutPlan.and.returnValue(
        of(plan({ status: 'ACTIVE', sessionsPerWeek, days: sessionsPerWeek ? [planDay()] : [] }))
      );
      component.activatePlan(plan({ planId: 'plan-1', status: 'DRAFT' }));
    }

    it('offers the session count of the plan when there is no weekly goal', () => {
      activateWeekPlan(4);

      expect(component.weeklyGoalOffer()).toEqual({ sessions: 4, existing: null });
    });

    it('offers it when the goal differs, and stays quiet when the goal already matches', () => {
      dataService.getGoals.and.returnValue(of([goal({ targetValue: 3 })]));
      activateWeekPlan(4);
      expect(component.weeklyGoalOffer()?.sessions).toBe(4);

      dataService.getGoals.and.returnValue(of([goal({ targetValue: 4 })]));
      activateWeekPlan(4);
      expect(component.weeklyGoalOffer()).toBeNull();
    });

    it('does not ask about a plan without a week', () => {
      activateWeekPlan(null);

      expect(dataService.getGoals).not.toHaveBeenCalled();
      expect(component.weeklyGoalOffer()).toBeNull();
    });

    it('offers it after a template was activated', () => {
      component.handleTemplateActivated(plan({ sessionsPerWeek: 5 }));

      expect(component.weeklyGoalOffer()?.sessions).toBe(5);
    });

    it('renders the prompt with its two actions', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.selectedTab.set('plans');
      fixture.componentInstance.weeklyGoalOffer.set({ sessions: 4, existing: null });
      fixture.detectChanges();

      const prompt = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.goal-offer')!;
      expect(prompt.querySelector('p')?.textContent).toBe('This plan has 4 sessions a week.');
      expect(Array.from(prompt.querySelectorAll('button')).map((button) => button.textContent?.trim())).toEqual([
        'Make 4 my weekly goal',
        'Not now'
      ]);
    });

    it('saves the goal keeping the existing target date, and confirms', () => {
      dataService.getGoals.and.returnValue(
        of([goal({ targetValue: 3, targetDate: '2026-12-31', notes: 'Keep going' })])
      );
      activateWeekPlan(4);

      component.acceptWeeklyGoalOffer();

      expect(dataService.upsertGoal).toHaveBeenCalledWith('WORKOUT_FREQUENCY', {
        targetValue: 4,
        targetUnit: 'sessions/week',
        targetDate: '2026-12-31',
        status: 'ACTIVE',
        notes: 'Keep going'
      });
      expect(toast.success).toHaveBeenCalledWith('Weekly goal saved.');
      expect(component.weeklyGoalOffer()).toBeNull();
      expect(component.weeklyGoalSaving()).toBeFalse();
    });

    it('uses no target date for a first weekly goal', () => {
      activateWeekPlan(4);

      component.acceptWeeklyGoalOffer();

      expect(dataService.upsertGoal.calls.mostRecent().args[1]).toEqual(
        jasmine.objectContaining({ targetDate: null, notes: null })
      );
    });

    it('keeps the prompt and shows the error toast when saving fails', () => {
      dataService.upsertGoal.and.returnValue(throwError(() => new Error('goal failed')));
      activateWeekPlan(4);

      component.acceptWeeklyGoalOffer();

      expect(toast.error).toHaveBeenCalledWith('Unable to save the weekly goal. Please retry.');
      expect(component.weeklyGoalOffer()?.sessions).toBe(4);
      expect(component.weeklyGoalSaving()).toBeFalse();
    });

    it('dismisses the prompt for that activation only', () => {
      activateWeekPlan(4);

      component.dismissWeeklyGoalOffer();
      expect(component.weeklyGoalOffer()).toBeNull();

      activateWeekPlan(6);
      expect(component.weeklyGoalOffer()?.sessions).toBe(6);
    });
  });
});
