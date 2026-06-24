import { Component, computed, effect, inject, OnDestroy, OnInit, signal, untracked } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, map, of, Subject, switchMap } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  Exercise,
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutPlanExerciseInput,
  WorkoutPlanRequest,
  WorkoutPlanStatus,
  WorkoutSession,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ExercisePlayerComponent } from './exercise-player.component';
import { ExerciseLibraryComponent } from './exercise-library.component';
import { LiveStartCardComponent } from './live-start-card.component';
import { LiveTrackerComponent } from './live-tracker.component';
import { LiveTrackerGoal, LiveTrackerStartEvent } from './live-tracker.models';
import { SessionDetailComponent } from './session-detail.component';
import { TodayOverviewComponent } from './today-overview.component';
import { WorkoutLiveService } from './workout-live.service';
import { WorkoutDataIoComponent } from './workout-data-io.component';
import { isCompletedSession } from './workout-session.util';

interface TrainingMetric {
  label: string;
  value: string;
  detail: string;
  tone: 'green' | 'blue' | 'orange';
}

interface ExercisePickerState {
  inputValue: string;
  query: string;
  results: Exercise[];
  loading: boolean;
  error: string | null;
  open: boolean;
  activeIndex: number;
}

interface ExerciseSearchRequest {
  index: number;
  query: string;
}

type HistoryDurationFilter = '' | 'lt30' | '30to60' | 'gt60';

@Component({
  selector: 'app-workout-page',
  imports: [
    ReactiveFormsModule,
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
export class WorkoutPage implements OnInit, OnDestroy {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly workoutLive = inject(WorkoutLiveService);
  private readonly exerciseSearchTerms = new Subject<ExerciseSearchRequest>();

  readonly plans = signal<WorkoutPlan[]>([]);
  readonly sessions = signal<WorkoutSession[]>([]);
  readonly totalSessionCount = signal(0);
  readonly activePlan = signal<WorkoutPlan | null>(null);
  readonly loading = signal(true);
  readonly planError = signal<string | null>(null);
  readonly exercisePickerStates = signal<Record<number, ExercisePickerState>>({});
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
  private readonly historyLoadLimit = 10;
  private readonly resetHistoryPageOnFilterChange = effect(() => {
    this.historySearch();
    this.filterType();
    this.filterStatus();
    this.filterDuration();
    this.filterDateFrom();
    this.filterDateTo();

    untracked(() => {
      if (this.page() !== 0) {
        this.page.set(0);
      }
    });
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
    exercises: this.fb.array([this.createExerciseGroup()])
  });

  private readonly exerciseSearchSubscription = this.exerciseSearchTerms.pipe(
    debounceTime(275),
    distinctUntilChanged((previous, current) => previous.index === current.index && previous.query === current.query),
    switchMap(({ index, query }) =>
      this.dataService.searchExercisesPage({ q: query, page: 0, size: 20 }).pipe(
        map((page) => ({ index, query, results: page.items, error: null as string | null })),
        catchError(() => of({
          index,
          query,
          results: [] as Exercise[],
          error: 'Unable to search exercises. Please retry.'
        }))
      )
    )
  ).subscribe(({ index, query, results, error }) => {
    const current = this.exercisePickerStates()[index];
    if (!current || current.query !== query) {
      return;
    }
    this.setExercisePickerState(index, {
      results,
      error,
      loading: false,
      open: true,
      activeIndex: results.length ? 0 : -1
    });
  });

  readonly latestSession = computed(() => {
    const sorted = this.completedSessions();
    return sorted[0] ?? null;
  });

  readonly metrics = computed<TrainingMetric[]>(() => {
    const sessions = this.completedSessions();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const thisWeek = sessions.filter((session) => this.timeOf(session) >= weekAgo).length;
    const latest = this.latestSession();

    return [
      { label: 'Sessions tracked', value: String(this.totalSessionCount()), detail: 'all statuses', tone: 'green' },
      { label: 'This week', value: String(thisWeek), detail: 'completed in the last 7 days', tone: 'blue' },
      {
        label: 'Last session',
        value: latest ? this.formatDate(latest.completedAt || latest.startedAt) : '—',
        detail: latest ? this.formatLabel(latest.workoutType) : 'none yet',
        tone: 'orange'
      }
    ];
  });

  readonly historyTypeOptions = computed(() => this.distinctSessionValues('workoutType'));

  readonly historyStatusOptions = ['COMPLETED', 'CANCELLED', 'IN_PROGRESS'] as const;

  readonly filteredSessions = computed(() => {
    const search = this.historySearch().trim().toLowerCase();
    const type = this.filterType();
    const status = this.filterStatus();
    const duration = this.filterDuration();
    const from = this.dateStart(this.filterDateFrom());
    const to = this.dateEnd(this.filterDateTo());

    return [...this.sessions()]
      .filter((session) => {
        const sessionTime = this.timeOf(session);
        return (
          (!search || session.name.toLowerCase().includes(search)) &&
          (!type || session.workoutType === type) &&
          (!status || session.status === status) &&
          this.matchesDuration(session, duration) &&
          this.matchesDateRange(sessionTime, from, to)
        );
      })
      .sort((a, b) => this.timeOf(b) - this.timeOf(a));
  });

  readonly totalHistoryPages = computed(() => Math.max(1, Math.ceil(this.filteredSessions().length / this.pageSize())));

  readonly pagedSessions = computed(() => {
    const start = this.page() * this.pageSize();
    return this.filteredSessions().slice(start, start + this.pageSize());
  });

  ngOnInit(): void {
    this.ensureExercisePickerStates();
    this.load();
  }

  ngOnDestroy(): void {
    this.exerciseSearchSubscription.unsubscribe();
  }

  load(): void {
    this.loadPlans();
    this.loadSessions();
    this.loadActivePlan();
  }

  get planExercises(): FormArray {
    return this.planForm.get('exercises') as FormArray;
  }

  setHistorySearch(value: string): void {
    this.historySearch.set(value);
    this.page.set(0);
  }

  setFilterType(value: string): void {
    this.filterType.set(value);
    this.page.set(0);
  }

  setFilterStatus(value: string): void {
    this.filterStatus.set(value);
    this.page.set(0);
  }

  setFilterDuration(value: string): void {
    this.filterDuration.set(this.toDurationFilter(value));
    this.page.set(0);
  }

  setFilterDateFrom(value: string): void {
    this.filterDateFrom.set(value);
    this.page.set(0);
  }

  setFilterDateTo(value: string): void {
    this.filterDateTo.set(value);
    this.page.set(0);
  }

  prevHistoryPage(): void {
    this.goToHistoryPage(this.page() - 1);
  }

  nextHistoryPage(): void {
    this.goToHistoryPage(this.page() + 1);
  }

  goToHistoryPage(page: number): void {
    const maxPage = this.totalHistoryPages() - 1;
    this.page.set(Math.min(Math.max(page, 0), maxPage));
  }

  selectPlanStatus(status: WorkoutPlanStatus | null): void {
    this.planStatus.set(status);
    this.loadPlans();
  }

  addPlanExercise(): void {
    this.planExercises.push(this.createExerciseGroup());
    this.setExercisePickerState(this.planExercises.length - 1, this.emptyExercisePickerState());
  }

  removePlanExercise(index: number): void {
    if (this.planExercises.length <= 1) {
      this.planExercises.at(0).reset({
        exerciseId: '',
        targetSets: 3,
        targetReps: 8,
        targetWeightKg: null,
        restSeconds: 90,
        notes: ''
      });
      this.setExercisePickerState(0, this.emptyExercisePickerState());
      return;
    }
    this.planExercises.removeAt(index);
    this.reindexExercisePickerStates(index);
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
    this.exercisePickerStates.set({});
    const exercises = plan.exercises.length ? plan.exercises : [null];
    exercises.forEach((exercise, index) => {
      const group = this.createExerciseGroup();
      if (exercise) {
        group.patchValue({
          exerciseId: exercise.exerciseId ?? '',
          targetSets: exercise.targetSets ?? 0,
          targetReps: exercise.targetReps ?? 0,
          targetWeightKg: exercise.targetWeightKg,
          restSeconds: exercise.restSeconds ?? 0,
          notes: exercise.notes
        });
        this.setExercisePickerState(index, {
          ...this.emptyExercisePickerState(),
          inputValue: exercise.exerciseNameSnapshot || ''
        });
      } else {
        this.setExercisePickerState(index, this.emptyExercisePickerState());
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

    if (this.planForm.invalid) {
      this.toast.error('Choose at least one exercise and complete the required plan fields.');
      return;
    }

    const request = this.buildPlanRequest();
    if (!request.exercises.length) {
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
      next: () => {
        this.toast.success('Plan activated.');
        this.planStatus.set('ACTIVE');
        this.loadPlans();
        this.loadActivePlan();
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

  handleTodayStart(plan: WorkoutPlan): void {
    this.startGuidedPlan(plan, null);
  }

  handleTodayExerciseStart(exercise: WorkoutPlanExercise): void {
    const plan = this.activePlan();
    if (!plan) {
      return;
    }
    this.startGuidedPlan(plan, exercise.exerciseId);
  }

  private startGuidedPlan(plan: WorkoutPlan, initialExerciseId: string | null): void {
    if (!plan.planId || this.isPlanMutating(plan)) {
      return;
    }

    this.setPlanMutating(plan.planId, true);
    this.guidedInitialExerciseId.set(initialExerciseId);
    this.workoutLive.startFromPlan(plan.planId).subscribe({
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
  }

  browsePlans(): void {
    this.selectedTab.set('plans');
  }

  exercisePickerState(index: number): ExercisePickerState {
    return this.exercisePickerStates()[index] ?? this.emptyExercisePickerState();
  }

  setExerciseSearchQuery(index: number, value: string): void {
    const query = value.trim();
    this.planExercises.at(index)?.get('exerciseId')?.setValue('');
    this.setExercisePickerState(index, {
      inputValue: value,
      query,
      results: [],
      error: null,
      loading: Boolean(query),
      open: true,
      activeIndex: -1
    });
    if (query) {
      this.exerciseSearchTerms.next({ index, query });
    }
  }

  openExercisePicker(index: number): void {
    this.ensureExercisePickerState(index);
    this.setExercisePickerState(index, { open: true });
  }

  closeExercisePicker(index: number): void {
    this.setExercisePickerState(index, { open: false, activeIndex: -1 });
  }

  markExercisePickerTouched(index: number): void {
    this.planExercises.at(index)?.get('exerciseId')?.markAsTouched();
  }

  handleExercisePickerKeydown(event: KeyboardEvent, index: number): void {
    const state = this.exercisePickerState(index);
    if (event.key === 'Escape') {
      this.closeExercisePicker(index);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveExercisePickerActive(index, 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveExercisePickerActive(index, -1);
      return;
    }
    if (event.key === 'Enter' && state.open && state.activeIndex >= 0) {
      event.preventDefault();
      const exercise = state.results[state.activeIndex];
      if (exercise) {
        this.selectExerciseResult(index, exercise);
      }
    }
  }

  selectExerciseResult(index: number, exercise: Exercise): void {
    if (!exercise.exerciseId) {
      return;
    }
    const control = this.planExercises.at(index)?.get('exerciseId');
    control?.setValue(exercise.exerciseId);
    control?.markAsDirty();
    control?.markAsTouched();
    this.setExercisePickerState(index, {
      inputValue: exercise.name,
      query: '',
      results: [exercise],
      error: null,
      loading: false,
      open: false,
      activeIndex: -1
    });
  }

  exerciseHint(exercise: Exercise): string {
    return [exercise.primaryMuscleGroup, exercise.equipment]
      .filter(Boolean)
      .map((value) => this.formatLabel(value))
      .join(' / ');
  }

  exerciseListboxId(index: number): string {
    return `plan-exercise-results-${index}`;
  }

  exerciseOptionId(rowIndex: number, optionIndex: number): string {
    return `plan-exercise-option-${rowIndex}-${optionIndex}`;
  }

  activeExerciseOptionId(index: number): string | null {
    const state = this.exercisePickerState(index);
    return state.open && state.activeIndex >= 0 ? this.exerciseOptionId(index, state.activeIndex) : null;
  }

  openSessionDetail(session: WorkoutSession): void {
    if (!session.sessionId) {
      return;
    }
    this.selectedSessionId.set(session.sessionId);
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
    this.dataService.getWorkoutSessionPage(this.historyLoadLimit).subscribe((page) => {
      this.sessions.set(page.sessions);
      this.totalSessionCount.set(page.total);
    });
  }

  private loadActivePlan(): void {
    this.dataService.getActivePlan().subscribe((plan) => this.activePlan.set(plan));
  }

  private createExerciseGroup() {
    return this.fb.group({
      exerciseId: ['', Validators.required],
      targetSets: [3, [Validators.min(0)]],
      targetReps: [8, [Validators.min(0)]],
      targetWeightKg: [null as number | null, [Validators.min(0)]],
      restSeconds: [90, [Validators.min(0)]],
      notes: ['', Validators.maxLength(300)]
    });
  }

  private buildPlanRequest(): WorkoutPlanRequest {
    const raw = this.planForm.getRawValue();
    const exercises: WorkoutPlanExerciseInput[] = raw.exercises
      .filter((exercise): exercise is typeof exercise & { exerciseId: string } => Boolean(exercise.exerciseId))
      .map((exercise, index) => ({
        exerciseId: exercise.exerciseId,
        sequence: index + 1,
        targetSets: this.optionalNumber(exercise.targetSets),
        targetReps: this.optionalNumber(exercise.targetReps),
        targetWeightKg: this.optionalNumber(exercise.targetWeightKg),
        targetDurationSeconds: null,
        targetDistanceKm: null,
        restSeconds: this.optionalNumber(exercise.restSeconds),
        notes: exercise.notes ?? '',
        setTargets: []
      }));

    return {
      name: raw.name ?? '',
      description: raw.description ?? '',
      goalFocus: raw.goalFocus ?? 'GENERAL_FITNESS',
      workoutType: raw.workoutType ?? 'STRENGTH',
      difficulty: raw.difficulty ?? 'BEGINNER',
      estimatedDurationMinutes: this.optionalNumber(raw.estimatedDurationMinutes),
      exercises
    };
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
    this.planExercises.push(this.createExerciseGroup());
    this.exercisePickerStates.set({ 0: this.emptyExercisePickerState() });
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

  private timeOf(session: WorkoutSession): number {
    const value = session.completedAt || session.startedAt;
    const time = value ? new Date(value).getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
  }

  private completedSessions(): WorkoutSession[] {
    return this.sessions()
      .filter(isCompletedSession)
      .sort((a, b) => this.timeOf(b) - this.timeOf(a));
  }

  private distinctSessionValues(key: 'workoutType' | 'status'): string[] {
    return [...new Set(this.sessions().map((session) => session[key]).filter(Boolean))].sort((a, b) =>
      this.formatLabel(a).localeCompare(this.formatLabel(b))
    );
  }

  private matchesDuration(session: WorkoutSession, filter: HistoryDurationFilter): boolean {
    if (!filter) {
      return true;
    }
    const minutes = session.durationMinutes ?? 0;
    if (filter === 'lt30') {
      return minutes < 30;
    }
    if (filter === '30to60') {
      return minutes >= 30 && minutes <= 60;
    }
    return minutes > 60;
  }

  private dateStart(value: string): number | null {
    if (!value) {
      return null;
    }
    const time = new Date(`${value}T00:00:00`).getTime();
    return Number.isNaN(time) ? null : time;
  }

  private dateEnd(value: string): number | null {
    if (!value) {
      return null;
    }
    const time = new Date(`${value}T23:59:59.999`).getTime();
    return Number.isNaN(time) ? null : time;
  }

  private matchesDateRange(sessionTime: number, from: number | null, to: number | null): boolean {
    if (from === null && to === null) {
      return true;
    }
    return sessionTime > 0 && (from === null || sessionTime >= from) && (to === null || sessionTime <= to);
  }

  private toDurationFilter(value: string): HistoryDurationFilter {
    return value === 'lt30' || value === '30to60' || value === 'gt60' ? value : '';
  }

  private emptyExercisePickerState(): ExercisePickerState {
    return {
      inputValue: '',
      query: '',
      results: [],
      loading: false,
      error: null,
      open: false,
      activeIndex: -1
    };
  }

  private ensureExercisePickerStates(): void {
    this.planExercises.controls.forEach((_, index) => this.ensureExercisePickerState(index));
  }

  private ensureExercisePickerState(index: number): void {
    if (!this.exercisePickerStates()[index]) {
      this.setExercisePickerState(index, this.emptyExercisePickerState());
    }
  }

  private setExercisePickerState(index: number, patch: Partial<ExercisePickerState>): void {
    this.exercisePickerStates.update((states) => ({
      ...states,
      [index]: {
        ...this.emptyExercisePickerState(),
        ...states[index],
        ...patch
      }
    }));
  }

  private moveExercisePickerActive(index: number, delta: number): void {
    const state = this.exercisePickerState(index);
    if (!state.open) {
      this.setExercisePickerState(index, { open: true });
      return;
    }
    if (!state.results.length) {
      return;
    }
    const nextIndex = (state.activeIndex + delta + state.results.length) % state.results.length;
    this.setExercisePickerState(index, { activeIndex: nextIndex });
  }

  private reindexExercisePickerStates(removedIndex: number): void {
    const nextStates: Record<number, ExercisePickerState> = {};
    Object.entries(this.exercisePickerStates()).forEach(([key, state]) => {
      const index = Number(key);
      if (index < removedIndex) {
        nextStates[index] = state;
      } else if (index > removedIndex) {
        nextStates[index - 1] = state;
      }
    });
    this.exercisePickerStates.set(nextStates);
  }
}
