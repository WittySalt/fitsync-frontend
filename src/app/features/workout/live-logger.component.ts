import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  Exercise,
  WorkoutExerciseLog,
  WorkoutExerciseSetLog,
  WorkoutPlan,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';

@Component({
  selector: 'app-live-logger',
  imports: [ReactiveFormsModule, StatePanelComponent],
  templateUrl: './live-logger.component.html',
  styleUrl: './live-logger.component.scss'
})
export class LiveLoggerComponent {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly setForms = new Map<string, ReturnType<LiveLoggerComponent['createSetForm']>>();

  @Input() plans: WorkoutPlan[] = [];
  @Input() activePlan: WorkoutPlan | null = null;
  @Input() exercises: Exercise[] = [];
  @Output() completed = new EventEmitter<WorkoutSessionDetail>();
  @Output() cancelled = new EventEmitter<WorkoutSessionDetail>();

  readonly session = signal<WorkoutSessionDetail | null>(null);
  readonly busy = signal(false);
  readonly addingExercise = signal(false);
  readonly savingSet = signal<string | null>(null);

  readonly planForm = this.fb.nonNullable.group({
    planId: ['']
  });

  readonly adHocForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    workoutType: ['STRENGTH', Validators.required]
  });

  readonly exerciseForm = this.fb.nonNullable.group({
    exerciseId: ['', Validators.required]
  });

  readonly canWrite = computed(() => {
    const status = this.session()?.status;
    return status === 'PLANNED' || status === 'IN_PROGRESS';
  });

  planOptions(): WorkoutPlan[] {
    const options = new Map<string, WorkoutPlan>();
    if (this.activePlan?.planId) {
      options.set(this.activePlan.planId, this.activePlan);
    }
    this.plans
      .filter((plan) => plan.planId && plan.status !== 'ARCHIVED')
      .forEach((plan) => options.set(plan.planId!, plan));
    return [...options.values()];
  }

  startSelectedPlan(): void {
    const planId = this.planForm.controls.planId.value || this.activePlan?.planId;
    if (!planId || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.dataService.startWorkoutPlan(planId).subscribe({
      next: (session) => {
        this.setSession(session);
        this.toast.success('Workout started.');
      },
      error: () => this.toast.error('Unable to start this plan. Please retry.'),
      complete: () => this.busy.set(false)
    });
  }

  startAdHoc(): void {
    this.adHocForm.markAllAsTouched();
    if (this.adHocForm.invalid || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.dataService.startAdHocSession(this.adHocForm.getRawValue()).subscribe({
      next: (session) => {
        this.setSession(session);
        this.toast.success('Workout started.');
      },
      error: () => this.toast.error('Unable to start a workout. Please retry.'),
      complete: () => this.busy.set(false)
    });
  }

  addExercise(): void {
    this.exerciseForm.markAllAsTouched();
    const session = this.session();
    const exerciseId = this.exerciseForm.controls.exerciseId.value;
    if (!session?.sessionId || !this.canWrite() || !exerciseId || this.addingExercise()) {
      return;
    }

    this.addingExercise.set(true);
    this.dataService
      .addSessionExercise(session.sessionId, {
        exerciseId,
        sequence: session.exercises.length + 1,
        performedSets: null,
        performedReps: null,
        totalVolumeKg: null,
        distanceKm: null,
        durationSeconds: null,
        averageHeartRate: null,
        maxHeartRate: null,
        notes: null,
        sets: []
      })
      .subscribe({
        next: (updated) => {
          this.setSession(updated);
          this.exerciseForm.reset({ exerciseId: '' });
          this.toast.success('Exercise added.');
        },
        error: () => this.toast.error('Unable to add exercise. Please retry.'),
        complete: () => this.addingExercise.set(false)
      });
  }

  setForm(log: WorkoutExerciseLog, set?: WorkoutExerciseSetLog) {
    const setNumber = set?.setNumber ?? this.nextSetNumber(log);
    const key = this.formKey(log.exerciseLogId, setNumber);
    const existing = this.setForms.get(key);
    if (existing) {
      return existing;
    }

    const form = this.createSetForm(set);
    this.setForms.set(key, form);
    return form;
  }

  saveSet(log: WorkoutExerciseLog, set?: WorkoutExerciseSetLog): void {
    const session = this.session();
    const setNumber = set?.setNumber ?? this.nextSetNumber(log);
    const key = this.formKey(log.exerciseLogId, setNumber);
    const form = this.setForm(log, set);
    form.markAllAsTouched();
    if (!session?.sessionId || !this.canWrite() || form.invalid || this.savingSet()) {
      return;
    }

    this.savingSet.set(key);
    this.dataService.upsertSessionSet(session.sessionId, log.exerciseLogId, setNumber, form.getRawValue()).subscribe({
      next: (updated) => {
        this.setSession(updated);
        this.toast.success('Set saved.');
      },
      error: () => this.toast.error('Unable to save this set. Please retry.'),
      complete: () => this.savingSet.set(null)
    });
  }

  completeSession(): void {
    const session = this.session();
    if (!session?.sessionId || !this.canWrite() || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.dataService.completeSession(session.sessionId).subscribe({
      next: (updated) => {
        this.setSession(updated);
        this.toast.success('Workout completed.');
        this.completed.emit(updated);
      },
      error: () => this.toast.error('Unable to complete workout. Please retry.'),
      complete: () => this.busy.set(false)
    });
  }

  cancelSession(): void {
    const session = this.session();
    if (!session?.sessionId || !this.canWrite() || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.dataService.cancelSession(session.sessionId).subscribe({
      next: (updated) => {
        this.setSession(updated);
        this.toast.success('Workout cancelled.');
        this.cancelled.emit(updated);
      },
      error: () => this.toast.error('Unable to cancel workout. Please retry.'),
      complete: () => this.busy.set(false)
    });
  }

  nextSetNumber(log: WorkoutExerciseLog): number {
    return Math.max(0, ...log.sets.map((set) => set.setNumber)) + 1;
  }

  formatLabel(value: string | null | undefined): string {
    return (value ?? '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatNumber(value: number | null | undefined, unit = ''): string {
    if (value == null) {
      return '—';
    }
    return `${value}${unit}`;
  }

  private setSession(session: WorkoutSessionDetail): void {
    this.session.set(session);
    if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      this.setForms.clear();
    }
  }

  private createSetForm(set?: WorkoutExerciseSetLog) {
    return this.fb.group({
      reps: [set?.reps ?? null as number | null, [Validators.min(0)]],
      weightKg: [set?.weightKg ?? null as number | null, [Validators.min(0)]],
      durationSeconds: [set?.durationSeconds ?? null as number | null, [Validators.min(0)]],
      distanceKm: [set?.distanceKm ?? null as number | null, [Validators.min(0)]],
      restSeconds: [set?.restSeconds ?? null as number | null, [Validators.min(0)]],
      perceivedExertion: [set?.perceivedExertion ?? null as number | null, [Validators.min(1), Validators.max(10)]],
      notes: [set?.notes ?? null as string | null, Validators.maxLength(300)]
    });
  }

  private formKey(exerciseLogId: string, setNumber: number): string {
    return `${exerciseLogId}:${setNumber}`;
  }
}
