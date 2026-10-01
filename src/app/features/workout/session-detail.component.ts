import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators
} from '@angular/forms';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  Exercise,
  ExerciseMetadata,
  UpsertWorkoutSessionRequest,
  WorkoutExerciseLog,
  WorkoutExerciseLogInput,
  WorkoutExerciseSetLog,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { formatKm } from '../dashboard/brief/brief-duration';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { WorkoutLiveService } from './workout-live.service';
import { caloriesLabel, deriveDurationMinutes, sessionDurationLabel } from './workout-session.util';

type ExerciseSetEditGroup = FormGroup<{
  reps: FormControl<number | null>;
  weightKg: FormControl<number | null>;
  durationSeconds: FormControl<number | null>;
  distanceKm: FormControl<number | null>;
  restSeconds: FormControl<number | null>;
  perceivedExertion: FormControl<number | null>;
  notes: FormControl<string | null>;
}>;

type ExerciseEditGroup = FormGroup<{
  exerciseId: FormControl<string>;
  exerciseNameSnapshot: FormControl<string>;
  distanceKm: FormControl<number | null>;
  durationSeconds: FormControl<number | null>;
  averageHeartRate: FormControl<number | null>;
  maxHeartRate: FormControl<number | null>;
  notes: FormControl<string | null>;
  sets: FormArray<ExerciseSetEditGroup>;
}>;

const integerOrBlank: ValidatorFn = (control) => {
  const value = control.value as number | null;
  return value == null || Number.isInteger(value) ? null : { integer: true };
};

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
  private readonly live = inject(WorkoutLiveService);

  @Input() sessionId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<WorkoutSessionDetail>();
  @Output() deleted = new EventEmitter<void>();
  @Output() repeated = new EventEmitter<WorkoutSessionDetail>();

  readonly session = signal<WorkoutSessionDetail | null>(null);
  readonly metadata = signal<ExerciseMetadata | null>(null);
  readonly exercises = signal<Exercise[]>([]);
  readonly loading = signal(false);
  readonly editing = signal(false);
  readonly exerciseEditing = signal(false);
  readonly saving = signal(false);

  readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    workoutType: ['', Validators.required],
    caloriesBurned: [null as number | null, [Validators.min(0)]],
    perceivedExertion: [null as number | null, [Validators.min(1), Validators.max(10)]],
    notes: ['', Validators.maxLength(1000)],
    // The time of day the workout ended (HH:mm), for a completed session.
    endedAt: ['']
  });

  readonly exerciseEditForm = new FormGroup({
    exercises: new FormArray<ExerciseEditGroup>([])
  });

  readonly addExerciseForm = this.fb.nonNullable.group({
    exerciseId: ['', Validators.required]
  });

  ngOnInit(): void {
    this.loadMetadata();
    this.loadExercises();
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
      caloriesBurned: session.caloriesBurned,
      perceivedExertion: session.perceivedExertion,
      notes: session.notes,
      endedAt: session.status === 'COMPLETED' ? this.clockTime(session.completedAt) : ''
    });
    this.editing.set(true);
    this.exerciseEditing.set(false);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  startExerciseEdit(): void {
    const session = this.session();
    if (!session || !this.canEditExercises(session) || this.saving()) {
      return;
    }

    this.resetExerciseEditForm(session);
    this.editing.set(false);
    this.exerciseEditing.set(true);
  }

  cancelExerciseEdit(): void {
    this.exerciseEditing.set(false);
    this.addExerciseForm.reset({ exerciseId: '' });
  }

  addExercise(): void {
    this.addExerciseForm.markAllAsTouched();
    const exerciseId = this.addExerciseForm.controls.exerciseId.value;
    if (!exerciseId || this.addExerciseForm.invalid) {
      return;
    }

    const exercise = this.exercises().find((option) => option.exerciseId === exerciseId);
    this.exerciseForms.push(
      this.createExerciseGroup({
        exerciseLogId: '',
        exerciseId,
        exerciseNameSnapshot: exercise?.name ?? 'Exercise',
        sequence: this.exerciseForms.length + 1,
        performedSets: null,
        performedReps: null,
        totalVolumeKg: null,
        distanceKm: null,
        durationSeconds: null,
        averageHeartRate: null,
        maxHeartRate: null,
        notes: '',
        sets: [],
        videoUrl: exercise?.videoUrl ?? null,
        animationUrl: exercise?.animationUrl ?? null,
        images: exercise?.imageUrls ?? []
      })
    );
    this.addExerciseForm.reset({ exerciseId: '' });
  }

  removeExercise(exerciseIndex: number): void {
    const exercise = this.exerciseForms.at(exerciseIndex);
    if (!exercise) {
      return;
    }
    const name = exercise.controls.exerciseNameSnapshot.value;
    if (!window.confirm(`Remove ${name}?`)) {
      return;
    }
    this.exerciseForms.removeAt(exerciseIndex);
  }

  moveExercise(exerciseIndex: number, direction: -1 | 1): void {
    const nextIndex = exerciseIndex + direction;
    if (nextIndex < 0 || nextIndex >= this.exerciseForms.length) {
      return;
    }
    const exercise = this.exerciseForms.at(exerciseIndex);
    this.exerciseForms.removeAt(exerciseIndex);
    this.exerciseForms.insert(nextIndex, exercise);
  }

  addSet(exerciseIndex: number): void {
    this.exerciseSetArray(exerciseIndex).push(this.createSetGroup());
  }

  removeSet(exerciseIndex: number, setIndex: number): void {
    const setNumber = setIndex + 1;
    if (!window.confirm(`Remove set ${setNumber}?`)) {
      return;
    }
    this.exerciseSetArray(exerciseIndex).removeAt(setIndex);
  }

  saveExerciseEdit(): void {
    const session = this.session();
    this.exerciseEditForm.markAllAsTouched();
    if (!session?.sessionId || !this.canEditExercises(session) || this.exerciseEditForm.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    const request = this.buildExerciseUpdateRequest(session);
    this.dataService.updateSession(session.sessionId, request).subscribe({
      next: (updated) => {
        this.session.set(updated);
        this.resetExerciseEditForm(updated);
        this.exerciseEditing.set(false);
        this.toast.success('Exercises updated.');
        this.updated.emit(updated);
        this.refreshSavedSession(updated.sessionId);
      },
      error: () => {
        this.toast.error('Unable to update exercises. Please retry.');
        this.saving.set(false);
      },
      complete: () => this.saving.set(false)
    });
  }

  saveEdit(): void {
    const session = this.session();
    this.editForm.markAllAsTouched();
    if (!session?.sessionId || this.editForm.invalid || this.saving()) {
      return;
    }

    if (this.endedAtBeforeStart(session)) {
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
        this.refreshSavedSession(updated.sessionId);
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
    this.live.repeatSession(session.sessionId).subscribe({
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

  formatDuration(session: WorkoutSessionDetail): string {
    return sessionDurationLabel(session);
  }

  formatDistance(km: number | null | undefined): string {
    return formatKm(km);
  }

  formatCalories(value: number | null | undefined): string {
    return caloriesLabel(value);
  }

  canEditExercises(session: WorkoutSessionDetail | null = this.session()): boolean {
    return session?.status === 'COMPLETED';
  }

  exerciseEditUnavailableLabel(session: WorkoutSessionDetail): string {
    return this.canEditExercises(session) ? 'Edit recorded exercises and sets' : 'Only completed sessions can edit exercises';
  }

  /** One line for a workout the server closed by itself, or null for any other. */
  autoClosedLine(session: WorkoutSessionDetail): string | null {
    if (!session.autoClosedAt) {
      return null;
    }
    if (session.status === 'COMPLETED') {
      return `Ended automatically at ${this.clockTime(session.completedAt)}, the time of your last set.`;
    }
    return session.status === 'CANCELLED' ? 'Closed automatically. No set was logged.' : null;
  }

  /** The "Ended at" time sits before the start, which cannot be saved. */
  endedAtBeforeStart(session: WorkoutSessionDetail | null = this.session()): boolean {
    if (!session) {
      return false;
    }
    const ended = this.endedAtInstant(session);
    const started = new Date(session.startedAt).getTime();
    return ended !== null && Number.isFinite(started) && ended.getTime() < started;
  }

  exerciseGroups(): ExerciseEditGroup[] {
    return this.exerciseForms.controls;
  }

  exerciseSetGroups(exerciseIndex: number): ExerciseSetEditGroup[] {
    return this.exerciseSetArray(exerciseIndex).controls;
  }

  exerciseSetNumber(setIndex: number): number {
    return setIndex + 1;
  }

  /** HH:mm in the browser's timezone, or an empty string. */
  private clockTime(value: string | null | undefined): string {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return '';
    }
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  /** The edited end as an instant on the day the workout ended, or null when it is unchanged or blank. */
  private endedAtInstant(session: WorkoutSessionDetail): Date | null {
    const time = this.editForm.controls.endedAt.value;
    if (session.status !== 'COMPLETED' || !/^\d{2}:\d{2}$/.test(time) || time === this.clockTime(session.completedAt)) {
      return null;
    }
    const day = new Date(session.completedAt || session.startedAt);
    if (Number.isNaN(day.getTime())) {
      return null;
    }
    const [hours, minutes] = time.split(':').map(Number);
    day.setHours(hours, minutes, 0, 0);
    return day;
  }

  private loadMetadata(): void {
    this.dataService.getExerciseMetadata().subscribe((metadata) => this.metadata.set(metadata));
  }

  private loadExercises(): void {
    this.dataService.getExercises({ size: 100 }).subscribe((exercises) => this.exercises.set(exercises));
  }

  private loadSession(): void {
    if (!this.sessionId) {
      this.session.set(null);
      return;
    }

    this.loading.set(true);
    this.editing.set(false);
    this.exerciseEditing.set(false);
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
    const completedAt = this.endedAtInstant(session)?.toISOString() ?? session.completedAt;
    const request: UpsertWorkoutSessionRequest = {
      planId: session.planId ?? null,
      name: raw.name.trim(),
      workoutType: raw.workoutType,
      status: session.status,
      source: session.source ?? 'MANUAL',
      startedAt: session.startedAt,
      durationMinutes: deriveDurationMinutes(session.startedAt, completedAt) ?? session.durationMinutes,
      caloriesBurned: raw.caloriesBurned ?? session.caloriesBurned,
      perceivedExertion: raw.perceivedExertion,
      notes: raw.notes.trim() || null,
      exercises: session.exercises.map((exercise) => this.mapExerciseInput(exercise))
    };

    if (session.status === 'COMPLETED') {
      request.completedAt = completedAt;
    }

    return request;
  }

  private buildExerciseUpdateRequest(session: WorkoutSessionDetail): UpsertWorkoutSessionRequest {
    const request: UpsertWorkoutSessionRequest = {
      planId: session.planId ?? null,
      name: session.name,
      workoutType: session.workoutType,
      status: session.status,
      source: session.source ?? 'MANUAL',
      startedAt: session.startedAt,
      durationMinutes: deriveDurationMinutes(session.startedAt, session.completedAt) ?? session.durationMinutes,
      caloriesBurned: session.caloriesBurned,
      perceivedExertion: session.perceivedExertion,
      notes: session.notes?.trim() || null,
      exercises: this.exerciseForms.controls.map((exercise, index) => this.mapEditedExerciseInput(exercise, index))
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
      tempoSeconds: exercise.tempoSeconds ?? null,
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

  private mapEditedExerciseInput(exercise: ExerciseEditGroup, exerciseIndex: number): WorkoutExerciseLogInput {
    const sets = exercise.controls.sets.controls.map((set, setIndex) => ({
      setNumber: setIndex + 1,
      reps: set.controls.reps.value,
      weightKg: set.controls.weightKg.value,
      durationSeconds: set.controls.durationSeconds.value,
      distanceKm: set.controls.distanceKm.value,
      restSeconds: set.controls.restSeconds.value,
      perceivedExertion: set.controls.perceivedExertion.value,
      notes: set.controls.notes.value?.trim() || null
    }));

    return {
      exerciseId: exercise.controls.exerciseId.value,
      sequence: exerciseIndex + 1,
      performedSets: sets.length || null,
      performedReps: this.sumValues(sets.map((set) => set.reps)),
      totalVolumeKg: this.sumVolume(sets),
      distanceKm: exercise.controls.distanceKm.value,
      durationSeconds: exercise.controls.durationSeconds.value,
      averageHeartRate: exercise.controls.averageHeartRate.value,
      maxHeartRate: exercise.controls.maxHeartRate.value,
      notes: exercise.controls.notes.value?.trim() || null,
      // The tempo is not edited here; an exercise keeps the one the workout started with.
      tempoSeconds: this.session()?.exercises.find((log) => log.exerciseId === exercise.controls.exerciseId.value)?.tempoSeconds ?? null,
      sets
    };
  }

  private resetExerciseEditForm(session: WorkoutSessionDetail): void {
    this.exerciseForms.clear();
    session.exercises
      .slice()
      .sort((first, second) => first.sequence - second.sequence)
      .forEach((exercise) => this.exerciseForms.push(this.createExerciseGroup(exercise)));
    this.addExerciseForm.reset({ exerciseId: '' });
  }

  private createExerciseGroup(exercise: WorkoutExerciseLog): ExerciseEditGroup {
    return new FormGroup({
      exerciseId: new FormControl(exercise.exerciseId, { nonNullable: true, validators: Validators.required }),
      exerciseNameSnapshot: new FormControl(exercise.exerciseNameSnapshot, { nonNullable: true }),
      distanceKm: new FormControl<number | null>(exercise.distanceKm),
      durationSeconds: new FormControl<number | null>(exercise.durationSeconds),
      averageHeartRate: new FormControl<number | null>(exercise.averageHeartRate),
      maxHeartRate: new FormControl<number | null>(exercise.maxHeartRate),
      notes: new FormControl<string | null>(exercise.notes || null, Validators.maxLength(300)),
      sets: new FormArray<ExerciseSetEditGroup>(exercise.sets.map((set) => this.createSetGroup(set)))
    });
  }

  private refreshSavedSession(sessionId: string | null | undefined): void {
    if (!sessionId) {
      return;
    }

    this.dataService.getSession(sessionId).subscribe({
      next: (session) => {
        if (session) {
          this.session.set(session);
        }
      }
    });
  }

  private createSetGroup(set?: WorkoutExerciseSetLog): ExerciseSetEditGroup {
    return new FormGroup({
      reps: new FormControl<number | null>(set?.reps ?? null, [Validators.min(0), integerOrBlank]),
      weightKg: new FormControl<number | null>(set?.weightKg ?? null, Validators.min(0)),
      durationSeconds: new FormControl<number | null>(set?.durationSeconds ?? null, Validators.min(0)),
      distanceKm: new FormControl<number | null>(set?.distanceKm ?? null, Validators.min(0)),
      restSeconds: new FormControl<number | null>(set?.restSeconds ?? null, Validators.min(0)),
      perceivedExertion: new FormControl<number | null>(set?.perceivedExertion ?? null, [
        Validators.min(1),
        Validators.max(10)
      ]),
      notes: new FormControl<string | null>(set?.notes || null, Validators.maxLength(300))
    });
  }

  private get exerciseForms(): FormArray<ExerciseEditGroup> {
    return this.exerciseEditForm.controls.exercises;
  }

  private exerciseSetArray(exerciseIndex: number): FormArray<ExerciseSetEditGroup> {
    return this.exerciseForms.at(exerciseIndex).controls.sets;
  }

  private sumValues(values: Array<number | null>): number | null {
    const measured = values.filter((value): value is number => value != null);
    return measured.length ? measured.reduce((total, value) => total + value, 0) : null;
  }

  private sumVolume(sets: Array<{ reps: number | null; weightKg: number | null }>): number | null {
    const volumes = sets
      .filter((set): set is { reps: number; weightKg: number } => set.reps != null && set.weightKg != null)
      .map((set) => set.reps * set.weightKg);
    return volumes.length ? volumes.reduce((total, value) => total + value, 0) : null;
  }
}
