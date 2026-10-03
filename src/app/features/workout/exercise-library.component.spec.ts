import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse, HttpEventType, HttpResponse, HttpUploadProgressEvent } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Exercise, ExerciseDetail, ExerciseHistoryEntry, ExerciseMetadata, PagedExercises } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { ExerciseLibraryComponent } from './exercise-library.component';

const metadata: ExerciseMetadata = {
  exerciseTypes: ['STRENGTH', 'CARDIO'],
  muscleGroups: ['QUADS', 'CHEST'],
  equipment: ['BARBELL', 'DUMBBELL'],
  difficulties: ['BEGINNER', 'INTERMEDIATE'],
  workoutTypes: ['STRENGTH'],
  goalFocuses: ['STRENGTH'],
  sportActivities: []
};

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    exerciseId: 'exercise-1',
    code: 'BACK_SQUAT',
    name: 'Back squat',
    description: 'Lower body compound lift',
    exerciseType: 'STRENGTH',
    primaryMuscleGroup: 'QUADS',
    equipment: 'BARBELL',
    difficulty: 'INTERMEDIATE',
    status: 'ACTIVE',
    custom: false,
    ...overrides
  };
}

function exerciseDetail(overrides: Partial<ExerciseDetail> = {}): ExerciseDetail {
  return {
    ...exercise(),
    images: [],
    imageUrls: [],
    instructions: [],
    secondaryMuscleGroups: [],
    ...overrides
  };
}

function pagedExercises(
  items: Exercise[],
  overrides: Partial<Omit<PagedExercises, 'items'>> = {}
): PagedExercises {
  return {
    items,
    page: 0,
    size: 20,
    totalPages: 1,
    totalElements: items.length,
    ...overrides
  };
}

function historyEntry(overrides: Partial<ExerciseHistoryEntry> = {}) {
  return {
    sessionId: 'session-1',
    exerciseLogId: 'log-1',
    setLogId: 'set-1',
    exerciseId: 'exercise-1',
    exerciseNameSnapshot: 'Back squat',
    sessionName: 'Lower body',
    startedAt: '2026-06-12T10:00:00Z',
    completedAt: '2026-06-12T11:05:00Z',
    sequence: 1,
    setNumber: 1,
    reps: 5,
    weightKg: 100,
    durationSeconds: null,
    distanceKm: null,
    restSeconds: 120,
    perceivedExertion: 7,
    notes: '',
    ...overrides
  };
}

function fileEvent(file: Partial<File> | null): Event {
  return {
    target: {
      files: file ? [file] : [],
      value: file?.name ?? ''
    }
  } as unknown as Event;
}

describe('ExerciseLibraryComponent', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getExerciseMetadata',
      'searchExercisesPage',
      'createExercise',
      'updateExercise',
      'archiveExercise',
      'getExercise',
      'getExerciseRecords',
      'getExerciseHistory',
      'uploadExerciseImage',
      'uploadExerciseVideo'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    dataService.getExerciseMetadata.and.returnValue(of(metadata));
    dataService.searchExercisesPage.and.returnValue(of(pagedExercises([exercise()])));
    dataService.createExercise.and.returnValue(of(exercise({ custom: true })));
    dataService.updateExercise.and.returnValue(of(exercise({ custom: true })));
    dataService.archiveExercise.and.returnValue(of(void 0));
    dataService.getExercise.and.returnValue(of(exerciseDetail()));
    dataService.getExerciseRecords.and.returnValue(of(null));
    dataService.getExerciseHistory.and.returnValue(of([]));
    dataService.uploadExerciseVideo.and.returnValue(
      of(new HttpResponse({ body: exercise({ custom: true, videoUrl: 'https://media.example.test/exercise.mp4' }) }))
    );
    dataService.uploadExerciseImage.and.returnValue(
      of(new HttpResponse({ body: exercise({ custom: true, images: [{ position: 0, url: 'https://media.example.test/exercise.webp' }] }) }))
    );

    await TestBed.configureTestingModule({
      imports: [ExerciseLibraryComponent],
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('disambiguates duplicate names by equipment and exposes a list thumbnail', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    const component = fixture.componentInstance;
    const gobletKb = exercise({ exerciseId: 'a', name: 'Goblet Squat', equipment: 'KETTLEBELL', images: [{ position: 0, url: 'https://media/a.jpg' }] });
    const gobletDb = exercise({ exerciseId: 'b', name: 'Goblet Squat', equipment: 'DUMBBELL' });
    const frontSquat = exercise({ exerciseId: 'c', name: 'Front Squat', equipment: 'BARBELL' });
    component.exercises.set([gobletKb, gobletDb, frontSquat]);

    expect(component.exerciseListName(gobletKb)).toBe('Goblet Squat - Kettlebell');
    expect(component.exerciseListName(frontSquat)).toBe('Front Squat');
    expect(component.exerciseThumbnail(gobletKb)).toBe('https://media/a.jpg');
    expect(component.exerciseThumbnail(frontSquat)).toBeNull();
  });

  it('renders filter and form options from exercise metadata', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    const optionText = Array.from<Element>(fixture.nativeElement.querySelectorAll('option')).map((option) =>
      option.textContent?.trim()
    );

    expect(optionText).toContain('Strength');
    expect(optionText).toContain('Quads');
    expect(optionText).toContain('Barbell');
    expect(optionText).toContain('Intermediate');
  });

  it('switches between browse and create library views', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    const tabs = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.library-view-nav button'));
    expect(tabs[0].getAttribute('aria-pressed')).toBe('true');
    expect(tabs[0].getAttribute('role')).toBeNull();
    expect(fixture.nativeElement.querySelector('.filter-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.exercise-list')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Create custom exercise"]')).toBeNull();

    tabs[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.libraryView()).toBe('create');
    expect(tabs[1].getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('[aria-label="Create custom exercise"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.filter-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('.exercise-list')).toBeNull();

    const cancel = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Cancel')
    );
    cancel?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.libraryView()).toBe('browse');
    expect(fixture.nativeElement.querySelector('.filter-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.exercise-list')).not.toBeNull();
  });

  it('routes shared editor submit and cancel actions by active library view', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const create = spyOn(component, 'createExercise');
    const update = spyOn(component, 'updateExercise');
    const cancelCreate = spyOn(component, 'cancelCreate');
    const cancelEdit = spyOn(component, 'cancelEdit');

    component.libraryView.set('create');
    component.submitEditor();
    component.cancelEditor();

    component.libraryView.set('browse');
    component.startEdit(exercise({ custom: true }));
    component.submitEditor();
    component.cancelEditor();

    expect(create).toHaveBeenCalledTimes(1);
    expect(cancelCreate).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(cancelEdit).toHaveBeenCalledTimes(1);
  });

  it('loads the first exercise page with the default page size', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    expect(dataService.searchExercisesPage).toHaveBeenCalledWith(
      jasmine.objectContaining({
        page: 0,
        size: 20
      })
    );
  });

  it('loads the next exercise page when the next button is clicked', () => {
    dataService.searchExercisesPage.and.callFake((options) => {
      const request = options ?? {};
      return of(
        pagedExercises([exercise({ exerciseId: `exercise-${request.page ?? 0}` })], {
          page: request.page ?? 0,
          totalPages: 2,
          totalElements: 25
        })
      );
    });
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    const next = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Next')
    );
    next?.click();
    fixture.detectChanges();

    expect(dataService.searchExercisesPage).toHaveBeenCalledWith(
      jasmine.objectContaining({
        page: 1,
        size: 20
      })
    );
  });

  it('resets to the first page when filters change', fakeAsync(() => {
    dataService.searchExercisesPage.and.callFake((options) => {
      const request = options ?? {};
      return of(pagedExercises([exercise()], { page: request.page ?? 0, totalPages: 3, totalElements: 49 }));
    });
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.nextPage();
    fixture.detectChanges();
    fixture.componentInstance.filterForm.controls.q.setValue('press');
    tick(250);

    expect(dataService.searchExercisesPage).toHaveBeenCalledWith(
      jasmine.objectContaining({
        q: 'press',
        page: 0,
        size: 20
      })
    );
  }));

  it('resets to the first page when the exercise page size changes', () => {
    dataService.searchExercisesPage.and.callFake((options) => {
      const request = options ?? {};
      return of(
        pagedExercises([exercise()], {
          page: request.page ?? 0,
          size: request.size ?? 20,
          totalPages: 5,
          totalElements: 90
        })
      );
    });
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.nextPage();
    fixture.detectChanges();
    fixture.componentInstance.setPageSize(10);
    fixture.detectChanges();

    expect(fixture.componentInstance.page()).toBe(0);
    expect(dataService.searchExercisesPage).toHaveBeenCalledWith(
      jasmine.objectContaining({
        page: 0,
        size: 10
      })
    );
  });

  it('shows the total, the page size and a button for every page', () => {
    dataService.searchExercisesPage.and.returnValue(
      of(pagedExercises([exercise()], { page: 0, totalPages: 3, totalElements: 49 }))
    );
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();
    const pager = fixture.nativeElement.querySelector('.catalog-pager') as HTMLElement;

    expect(pager.textContent).toContain('49 exercises');
    expect(pager.querySelector('select')).not.toBeNull();
    expect(Array.from(pager.querySelectorAll('.number')).map((button) => button.textContent?.trim())).toEqual(['1', '2', '3']);
  });

  it('jumps to a page from its number', () => {
    dataService.searchExercisesPage.and.returnValue(
      of(pagedExercises([exercise()], { page: 0, totalPages: 3, totalElements: 49 }))
    );
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelectorAll('.catalog-pager .number')[2] as HTMLButtonElement).click();

    expect(dataService.searchExercisesPage.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ page: 2 }));
  });

  it('shows no page buttons when there is only one page', () => {
    dataService.searchExercisesPage.and.returnValue(of(pagedExercises([exercise()], { totalPages: 1 })));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.catalog-pager .pages')).toBeNull();
  });

  it('opens the edit form from the browse list and keeps create hidden', () => {
    const customExercise = exercise({ custom: true });
    dataService.searchExercisesPage.and.returnValue(of(pagedExercises([customExercise])));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    const edit = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      button.textContent?.trim() === 'Edit'
    );
    edit?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.libraryView()).toBe('browse');
    expect(fixture.componentInstance.editingExercise()).toEqual(customExercise);
    expect(fixture.nativeElement.querySelector('[aria-label="Edit custom exercise"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Create custom exercise"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Save changes');
  });

  it('creates a custom exercise with the normalized backend body', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      name: ' Split squat ',
      description: ' Single leg ',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER',
      videoMode: 'url',
      videoUrl: 'https://www.youtube.com/watch?v=abc123def45'
    });
    const saved = jasmine.createSpy('exerciseSaved');
    fixture.componentInstance.exerciseSaved.subscribe(saved);
    fixture.componentInstance.createExercise();

    expect(dataService.createExercise).toHaveBeenCalledWith({
      code: jasmine.stringMatching(/^CUSTOM_SPLIT_SQUAT_[A-Z0-9]{4}$/),
      name: 'Split squat',
      description: 'Single leg',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER',
      videoUrl: 'https://www.youtube.com/watch?v=abc123def45'
    });
    expect(toast.success).toHaveBeenCalledWith('Exercise created.');
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('creates an exercise then uploads the selected video before finishing', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    const file = new File(['video'], 'demo.webm', { type: 'video/webm' });
    dataService.createExercise.and.returnValue(of(exercise({ exerciseId: 'created-1', custom: true })));
    dataService.uploadExerciseVideo.and.returnValue(
      of(
        { type: HttpEventType.UploadProgress, loaded: 5, total: 10 } as HttpUploadProgressEvent,
        new HttpResponse({ body: exercise({ exerciseId: 'created-1', custom: true, videoUrl: 'https://media.example.test/demo.webm' }) })
      )
    );
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      name: 'Row',
      description: '',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'CHEST',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER',
      videoMode: 'upload',
      videoUrl: ''
    });
    fixture.componentInstance.createVideoFile.set(file);
    fixture.componentInstance.createExercise();

    expect(dataService.createExercise).toHaveBeenCalled();
    expect(dataService.uploadExerciseVideo).toHaveBeenCalledWith('created-1', file);
    expect(fixture.componentInstance.createUploadProgress()).toBeNull();
    expect(fixture.componentInstance.createVideoFile()).toBeNull();
    expect(fixture.componentInstance.saving()).toBeFalse();
    expect(toast.success).toHaveBeenCalledWith('Exercise created.');
  });

  it('creates an exercise then uploads the selected photo before finishing', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    const file = new File(['image'], 'split-squat.webp', { type: 'image/webp' });
    dataService.createExercise.and.returnValue(of(exercise({ exerciseId: 'created-1', custom: true })));
    dataService.uploadExerciseImage.and.returnValue(
      of(
        { type: HttpEventType.UploadProgress, loaded: 4, total: 8 } as HttpUploadProgressEvent,
        new HttpResponse({
          body: exercise({
            exerciseId: 'created-1',
            custom: true,
            images: [{ position: 0, url: 'https://media.example.test/split-squat.webp' }]
          })
        })
      )
    );
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      name: 'Split squat',
      description: '',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER',
      videoMode: 'url',
      videoUrl: ''
    });
    fixture.componentInstance.createImageFile.set(file);
    fixture.componentInstance.createExercise();

    expect(dataService.uploadExerciseImage).toHaveBeenCalledWith('created-1', file);
    expect(fixture.componentInstance.createImageUploadProgress()).toBeNull();
    expect(fixture.componentInstance.createImageFile()).toBeNull();
    expect(fixture.componentInstance.saving()).toBeFalse();
    expect(toast.success).toHaveBeenCalledWith('Exercise created.');
  });

  it('creates an exercise then uploads selected photo and video before finishing', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    const imageFile = new File(['image'], 'row.webp', { type: 'image/webp' });
    const videoFile = new File(['video'], 'row.webm', { type: 'video/webm' });
    dataService.createExercise.and.returnValue(of(exercise({ exerciseId: 'created-1', custom: true })));
    dataService.uploadExerciseImage.and.returnValue(
      of(new HttpResponse({ body: exercise({ exerciseId: 'created-1', custom: true, images: [{ position: 0, url: 'https://media.example.test/row.webp' }] }) }))
    );
    dataService.uploadExerciseVideo.and.returnValue(
      of(new HttpResponse({ body: exercise({ exerciseId: 'created-1', custom: true, videoUrl: 'https://media.example.test/row.webm' }) }))
    );
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      name: 'Row',
      description: '',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'CHEST',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER',
      videoMode: 'upload',
      videoUrl: ''
    });
    fixture.componentInstance.createImageFile.set(imageFile);
    fixture.componentInstance.createVideoFile.set(videoFile);
    fixture.componentInstance.createExercise();

    expect(dataService.uploadExerciseImage).toHaveBeenCalledWith('created-1', imageFile);
    expect(dataService.uploadExerciseVideo).toHaveBeenCalledWith('created-1', videoFile);
    expect(fixture.componentInstance.saving()).toBeFalse();
    expect(toast.success).toHaveBeenCalledWith('Exercise created.');
  });

  it('reports create failures and clears the saving state', () => {
    dataService.createExercise.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      name: 'Back squat',
      description: '',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'BARBELL',
      difficulty: 'INTERMEDIATE',
      videoMode: 'upload',
      videoUrl: ''
    });
    fixture.componentInstance.createExercise();

    expect(toast.error).toHaveBeenCalledWith('An exercise with that name already exists.');
    expect(fixture.componentInstance.saving()).toBeFalse();
  });

  it('does not show edit or archive actions for global exercises', () => {
    dataService.searchExercisesPage.and.returnValue(of(pagedExercises([exercise({ custom: false })])));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    const buttonText = Array.from<Element>(fixture.nativeElement.querySelectorAll('button')).map((button) =>
      button.textContent?.trim()
    );

    expect(buttonText).not.toContain('Edit');
    expect(buttonText).not.toContain('Archive');
  });

  it('does not start editing global exercises and resets edit state on cancel', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit(exercise({ custom: false }));
    expect(fixture.componentInstance.editingExercise()).toBeNull();

    fixture.componentInstance.startEdit(exercise({ custom: true, videoUrl: 'https://media.example.test/exercise.mp4' }));
    fixture.componentInstance.editVideoFile.set(new File(['video'], 'demo.mp4', { type: 'video/mp4' }));
    fixture.componentInstance.editUploadProgress.set(75);
    fixture.componentInstance.editVideoError.set('bad file');
    fixture.componentInstance.cancelEdit();

    expect(fixture.componentInstance.editingExercise()).toBeNull();
    expect(fixture.componentInstance.editForm.getRawValue()).toEqual({
      name: '',
      description: '',
      exerciseType: '',
      primaryMuscleGroup: '',
      equipment: '',
      difficulty: '',
      videoMode: 'url',
      videoUrl: ''
    });
    expect(fixture.componentInstance.editVideoFile()).toBeNull();
    expect(fixture.componentInstance.editUploadProgress()).toBeNull();
    expect(fixture.componentInstance.editVideoError()).toBe('');
  });

  it('updates a custom exercise and reloads the catalog on success', () => {
    const customExercise = exercise({ custom: true });
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit(customExercise);
    fixture.componentInstance.editForm.patchValue({
      name: ' Front squat ',
      description: ' Upright squat ',
      videoMode: 'url',
      videoUrl: 'https://vimeo.com/12345678'
    });
    const saved = jasmine.createSpy('exerciseSaved');
    fixture.componentInstance.exerciseSaved.subscribe(saved);
    fixture.componentInstance.updateExercise();
    expect(saved).toHaveBeenCalledTimes(1);

    expect(dataService.updateExercise).toHaveBeenCalledWith(
      'exercise-1',
      jasmine.objectContaining({
        name: 'Front squat',
        description: 'Upright squat',
        videoUrl: 'https://vimeo.com/12345678'
      })
    );
    expect(toast.success).toHaveBeenCalledWith('Exercise updated.');
    expect(fixture.componentInstance.editingExercise()).toBeNull();
    expect(fixture.componentInstance.saving()).toBeFalse();
    expect(dataService.searchExercisesPage).toHaveBeenCalledTimes(2);
  });

  it('does not update when edit guards fail and reports update errors', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.updateExercise();
    expect(dataService.updateExercise).not.toHaveBeenCalled();

    fixture.componentInstance.startEdit(exercise({ custom: true }));
    fixture.componentInstance.editForm.controls.name.setValue('');
    fixture.componentInstance.updateExercise();
    expect(dataService.updateExercise).not.toHaveBeenCalled();

    fixture.componentInstance.editForm.controls.name.setValue('Back squat');
    fixture.componentInstance.saving.set(true);
    fixture.componentInstance.updateExercise();
    expect(dataService.updateExercise).not.toHaveBeenCalled();

    fixture.componentInstance.saving.set(false);
    dataService.updateExercise.and.returnValue(throwError(() => new Error('update failed')));
    fixture.componentInstance.updateExercise();

    expect(toast.error).toHaveBeenCalledWith('Unable to update exercise. Please retry.');
    expect(fixture.componentInstance.saving()).toBeFalse();
  });

  it('archives a custom exercise after confirmation', () => {
    const customExercise = exercise({ custom: true });
    dataService.searchExercisesPage.and.returnValue(of(pagedExercises([customExercise])));
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    const saved = jasmine.createSpy('exerciseSaved');
    fixture.componentInstance.exerciseSaved.subscribe(saved);
    fixture.componentInstance.archiveExercise(customExercise);

    expect(saved).toHaveBeenCalledTimes(1);
    expect(window.confirm).toHaveBeenCalledWith('Archive Back squat?');
    expect(dataService.archiveExercise).toHaveBeenCalledWith('exercise-1');
    expect(toast.success).toHaveBeenCalledWith('Exercise archived.');
    expect(fixture.componentInstance.saving()).toBeFalse();
  });

  it('does not emit exerciseSaved for a browse load or a failed save', () => {
    dataService.updateExercise.and.returnValue(throwError(() => new Error('nope')));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    const saved = jasmine.createSpy('exerciseSaved');
    fixture.componentInstance.exerciseSaved.subscribe(saved);
    fixture.detectChanges();
    fixture.componentInstance.startEdit(exercise({ custom: true }));
    fixture.componentInstance.updateExercise();

    expect(saved).not.toHaveBeenCalled();
  });

  it('does not archive when guards fail or confirmation is declined', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();
    const confirm = spyOn(window, 'confirm').and.returnValue(false);

    fixture.componentInstance.archiveExercise(exercise({ custom: false }));
    fixture.componentInstance.archiveExercise(exercise({ custom: true, exerciseId: null }));
    fixture.componentInstance.saving.set(true);
    fixture.componentInstance.archiveExercise(exercise({ custom: true }));
    fixture.componentInstance.saving.set(false);
    fixture.componentInstance.archiveExercise(exercise({ custom: true }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dataService.archiveExercise).not.toHaveBeenCalled();
  });

  it('reports archive failures and clears saving', () => {
    dataService.archiveExercise.and.returnValue(throwError(() => new Error('archive failed')));
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.archiveExercise(exercise({ custom: true }));

    expect(toast.error).toHaveBeenCalledWith('Unable to archive exercise. Please retry.');
    expect(fixture.componentInstance.saving()).toBeFalse();
  });

  it('surfaces write failures through toast errors', () => {
    dataService.createExercise.and.returnValue(throwError(() => new Error('create failed')));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      name: 'Back squat',
      description: '',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'BARBELL',
      difficulty: 'INTERMEDIATE',
      videoMode: 'url',
      videoUrl: ''
    });
    fixture.componentInstance.createExercise();

    expect(toast.error).toHaveBeenCalledWith('Unable to create exercise. Please retry.');
  });

  it('rejects non-allowlisted pasted video URLs before writing', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      name: 'Back squat',
      description: '',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'BARBELL',
      difficulty: 'INTERMEDIATE',
      videoMode: 'url',
      videoUrl: 'https://example.test/video.mp4'
    });
    fixture.componentInstance.createExercise();

    expect(dataService.createExercise).not.toHaveBeenCalled();
    expect(fixture.componentInstance.createVideoError()).toBe('Use a YouTube or Vimeo URL.');
  });

  it('uploads a selected edit video file with progress and toast feedback', () => {
    const customExercise = exercise({ custom: true });
    const file = new File(['video'], 'demo.mp4', { type: 'video/mp4' });
    dataService.searchExercisesPage.and.returnValue(of(pagedExercises([customExercise])));
    dataService.uploadExerciseVideo.and.returnValue(
      of(
        { type: HttpEventType.UploadProgress, loaded: 15, total: 30 } as HttpUploadProgressEvent,
        new HttpResponse({ body: exercise({ custom: true, videoUrl: 'https://media.example.test/demo.mp4' }) })
      )
    );
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit(customExercise);
    fixture.componentInstance.editVideoFile.set(file);
    fixture.componentInstance.uploadEditingVideo();

    expect(dataService.uploadExerciseVideo).toHaveBeenCalledWith('exercise-1', file);
    expect(fixture.componentInstance.editUploadProgress()).toBe(100);
    expect(fixture.componentInstance.editingExercise()?.videoUrl).toBe('https://media.example.test/demo.mp4');
    expect(toast.success).toHaveBeenCalledWith('Exercise video uploaded.');
  });

  it('uploads a selected edit photo file and refreshes the exercise', () => {
    const customExercise = exercise({ custom: true });
    const file = new File(['image'], 'demo.webp', { type: 'image/webp' });
    dataService.searchExercisesPage.and.returnValue(of(pagedExercises([customExercise])));
    dataService.uploadExerciseImage.and.returnValue(
      of(
        { type: HttpEventType.UploadProgress, loaded: 6, total: 12 } as HttpUploadProgressEvent,
        new HttpResponse({
          body: exercise({
            custom: true,
            images: [{ position: 0, url: 'https://media.example.test/demo.webp' }]
          })
        })
      )
    );
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit(customExercise);
    fixture.componentInstance.selectEditImageFile(fileEvent(file));
    fixture.componentInstance.uploadEditingImage();

    expect(dataService.uploadExerciseImage).toHaveBeenCalledWith('exercise-1', file);
    expect(fixture.componentInstance.editImageUploadProgress()).toBe(100);
    expect(fixture.componentInstance.editImageFile()).toBeNull();
    expect(fixture.componentInstance.editingExercise()?.images?.[0]?.url).toBe('https://media.example.test/demo.webp');
    expect(toast.success).toHaveBeenCalledWith('Exercise photo uploaded.');
  });

  it('refreshes the selected exercise and detail after an edit photo upload', () => {
    const customExercise = exercise({ custom: true });
    dataService.searchExercisesPage.and.returnValue(of(pagedExercises([customExercise])));
    dataService.uploadExerciseImage.and.returnValue(
      of(
        new HttpResponse({
          body: exercise({
            custom: true,
            images: [{ position: 0, url: 'https://media.example.test/refresh.webp' }]
          })
        })
      )
    );
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.startEdit(customExercise);
    component.selectedExercise.set(customExercise);
    component.selectedExerciseDetail.set(exerciseDetail({ custom: true }));
    component.editImageFile.set(new File(['image'], 'refresh.webp', { type: 'image/webp' }));
    component.uploadEditingImage();

    expect(component.selectedExercise()?.images?.[0]?.url).toBe('https://media.example.test/refresh.webp');
    expect(component.selectedExerciseDetail()?.images?.[0]?.url).toBe('https://media.example.test/refresh.webp');
  });

  it('does not upload an edit photo when no file is selected', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit(exercise({ custom: true }));
    fixture.componentInstance.uploadEditingImage();

    expect(dataService.uploadExerciseImage).not.toHaveBeenCalled();
  });

  it('rejects non-video and oversized upload selections before calling the API', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectCreateVideoFile({
      target: { files: [{ name: 'demo.mov', type: 'video/quicktime', size: 1000 }], value: 'demo.mov' }
    } as unknown as Event);
    expect(fixture.componentInstance.createVideoError()).toBe('Use an MP4 or WebM file.');

    fixture.componentInstance.selectCreateVideoFile({
      target: { files: [{ name: 'large.mp4', type: 'video/mp4', size: 31 * 1024 * 1024 }], value: 'large.mp4' }
    } as unknown as Event);
    expect(fixture.componentInstance.createVideoError()).toBe('Video must be 30 MB or smaller.');
    expect(dataService.uploadExerciseVideo).not.toHaveBeenCalled();
  });

  it('rejects invalid image selections and clears an empty image selection', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();
    const imageFile = new File(['image'], 'demo.jpg', { type: 'image/jpeg' });

    fixture.componentInstance.selectCreateImageFile({
      target: { files: [{ name: 'demo.gif', type: 'image/gif', size: 1000 }], value: 'demo.gif' }
    } as unknown as Event);
    expect(fixture.componentInstance.createImageFile()).toBeNull();
    expect(fixture.componentInstance.createImageError()).toBe('Use a PNG, JPEG, or WebP image.');

    fixture.componentInstance.selectCreateImageFile(fileEvent(imageFile));
    expect(fixture.componentInstance.createImageFile()).toBe(imageFile);
    expect(fixture.componentInstance.createImageError()).toBe('');

    fixture.componentInstance.createImageError.set('previous');
    fixture.componentInstance.selectCreateImageFile(fileEvent(null));
    expect(fixture.componentInstance.createImageFile()).toBeNull();
    expect(fixture.componentInstance.createImageError()).toBe('');
  });

  it('clears video selection when no file is selected and accepts valid create/edit files', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();
    const createFile = new File(['video'], 'demo.mp4', { type: 'video/mp4' });
    const editFile = new File(['video'], 'demo.webm', { type: 'video/webm' });

    fixture.componentInstance.createVideoFile.set(createFile);
    fixture.componentInstance.createVideoError.set('previous');
    fixture.componentInstance.selectCreateVideoFile(fileEvent(null));
    expect(fixture.componentInstance.createVideoFile()).toBeNull();
    expect(fixture.componentInstance.createVideoError()).toBe('');

    fixture.componentInstance.selectCreateVideoFile(fileEvent(createFile));
    fixture.componentInstance.selectEditVideoFile(fileEvent(editFile));

    expect(fixture.componentInstance.createVideoFile()).toBe(createFile);
    expect(fixture.componentInstance.editVideoFile()).toBe(editFile);
    expect(fixture.componentInstance.createVideoError()).toBe('');
    expect(fixture.componentInstance.editVideoError()).toBe('');
  });

  it('reports upload failures for create and edit targets', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    const file = new File(['video'], 'demo.mp4', { type: 'video/mp4' });
    dataService.createExercise.and.returnValue(of(exercise({ exerciseId: 'created-1', custom: true })));
    dataService.uploadExerciseVideo.and.returnValue(throwError(() => new Error('upload failed')));
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      name: 'Row',
      description: '',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'CHEST',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER',
      videoMode: 'upload',
      videoUrl: ''
    });
    fixture.componentInstance.createVideoFile.set(file);
    fixture.componentInstance.createExercise();

    expect(fixture.componentInstance.createVideoError()).toBe('Unable to upload video. Please retry.');
    expect(toast.error).toHaveBeenCalledWith('Unable to upload exercise video. Please retry.');
    expect(fixture.componentInstance.saving()).toBeFalse();

    fixture.componentInstance.startEdit(exercise({ custom: true }));
    fixture.componentInstance.editVideoFile.set(file);
    fixture.componentInstance.uploadEditingVideo();

    expect(fixture.componentInstance.editVideoError()).toBe('Unable to upload video. Please retry.');
  });

  it('reports image upload failures for create media', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    const file = new File(['image'], 'demo.webp', { type: 'image/webp' });
    dataService.createExercise.and.returnValue(of(exercise({ exerciseId: 'created-1', custom: true })));
    dataService.uploadExerciseImage.and.returnValue(throwError(() => new Error('upload failed')));
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      name: 'Row',
      description: '',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'CHEST',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER',
      videoMode: 'url',
      videoUrl: ''
    });
    fixture.componentInstance.createImageFile.set(file);
    fixture.componentInstance.createExercise();

    expect(fixture.componentInstance.createImageError()).toBe('Unable to upload photo. Please retry.');
    expect(toast.error).toHaveBeenCalledWith('Unable to upload exercise photo. Please retry.');
    expect(fixture.componentInstance.saving()).toBeFalse();
  });

  it('does not upload an editing video when required state is missing', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    const file = new File(['video'], 'demo.mp4', { type: 'video/mp4' });
    fixture.detectChanges();

    fixture.componentInstance.uploadEditingVideo();
    fixture.componentInstance.startEdit(exercise({ custom: true, exerciseId: null }));
    fixture.componentInstance.editVideoFile.set(file);
    fixture.componentInstance.uploadEditingVideo();
    fixture.componentInstance.startEdit(exercise({ custom: true }));
    fixture.componentInstance.editVideoFile.set(null);
    fixture.componentInstance.uploadEditingVideo();
    fixture.componentInstance.editVideoFile.set(file);
    fixture.componentInstance.saving.set(true);
    fixture.componentInstance.uploadEditingVideo();

    expect(dataService.uploadExerciseVideo).not.toHaveBeenCalled();
  });

  it('syncs uploaded edit video with selected exercise and detail', () => {
    const customExercise = exercise({ custom: true });
    const file = new File(['video'], 'demo.mp4', { type: 'video/mp4' });
    dataService.uploadExerciseVideo.and.returnValue(
      of(new HttpResponse({ body: exercise({ custom: true, videoUrl: 'https://media.example.test/demo.mp4' }) }))
    );
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit(customExercise);
    fixture.componentInstance.selectedExercise.set(customExercise);
    fixture.componentInstance.selectedExerciseDetail.set(exerciseDetail(customExercise));
    fixture.componentInstance.editVideoFile.set(file);
    fixture.componentInstance.uploadEditingVideo();

    expect(fixture.componentInstance.selectedExercise()?.videoUrl).toBe('https://media.example.test/demo.mp4');
    expect(fixture.componentInstance.selectedExerciseDetail()?.videoUrl).toBe('https://media.example.test/demo.mp4');
    expect(fixture.componentInstance.editVideoFile()).toBeNull();
  });

  it('opens real exercise records without rendering null records as zero', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectExercise(exercise());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(dataService.getExercise).toHaveBeenCalledWith('exercise-1');
    expect(dataService.getExerciseRecords).toHaveBeenCalledWith('exercise-1');
    expect(dataService.getExerciseHistory).toHaveBeenCalledWith('exercise-1');
    expect(text).toContain('No records yet');
    expect(text).not.toContain('0 kg');
    expect(text).not.toContain('0 reps');
  });

  it('does not select sample exercises without an id', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectExercise(exercise({ exerciseId: null }));

    expect(fixture.componentInstance.selectedExercise()).toBeNull();
    expect(dataService.getExercise).not.toHaveBeenCalled();
  });

  it('ignores stale detail responses when another exercise is selected', () => {
    const detail$ = new Subject<ExerciseDetail | null>();
    const records$ = new Subject<null>();
    const history$ = new Subject<[]>();
    dataService.getExercise.and.returnValue(detail$);
    dataService.getExerciseRecords.and.returnValue(records$);
    dataService.getExerciseHistory.and.returnValue(history$);
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectExercise(exercise({ exerciseId: 'exercise-1' }));
    fixture.componentInstance.selectedExercise.set(exercise({ exerciseId: 'exercise-2' }));
    detail$.next(exerciseDetail({ exerciseId: 'exercise-1', name: 'Stale exercise' }));
    records$.next(null);
    history$.next([]);
    detail$.complete();
    records$.complete();
    history$.complete();

    expect(fixture.componentInstance.selectedExerciseDetail()).toBeNull();
    expect(fixture.componentInstance.exerciseRecords()).toBeNull();
    expect(fixture.componentInstance.exerciseHistory()).toEqual([]);
  });

  it('resets exercise detail signals when detail loading fails', () => {
    dataService.getExercise.and.returnValue(throwError(() => new Error('detail failed')));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectedExerciseDetail.set(exerciseDetail());
    fixture.componentInstance.exerciseRecords.set({
      exerciseId: 'exercise-1',
      exerciseName: 'Back squat',
      maxWeightKg: null,
      maxReps: null,
      maxSingleSetVolumeKg: null,
      estimatedOneRepMaxKg: null,
      bestSessionVolumeKg: null
    });
    fixture.componentInstance.exerciseHistory.set([historyEntry()]);
    fixture.componentInstance.selectExercise(exercise());

    expect(fixture.componentInstance.selectedExerciseDetail()).toBeNull();
    expect(fixture.componentInstance.exerciseRecords()).toBeNull();
    expect(fixture.componentInstance.exerciseHistory()).toEqual([]);
    expect(fixture.componentInstance.exerciseDetailLoading()).toBeFalse();
  });

  it('shows the focused detail view and restores the same library page when returning', () => {
    dataService.searchExercisesPage.and.callFake((options) => {
      const request = options ?? {};
      return of(
        pagedExercises([exercise({ exerciseId: `exercise-${request.page ?? 0}` })], {
          page: request.page ?? 0,
          totalPages: 3,
          totalElements: 60
        })
      );
    });
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.nextPage();
    fixture.detectChanges();
    expect(fixture.componentInstance.page()).toBe(1);

    fixture.componentInstance.selectExercise(exercise());
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.exercise-detail')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.exercise-list')).toBeNull();
    expect(fixture.nativeElement.querySelector('.catalog-pager')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Back to library');

    fixture.componentInstance.clearSelectedExercise();
    fixture.detectChanges();

    expect(fixture.componentInstance.page()).toBe(1);
    expect(fixture.nativeElement.querySelector('.exercise-list')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.catalog-pager')).not.toBeNull();
  });

  it('renders exercise media, instructions, metadata, records, and history details', () => {
    dataService.getExercise.and.returnValue(
      of(
        exerciseDetail({
          images: [{ position: 0, url: 'https://cdn.example.test/squat.jpg' }],
          imageUrls: ['https://cdn.example.test/squat.jpg'],
          videoUrl: 'https://media.example.test/squat.mp4',
          instructions: [{ stepNumber: 1, text: 'Brace your core before descending.' }],
          secondaryMuscleGroups: ['GLUTES']
        })
      )
    );
    dataService.getExerciseRecords.and.returnValue(
      of({
        exerciseId: 'exercise-1',
        exerciseName: 'Back squat',
        maxWeightKg: { value: 125, sessionId: 'session-1', achievedAt: '2026-06-12T11:05:00Z' },
        maxReps: null,
        maxSingleSetVolumeKg: null,
        estimatedOneRepMaxKg: null,
        bestSessionVolumeKg: null
      })
    );
    dataService.getExerciseHistory.and.returnValue(
      of([
        {
          sessionId: 'session-1',
          exerciseLogId: 'log-1',
          setLogId: 'set-1',
          exerciseId: 'exercise-1',
          exerciseNameSnapshot: 'Back squat',
          sessionName: 'Lower body',
          startedAt: '2026-06-12T10:00:00Z',
          completedAt: '2026-06-12T11:05:00Z',
          sequence: 1,
          setNumber: 2,
          reps: 5,
          weightKg: 100,
          durationSeconds: null,
          distanceKm: null,
          restSeconds: 180,
          perceivedExertion: 8,
          notes: ''
        }
      ])
    );
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectExercise(exercise());
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('.media-panel img') as HTMLImageElement;
    const text = fixture.nativeElement.textContent as string;
    expect(image.src).toBe('https://cdn.example.test/squat.jpg');
    expect(image.alt).toBe('Back squat demonstration');
    expect(fixture.nativeElement.querySelector('app-exercise-video video')).not.toBeNull();
    expect(text).toContain('Brace your core before descending.');
    expect(text).toContain('Glutes');
    expect(text).toContain('125.0 kg');
    expect(text).toContain('Lower body');
    expect(text).toContain('Set 2');
  });

  it('marks failed media unavailable and skips invalid history trend points', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectedExercise.set(
      exercise({
        images: [{ position: 0, url: 'https://cdn.example.test/squat.jpg' }],
        animationUrl: 'https://cdn.example.test/squat.gif'
      })
    );
    expect(fixture.componentInstance.mediaUrl()).toBe('https://cdn.example.test/squat.jpg');

    fixture.componentInstance.markMediaFailed();
    expect(fixture.componentInstance.mediaUrl()).toBeNull();

    fixture.componentInstance.exerciseHistory.set([
      historyEntry({ sessionId: 'old', completedAt: '2026-06-10T10:00:00Z', weightKg: 90 }),
      historyEntry({ sessionId: 'old', completedAt: '2026-06-10T10:05:00Z', weightKg: 95 }),
      historyEntry({ sessionId: 'missing-weight', completedAt: '2026-06-11T10:00:00Z', weightKg: null }),
      historyEntry({ sessionId: 'bad-date', completedAt: 'not-a-date', startedAt: '', weightKg: 110 }),
      historyEntry({ sessionId: '', sessionName: 'Fallback key', completedAt: '2026-06-12T10:00:00Z', weightKg: 100 })
    ]);

    expect(fixture.componentInstance.historyTrend().labels.length).toBe(2);
    expect(fixture.componentInstance.historyTrend().series[0].values).toEqual([95, 100]);
    expect(fixture.componentInstance.sortedHistory()[0].sessionId).toBe('');
  });

  it('formats invalid dates as dash', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.formatDateTime('not-a-date')).toBe('-');
    expect((fixture.componentInstance as unknown as { formatDateOnly: (value: string) => string }).formatDateOnly('not-a-date')).toBe('-');
  });

  it('uses honest empty states when exercise media, instructions, records, and history are missing', () => {
    dataService.getExercise.and.returnValue(of(exerciseDetail()));
    dataService.getExerciseRecords.and.returnValue(of(null));
    dataService.getExerciseHistory.and.returnValue(of([]));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.selectExercise(exercise());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('.media-placeholder')).not.toBeNull();
    expect(text).toContain('No demo media yet');
    expect(text).toContain('No steps yet');
    expect(text).toContain('No records yet');
    expect(text).toContain('No history yet');
  });

  it('keeps selected photo and demo video fields when switching media tabs', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();
    const imageFile = new File(['image'], 'row.webp', { type: 'image/webp' });
    const videoFile = new File(['video'], 'row.webm', { type: 'video/webm' });

    fixture.componentInstance.libraryView.set('create');
    fixture.componentInstance.selectCreateImageFile(fileEvent(imageFile));
    fixture.componentInstance.createMediaTab.set('video');
    fixture.componentInstance.createForm.patchValue({
      videoMode: 'url',
      videoUrl: 'https://vimeo.com/12345678'
    });
    fixture.componentInstance.createForm.controls.videoMode.setValue('upload');
    fixture.componentInstance.selectCreateVideoFile(fileEvent(videoFile));
    fixture.componentInstance.createMediaTab.set('photo');

    expect(fixture.componentInstance.createMediaTab()).toBe('photo');
    expect(fixture.componentInstance.createImageFile()).toBe(imageFile);
    expect(fixture.componentInstance.createForm.controls.videoUrl.value).toBe('https://vimeo.com/12345678');
    expect(fixture.componentInstance.createVideoFile()).toBe(videoFile);
    expect(fixture.componentInstance.hasCreateVideoMedia()).toBeTrue();
  });

  it('keeps create enum fields empty when metadata is unavailable', () => {
    dataService.getExerciseMetadata.and.returnValue(of(null));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.metadata()).toBeNull();
    expect(fixture.componentInstance.createForm.getRawValue()).toEqual(
      jasmine.objectContaining({
        exerciseType: '',
        primaryMuscleGroup: '',
        equipment: '',
        difficulty: ''
      })
    );
  });

  it('handles page overflow and exercise loading failures', () => {
    dataService.searchExercisesPage.and.returnValues(
      of(pagedExercises([], { page: 3, totalPages: 2, totalElements: 30 })),
      of(pagedExercises([exercise({ exerciseId: 'exercise-page-1' })], { page: 1, totalPages: 2, totalElements: 30 }))
    );
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.page()).toBe(1);
    expect(fixture.componentInstance.exercises()[0].exerciseId).toBe('exercise-page-1');
    expect(dataService.searchExercisesPage).toHaveBeenCalledTimes(2);

    dataService.searchExercisesPage.and.returnValue(throwError(() => new Error('load failed')));
    (fixture.componentInstance as unknown as { loadExercises: () => void }).loadExercises();

    expect(fixture.componentInstance.exercises()).toEqual([]);
    expect(fixture.componentInstance.page()).toBe(0);
    expect(fixture.componentInstance.totalPages()).toBe(0);
    expect(fixture.componentInstance.totalElements()).toBe(0);
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('clamps pagination changes and ignores invalid page-size changes', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();
    dataService.searchExercisesPage.and.callFake((options) =>
      of(pagedExercises([exercise()], { page: options?.page ?? 0, size: options?.size ?? 20, totalPages: 3, totalElements: 60 }))
    );
    dataService.searchExercisesPage.calls.reset();

    fixture.componentInstance.totalPages.set(3);
    fixture.componentInstance.loading.set(false);

    fixture.componentInstance.goToPage(-2);
    fixture.componentInstance.goToPage(0);
    fixture.componentInstance.loading.set(true);
    fixture.componentInstance.goToPage(1);
    fixture.componentInstance.loading.set(false);
    fixture.componentInstance.goToPage(99);
    fixture.componentInstance.prevPage();
    fixture.componentInstance.nextPage();
    fixture.componentInstance.setPageSize(13);
    fixture.componentInstance.setPageSize(20);
    fixture.componentInstance.setPageSize(50);

    expect(fixture.componentInstance.pageSize()).toBe(50);
    expect(dataService.searchExercisesPage.calls.allArgs().map((args) => args[0]?.page)).toEqual([2, 1, 2, 0]);
    expect(dataService.searchExercisesPage.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ page: 0, size: 50 }));
  });
});
