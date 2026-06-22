import { HttpEventType } from '@angular/common/http';
import { Component, EventEmitter, OnInit, Output, WritableSignal, computed, inject, signal } from '@angular/core';
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
import { ExerciseVideoComponent, isAllowedEmbedVideoUrl } from './exercise-video.component';

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
  imports: [ReactiveFormsModule, FsChartComponent, StatePanelComponent, ExerciseVideoComponent],
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
  readonly pageSize = signal(20);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly editingExercise = signal<Exercise | null>(null);
  readonly selectedExercise = signal<Exercise | null>(null);
  readonly selectedExerciseDetail = signal<ExerciseDetail | null>(null);
  readonly exerciseRecords = signal<ExerciseRecords | null>(null);
  readonly exerciseHistory = signal<ExerciseHistoryEntry[]>([]);
  readonly exerciseDetailLoading = signal(false);
  readonly mediaFailed = signal(false);
  readonly createVideoFile = signal<File | null>(null);
  readonly editVideoFile = signal<File | null>(null);
  readonly createUploadProgress = signal<number | null>(null);
  readonly editUploadProgress = signal<number | null>(null);
  readonly createVideoError = signal('');
  readonly editVideoError = signal('');

  private readonly allowedVideoTypes = new Set(['video/mp4', 'video/webm']);
  private readonly maxVideoBytes = 30 * 1024 * 1024;

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
    difficulty: ['', Validators.required],
    videoMode: ['url'],
    videoUrl: ['', Validators.maxLength(500)]
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', Validators.maxLength(1000)],
    exerciseType: ['', Validators.required],
    primaryMuscleGroup: ['', Validators.required],
    equipment: ['', Validators.required],
    difficulty: ['', Validators.required],
    videoMode: ['url'],
    videoUrl: ['', Validators.maxLength(500)]
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
      difficulty: exercise.difficulty,
      videoMode: 'url',
      videoUrl: exercise.videoUrl && isAllowedEmbedVideoUrl(exercise.videoUrl) ? exercise.videoUrl : ''
    });
    this.editVideoFile.set(null);
    this.editUploadProgress.set(null);
    this.editVideoError.set('');
  }

  cancelEdit(): void {
    this.editingExercise.set(null);
    this.editForm.reset({
      name: '',
      description: '',
      exerciseType: '',
      primaryMuscleGroup: '',
      equipment: '',
      difficulty: '',
      videoMode: 'url',
      videoUrl: ''
    });
    this.editVideoFile.set(null);
    this.editUploadProgress.set(null);
    this.editVideoError.set('');
  }

  createExercise(): void {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid || this.saving() || !this.validateVideoUrl(this.createForm.getRawValue(), this.createVideoError)) {
      return;
    }

    const videoFile = this.createVideoFile();
    this.saving.set(true);
    this.dataService.createExercise(this.normalizeCreate(this.createForm.getRawValue())).subscribe({
      next: (exercise) => {
        if (videoFile && exercise.exerciseId) {
          this.uploadVideoForExercise(exercise.exerciseId, videoFile, 'create', () => this.finishCreateSuccess());
          return;
        }
        this.finishCreateSuccess();
      },
      error: () => {
        this.toast.error('Unable to create exercise. Check the code and retry.');
        this.saving.set(false);
      }
    });
  }

  updateExercise(): void {
    const exercise = this.editingExercise();
    this.editForm.markAllAsTouched();
    if (!exercise?.exerciseId || this.editForm.invalid || this.saving() || !this.validateVideoUrl(this.editForm.getRawValue(), this.editVideoError)) {
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

  uploadEditingVideo(): void {
    const exercise = this.editingExercise();
    const file = this.editVideoFile();
    if (!exercise?.exerciseId || !file || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.uploadVideoForExercise(exercise.exerciseId, file, 'edit', (updatedExercise) => {
      this.toast.success('Exercise video uploaded.');
      this.editingExercise.set(updatedExercise);
      if (this.selectedExercise()?.exerciseId === updatedExercise.exerciseId) {
        this.selectedExercise.set(updatedExercise);
      }
      if (this.selectedExerciseDetail()?.exerciseId === updatedExercise.exerciseId) {
        this.selectedExerciseDetail.set({
          ...this.selectedExerciseDetail()!,
          videoUrl: updatedExercise.videoUrl ?? null
        });
      }
      this.editVideoFile.set(null);
      this.loadExercises();
      this.saving.set(false);
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
    this.scrollToTop();
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
    this.scrollToTop();
  }

  markMediaFailed(): void {
    this.mediaFailed.set(true);
  }

  selectCreateVideoFile(event: Event): void {
    this.selectVideoFile(event, this.createVideoFile, this.createVideoError, this.createUploadProgress);
  }

  selectEditVideoFile(event: Event): void {
    this.selectVideoFile(event, this.editVideoFile, this.editVideoError, this.editUploadProgress);
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

  setPageSize(size: number): void {
    if (![10, 20, 50].includes(size) || size === this.pageSize()) {
      return;
    }
    this.pageSize.set(size);
    this.page.set(0);
    this.loadExercises();
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
      size: this.pageSize()
    };
  }

  private scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private normalizeCreate(value: CreateExerciseRequest & { videoMode?: string; videoUrl?: string }): CreateExerciseRequest {
    const { videoMode, videoUrl, ...exercise } = value;
    const normalized: CreateExerciseRequest = {
      ...exercise,
      code: value.code.trim().toUpperCase(),
      name: value.name.trim(),
      description: value.description.trim()
    };
    const embedUrl = videoUrl?.trim();
    if (videoMode === 'url' && embedUrl) {
      normalized.videoUrl = embedUrl;
    }
    return normalized;
  }

  private normalizeUpdate(value: UpdateExerciseRequest & { videoMode?: string; videoUrl?: string }): UpdateExerciseRequest {
    const { videoMode, videoUrl, ...exercise } = value;
    const normalized: UpdateExerciseRequest = {
      ...exercise,
      name: value.name.trim(),
      description: value.description.trim()
    };
    const embedUrl = videoUrl?.trim();
    if (videoMode === 'url' && embedUrl) {
      normalized.videoUrl = embedUrl;
    }
    return normalized;
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
      .split('_')
      .filter((segment) => segment.length > 0)
      .join('_')
      .toUpperCase();
    this.createForm.controls.code.setValue(slug ? `CUSTOM_${slug}` : '', { emitEvent: false });
  }

  private finishCreateSuccess(): void {
    this.toast.success('Exercise created.');
    this.createForm.reset({
      code: '',
      name: '',
      description: '',
      exerciseType: this.metadata()?.exerciseTypes[0] || '',
      primaryMuscleGroup: this.metadata()?.muscleGroups[0] || '',
      equipment: this.metadata()?.equipment[0] || '',
      difficulty: this.metadata()?.difficulties[0] || '',
      videoMode: 'url',
      videoUrl: ''
    });
    this.createVideoFile.set(null);
    this.createUploadProgress.set(null);
    this.createVideoError.set('');
    this.loadExercises();
    this.saving.set(false);
  }

  private validateVideoUrl(value: { videoMode?: string; videoUrl?: string }, errorSignal: WritableSignal<string>): boolean {
    const videoUrl = value.videoUrl?.trim();
    if (value.videoMode !== 'url' || !videoUrl) {
      errorSignal.set('');
      return true;
    }
    if (isAllowedEmbedVideoUrl(videoUrl)) {
      errorSignal.set('');
      return true;
    }
    errorSignal.set('Use a YouTube or Vimeo URL.');
    return false;
  }

  private selectVideoFile(
    event: Event,
    fileSignal: WritableSignal<File | null>,
    errorSignal: WritableSignal<string>,
    progressSignal: WritableSignal<number | null>
  ): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    progressSignal.set(null);
    if (!file) {
      fileSignal.set(null);
      errorSignal.set('');
      return;
    }
    if (!this.allowedVideoTypes.has(file.type)) {
      fileSignal.set(null);
      errorSignal.set('Use an MP4 or WebM file.');
      input.value = '';
      return;
    }
    if (file.size > this.maxVideoBytes) {
      fileSignal.set(null);
      errorSignal.set('Video must be 30 MB or smaller.');
      input.value = '';
      return;
    }
    fileSignal.set(file);
    errorSignal.set('');
  }

  private uploadVideoForExercise(
    exerciseId: string,
    file: File,
    target: 'create' | 'edit',
    onSuccess: (exercise: Exercise) => void
  ): void {
    const progressSignal = target === 'create' ? this.createUploadProgress : this.editUploadProgress;
    const errorSignal = target === 'create' ? this.createVideoError : this.editVideoError;
    progressSignal.set(0);
    this.dataService.uploadExerciseVideo(exerciseId, file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total ?? file.size;
          progressSignal.set(total > 0 ? Math.round((event.loaded / total) * 100) : 0);
          return;
        }
        if (event.type === HttpEventType.Response) {
          progressSignal.set(100);
          if (event.body) {
            onSuccess(event.body);
          }
        }
      },
      error: () => {
        errorSignal.set('Unable to upload video. Please retry.');
        this.toast.error('Unable to upload exercise video. Please retry.');
        this.saving.set(false);
      }
    });
  }
}
