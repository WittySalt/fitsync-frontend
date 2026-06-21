import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Exercise, ExerciseDetail, ExerciseMetadata, PagedExercises } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { ExerciseLibraryComponent } from './exercise-library.component';

const metadata: ExerciseMetadata = {
  exerciseTypes: ['STRENGTH', 'CARDIO'],
  muscleGroups: ['QUADS', 'CHEST'],
  equipment: ['BARBELL', 'DUMBBELL'],
  difficulties: ['BEGINNER', 'INTERMEDIATE'],
  workoutTypes: ['STRENGTH'],
  goalFocuses: ['STRENGTH']
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
    size: 24,
    totalPages: 1,
    totalElements: items.length,
    ...overrides
  };
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
      'getExerciseHistory'
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

    await TestBed.configureTestingModule({
      imports: [ExerciseLibraryComponent],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
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

  it('loads the first exercise page with a page size of 24', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    expect(dataService.searchExercisesPage).toHaveBeenCalledWith(
      jasmine.objectContaining({
        page: 0,
        size: 24
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
        size: 24
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
        size: 24
      })
    );
  }));

  it('renders total pages and total elements in the pagination bar', () => {
    dataService.searchExercisesPage.and.returnValue(
      of(pagedExercises([exercise()], { page: 0, totalPages: 3, totalElements: 49 }))
    );
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Page 1 / 3 (49 exercises)');
  });

  it('hides the pagination bar when there is only one page', () => {
    dataService.searchExercisesPage.and.returnValue(of(pagedExercises([exercise()], { totalPages: 1 })));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.pagination-bar')).toBeNull();
  });

  it('creates a custom exercise with the normalized backend body', () => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      code: ' custom_split_squat ',
      name: ' Split squat ',
      description: ' Single leg ',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER'
    });
    fixture.componentInstance.createExercise();

    expect(dataService.createExercise).toHaveBeenCalledWith({
      code: 'CUSTOM_SPLIT_SQUAT',
      name: 'Split squat',
      description: 'Single leg',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'DUMBBELL',
      difficulty: 'BEGINNER'
    });
    expect(toast.success).toHaveBeenCalledWith('Exercise created.');
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

  it('archives a custom exercise after confirmation', () => {
    const customExercise = exercise({ custom: true });
    dataService.searchExercisesPage.and.returnValue(of(pagedExercises([customExercise])));
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.archiveExercise(customExercise);

    expect(window.confirm).toHaveBeenCalledWith('Archive Back squat?');
    expect(dataService.archiveExercise).toHaveBeenCalledWith('exercise-1');
    expect(toast.success).toHaveBeenCalledWith('Exercise archived.');
  });

  it('surfaces write failures through toast errors', () => {
    dataService.createExercise.and.returnValue(throwError(() => new Error('duplicate code')));
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.createForm.setValue({
      code: 'CUSTOM_BACK_SQUAT',
      name: 'Back squat',
      description: '',
      exerciseType: 'STRENGTH',
      primaryMuscleGroup: 'QUADS',
      equipment: 'BARBELL',
      difficulty: 'INTERMEDIATE'
    });
    fixture.componentInstance.createExercise();

    expect(toast.error).toHaveBeenCalledWith('Unable to create exercise. Check the code and retry.');
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

  it('renders exercise media, instructions, metadata, records, and history details', () => {
    dataService.getExercise.and.returnValue(
      of(
        exerciseDetail({
          images: [{ position: 0, url: 'https://cdn.example.test/squat.jpg' }],
          imageUrls: ['https://cdn.example.test/squat.jpg'],
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
    expect(text).toContain('Brace your core before descending.');
    expect(text).toContain('Glutes');
    expect(text).toContain('125.0 kg');
    expect(text).toContain('Lower body');
    expect(text).toContain('Set 2');
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

  it('suggests an editable custom code from the exercise name', fakeAsync(() => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.createForm.controls.name.setValue('Single arm row');
    tick(120);

    expect(fixture.componentInstance.createForm.controls.code.value).toBe('CUSTOM_SINGLE_ARM_ROW');
  }));
});
