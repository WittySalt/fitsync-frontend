import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  ExerciseMetadata,
  UpsertWorkoutSessionRequest,
  WorkoutExerciseLog,
  WorkoutExerciseLogInput,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';

@Component({
  selector: 'app-session-detail',
  imports: [ReactiveFormsModule, StatePanelComponent],
  templateUrl: './session-detail.component.html',
  styleUrl: './session-detail.component.scss'
})
export class SessionDetailComponent implements OnInit, OnChanges {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  @Input() sessionId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<WorkoutSessionDetail>();
  @Output() deleted = new EventEmitter<void>();
  @Output() repeated = new EventEmitter<WorkoutSessionDetail>();

  readonly session = signal<WorkoutSessionDetail | null>(null);
  readonly metadata = signal<ExerciseMetadata | null>(null);
  readonly loading = signal(false);
  readonly editing = signal(false);
  readonly saving = signal(false);

  readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    workoutType: ['', Validators.required],
    perceivedExertion: [null as number | null, [Validators.min(1), Validators.max(10)]],
    notes: ['', Validators.maxLength(1000)]
  });

  ngOnInit(): void {
    this.loadMetadata();
    this.loadSession();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessionId'] && !changes['sessionId'].firstChange) {
      this.loadSession();
    }
  }

  startEdit(): void {
    const session = this.session();
    if (!session) {
      return;
    }
    this.editForm.setValue({
      name: session.name,
      workoutType: session.workoutType,
      perceivedExertion: session.perceivedExertion,
      notes: session.notes
    });
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  saveEdit(): void {
    const session = this.session();
    this.editForm.markAllAsTouched();
    if (!session?.sessionId || this.editForm.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    const request = this.buildUpdateRequest(session);
    this.dataService.updateSession(session.sessionId, request).subscribe({
      next: (updated) => {
        this.session.set(updated);
        this.editing.set(false);
        this.toast.success('Session updated.');
        this.updated.emit(updated);
      },
      error: () => {
        this.toast.error('Unable to update session. Please retry.');
        this.saving.set(false);
      },
      complete: () => this.saving.set(false)
    });
  }

  deleteSession(): void {
    const session = this.session();
    if (!session?.sessionId || this.saving()) {
      return;
    }
    if (!window.confirm(`Delete ${session.name}?`)) {
      return;
    }

    this.saving.set(true);
    this.dataService.deleteSession(session.sessionId).subscribe({
      next: () => {
        this.toast.success('Session deleted.');
        this.deleted.emit();
        this.closed.emit();
      },
      error: () => {
        this.toast.error('Unable to delete session. Please retry.');
        this.saving.set(false);
      },
      complete: () => this.saving.set(false)
    });
  }

  repeatThis(): void {
    const session = this.session();
    if (!session?.sessionId || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.dataService.repeatSession(session.sessionId).subscribe({
      next: (repeated) => {
        this.toast.success('Workout repeated.');
        this.repeated.emit(repeated);
      },
      error: () => {
        this.toast.error('Unable to repeat session. Please retry.');
        this.saving.set(false);
      },
      complete: () => this.saving.set(false)
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
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return new Intl.DateTimeFormat('en-SG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  formatNumber(value: number | null | undefined, unit = ''): string {
    if (value == null) {
      return '-';
    }
    return `${value}${unit}`;
  }

  private loadMetadata(): void {
    this.dataService.getExerciseMetadata().subscribe((metadata) => this.metadata.set(metadata));
  }

  private loadSession(): void {
    if (!this.sessionId) {
      this.session.set(null);
      return;
    }

    this.loading.set(true);
    this.editing.set(false);
    this.dataService.getSession(this.sessionId).subscribe({
      next: (session) => {
        this.session.set(session);
        if (!session) {
          this.toast.error('Unable to load session detail.');
        }
        this.loading.set(false);
      },
      error: () => {
        this.session.set(null);
        this.toast.error('Unable to load session detail.');
        this.loading.set(false);
      }
    });
  }

  private buildUpdateRequest(session: WorkoutSessionDetail): UpsertWorkoutSessionRequest {
    const raw = this.editForm.getRawValue();
    const request: UpsertWorkoutSessionRequest = {
      planId: session.planId ?? null,
      name: raw.name.trim(),
      workoutType: raw.workoutType,
      status: session.status,
      source: session.source ?? 'MANUAL',
      startedAt: session.startedAt,
      durationMinutes: session.durationMinutes,
      caloriesBurned: session.caloriesBurned,
      perceivedExertion: raw.perceivedExertion,
      notes: raw.notes.trim() || null,
      exercises: session.exercises.map((exercise) => this.mapExerciseInput(exercise))
    };

    if (session.status === 'COMPLETED') {
      request.completedAt = session.completedAt;
    }

    return request;
  }

  private mapExerciseInput(exercise: WorkoutExerciseLog): WorkoutExerciseLogInput {
    return {
      exerciseId: exercise.exerciseId,
      sequence: exercise.sequence,
      performedSets: exercise.performedSets,
      performedReps: exercise.performedReps,
      totalVolumeKg: exercise.totalVolumeKg,
      distanceKm: exercise.distanceKm,
      durationSeconds: exercise.durationSeconds,
      averageHeartRate: exercise.averageHeartRate,
      maxHeartRate: exercise.maxHeartRate,
      notes: exercise.notes || null,
      sets: exercise.sets.map((set) => ({
        setNumber: set.setNumber,
        reps: set.reps,
        weightKg: set.weightKg,
        durationSeconds: set.durationSeconds,
        distanceKm: set.distanceKm,
        restSeconds: set.restSeconds,
        perceivedExertion: set.perceivedExertion,
        notes: set.notes || null
      }))
    };
  }
}
