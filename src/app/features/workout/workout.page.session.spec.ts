import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { CoachApiService } from '../../core/coach/coach-api.service';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  WorkoutExerciseLog,
  WorkoutPlan,
  WorkoutPlanDay,
  WorkoutSession,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { ExercisePlayerComponent } from './exercise-player.component';
import { LiveTrackerComponent } from './live-tracker.component';
import { isoWeekdayIn } from './plan-day-pick';
import { STILL_RUNNING_NOTICE } from './workout-live.service';
import { WorkoutPage } from './workout.page';

const DISMISSED_KEY = 'fs-auto-closed-dismissed';

function log(sequence: number, exerciseId: string, name: string, sets: boolean[]): WorkoutExerciseLog {
  return {
    exerciseLogId: `log-${sequence}`,
    exerciseId,
    exerciseNameSnapshot: name,
    sequence,
    performedSets: null,
    performedReps: null,
    totalVolumeKg: null,
    distanceKm: null,
    durationSeconds: null,
    averageHeartRate: null,
    maxHeartRate: null,
    notes: '',
    sets: sets.map((logged, index) => ({
      setLogId: `set-${sequence}-${index + 1}`,
      setNumber: index + 1,
      reps: 8,
      weightKg: null,
      durationSeconds: null,
      distanceKm: null,
      restSeconds: null,
      perceivedExertion: null,
      logged,
      notes: ''
    }))
  };
}

function running(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-running',
    planId: 'plan-1',
    name: 'Leg day',
    workoutType: 'STRENGTH',
    status: 'IN_PROGRESS',
    source: 'PLAN',
    startedAt: new Date(Date.now() - 300_000).toISOString(),
    completedAt: '',
    durationMinutes: 0,
    caloriesBurned: 0,
    exerciseCount: 2,
    perceivedExertion: null,
    notes: '',
    exercises: [log(1, 'exercise-1', 'Goblet squat', [true, true]), log(2, 'exercise-2', 'Push-up', [false, false, false])],
    createdAt: '',
    updatedAt: '',
    ...overrides
  };
}

function listed(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    sessionId: 'session-listed',
    name: 'Earlier lift',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-10-01T01:00:00Z',
    durationMinutes: 40,
    caloriesBurned: null,
    completedAt: '2026-10-01T01:40:00Z',
    exerciseCount: 3,
    ...overrides
  };
}

function weeklyPlan(): WorkoutPlan {
  const days: WorkoutPlanDay[] = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    planDayId: `day-${dayOfWeek}`,
    dayOfWeek,
    kind: 'STRENGTH',
    title: `Day ${dayOfWeek}`,
    sportActivity: null,
    sportLabel: null,
    estimatedDurationMinutes: 40,
    exercises: []
  }));
  return {
    planId: 'plan-week',
    name: 'Week plan',
    description: '',
    goalFocus: 'STRENGTH',
    workoutType: 'STRENGTH',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 40,
    status: 'ACTIVE',
    exerciseCount: 0,
    exercises: [],
    days
  };
}

function conflict() {
  return new HttpErrorResponse({
    status: 409,
    error: { code: 'ACTIVE_SESSION_EXISTS', data: { sessionId: 'session-old', name: 'Old', startedAt: '2026-10-01T01:00:00Z' } }
  });
}

describe('WorkoutPage and the workout in progress', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  const sessionPage = (sessions: WorkoutSession[], totalPages = 1, page = 0) => ({
    sessions,
    total: sessions.length,
    totalPages,
    page
  });

  function createPage(): ComponentFixture<WorkoutPage> {
    const fixture = TestBed.createComponent(WorkoutPage);
    fixture.detectChanges();
    return fixture;
  }

  const root = (fixture: ComponentFixture<WorkoutPage>) => fixture.nativeElement as HTMLElement;
  const player = (fixture: ComponentFixture<WorkoutPage>) =>
    fixture.debugElement.query(By.directive(ExercisePlayerComponent))?.componentInstance as ExercisePlayerComponent | undefined;

  function selectTab(fixture: ComponentFixture<WorkoutPage>, name: string): void {
    // The tabs are away while the exercise screen is open, so a person puts it away first.
    if (!root(fixture).querySelector('.workout-tabs')) {
      player(fixture)?.minimise.emit();
      fixture.detectChanges();
    }
    root(fixture).querySelector<HTMLButtonElement>(`#workout-tab-${name}`)?.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.removeItem(DISMISSED_KEY);
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getWorkoutPlans',
      'getWorkoutSessionPage',
      'searchExercisesPage',
      'getActivePlan',
      'getWeeklyTrainingInsight',
      'startWorkoutPlan',
      'startAdHocSession',
      'repeatLatestSession',
      'repeatSession',
      'getActiveWorkout',
      'getExercise',
      'getExerciseMetadata',
      'getExercises',
      'getGoals',
      'getSession',
      'completeSession',
      'cancelSession',
      'upsertSessionSet'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    dataService.getWorkoutPlans.and.returnValue(of([]));
    dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([])));
    dataService.searchExercisesPage.and.returnValue(of({ items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 }));
    dataService.getActivePlan.and.returnValue(of(null));
    dataService.getWeeklyTrainingInsight.and.returnValue(throwError(() => new Error('not under test')));
    dataService.getActiveWorkout.and.returnValue(of(null));
    dataService.getExercise.and.returnValue(of(null));
    dataService.getExerciseMetadata.and.returnValue(of(null));
    dataService.getExercises.and.returnValue(of([]));
    dataService.getGoals.and.returnValue(of([]));
    dataService.getSession.and.returnValue(of(running({ status: 'COMPLETED' })));

    await TestBed.configureTestingModule({
      imports: [WorkoutPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CoachApiService,
          useValue: {
            listRecommendations: () => of([]),
            refreshRecommendations: () => of(undefined),
            getReading: () => throwError(() => new Error('not under test'))
          }
        },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  afterEach(() => localStorage.removeItem(DISMISSED_KEY));

  describe('the exercise screen comes from the session, not from the page', () => {
    it('opens the guided player on the next open set when the page loads with a workout in progress', () => {
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();

      const guided = player(fixture);
      expect(guided).toBeDefined();
      expect(guided?.currentExerciseIndex()).toBe(1);
      expect(guided?.currentSetNumber()).toBe(1);
      expect(root(fixture).textContent).not.toContain('No exercises ready');
    });

    it('opens on the last exercise with Finish next when every set is already done', () => {
      const session = running({ exercises: [log(1, 'exercise-1', 'Goblet squat', [true]), log(2, 'exercise-2', 'Push-up', [true])] });
      dataService.getActiveWorkout.and.returnValue(of({ session, resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();

      expect(player(fixture)?.currentExerciseIndex()).toBe(1);
      expect(player(fixture)?.allTargetsComplete()).toBeTrue();
    });

    it('opens the free timer for a workout without exercises, never the empty card', () => {
      dataService.getActiveWorkout.and.returnValue(
        of({ session: running({ name: 'Sport day', exercises: [], exerciseCount: 0, planDayId: 'day-sport' }), resume: null })
      );
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(LiveTrackerComponent))).not.toBeNull();
      expect(player(fixture)).toBeUndefined();
      expect(root(fixture).textContent).not.toContain('No exercises ready');
    });

    it('shows the Today card when there is no workout in progress', () => {
      const fixture = createPage();

      expect(root(fixture).querySelector('app-today-overview')).not.toBeNull();
      expect(player(fixture)).toBeUndefined();
    });

    it('survives a switch of tab inside the page, and the bar steps back in meanwhile', () => {
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();
      TestBed.flushEffects();
      expect(fixture.componentInstance.workoutLive.screenOpen()).toBeTrue();

      // The tabs are hidden while the exercise screen is open, so the tab is changed from code.
      expect(root(fixture).querySelector('.workout-tabs')).toBeNull();
      fixture.componentInstance.selectedTab.set('history');
      fixture.detectChanges();
      TestBed.flushEffects();
      expect(fixture.componentInstance.workoutLive.screenOpen()).toBeFalse();

      fixture.componentInstance.selectedTab.set('overview');
      fixture.detectChanges();
      TestBed.flushEffects();
      expect(player(fixture)).toBeDefined();
      expect(fixture.componentInstance.workoutLive.screenOpen()).toBeTrue();
    });
  });

  describe('Minimise', () => {
    function openWith(fixture: ComponentFixture<WorkoutPage>) {
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();
    }

    it('returns to the Today card, leaves the workout running, and says so once', () => {
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      openWith(fixture);

      player(fixture)?.minimise.emit();
      fixture.detectChanges();

      expect(player(fixture)).toBeUndefined();
      expect(root(fixture).querySelector('app-today-overview')).not.toBeNull();
      expect(fixture.componentInstance.workoutLive.active()).not.toBeNull();
      expect(toast.info).toHaveBeenCalledOnceWith(STILL_RUNNING_NOTICE, jasmine.any(Number));
    });

    it('also works from the free timer', () => {
      dataService.getActiveWorkout.and.returnValue(of({ session: running({ exercises: [], exerciseCount: 0 }), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      openWith(fixture);

      fixture.debugElement.query(By.directive(LiveTrackerComponent)).componentInstance.minimise.emit();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(LiveTrackerComponent))).toBeNull();
      expect(root(fixture).querySelector('app-today-overview')).not.toBeNull();
    });

    it('does not bring the screen back when the page is opened again from the navigation', () => {
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const first = TestBed.createComponent(WorkoutPage);
      openWith(first);
      player(first)?.minimise.emit();
      first.destroy();

      const second = createPage();

      expect(player(second)).toBeUndefined();
      expect(root(second).querySelector('app-today-overview')).not.toBeNull();
    });

    it('a request from the bar brings the screen back, on the Today tab even from History', () => {
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      openWith(fixture);
      player(fixture)?.minimise.emit();
      selectTab(fixture, 'history');

      fixture.componentInstance.workoutLive.open();
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedTab()).toBe('overview');
      expect(player(fixture)).toBeDefined();
    });

    it('puts the screen away and says so once when the page is left with it open', () => {
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      const live = fixture.componentInstance.workoutLive;
      openWith(fixture);

      fixture.destroy();

      expect(live.minimised()).toBeTrue();
      expect(live.screenOpen()).toBeFalse();
      expect(toast.info).toHaveBeenCalledOnceWith(STILL_RUNNING_NOTICE, jasmine.any(Number));
    });

    it('says nothing when the page is left with no workout, or one that is finished', () => {
      const fixture = createPage();

      fixture.destroy();

      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  describe('Continue on the Today card', () => {
    it('opens the exercise screen and does not touch the History filter or tab', () => {
      const insight = {
        timezone: 'Asia/Singapore',
        referenceDate: '2026-10-01',
        weekStart: '2026-09-28',
        weekEnd: '2026-10-04',
        completedSessions: 0,
        totalMinutes: 0,
        previousWeekCompletedSessions: 0,
        previousWeekTotalMinutes: 0,
        muscleGroups: [],
        volume: { thisWeekKg: 0, previousWeekKg: 0, weekBeforePreviousKg: 0, thisWeekSessionsWithVolume: 0, previousWeekSessionsWithVolume: 0 },
        days: [],
        today: {
          date: '2026-10-01',
          kind: 'STRENGTH' as const,
          label: 'Strength',
          source: 'IN_PROGRESS' as const,
          planDayId: null,
          title: 'Leg day',
          estimatedMinutes: 40,
          moves: 2,
          lastOfKind: null,
          carriedOver: []
        },
        nextTraining: null
      };
      dataService.getWeeklyTrainingInsight.and.returnValue(of(insight));
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();
      player(fixture)?.minimise.emit();
      fixture.detectChanges();

      const button = root(fixture).querySelector<HTMLButtonElement>('.action-primary');
      expect(button?.textContent).toContain('Continue');
      button?.click();
      fixture.detectChanges();

      expect(player(fixture)).toBeDefined();
      expect(fixture.componentInstance.filterStatus()).toBe('');
      expect(fixture.componentInstance.selectedTab()).toBe('overview');
    });
  });

  describe('every start lands on the exercise screen', () => {
    it('opens the screen after the plan card starts a weekly plan on today, in the browser timezone', () => {
      dataService.startWorkoutPlan.and.returnValue(of(running()));
      const fixture = createPage();
      fixture.componentInstance.selectedTab.set('plans');

      fixture.componentInstance.startPlan(weeklyPlan());
      fixture.detectChanges();

      const timezone = fixture.componentInstance.timezone;
      expect(dataService.startWorkoutPlan).toHaveBeenCalledWith('plan-week', {
        planDayId: `day-${isoWeekdayIn(timezone)}`,
        timezone
      });
      expect(fixture.componentInstance.selectedTab()).toBe('overview');
      expect(player(fixture)).toBeDefined();
    });

    it('offers Start session on the plan card only for an active plan', () => {
      const active = { ...weeklyPlan(), planId: 'plan-a', name: 'Active one' };
      const draft = { ...weeklyPlan(), planId: 'plan-d', name: 'Draft one', status: 'DRAFT' as const };
      dataService.getWorkoutPlans.and.returnValue(of([active, draft]));
      dataService.getActivePlan.and.returnValue(of(active));
      const fixture = createPage();

      selectTab(fixture, 'plans');

      // The current plan is shown first and is left out of the list below it.
      const cards = [...root(fixture).querySelectorAll('.plan-card')];
      const starts = (card: Element) => [...card.querySelectorAll('button')].filter((button) => button.textContent?.trim() === 'Start session');
      expect(cards.length).toBe(2);
      expect(starts(cards[0]).length).toBe(1);
      expect(starts(cards[1]).length).toBe(0);
    });

    it('opens the screen after Repeat latest', () => {
      dataService.repeatLatestSession.and.returnValue(of(running({ sessionId: 'session-repeat' })));
      const fixture = createPage();
      selectTab(fixture, 'history');

      fixture.componentInstance.repeatLatestSession();
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedTab()).toBe('overview');
      expect(player(fixture)).toBeDefined();
    });

    it('leaves a refused start to the shared dialog: no error, no screen, and the button is free again', () => {
      dataService.startWorkoutPlan.and.returnValue(throwError(() => conflict()));
      const fixture = createPage();
      const active = weeklyPlan();

      fixture.componentInstance.handleTodayStart({ plan: active, planDayId: 'day-1' });
      fixture.detectChanges();

      expect(toast.error).not.toHaveBeenCalled();
      expect(fixture.componentInstance.workoutLive.pendingStart()?.info.sessionId).toBe('session-old');
      expect(fixture.componentInstance.isPlanMutating(active)).toBeFalse();
      expect(player(fixture)).toBeUndefined();
    });

    it('leaves a refused Repeat latest to the dialog as well', () => {
      dataService.repeatLatestSession.and.returnValue(throwError(() => conflict()));
      const fixture = createPage();

      fixture.componentInstance.repeatLatestSession();

      expect(toast.error).not.toHaveBeenCalled();
      expect(fixture.componentInstance.repeatingLatest()).toBeFalse();
      expect(fixture.componentInstance.workoutLive.pendingStart()).not.toBeNull();
    });

    it('reloads the lists when a refused start has gone through from the dialog', () => {
      const fixture = createPage();
      dataService.getWorkoutSessionPage.calls.reset();

      fixture.componentInstance.workoutLive.changedElsewhere.next(running());

      expect(dataService.getWorkoutSessionPage).toHaveBeenCalled();
    });
  });

  describe('History lists the workout in progress first', () => {
    function history(fixture: ComponentFixture<WorkoutPage>) {
      selectTab(fixture, 'history');
      return [...root(fixture).querySelectorAll<HTMLElement>('.history-row')];
    }

    it('puts it on top of the first page whatever the status filter says, marked and with its running time', () => {
      dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([listed()])));
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      // The filter leaves out in-progress sessions, and the running one is listed all the same.
      fixture.componentInstance.filterStatus.set('COMPLETED');
      fixture.detectChanges();

      const rows = history(fixture);

      expect(fixture.componentInstance.filterStatus()).toBe('COMPLETED');
      expect(rows.length).toBe(2);
      expect(rows[0].classList.contains('running')).toBeTrue();
      expect(rows[0].textContent).toContain('Leg day');
      expect(rows[0].textContent).toContain('In progress');
      expect(rows[0].textContent).toMatch(/\d+:\d{2}/);
      expect(rows[1].textContent).toContain('Earlier lift');
    });

    it('opens the exercise screen from that row, not the read-only detail', () => {
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();
      player(fixture)?.minimise.emit();
      const rows = history(fixture);

      rows[0].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedTab()).toBe('overview');
      expect(player(fixture)).toBeDefined();
    });

    it('lists it once when the filtered page already holds it', () => {
      dataService.getWorkoutSessionPage.and.returnValue(
        of(sessionPage([listed({ sessionId: 'session-running', name: 'Leg day', status: 'IN_PROGRESS' })]))
      );
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();

      expect(history(fixture).length).toBe(1);
    });

    it('is not on a later page, and follows the name search', () => {
      dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([listed()], 2, 1)));
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();
      expect(fixture.componentInstance.page()).toBe(1);
      expect(history(fixture).length).toBe(1);

      fixture.componentInstance.page.set(0);
      fixture.componentInstance.setHistorySearch('zzz');
      expect(fixture.componentInstance.runningRow()).toBeNull();
      fixture.componentInstance.setHistorySearch('leg');
      expect(fixture.componentInstance.runningRow()?.sessionId).toBe('session-running');
    });

    it('shows the row even when the filtered list is empty', () => {
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();

      expect(history(fixture).length).toBe(1);
      expect(root(fixture).textContent).not.toContain('No sessions match these filters');
    });
  });

  describe('a workout the server closed by itself', () => {
    const closed = (overrides: Partial<WorkoutSession> = {}) =>
      listed({ sessionId: 'session-closed', autoClosedAt: '2026-10-01T04:00:00Z', ...overrides });

    it('shows one quiet line above the Today card, and Edit opens that session in History', () => {
      dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([closed()])));
      const fixture = createPage();
      const notice = root(fixture).querySelector('app-auto-closed-notice');

      expect(notice).not.toBeNull();
      expect(notice?.nextElementSibling?.tagName.toLowerCase()).toBe('app-today-overview');
      expect(notice?.textContent).toContain('was saved at');

      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      notice?.querySelector<HTMLButtonElement>('.edit')?.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedTab()).toBe('history');
      expect(navigate).toHaveBeenCalledWith(['/workout/sessions', 'session-closed']);
    });

    it('asks for the latest session of the last day', () => {
      createPage();

      const query = dataService.getWorkoutSessionPage.calls.allArgs().map((args) => args[0] as { from?: string; status?: string; size?: number });
      const recent = query.find((candidate) => candidate.from && !candidate.status && candidate.size === 1);
      expect(recent).toBeDefined();
      const age = Date.now() - Date.parse(recent!.from as string);
      expect(age).toBeGreaterThan(23.9 * 3600_000);
      expect(age).toBeLessThan(24.1 * 3600_000);
    });

    it('is gone once dismissed, and stays gone after a reload', () => {
      dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([closed()])));
      const fixture = createPage();

      root(fixture).querySelector<HTMLButtonElement>('app-auto-closed-notice .dismiss')?.click();
      fixture.detectChanges();

      expect(root(fixture).querySelector('app-auto-closed-notice')).toBeNull();
      expect(localStorage.getItem(DISMISSED_KEY)).toContain('session-closed');

      fixture.destroy();
      const again = createPage();
      expect(root(again).querySelector('app-auto-closed-notice')).toBeNull();
    });

    it('stays out when the latest session was ended by the person, or is still running', () => {
      dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([listed({ autoClosedAt: null })])));
      expect(root(createPage()).querySelector('app-auto-closed-notice')).toBeNull();

      dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([closed({ status: 'IN_PROGRESS' })])));
      expect(root(createPage()).querySelector('app-auto-closed-notice')).toBeNull();
    });

    it('says that a cancelled one had no set', () => {
      dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([closed({ status: 'CANCELLED', completedAt: '' })])));

      expect(root(createPage()).querySelector('app-auto-closed-notice')?.textContent).toContain('was closed with no set logged');
    });

    it('is hidden while the exercise screen is showing', () => {
      dataService.getWorkoutSessionPage.and.returnValue(of(sessionPage([closed()])));
      dataService.getActiveWorkout.and.returnValue(of({ session: running(), resume: null }));
      const fixture = TestBed.createComponent(WorkoutPage);
      fixture.componentInstance.workoutLive.refresh();
      fixture.detectChanges();

      expect(root(fixture).querySelector('app-auto-closed-notice')).toBeNull();
    });
  });
});
