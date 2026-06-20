import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  Exercise,
  WorkoutPlan,
  WorkoutPlanExerciseInput,
  WorkoutPlanRequest,
  WorkoutPlanStatus,
  WorkoutSession,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ExerciseLibraryComponent } from './exercise-library.component';
import { LiveLoggerComponent } from './live-logger.component';
import { SessionDetailComponent } from './session-detail.component';

interface TrainingMetric {
  label: string;
  value: string;
  detail: string;
  tone: 'green' | 'blue' | 'orange';
}

@Component({
  selector: 'app-workout-page',
  imports: [
    ReactiveFormsModule,
    StatePanelComponent,
    LiveLoggerComponent,
    ExerciseLibraryComponent,
    SessionDetailComponent
  ],
  templateUrl: './workout.page.html',
  styleUrl: './workout.page.scss'
})
export class WorkoutPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly plans = signal<WorkoutPlan[]>([]);
  readonly sessions = signal<WorkoutSession[]>([]);
  readonly exercises = signal<Exercise[]>([]);
  readonly activePlan = signal<WorkoutPlan | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly logFormOpen = signal(false);
  readonly planError = signal<string | null>(null);
  readonly planStatus = signal<WorkoutPlanStatus | null>('ACTIVE');
  readonly editingPlanId = signal<string | null>(null);
  readonly savingPlan = signal(false);
  readonly planMutations = signal<Set<string>>(new Set());
  readonly selectedTab = signal<'overview' | 'plans' | 'history' | 'library'>('overview');
  readonly selectedSessionId = signal<string | null>(null);
  readonly repeatingLatest = signal(false);
  readonly planStatusOptions: Array<WorkoutPlanStatus | null> = ['ACTIVE', 'DRAFT', 'ARCHIVED', null];
  readonly goalFocusOptions = ['GENERAL_FITNESS', 'WEIGHT_LOSS', 'MUSCLE_GAIN', 'STRENGTH', 'ENDURANCE', 'MOBILITY'];
  readonly workoutTypeOptions = ['STRENGTH', 'CARDIO', 'HIIT', 'YOGA', 'PILATES', 'MOBILITY', 'SPORTS', 'CUSTOM'];
  readonly difficultyOptions = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

  readonly planForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', Validators.maxLength(1000)],
    goalFocus: ['GENERAL_FITNESS', Validators.required],
    workoutType: ['STRENGTH', Validators.required],
    difficulty: ['BEGINNER', Validators.required],
    estimatedDurationMinutes: [45, [Validators.required, Validators.min(1)]],
    exercises: this.fb.array([this.createExerciseGroup()])
  });

  readonly workoutTypes = ['STRENGTH', 'CARDIO', 'HIIT', 'MOBILITY', 'SPORT', 'OTHER'];

  readonly logForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    workoutType: ['STRENGTH', Validators.required],
    durationMinutes: [45, [Validators.required, Validators.min(1), Validators.max(600)]],
    caloriesBurned: [350, [Validators.required, Validators.min(0), Validators.max(5000)]],
    perceivedExertion: [7, [Validators.min(1), Validators.max(10)]],
    notes: ['', Validators.maxLength(300)]
  });

  readonly latestSession = computed(() => {
    const sorted = [...this.sessions()].sort((a, b) => this.timeOf(b) - this.timeOf(a));
    return sorted[0] ?? null;
  });

  readonly metrics = computed<TrainingMetric[]>(() => {
    const sessions = this.sessions();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const thisWeek = sessions.filter((session) => this.timeOf(session) >= weekAgo).length;
    const latest = this.latestSession();

    return [
      { label: 'Sessions logged', value: String(sessions.length), detail: 'recent history', tone: 'green' },
      { label: 'This week', value: String(thisWeek), detail: 'in the last 7 days', tone: 'blue' },
      {
        label: 'Last session',
        value: latest ? this.formatDate(latest.completedAt || latest.startedAt) : '—',
        detail: latest ? this.formatLabel(latest.workoutType) : 'none yet',
        tone: 'orange'
      }
    ];
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loadPlans();
    this.loadSessions();
    this.loadExercises();
    this.loadActivePlan();
  }

  get planExercises(): FormArray {
    return this.planForm.get('exercises') as FormArray;
  }

  selectPlanStatus(status: WorkoutPlanStatus | null): void {
    this.planStatus.set(status);
    this.loadPlans();
  }

  addPlanExercise(): void {
    this.planExercises.push(this.createExerciseGroup());
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
      return;
    }
    this.planExercises.removeAt(index);
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
    const exercises = plan.exercises.length ? plan.exercises : [null];
    exercises.forEach((exercise) => {
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

  handleLiveWorkoutFinished(): void {
    this.loadSessions();
    this.loadActivePlan();
    this.selectedTab.set('history');
  }

  handleLiveWorkoutCancelled(): void {
    this.loadSessions();
  }

  handleExerciseLibraryChanged(exercises: Exercise[]): void {
    this.exercises.set(exercises);
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

  toggleLogForm(): void {
    this.logFormOpen.update((open) => !open);
  }

  logWorkout(): void {
    this.logForm.markAllAsTouched();
    if (this.logForm.invalid) {
      return;
    }

    this.submitting.set(true);
    this.dataService.saveWorkoutSession(this.logForm.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.logFormOpen.set(false);
        this.logForm.reset({
          name: '',
          workoutType: 'STRENGTH',
          durationMinutes: 45,
          caloriesBurned: 350,
          perceivedExertion: 7,
          notes: ''
        });
        this.toast.success('Workout logged.');
        this.dataService.getWorkoutSessions().subscribe((sessions) => this.sessions.set(sessions));
      },
      error: () => {
        this.submitting.set(false);
        this.toast.error('Unable to log workout. Check your connection and try again.');
      }
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
    this.dataService.getWorkoutSessions().subscribe((sessions) => this.sessions.set(sessions));
  }

  private loadExercises(): void {
    this.dataService.getExercises().subscribe((exercises) => this.exercises.set(exercises));
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
}
