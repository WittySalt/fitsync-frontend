import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { CoachApiService } from '../../core/coach/coach-api.service';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutPage } from './workout.page';
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

  describe('the plan flow entry', () => {
    it('opens the entry sheet from New plan instead of an inline form', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.selectedTab.set('plans');
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('app-plan-entry-sheet')).toBeNull();
      expect(root.querySelector('form#plan-form')).toBeNull();

      fixture.componentInstance.openNewPlan();
      fixture.detectChanges();
      expect(root.querySelector('app-plan-entry-sheet')).not.toBeNull();

      fixture.componentInstance.closeEntry();
      fixture.detectChanges();
      expect(root.querySelector('app-plan-entry-sheet')).toBeNull();
    });

    it('goes to the flow, with the template named, when a row of the sheet is chosen', () => {
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      component.openNewPlan();
      component.handleEntryChosen({ commands: ['/workout/plans/new'], queryParams: { template: 'full-body-beginner' } });
      expect(component.entryOpen()).toBeFalse();
      expect(navigate).toHaveBeenCalledWith(['/workout/plans/new'], { queryParams: { template: 'full-body-beginner' } });
    });

    it('opens a saved plan in the flow from Edit, and ignores a plan without an id', () => {
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      component.editPlan(plan({ planId: null }));
      expect(navigate).not.toHaveBeenCalled();
      component.editPlan(plan({ planId: 'plan-9' }));
      expect(navigate).toHaveBeenCalledWith(['/workout/plans', 'plan-9', 'edit']);
    });

    it('opens the active plan in the flow when the address asks for it', () => {
      const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { queryParamMap: unknown } };
      route.snapshot.queryParamMap = convertToParamMap({ edit: 'active' });
      dataService.getActivePlan.and.returnValue(of(plan({ planId: 'plan-active', status: 'ACTIVE' })));
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      expect(navigate).toHaveBeenCalledWith(['/workout/plans', 'plan-active', 'edit']);
    });

    it('does not open the flow on a plain arrival', () => {
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      TestBed.createComponent(WorkoutPage).detectChanges();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it('heads the page with the day and the plan, and one week card in place of the three boxes', () => {
    component.activePlan.set(plan({ name: 'Recomp Strength + Cardio' }));
    expect(component.headLine()).toContain(' \u00b7 Recomp Strength + Cardio');
    component.activePlan.set(null);
    expect(component.headLine()).not.toContain('\u00b7');

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Workout');
    expect(root.querySelector('app-workout-week')).not.toBeNull();
    expect(root.querySelector('.metric-strip')).toBeNull();
  });

  it('shows the Plans unavailable panel on failure and Retry loads the plans again', () => {
    dataService.getWorkoutPlans.and.returnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Plans unavailable');
    const retry = Array.from(root.querySelectorAll<HTMLButtonElement>('app-state-panel button')).find(
      (button) => button.textContent?.trim() === 'Retry'
    );
    expect(retry).toBeDefined();

    dataService.getWorkoutPlans.calls.reset();
    dataService.getWorkoutPlans.and.returnValue(of([plan({ planId: 'plan-d', status: 'DRAFT' })]));
    retry?.click();
    fixture.detectChanges();

    expect(dataService.getWorkoutPlans).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.planError()).toBeNull();
    expect(root.textContent).not.toContain('Plans unavailable');
  });

  it('disables Edit for an archived plan', () => {
    dataService.getWorkoutPlans.and.returnValue(of([plan({ planId: 'plan-a', status: 'ARCHIVED' })]));
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.componentInstance.selectedTab.set('plans');
    fixture.componentInstance.planStatus.set('ARCHIVED');
    fixture.detectChanges();
    const edit = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.plan-actions button')).find(
      (button) => button.textContent?.trim() === 'Edit'
    );

    expect(edit?.disabled).toBeTrue();
  });

  describe('tab bar', () => {
    function tabs(fixture: ComponentFixture<WorkoutPage>): HTMLButtonElement[] {
      return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.workout-tabs [role="tab"]'));
    }

    it('gives only the selected tab a tab stop and aria-controls', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      const [today, plans] = tabs(fixture);

      expect(today.getAttribute('tabindex')).toBe('0');
      expect(today.getAttribute('aria-controls')).toBe('workout-panel-overview');
      expect(plans.getAttribute('tabindex')).toBe('-1');
      expect(plans.hasAttribute('aria-controls')).toBeFalse();
    });

    it('moves selection and focus with the arrow keys, Home and End', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      document.body.appendChild(fixture.nativeElement);
      fixture.detectChanges();
      const focused = () => (fixture.nativeElement as HTMLElement).querySelector(`#workout-tab-${fixture.componentInstance.selectedTab()}`) as HTMLElement;
      const press = (key: string) => {
        focused().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        fixture.detectChanges();
      };

      press('ArrowRight');
      expect(fixture.componentInstance.selectedTab()).toBe('plans');
      expect(document.activeElement?.id).toBe('workout-tab-plans');
      press('End');
      expect(fixture.componentInstance.selectedTab()).toBe('library');
      press('ArrowRight');
      expect(fixture.componentInstance.selectedTab()).toBe('overview');
      press('ArrowLeft');
      expect(fixture.componentInstance.selectedTab()).toBe('library');
      press('Home');
      expect(fixture.componentInstance.selectedTab()).toBe('overview');
      fixture.nativeElement.remove();
    });
  });

  describe('quick start card', () => {
    function startCard(fixture: ComponentFixture<WorkoutPage>): Element | null {
      return (fixture.nativeElement as HTMLElement).querySelector('app-live-start-card');
    }

    it('shows when nothing is in progress', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();

      expect(startCard(fixture)).not.toBeNull();
    });

    it('is hidden while a workout is in progress', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.setSession(sessionDetail({ sessionId: 'running', status: 'IN_PROGRESS' }));
      fixture.componentInstance.workoutLive.minimise();
      fixture.detectChanges();

      expect(fixture.componentInstance.workoutLive.active()).not.toBeNull();
      expect(startCard(fixture)).toBeNull();
    });

    it('stays when today was already trained, because the card foot still logs a past workout', () => {
      dataService.getWeeklyTrainingInsight.and.returnValue(of(weeklyInsight({ today: todayInsight({ source: 'DONE' }) })));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();

      expect(startCard(fixture)).not.toBeNull();
    });

    it('opens the free workout sheet from the Today card', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      const card = fixture.debugElement.query(By.directive(LiveStartCardComponent)).componentInstance as LiveStartCardComponent;

      fixture.componentInstance.handleTodayStartFree();

      expect(card.freeOpen()).toBeTrue();
    });

    it('opens the past workout form from the foot link of the Today card', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      const card = fixture.debugElement.query(By.directive(LiveStartCardComponent)).componentInstance as LiveStartCardComponent;

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.today-card .past-link')?.click();
      fixture.detectChanges();

      expect(card.pastWorkoutOpen()).toBeTrue();
      expect((fixture.nativeElement as HTMLElement).querySelector('#past-workout-form')).not.toBeNull();
    });
  });

  it('reloads the active plan and sessions when the library saved an exercise', () => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    dataService.getActivePlan.calls.reset();
    dataService.getWorkoutSessionPage.calls.reset();

    fixture.componentInstance.handleExerciseSaved();

    expect(dataService.getActivePlan).toHaveBeenCalledTimes(1);
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalled();
  });

  it('loads completed-only metric counts and last session from the server', () => {
    dataService.getWorkoutSessionPage.and.callFake((query) => {
      const q = query as WorkoutSessionQuery;
      if (q.status === 'COMPLETED' && q.size === 1) {
        return of(sessionPage([session({ sessionId: 'last', workoutType: 'STRENGTH', completedAt: new Date().toISOString() })], 40));
      }
      return of(sessionPage([]));
    });

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    const c = fixture.componentInstance;

    expect(c.completedSessionCount()).toBe(40);
    expect(c.lastCompletedSession()?.sessionId).toBe('last');
  });

  it('shows the latest completed session on the Today card when the newest history rows are not completed', () => {
    dataService.getWorkoutSessionPage.and.callFake((query) => {
      const q = query as WorkoutSessionQuery;
      if (q.status === 'COMPLETED' && q.size === 1 && !q.from) {
        return of(sessionPage([session({ sessionId: 'last', name: 'Pull day', status: 'COMPLETED', completedAt: new Date().toISOString() })], 32));
      }
      if (q.from) {
        return of(sessionPage([], 1));
      }
      return of(sessionPage([
        session({ sessionId: 'c-1', name: 'Cancelled one', status: 'CANCELLED' }),
        session({ sessionId: 'r-1', name: 'Running one', status: 'IN_PROGRESS' })
      ]));
    });

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();

    const last = (fixture.nativeElement as HTMLElement).querySelector('.last-session strong');
    expect(last?.textContent?.trim()).toBe('Pull day');
  });

  it('requests history from the server with the active filters', () => {
    dataService.getWorkoutSessionPage.calls.reset();

    component.setFilterType('STRENGTH');
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledWith(
      jasmine.objectContaining({ workoutType: 'STRENGTH', status: undefined, page: 0 })
    );

    component.setFilterStatus('COMPLETED');
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

    c.goToHistoryPage(3);
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledWith(jasmine.objectContaining({ page: 3 }));

    dataService.getWorkoutSessionPage.calls.reset();
    c.setHistoryPageSize(13);
    expect(dataService.getWorkoutSessionPage).not.toHaveBeenCalled();
    c.setHistoryPageSize(20);
    expect(c.page()).toBe(0);
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledWith(jasmine.objectContaining({ page: 0, size: 20 }));
  });

  it('asks the server for the name search once typing pauses, trimmed and from the first page', fakeAsync(() => {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.page.set(2);
    dataService.getWorkoutSessionPage.calls.reset();

    c.setHistorySearch(' pu');
    tick(200);
    c.setHistorySearch('  push ');
    tick(299);
    expect(dataService.getWorkoutSessionPage).not.toHaveBeenCalled();

    tick(1);
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledTimes(1);
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledWith(jasmine.objectContaining({ q: 'push', page: 0 }));

    c.setHistorySearch('push   ');
    tick(300);
    expect(dataService.getWorkoutSessionPage).toHaveBeenCalledTimes(1);

    c.setHistorySearch('');
    tick(300);
    const query = dataService.getWorkoutSessionPage.calls.mostRecent().args[0] as WorkoutSessionQuery;
    expect(query.q).toBeUndefined();
  }));

  it('lists every status by default and lets the address choose one', () => {
    expect(component.filterStatus()).toBe('');
    dataService.getWorkoutSessionPage.calls.reset();
    component.ngOnInit();
    const statuses = dataService.getWorkoutSessionPage.calls.allArgs().map((args) => (args[0] as WorkoutSessionQuery).status);
    expect(statuses).toContain(undefined);

    const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { queryParamMap: unknown } };
    route.snapshot.queryParamMap = convertToParamMap({ status: 'CANCELLED' });
    component.ngOnInit();
    expect(component.filterStatus()).toBe('CANCELLED');
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

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-today', { planDayId: null });
    expect(fixture.componentInstance.guidedPlayerSession()?.sessionId).toBe('session-today');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-exercise-player')).not.toBeNull();
  });

  it('hides the header, the reading, the figures, the tabs and the goal offer while the exercise screen is open', () => {
    const active = plan({ planId: 'plan-today', name: 'Today plan', status: 'ACTIVE' });
    dataService.getActivePlan.and.returnValue(of(active));
    dataService.startWorkoutPlan.and.returnValue(of(guidedSession({ sessionId: 'session-today', planId: 'plan-today', name: 'Today plan' })));
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.workout-header')).not.toBeNull();
    expect(root.querySelector('app-insight-panel')).not.toBeNull();
    expect(root.querySelector('app-workout-week')).not.toBeNull();
    expect(root.querySelector('.workout-tabs')).not.toBeNull();

    const today = fixture.debugElement.query(By.directive(TodayOverviewComponent)).componentInstance as TodayOverviewComponent;
    today.startPlan.emit({ plan: active, planDayId: null });
    fixture.detectChanges();

    expect(fixture.componentInstance.focusMode()).toBeTrue();
    expect(root.querySelector('app-exercise-player')).not.toBeNull();
    expect(root.querySelector('.workout-header')).toBeNull();
    expect(root.querySelector('app-insight-panel')).toBeNull();
    expect(root.querySelector('app-workout-week')).toBeNull();
    expect(root.querySelector('.workout-tabs')).toBeNull();
    expect(root.querySelector('.goal-offer')).toBeNull();

    fixture.componentInstance.minimiseScreen();
    fixture.detectChanges();

    expect(fixture.componentInstance.focusMode()).toBeFalse();
    expect(root.querySelector('app-exercise-player')).toBeNull();
    expect(root.querySelector('.workout-header')).not.toBeNull();
    expect(root.querySelector('app-insight-panel')).not.toBeNull();
    expect(root.querySelector('app-workout-week')).not.toBeNull();
    expect(root.querySelector('.workout-tabs')).not.toBeNull();
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

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-today', { planDayId: null });
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

    it('passes today, and the next training day to the card', () => {
      const insight = weeklyInsight({
        today: todayInsight(),
        nextTraining: { date: '2026-10-01', kind: 'CARDIO', label: 'Cardio', title: 'Run', estimatedMinutes: 35 }
      });
      dataService.getWeeklyTrainingInsight.and.returnValue(of(insight));

      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      const card = todayCard(fixture);

      expect(dataService.getWeeklyTrainingInsight).toHaveBeenCalledWith();
      expect(card.today()).toEqual(insight.today);
      expect(card.nextTraining()).toEqual(insight.nextTraining);
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

    it('starts the plan day the card names', () => {
      const active = dayPlan();
      dataService.getActivePlan.and.returnValue(of(active));
      dataService.startWorkoutPlan.and.returnValue(of(guidedSession()));
      dataService.getWeeklyTrainingInsight.and.returnValue(of(weeklyInsight({ today: todayInsight() })));

      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      todayCard(fixture).startPlan.emit({ plan: active, planDayId: 'day-strength' });
      fixture.detectChanges();

      expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-days', {
        planDayId: 'day-strength'
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
        planDayId: 'day-strength'
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
        planDayId: null
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
      expect(fixture.componentInstance.filterStatus()).toBe('');
      expect((fixture.nativeElement as HTMLElement).querySelector('app-exercise-player')).not.toBeNull();
    });

    it('falls back to the page of the session when Continue finds no workout in progress', () => {
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();

      todayCard(fixture).openSession.emit({ sessionId: 'session-running', status: 'IN_PROGRESS' });
      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith(['/workout/sessions', 'session-running']);
      expect(fixture.componentInstance.filterStatus()).toBe('');
    });

    it('opens a finished session on its own page, with History behind it on its status', () => {
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();

      todayCard(fixture).openSession.emit({ sessionId: 'session-done', status: 'COMPLETED' });
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedTab()).toBe('history');
      expect(navigate).toHaveBeenCalledWith(['/workout/sessions', 'session-done']);
    });

    it('opens History without a page when the insight names no session', () => {
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();

      todayCard(fixture).openSession.emit({ sessionId: null, status: 'COMPLETED' });

      expect(fixture.componentInstance.selectedTab()).toBe('history');
      expect(navigate).not.toHaveBeenCalled();
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

  it('starts a plan from the plan card and opens the exercise screen on Today', () => {
    const started = guidedSession({ sessionId: 'session-1', name: 'Strength base', status: 'IN_PROGRESS' });
    dataService.startWorkoutPlan.and.returnValue(of(started));
    component.selectedTab.set('plans');

    component.startPlan(plan({ status: 'ACTIVE' }));

    expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-1', { planDayId: null });
    expect(component.selectedTab()).toBe('overview');
    expect(component.workoutLive.session()?.sessionId).toBe('session-1');
    expect(component.workoutLive.minimised()).toBeFalse();
    expect(component.guidedPlayerSession()?.sessionId).toBe('session-1');
  });

  it('refreshes sessions and stays on Today when the live tracker completes', () => {
    const completed = session({ sessionId: 'session-2', name: 'Finished', status: 'COMPLETED' });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([completed])));
    component.workoutLive.setSession(sessionDetail({ sessionId: 'session-live' }));

    component.handleLiveTrackerFinished();

    expect(dataService.getWorkoutSessionPage).toHaveBeenCalled();
    expect(component.sessions()[0].sessionId).toBe('session-2');
    expect(component.liveTrackerSession()).toBeNull();
    expect(component.selectedTab()).toBe('overview');
  });

  it('opens the page of a session from its History row, which names its kind, day, facts and state', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const completed = session({
      sessionId: 'session-1', name: 'Push day', status: 'COMPLETED', durationMinutes: 48, doneSets: 9, totalSets: 12
    });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([completed])));

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    fixture.componentInstance.selectedTab.set('history');
    fixture.detectChanges();

    const row = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.history-row.session-row');
    expect(row?.querySelector('.name')?.textContent?.trim()).toBe('Push day');
    expect(row?.querySelector('.facts')?.textContent?.trim()).toBe('48 min \u00b7 9 of 12 sets');
    expect(row?.querySelector('.state')?.textContent?.trim()).toBe('Completed');
    row?.click();

    expect(navigate).toHaveBeenCalledWith(['/workout/sessions', 'session-1']);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-session-detail')).toBeNull();
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

  it('shows a filter-aware empty state and keeps the filter bar reachable when empty', fakeAsync(() => {
    dataService.getWorkoutSessionPage.and.returnValue(
      of(sessionPage([session({ sessionId: 'session-1', name: 'Push day', status: 'COMPLETED' })]))
    );

    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    fixture.componentInstance.selectedTab.set('history');
    fixture.detectChanges();

    // The search is the server's: it answers a name that matches nothing with an empty page.
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([])));
    fixture.componentInstance.setHistorySearch('missing');
    tick(300);
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
  }));

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

  it('opens a session page only for a row that has an id, and reloads History after a repeat', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const first = session({ sessionId: 'session-1', name: 'First', status: 'COMPLETED' });

    component.openSessionDetail(session({ status: 'COMPLETED' }));
    expect(navigate).not.toHaveBeenCalled();

    component.openSessionDetail(first);
    expect(navigate).toHaveBeenCalledWith(['/workout/sessions', 'session-1']);

    const repeated = sessionDetail({ sessionId: 'session-2', name: 'Repeated' });
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([repeated, first])));

    component.handleSessionRepeated();
    expect(component.sessions()[0].name).toBe('Repeated');
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
  describe('the Plans tab', () => {
    const active = () => plan({ planId: 'plan-active', name: 'Current one', status: 'ACTIVE' });
    const draft = () => plan({ planId: 'plan-draft', name: 'Draft one', status: 'DRAFT' });

    function openPlans(): { fixture: ComponentFixture<WorkoutPage>; root: HTMLElement } {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.selectedTab.set('plans');
      fixture.detectChanges();
      return { fixture, root: fixture.nativeElement as HTMLElement };
    }

    const headings = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('#workout-panel-plans h2')).map((h) => h.textContent?.trim());
    const buttons = (el: Element) => Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());

    it('puts the current plan first, with its week and actions, and the other plans below it', () => {
      dataService.getActivePlan.and.returnValue(of(active()));
      dataService.getWorkoutPlans.and.returnValue(of([active(), draft()]));
      const { root } = openPlans();

      expect(headings(root)).toEqual(['Current plan', 'Other plans']);
      const cards = Array.from(root.querySelectorAll<HTMLElement>('.plan-card'));
      expect(cards.map((card) => card.querySelector('h3')?.textContent?.trim())).toEqual(['Current one', 'Draft one']);
      expect(buttons(cards[0])).toEqual(['Edit', 'Archive', 'Start session']);
      expect(buttons(cards[1])).toEqual(['Edit', 'Activate', 'Archive']);
    });

    it('filters the other plans by Draft, Archived or All, with Draft first', () => {
      const { root, fixture } = openPlans();

      expect(fixture.componentInstance.planStatus()).toBe('DRAFT');
      expect(dataService.getWorkoutPlans).toHaveBeenCalledWith('DRAFT');
      const filter = root.querySelector('[aria-label="Plan status filter"]')!;
      expect(buttons(filter)).toEqual(['Draft', 'Archived', 'All']);
      expect(filter.querySelector('.active')?.textContent?.trim()).toBe('Draft');

      dataService.getWorkoutPlans.calls.reset();
      (filter.querySelectorAll('button')[2] as HTMLButtonElement).click();
      expect(dataService.getWorkoutPlans).toHaveBeenCalledWith(null);
    });

    it('does not repeat the current plan in the other plans when All brings it back', () => {
      dataService.getActivePlan.and.returnValue(of(active()));
      dataService.getWorkoutPlans.and.returnValue(of([active(), draft()]));
      const { fixture } = openPlans();

      expect(fixture.componentInstance.otherPlans().map((p) => p.planId)).toEqual(['plan-draft']);
    });

    it('says there is no current plan and offers a new one', () => {
      const { root, fixture } = openPlans();

      expect(root.textContent).toContain('No current plan');
      const quiet = root.querySelector('.plan-section .summary-card')!;
      expect(buttons(quiet)).toEqual(['New plan']);
      expect(root.querySelector('app-plan-entry-sheet')).toBeNull();

      (quiet.querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(root.querySelector('app-plan-entry-sheet')).not.toBeNull();
    });

    it('does not pick the Active filter after activating a plan', () => {
      component.activatePlan(plan({ planId: 'plan-1', status: 'DRAFT' }));

      expect(component.planStatus()).toBe('DRAFT');
      expect(component.planStatusOptions).toEqual(['DRAFT', 'ARCHIVED', null]);
    });
  });

  describe('a habit day started from the Today card', () => {
    it('opens the exercise screen of the session that began and reloads the history', () => {
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      fixture.componentInstance.workoutLive.minimise();
      fixture.componentInstance.selectedTab.set('history');
      fixture.detectChanges();
      dataService.getWorkoutSessionPage.calls.reset();

      fixture.componentInstance.handleHabitStarted();
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedTab()).toBe('overview');
      expect(fixture.componentInstance.workoutLive.minimised()).toBeFalse();
      expect(dataService.getWorkoutSessionPage).toHaveBeenCalled();
    });

    it('is wired from the Today card', () => {
      dataService.getActivePlan.and.returnValue(of(plan({ status: 'ACTIVE' })));
      dataService.getWeeklyTrainingInsight.and.returnValue(
        of(weeklyInsight({ today: todayInsight({ kind: 'CARDIO', label: 'Cardio', source: 'HABIT', planDayId: null }) }))
      );
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.detectChanges();
      const handler = spyOn(fixture.componentInstance, 'handleHabitStarted');

      fixture.debugElement
        .query(By.directive(TodayOverviewComponent))
        .componentInstance.habitStarted.emit(sessionDetail());

      expect(handler).toHaveBeenCalled();
    });
  });
});
