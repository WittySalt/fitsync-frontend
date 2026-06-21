import { Component, EventEmitter, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  CreateExerciseRequest,
  Exercise,
  ExerciseDetail,
  ExerciseHistoryEntry,
  ExerciseMetadata,
  ExerciseRecordValue,
  ExerciseRecords,
  ExerciseSearchOptions,
  UpdateExerciseRequest
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { FsChartComponent, FsChartSeries } from '../../shared/fs-chart.component';
import { StatePanelComponent } from '../../shared/state-panel.component';

interface RecordCard {
  label: string;
  value: string;
  detail: string;
}

interface HistoryTrend {
  labels: string[];
  series: FsChartSeries[];
}

@Component({
  selector: 'app-exercise-library',
  imports: [ReactiveFormsModule, FsChartComponent, StatePanelComponent],
  templateUrl: './exercise-library.component.html',
  styleUrl: './exercise-library.component.scss'
})
export class ExerciseLibraryComponent implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  @Output() exercisesChanged = new EventEmitter<Exercise[]>();

  readonly metadata = signal<ExerciseMetadata | null>(null);
  readonly exercises = signal<Exercise[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly editingExercise = signal<Exercise | null>(null);
  readonly selectedExercise = signal<Exercise | null>(null);
  readonly selectedExerciseDetail = signal<ExerciseDetail | null>(null);
  readonly exerciseRecords = signal<ExerciseRecords | null>(null);
  readonly exerciseHistory = signal<ExerciseHistoryEntry[]>([]);
  readonly exerciseDetailLoading = signal(false);
  readonly mediaFailed = signal(false);

  readonly filterForm = this.fb.nonNullable.group({
    q: [''],
    exerciseType: [''],
    primaryMuscleGroup: [''],
    equipment: [''],
    difficulty: ['']
  });

  readonly createForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', Validators.maxLength(1000)],
    exerciseType: ['', Validators.required],
    primaryMuscleGroup: ['', Validators.required],
    equipment: ['', Validators.required],
    difficulty: ['', Validators.required]
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', Validators.maxLength(1000)],
    exerciseType: ['', Validators.required],
    primaryMuscleGroup: ['', Validators.required],
    equipment: ['', Validators.required],
    difficulty: ['', Validators.required]
  });

  readonly recordCards = computed<RecordCard[]>(() => {
    const records = this.exerciseRecords();
    return [
      this.recordCard('Max weight', records?.maxWeightKg ?? null, 'kg', 1),
      this.recordCard('Max reps', records?.maxReps ?? null, 'reps', 0),
      this.recordCard('Estimated 1RM', records?.estimatedOneRepMaxKg ?? null, 'kg', 1),
      this.recordCard('Single-set volume', records?.maxSingleSetVolumeKg ?? null, 'kg', 1),
      this.recordCard('Best session volume', records?.bestSessionVolumeKg ?? null, 'kg', 1)
    ];
  });

  readonly displayExercise = computed<Exercise | ExerciseDetail | null>(
    () => this.selectedExerciseDetail() ?? this.selectedExercise()
  );

  readonly recordsEmpty = computed(() => this.recordCards().every((record) => record.detail === 'No data yet'));

  readonly mediaUrl = computed(() => {
    const exercise = this.displayExercise();
    if (!exercise || this.mediaFailed()) {
      return null;
    }
    return exercise.images?.[0]?.url ?? exercise.animationUrl ?? null;
  });

  readonly sortedHistory = computed(() =>
    [...this.exerciseHistory()].sort((a, b) => {
      const left = new Date(a.completedAt || a.startedAt).getTime();
      const right = new Date(b.completedAt || b.startedAt).getTime();
      return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
    })
  );

  readonly historyTrend = computed<HistoryTrend>(() => {
    const points = new Map<string, { label: string; time: number; value: number }>();

    this.exerciseHistory().forEach((entry) => {
      if (entry.weightKg == null) {
        return;
      }
      const dateValue = entry.completedAt || entry.startedAt;
      const time = dateValue ? new Date(dateValue).getTime() : NaN;
      if (Number.isNaN(time)) {
        return;
      }

      const key = entry.sessionId || `${entry.sessionName}-${dateValue}`;
      const existing = points.get(key);
      if (!existing || entry.weightKg > existing.value) {
        points.set(key, {
          label: this.formatDateOnly(dateValue),
          time,
          value: entry.weightKg
        });
      }
    });

    const sorted = [...points.values()].sort((a, b) => a.time - b.time);
    return {
      labels: sorted.map((point) => point.label),
      series: sorted.length
        ? [
            {
              label: 'Max weight',
              values: sorted.map((point) => point.value),
              colorToken: '--accent'
            }
          ]
        : []
    };
  });

  ngOnInit(): void {
    this.loadMetadata();
    this.loadExercises();
    this.filterForm.valueChanges.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => {
      this.page.set(0);
      this.loadExercises();
    });
    this.createForm.controls.name.valueChanges.pipe(debounceTime(120)).subscribe((name) => this.suggestCode(name));
  }

  formatLabel(value: string | null | undefined): string {
    return (value ?? '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatLabels(values: string[] | null | undefined): string {
    return (values ?? []).map((value) => this.formatLabel(value)).filter(Boolean).join(', ');
  }

  formatDateTime(value: string | null | undefined): string {
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
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  formatMetric(value: number | null | undefined, unit: string, digits = 0): string {
    if (value == null) {
      return '-';
    }
    return `${value.toFixed(digits)} ${unit}`;
  }

  startEdit(exercise: Exercise): void {
    if (!exercise.custom) {
      return;
    }
    this.editingExercise.set(exercise);
    this.editForm.setValue({
      name: exercise.name,
      description: exercise.description,
      exerciseType: exercise.exerciseType,
      primaryMuscleGroup: exercise.primaryMuscleGroup,
      equipment: exercise.equipment,
      difficulty: exercise.difficulty
    });
  }

  cancelEdit(): void {
    this.editingExercise.set(null);
    this.editForm.reset({
      name: '',
      description: '',
      exerciseType: '',
      primaryMuscleGroup: '',
      equipment: '',
      difficulty: ''
    });
  }

  createExercise(): void {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.dataService.createExercise(this.normalizeCreate(this.createForm.getRawValue())).subscribe({
      next: () => {
        this.toast.success('Exercise created.');
        this.createForm.reset({
          code: '',
          name: '',
          description: '',
          exerciseType: '',
          primaryMuscleGroup: '',
          equipment: '',
          difficulty: ''
        });
        this.loadExercises();
      },
      error: () => {
        this.toast.error('Unable to create exercise. Check the code and retry.');
        this.saving.set(false);
      },
      complete: () => this.saving.set(false)
    });
  }

  updateExercise(): void {
    const exercise = this.editingExercise();
    this.editForm.markAllAsTouched();
    if (!exercise?.exerciseId || this.editForm.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.dataService.updateExercise(exercise.exerciseId, this.normalizeUpdate(this.editForm.getRawValue())).subscribe({
      next: () => {
        this.toast.success('Exercise updated.');
        this.cancelEdit();
        this.loadExercises();
      },
      error: () => {
        this.toast.error('Unable to update exercise. Please retry.');
        this.saving.set(false);
      },
      complete: () => this.saving.set(false)
    });
  }

  archiveExercise(exercise: Exercise): void {
    if (!exercise.custom || !exercise.exerciseId || this.saving()) {
      return;
    }
    if (!window.confirm(`Archive ${exercise.name}?`)) {
      return;
    }

    this.saving.set(true);
    this.dataService.archiveExercise(exercise.exerciseId).subscribe({
      next: () => {
        this.toast.success('Exercise archived.');
        this.loadExercises();
      },
      error: () => {
        this.toast.error('Unable to archive exercise. Please retry.');
        this.saving.set(false);
      },
      complete: () => this.saving.set(false)
    });
  }

  selectExercise(exercise: Exercise): void {
    if (!exercise.exerciseId) {
      return;
    }

    this.selectedExercise.set(exercise);
    this.selectedExerciseDetail.set(null);
    this.exerciseRecords.set(null);
    this.exerciseHistory.set([]);
    this.exerciseDetailLoading.set(true);
    this.mediaFailed.set(false);

    forkJoin({
      detail: this.dataService.getExercise(exercise.exerciseId),
      records: this.dataService.getExerciseRecords(exercise.exerciseId),
      history: this.dataService.getExerciseHistory(exercise.exerciseId)
    }).subscribe({
      next: ({ detail, records, history }) => {
        if (this.selectedExercise()?.exerciseId !== exercise.exerciseId) {
          return;
        }
        this.selectedExerciseDetail.set(detail);
        this.exerciseRecords.set(records);
        this.exerciseHistory.set(history);
        this.exerciseDetailLoading.set(false);
      },
      error: () => {
        this.selectedExerciseDetail.set(null);
        this.exerciseRecords.set(null);
        this.exerciseHistory.set([]);
        this.exerciseDetailLoading.set(false);
      }
    });
  }

  clearSelectedExercise(): void {
    this.selectedExercise.set(null);
    this.selectedExerciseDetail.set(null);
    this.exerciseRecords.set(null);
    this.exerciseHistory.set([]);
    this.mediaFailed.set(false);
  }

  markMediaFailed(): void {
    this.mediaFailed.set(true);
  }

  goToPage(nextPage: number): void {
    const boundedPage = Math.max(0, Math.min(nextPage, Math.max(this.totalPages() - 1, 0)));
    if (boundedPage === this.page() || this.loading()) {
      return;
    }
    this.page.set(boundedPage);
    this.loadExercises();
  }

  prevPage(): void {
    this.goToPage(this.page() - 1);
  }

  nextPage(): void {
    this.goToPage(this.page() + 1);
  }

  private loadMetadata(): void {
    this.dataService.getExerciseMetadata().subscribe((metadata) => {
      this.metadata.set(metadata);
      this.defaultCreateEnums(metadata);
    });
  }

  private loadExercises(): void {
    this.loading.set(true);
    this.dataService.searchExercisesPage(this.searchOptions()).subscribe({
      next: (result) => {
        if (result.totalPages > 0 && result.page >= result.totalPages) {
          this.page.set(result.totalPages - 1);
          this.loadExercises();
          return;
        }
        this.page.set(result.totalPages > 0 ? result.page : 0);
        this.totalPages.set(result.totalPages);
        this.totalElements.set(result.totalElements);
        this.exercises.set(result.items);
        this.exercisesChanged.emit(result.items);
        this.loading.set(false);
      },
      error: () => {
        this.exercises.set([]);
        this.page.set(0);
        this.totalPages.set(0);
        this.totalElements.set(0);
        this.loading.set(false);
      }
    });
  }

  private searchOptions(): ExerciseSearchOptions {
    const raw = this.filterForm.getRawValue();
    return {
      q: raw.q.trim(),
      exerciseType: raw.exerciseType || undefined,
      primaryMuscleGroup: raw.primaryMuscleGroup || undefined,
      equipment: raw.equipment || undefined,
      difficulty: raw.difficulty || undefined,
      page: this.page(),
      size: 24
    };
  }

  private normalizeCreate(value: CreateExerciseRequest): CreateExerciseRequest {
    return {
      ...value,
      code: value.code.trim().toUpperCase(),
      name: value.name.trim(),
      description: value.description.trim()
    };
  }

  private normalizeUpdate(value: UpdateExerciseRequest): UpdateExerciseRequest {
    return {
      ...value,
      name: value.name.trim(),
      description: value.description.trim()
    };
  }

  private formatDateOnly(value: string | null | undefined): string {
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
      year: 'numeric'
    }).format(date);
  }

  private recordCard(label: string, record: ExerciseRecordValue | null, unit: string, digits: number): RecordCard {
    if (!record || record.value == null) {
      return { label, value: '-', detail: 'No data yet' };
    }

    return {
      label,
      value: `${record.value.toFixed(digits)} ${unit}`,
      detail: this.formatDateOnly(record.achievedAt)
    };
  }

  private defaultCreateEnums(metadata: ExerciseMetadata | null): void {
    if (!metadata) {
      return;
    }
    const current = this.createForm.getRawValue();
    this.createForm.patchValue({
      exerciseType: current.exerciseType || metadata.exerciseTypes[0] || '',
      primaryMuscleGroup: current.primaryMuscleGroup || metadata.muscleGroups[0] || '',
      equipment: current.equipment || metadata.equipment[0] || '',
      difficulty: current.difficulty || metadata.difficulties[0] || ''
    });
  }

  private suggestCode(name: string): void {
    if (this.createForm.controls.code.dirty || !name.trim()) {
      return;
    }
    const slug = name
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
    this.createForm.controls.code.setValue(slug ? `CUSTOM_${slug}` : '', { emitEvent: false });
  }
}
