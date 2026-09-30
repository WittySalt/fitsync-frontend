import { ActivatedRoute } from '@angular/router';
import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { CoachContextService } from '../../core/coach/coach-context.service';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  DayInsight,
  DayKind,
  NextTraining,
  SportActivityOption,
  TodayInsight,
  UserGoal,
  WeeklyTrainingInsight,
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutPlanRequest,
  WorkoutPlanStatus,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSessionQuery
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ExercisePlayerComponent } from './exercise-player.component';
import { ExerciseLibraryComponent } from './exercise-library.component';
import { LiveStartCardComponent } from './live-start-card.component';
import { LiveTrackerComponent } from './live-tracker.component';
import { LiveTrackerGoal, LiveTrackerStartEvent } from './live-tracker.models';
import {
  createExerciseArray,
  createExerciseGroup,
  exerciseGroupsToInputs,
  ExerciseGroup,
  fillExerciseGroup,
  isBlankExerciseGroup,
  resetExerciseGroup
} from './plan-exercise-form';
import { PlanExerciseRowsComponent } from './plan-exercise-rows.component';
import { PlanWeekEditorComponent } from './plan-week-editor.component';
import { PlanWeekSummaryComponent } from './plan-week-summary.component';
import {
  applyDayKind,
  buildWeekRequest,
  createWeek,
  fillWeek,
  firstInvalidDay,
  MAX_DAY_TITLE_LENGTH,
  resetWeek,
  trainingDayCount,
  weekMoves
} from './plan-week-form';
import { SessionDetailComponent } from './session-detail.component';
import { TodayOpenSessionEvent, TodayOverviewComponent, TodayStartEvent } from './today-overview.component';
import { WorkoutLiveService } from './workout-live.service';
import { WorkoutDataIoComponent } from './workout-data-io.component';
import { sessionDurationLabel } from './workout-session.util';
import { formatKm } from '../dashboard/brief/brief-duration';
import { InsightPanelComponent } from '../../shared/coach/insight/insight-panel.component';

interface TrainingMetric {
  label: string;
  value: string;
  detail: string;
}

type PlanMode = 'list' | 'week';

/** The offer to make an activated plan's weekly session count the user's weekly goal. */
interface WeeklyGoalOffer {
  sessions: number;
  existing: UserGoal | null;
}

type HistoryDurationFilter = '' | 'lt30' | '30to60' | 'gt60';

@Component({
  selector: 'app-workout-page',
  imports: [InsightPanelComponent, 
    ReactiveFormsModule,
    PlanExerciseRowsComponent,
    PlanWeekEditorComponent,
    PlanWeekSummaryComponent,
    StatePanelComponent,
    ExercisePlayerComponent,
    LiveStartCardComponent,
    LiveTrackerComponent,
    TodayOverviewComponent,
    ExerciseLibraryComponent,
    SessionDetailComponent,
    WorkoutDataIoComponent
  ],
  templateUrl: './workout.page.html',
  styleUrl: './workout.page.scss'
})
export class WorkoutPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly workoutLive = inject(WorkoutLiveService);
  private readonly coachContext = inject(CoachContextService);
  private readonly liveStartCard = viewChild(LiveStartCardComponent);

  readonly plans = signal<WorkoutPlan[]>([]);
  readonly sessions = signal<WorkoutSession[]>([]);
  readonly historyTotal = signal(0);
  readonly historyTotalPages = signal(1);
  readonly historyLoading = signal(false);
  readonly completedSessionCount = signal(0);
  readonly weekCompletedCount = signal(0);
  readonly lastCompletedSession = signal<WorkoutSession | null>(null);
  readonly activePlan = signal<WorkoutPlan | null>(null);
  readonly loading = signal(true);
  readonly planError = signal<string | null>(null);
  readonly planMode = signal<PlanMode>('list');
  readonly selectedPlanDay = signal(0);
  readonly sportActivities = signal<SportActivityOption[]>([]);
  readonly weeklyGoalOffer = signal<WeeklyGoalOffer | null>(null);
  readonly weeklyGoalSaving = signal(false);
  readonly planStatus = signal<WorkoutPlanStatus | null>('ACTIVE');
  readonly editingPlanId = signal<string | null>(null);
  readonly savingPlan = signal(false);
  readonly planMutations = signal<Set<string>>(new Set());
  readonly selectedTab = signal<'overview' | 'plans' | 'history' | 'library'>('overview');
  readonly selectedSessionId = signal<string | null>(null);
  readonly guidedPlayerSession = signal<WorkoutSessionDetail | null>(null);
  readonly guidedInitialExerciseId = signal<string | null>(null);
  readonly liveTrackerSession = signal<WorkoutSessionDetail | null>(null);
  readonly liveTrackerGoal = signal<LiveTrackerGoal | null>(null);
  readonly repeatingLatest = signal(false);
  readonly dataToolsOpen = signal(false);
  readonly historySearch = signal('');
  readonly filterType = signal('');
  readonly filterStatus = signal('COMPLETED');
  readonly filterDuration = signal<HistoryDurationFilter>('');
  readonly filterDateFrom = signal('');
  readonly filterDateTo = signal('');
  readonly page = signal(0);
  readonly pageSize = signal(8);
  readonly planStatusOptions: Array<WorkoutPlanStatus | null> = ['ACTIVE', 'DRAFT', 'ARCHIVED', null];
  readonly goalFocusOptions = ['GENERAL_FITNESS', 'WEIGHT_LOSS', 'MUSCLE_GAIN', 'STRENGTH', 'ENDURANCE', 'MOBILITY'];
  readonly workoutTypeOptions = ['STRENGTH', 'CARDIO', 'HIIT', 'YOGA', 'PILATES', 'MOBILITY', 'SPORTS', 'CUSTOM'];
  readonly difficultyOptions = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore';
  // The weekly insight says what kind of day today is. It stays null when the request fails, and
  // the Today card then falls back to the plain active plan.
  readonly insight = signal<WeeklyTrainingInsight | null>(null);
  readonly todayInsight = computed<TodayInsight | null>(() => this.insight()?.today ?? null);
  readonly nextTraining = computed<NextTraining | null>(() => this.insight()?.nextTraining ?? null);
  readonly todayDay = computed<DayInsight | null>(() => {
    const today = this.todayInsight();
    return today ? (this.insight()?.days?.find((day) => day.date === today.date) ?? null) : null;
  });
  readonly todayStarting = computed(() => {
    const planId = this.activePlan()?.planId;
    return Boolean(planId && this.planMutations().has(planId));
  });

  readonly planForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', Validators.maxLength(1000)],
    goalFocus: ['GENERAL_FITNESS', Validators.required],
    workoutType: ['STRENGTH', Validators.required],
    difficulty: ['BEGINNER', Validators.required],
    estimatedDurationMinutes: [45, [Validators.required, Validators.min(1)]],
    exercises: createExerciseArray(this.fb)
  });

  // The week of a plan that has one. It lives beside the form rather than inside it, so a plan
  // saved as one list never depends on it.
  readonly planWeek = createWeek(this.fb);
  private sportActivitiesRequested = false;
  private weeklyGoalRequest = 0;

  readonly metrics = computed<TrainingMetric[]>(() => {
    const latest = this.lastCompletedSession();
    return [
      { label: 'Sessions logged', value: String(this.completedSessionCount()), detail: 'completed all time' },
      { label: 'Last 7 days', value: String(this.weekCompletedCount()), detail: 'completed sessions' },
      {
        label: 'Last session',
        value: latest ? this.formatDate(latest.completedAt || latest.startedAt) : '—',
        detail: latest ? this.formatLabel(latest.workoutType) : 'none yet'
      }
    ];
  });

  readonly historyTypeOptions = this.workoutTypeOptions;

  readonly historyStatusOptions = ['COMPLETED', 'CANCELLED', 'IN_PROGRESS'] as const;

  // Server-side filters (status/type/duration/date) + pagination drive this list.
  // Name search has no backend param, so it refines the loaded page client-side only.
  readonly visibleSessions = computed(() => {
    const search = this.historySearch().trim().toLowerCase();
    const rows = this.sessions();
    return search ? rows.filter((session) => session.name.toLowerCase().includes(search)) : rows;
  });

  ngOnInit(): void {
    // Another surface can land here on a specific tab. Plan Studio does, after accepting a
    // draft: the session it started is in History, which is also where this page goes itself
    // after starting a plan.
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'overview' || tab === 'plans' || tab === 'history' || tab === 'library') {
      this.selectedTab.set(tab);
    }
    // History lists completed sessions unless told otherwise, and a session that was started a
    // moment ago is not completed. Plan Studio passes the status so it is visible on arrival.
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status && (this.historyStatusOptions as readonly string[]).includes(status)) {
      this.filterStatus.set(status);
    }
    this.load();
  }

  load(): void {
    this.loadPlans();
    this.loadSessions();
    this.loadActivePlan();
  }

  get planExercises(): FormArray<ExerciseGroup> {
    return this.planForm.controls.exercises;
  }

  setHistorySearch(value: string): void {
    // Name search has no backend param; refine the loaded page client-side only.
    this.historySearch.set(value);
  }

  setFilterType(value: string): void {
    this.filterType.set(value);
    this.reloadHistoryFromFirstPage();
  }

  setFilterStatus(value: string): void {
    this.filterStatus.set(value);
    this.reloadHistoryFromFirstPage();
  }

  setFilterDuration(value: string): void {
    this.filterDuration.set(this.toDurationFilter(value));
    this.reloadHistoryFromFirstPage();
  }

  setFilterDateFrom(value: string): void {
    this.filterDateFrom.set(value);
    this.reloadHistoryFromFirstPage();
  }

  setFilterDateTo(value: string): void {
    this.filterDateTo.set(value);
    this.reloadHistoryFromFirstPage();
  }

  prevHistoryPage(): void {
    this.goToHistoryPage(this.page() - 1);
  }

  nextHistoryPage(): void {
    this.goToHistoryPage(this.page() + 1);
  }

  goToHistoryPage(page: number): void {
    const maxPage = this.historyTotalPages() - 1;
    const next = Math.min(Math.max(page, 0), maxPage);
    if (next === this.page()) {
      return;
    }
    this.page.set(next);
    this.loadHistory();
  }

  private reloadHistoryFromFirstPage(): void {
    this.page.set(0);
    this.loadHistory();
  }

  selectPlanStatus(status: WorkoutPlanStatus | null): void {
    this.planStatus.set(status);
    this.loadPlans();
  }

  addPlanExercise(): void {
    this.planExercises.push(createExerciseGroup(this.fb));
  }

  removePlanExercise(index: number): void {
    if (this.planExercises.length <= 1) {
      resetExerciseGroup(this.planExercises.at(0));
      return;
    }
    this.planExercises.removeAt(index);
  }

  setPlanMode(mode: PlanMode): void {
    if (mode === this.planMode()) {
      return;
    }
    if (mode === 'week') {
      this.moveListIntoWeek();
    } else {
      this.mergeWeekIntoList();
    }
  }

  editPlan(plan: WorkoutPlan): void {
    if (!plan.planId) {
      this.toast.error('This sample plan cannot be edited until the workout API is available.');
      return;
    }

    this.editingPlanId.set(plan.planId);
    this.planForm.patchValue({
      name: plan.name,
      description: plan.description,
      goalFocus: plan.goalFocus,
      workoutType: plan.workoutType,
      difficulty: plan.difficulty,
      estimatedDurationMinutes: plan.estimatedDurationMinutes
    });

    this.planExercises.clear();
    resetWeek(this.planWeek);
    if (plan.days?.length) {
      fillWeek(this.fb, this.planWeek, plan.days);
      this.planMode.set('week');
      this.selectedPlanDay.set(Math.max(0, this.planWeek.controls.findIndex((day) => day.controls.kind.value !== 'REST')));
      this.ensureSportActivities();
      return;
    }
    this.planMode.set('list');
    const exercises = plan.exercises.length ? plan.exercises : [null];
    exercises.forEach((exercise) => {
      const group = createExerciseGroup(this.fb);
      if (exercise) {
        fillExerciseGroup(group, exercise);
      }
      this.planExercises.push(group);
    });
  }

  cancelEdit(): void {
    this.editingPlanId.set(null);
    this.resetPlanForm();
  }

  savePlan(): void {
    this.planForm.markAllAsTouched();
    const week = this.planMode() === 'week';

    if (this.planForm.invalid) {
      this.toast.error(week ? 'Complete the required plan fields.' : 'Choose at least one exercise and complete the required plan fields.');
      return;
    }

    if (week) {
      this.planWeek.markAllAsTouched();
      const invalidDay = firstInvalidDay(this.planWeek);
      if (invalidDay >= 0) {
        this.selectedPlanDay.set(invalidDay);
        this.toast.error('Complete this day before saving the week.');
        return;
      }
      if (trainingDayCount(this.planWeek) === 0) {
        this.toast.error('Plan at least one training day before saving the week.');
        return;
      }
    }

    const request = this.buildPlanRequest();
    if (!week && !request.exercises.length) {
      this.toast.error('Choose at least one exercise before saving the plan.');
      return;
    }

    this.savingPlan.set(true);
    const editingId = this.editingPlanId();
    const action = editingId
      ? this.dataService.updateWorkoutPlan(editingId, request)
      : this.dataService.createWorkoutPlan(request);

    action.subscribe({
      next: (plan) => {
        this.toast.success(editingId ? 'Plan updated.' : 'Plan created.');
        this.resetPlanForm();
        this.editingPlanId.set(null);
        this.planStatus.set(plan.status === 'ARCHIVED' ? 'ARCHIVED' : (plan.status as WorkoutPlanStatus));
        this.loadPlans();
        this.loadActivePlan();
      },
      error: () => {
        this.savingPlan.set(false);
        this.toast.error(editingId ? 'Unable to update plan. Please retry.' : 'Unable to create plan. Please retry.');
      },
      complete: () => this.savingPlan.set(false)
    });
  }

  activatePlan(plan: WorkoutPlan): void {
    if (!plan.planId || this.isPlanMutating(plan)) {
      return;
    }

    this.setPlanMutating(plan.planId, true);
    this.dataService.activateWorkoutPlan(plan.planId).subscribe({
      next: (activated) => {
        this.toast.success('Plan activated.');
        this.planStatus.set('ACTIVE');
        this.loadPlans();
        this.loadActivePlan();
        this.offerWeeklyGoal(activated);
      },
      error: () => {
        this.toast.error('Unable to activate plan. Please retry.');
        this.setPlanMutating(plan.planId!, false);
      },
      complete: () => this.setPlanMutating(plan.planId!, false)
    });
  }

  archivePlan(plan: WorkoutPlan): void {
    if (!plan.planId || this.isPlanMutating(plan)) {
      return;
    }

    this.setPlanMutating(plan.planId, true);
    this.dataService.archiveWorkoutPlan(plan.planId).subscribe({
      next: () => {
        this.toast.success('Plan archived.');
        this.loadPlans();
        this.loadActivePlan();
      },
      error: () => {
        this.toast.error('Unable to archive plan. Please retry.');
        this.setPlanMutating(plan.planId!, false);
      },
      complete: () => this.setPlanMutating(plan.planId!, false)
    });
  }

  startPlan(plan: WorkoutPlan): void {
    if (!plan.planId || plan.status === 'ARCHIVED' || this.isPlanMutating(plan)) {
      return;
    }

    this.setPlanMutating(plan.planId, true);
    this.dataService.startWorkoutPlan(plan.planId).subscribe({
      next: (session) => {
        this.toast.success('Workout session started.');
        this.sessions.update((sessions) => [session, ...sessions.filter((item) => item.sessionId !== session.sessionId)]);
        this.selectedTab.set('history');
        this.loadSessions();
      },
      error: () => {
        this.toast.error('Unable to start this plan. Please retry.');
        this.setPlanMutating(plan.planId!, false);
      },
      complete: () => this.setPlanMutating(plan.planId!, false)
    });
  }

  isPlanMutating(plan: WorkoutPlan): boolean {
    return Boolean(plan.planId && this.planMutations().has(plan.planId));
  }

  handleLiveTrackerStarted(event: LiveTrackerStartEvent): void {
    this.liveTrackerSession.set(event.session);
    this.liveTrackerGoal.set(event.goal);
    this.sessions.update((sessions) => [event.session, ...sessions.filter((item) => item.sessionId !== event.session.sessionId)]);
  }

  handleLiveTrackerFinished(): void {
    this.liveTrackerSession.set(null);
    this.liveTrackerGoal.set(null);
    this.workoutLive.reset();
    this.loadSessions();
    this.loadActivePlan();
    this.selectedTab.set('history');
  }

  handleLiveTrackerCancelled(): void {
    this.liveTrackerSession.set(null);
    this.liveTrackerGoal.set(null);
    this.workoutLive.reset();
    this.loadSessions();
  }

  handlePastWorkoutLogged(): void {
    this.loadSessions();
  }

  handleTodayStart(event: TodayStartEvent): void {
    this.startGuidedPlan(event.plan, null, event.planDayId);
  }

  handleTodayExerciseStart(exercise: WorkoutPlanExercise): void {
    const plan = this.activePlan();
    if (!plan) {
      return;
    }
    // A row belongs to one day of the plan, and that day is the one to start. A plan without a
    // weekly layout has no days, and the backend then picks today's on its own.
    const day = plan.days?.find((entry) =>
      entry.exercises.some((item) => item === exercise || (!!item.planExerciseId && item.planExerciseId === exercise.planExerciseId))
    );
    this.startGuidedPlan(plan, exercise.exerciseId, day?.planDayId ?? null);
  }

  /** The Today card has no session to start (a habit day, or a sport that is logged afterwards),
   *  so it hands over to the past-workout form of the quick start card beside it. */
  handleTodayLogManually(kind: DayKind): void {
    const card = this.liveStartCard();
    if (!card) {
      return;
    }
    const workoutType = kind === 'SPORT' ? 'SPORTS' : kind === 'STRENGTH' || kind === 'CARDIO' || kind === 'MOBILITY' ? kind : 'CUSTOM';
    card.pastWorkoutForm.controls.workoutType.setValue(workoutType);
    if (kind === 'SPORT') {
      // Today's plan names the sport, or a session already logged today does when the plan does not.
      const day = this.todayDay();
      const sport = day?.planned?.sportActivity ?? day?.sessions.find((session) => session.sportActivity)?.sportActivity;
      card.pastWorkoutForm.controls.sportActivity.setValue(sport ?? '');
    }
    card.pastWorkoutOpen.set(true);
    if (typeof queueMicrotask === 'function' && typeof document !== 'undefined') {
      queueMicrotask(() => document.querySelector('#past-workout-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
  }

  /** Continue and See the session both open the session in History, where it can be resumed,
   *  finished or read. The list shows the status the session has, so that status is selected. */
  handleTodayOpenSession(event: TodayOpenSessionEvent): void {
    if (this.filterStatus() !== event.status) {
      this.setFilterStatus(event.status);
    }
    this.selectedTab.set('history');
    if (event.sessionId) {
      this.selectedSessionId.set(event.sessionId);
    }
  }

  private startGuidedPlan(plan: WorkoutPlan, initialExerciseId: string | null, planDayId: string | null): void {
    if (!plan.planId || this.isPlanMutating(plan)) {
      return;
    }

    this.setPlanMutating(plan.planId, true);
    this.guidedInitialExerciseId.set(initialExerciseId);
    this.workoutLive.startFromPlan(plan.planId, { planDayId, timezone: this.timezone }).subscribe({
      next: (session) => {
        this.toast.success('Workout session started.');
        this.guidedPlayerSession.set(session);
        this.sessions.update((sessions) => [session, ...sessions.filter((item) => item.sessionId !== session.sessionId)]);
      },
      error: () => {
        this.guidedInitialExerciseId.set(null);
        this.toast.error('Unable to start this plan. Please retry.');
        this.setPlanMutating(plan.planId!, false);
      },
      complete: () => this.setPlanMutating(plan.planId!, false)
    });
  }

  handleGuidedPlayerFinished(): void {
    this.guidedPlayerSession.set(null);
    this.guidedInitialExerciseId.set(null);
    this.workoutLive.reset();
    this.loadSessions();
    this.loadActivePlan();
  }

  handleGuidedPlayerCancelled(): void {
    this.guidedPlayerSession.set(null);
    this.guidedInitialExerciseId.set(null);
    this.workoutLive.reset();
    this.loadSessions();
  }

  handleTemplateActivated(plan: WorkoutPlan): void {
    this.activePlan.set(plan);
    this.planStatus.set('ACTIVE');
    this.loadPlans();
    this.loadActivePlan();
    this.offerWeeklyGoal(plan);
  }

  dismissWeeklyGoalOffer(): void {
    this.weeklyGoalRequest++;
    this.weeklyGoalOffer.set(null);
  }

  acceptWeeklyGoalOffer(): void {
    const offer = this.weeklyGoalOffer();
    if (!offer || this.weeklyGoalSaving()) {
      return;
    }

    this.weeklyGoalSaving.set(true);
    this.dataService
      .upsertGoal('WORKOUT_FREQUENCY', {
        targetValue: offer.sessions,
        targetUnit: 'sessions/week',
        targetDate: offer.existing?.targetDate ?? null,
        status: 'ACTIVE',
        notes: offer.existing?.notes ?? null
      })
      .subscribe({
        next: () => {
          this.toast.success('Weekly goal saved.');
          this.weeklyGoalOffer.set(null);
        },
        error: () => {
          this.toast.error('Unable to save the weekly goal. Please retry.');
          this.weeklyGoalSaving.set(false);
        },
        complete: () => this.weeklyGoalSaving.set(false)
      });
  }

  browsePlans(): void {
    this.selectedTab.set('plans');
  }

  openSessionDetail(session: WorkoutSession): void {
    if (!session.sessionId) {
      return;
    }
    this.selectedSessionId.set(session.sessionId);
    // Bring the detail panel into view; it renders below the (possibly long) list.
    if (typeof queueMicrotask === 'function' && typeof document !== 'undefined') {
      queueMicrotask(() => document.querySelector('app-session-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  closeSessionDetail(): void {
    this.selectedSessionId.set(null);
  }

  handleSessionUpdated(session: WorkoutSessionDetail): void {
    this.sessions.update((sessions) => sessions.map((item) => (item.sessionId === session.sessionId ? session : item)));
    this.loadSessions();
  }

  handleSessionDeleted(): void {
    this.selectedSessionId.set(null);
    this.loadSessions();
  }

  handleSessionRepeated(session: WorkoutSessionDetail): void {
    this.sessions.update((sessions) => [session, ...sessions.filter((item) => item.sessionId !== session.sessionId)]);
    this.loadSessions();
  }

  handleWorkoutImportFinished(): void {
    this.loadSessions();
  }

  toggleDataTools(): void {
    this.dataToolsOpen.update((open) => !open);
  }

  repeatLatestSession(): void {
    if (this.repeatingLatest()) {
      return;
    }

    this.repeatingLatest.set(true);
    this.dataService.repeatLatestSession().subscribe({
      next: (session) => {
        this.toast.success('Latest workout repeated.');
        this.handleSessionRepeated(session);
      },
      error: () => {
        this.toast.error('Unable to repeat the latest session. Please retry.');
        this.repeatingLatest.set(false);
      },
      complete: () => this.repeatingLatest.set(false)
    });
  }

  formatLabel(value: string | null | undefined): string {
    return (value ?? '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat('en-SG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  formatDuration(session: WorkoutSession): string {
    return sessionDurationLabel(session);
  }

  formatDistance(km: number | null | undefined): string {
    return formatKm(km);
  }

  private loadPlans(): void {
    this.loading.set(true);
    this.planError.set(null);
    this.dataService.getWorkoutPlans(this.planStatus()).subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: () => {
        this.planError.set('Unable to load workout plans. Please retry.');
        this.plans.set([]);
        this.loading.set(false);
      }
    });
  }

  private loadSessions(): void {
    this.loadHistory();
    this.loadMetrics();
    this.loadInsight();
  }

  private loadInsight(): void {
    this.dataService.getWeeklyTrainingInsight(this.timezone).subscribe({
      next: (insight) => {
        this.insight.set(insight);
        this.coachContext.setTodayKind(insight.today?.kind ?? null);
      },
      // The card shows the plain plan without the insight, so a failure is not worth a toast.
      error: () => this.insight.set(null)
    });
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.dataService.getWorkoutSessionPage(this.historyQuery()).subscribe({
      next: (page) => {
        this.sessions.set(page.sessions);
        this.historyTotal.set(page.total);
        this.historyTotalPages.set(Math.max(1, page.totalPages));
        if (page.page !== this.page()) {
          this.page.set(page.page);
        }
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false)
    });
  }

  private loadMetrics(): void {
    this.dataService.getWorkoutSessionPage({ status: 'COMPLETED', page: 0, size: 1 }).subscribe((page) => {
      this.completedSessionCount.set(page.total);
      this.lastCompletedSession.set(page.sessions[0] ?? null);
    });
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    this.dataService.getWorkoutSessionPage({ status: 'COMPLETED', from: weekAgo, page: 0, size: 1 }).subscribe((page) => {
      this.weekCompletedCount.set(page.total);
    });
  }

  private historyQuery(): WorkoutSessionQuery {
    const [minDurationMinutes, maxDurationMinutes] = this.durationBounds(this.filterDuration());
    return {
      status: this.filterStatus() || undefined,
      workoutType: this.filterType() || undefined,
      minDurationMinutes,
      maxDurationMinutes,
      from: this.dateToInstant(this.filterDateFrom(), false),
      to: this.dateToInstant(this.filterDateTo(), true),
      page: this.page(),
      size: this.pageSize()
    };
  }

  private durationBounds(filter: HistoryDurationFilter): [number | undefined, number | undefined] {
    if (filter === 'lt30') {
      return [undefined, 29];
    }
    if (filter === '30to60') {
      return [30, 60];
    }
    if (filter === 'gt60') {
      return [61, undefined];
    }
    return [undefined, undefined];
  }

  private dateToInstant(value: string, endOfDay: boolean): string | undefined {
    if (!value) {
      return undefined;
    }
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private loadActivePlan(): void {
    this.dataService.getActivePlan().subscribe((plan) => this.activePlan.set(plan));
  }

  private buildPlanRequest(): WorkoutPlanRequest {
    const raw = this.planForm.getRawValue();
    const request: WorkoutPlanRequest = {
      name: raw.name ?? '',
      description: raw.description ?? '',
      goalFocus: raw.goalFocus ?? 'GENERAL_FITNESS',
      workoutType: raw.workoutType ?? 'STRENGTH',
      difficulty: raw.difficulty ?? 'BEGINNER',
      estimatedDurationMinutes: this.optionalNumber(raw.estimatedDurationMinutes),
      exercises: exerciseGroupsToInputs(this.planExercises.controls)
    };
    // A plan with a week keeps every exercise inside its days, and the server refuses both.
    return this.planMode() === 'week'
      ? { ...request, exercises: [], days: buildWeekRequest(this.planWeek) }
      : request;
  }

  private resetPlanForm(): void {
    this.planForm.reset({
      name: '',
      description: '',
      goalFocus: 'GENERAL_FITNESS',
      workoutType: 'STRENGTH',
      difficulty: 'BEGINNER',
      estimatedDurationMinutes: 45
    });
    this.planExercises.clear();
    this.planExercises.push(createExerciseGroup(this.fb));
    resetWeek(this.planWeek);
    this.selectedPlanDay.set(0);
    this.planMode.set('list');
  }

  // Choosing "A week" carries what is already typed into Monday, so nothing is lost by trying it.
  private moveListIntoWeek(): void {
    const monday = this.planWeek.at(0);
    const moved = this.planExercises.controls.filter((group) => !isBlankExerciseGroup(group));
    this.planExercises.clear();
    resetWeek(this.planWeek);
    monday.controls.title.setValue((this.planForm.controls.name.value ?? '').trim().slice(0, MAX_DAY_TITLE_LENGTH));
    moved.forEach((group) => monday.controls.exercises.push(group));
    applyDayKind(monday, 'STRENGTH');
    this.selectedPlanDay.set(0);
    this.planMode.set('week');
    this.ensureSportActivities();
  }

  private mergeWeekIntoList(): void {
    const hasStructure = trainingDayCount(this.planWeek) > 0;
    if (hasStructure && !window.confirm('Turn the week into one list? Days, titles and rest days are dropped, and every move is kept in order.')) {
      return;
    }
    const moved = weekMoves(this.planWeek);
    resetWeek(this.planWeek);
    this.planExercises.clear();
    (moved.length ? moved : [createExerciseGroup(this.fb)]).forEach((group) => this.planExercises.push(group));
    this.selectedPlanDay.set(0);
    this.planMode.set('list');
  }

  private ensureSportActivities(): void {
    if (this.sportActivitiesRequested) {
      return;
    }
    this.sportActivitiesRequested = true;
    this.dataService.getExerciseMetadata().subscribe((metadata) => {
      this.sportActivities.set(metadata?.sportActivities ?? []);
      if (!metadata) {
        // Try again the next time a week is opened; the sport select is empty until it loads.
        this.sportActivitiesRequested = false;
      }
    });
  }

  // Asks whether the weekly goal should follow a plan that was just activated. Nothing is asked for
  // a plan without a week, or when the goal already says the same number.
  private offerWeeklyGoal(plan: WorkoutPlan): void {
    const request = ++this.weeklyGoalRequest;
    this.weeklyGoalOffer.set(null);
    const sessions = plan.sessionsPerWeek;
    if (!sessions) {
      return;
    }
    this.dataService.getGoals().subscribe((goals) => {
      if (request !== this.weeklyGoalRequest) {
        return;
      }
      const existing = goals.find((goal) => goal.goalType === 'WORKOUT_FREQUENCY') ?? null;
      if (existing?.status === 'ACTIVE' && existing.targetValue === sessions) {
        return;
      }
      this.weeklyGoalOffer.set({ sessions, existing });
    });
  }

  private optionalNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private setPlanMutating(planId: string, mutating: boolean): void {
    const next = new Set(this.planMutations());
    if (mutating) {
      next.add(planId);
    } else {
      next.delete(planId);
    }
    this.planMutations.set(next);
  }

  private toDurationFilter(value: string): HistoryDurationFilter {
    return value === 'lt30' || value === '30to60' || value === 'gt60' ? value : '';
  }
}
