import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Exercise, ExerciseMetadata } from '../../core/fitsync.models';
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

describe('ExerciseLibraryComponent', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getExerciseMetadata',
      'getExercises',
      'createExercise',
      'updateExercise',
      'archiveExercise',
      'getExerciseRecords',
      'getExerciseHistory'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    dataService.getExerciseMetadata.and.returnValue(of(metadata));
    dataService.getExercises.and.returnValue(of([exercise()]));
    dataService.createExercise.and.returnValue(of(exercise({ custom: true })));
    dataService.updateExercise.and.returnValue(of(exercise({ custom: true })));
    dataService.archiveExercise.and.returnValue(of(void 0));
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
    dataService.getExercises.and.returnValue(of([exercise({ custom: false })]));
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
    dataService.getExercises.and.returnValue(of([customExercise]));
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
    expect(dataService.getExerciseRecords).toHaveBeenCalledWith('exercise-1');
    expect(dataService.getExerciseHistory).toHaveBeenCalledWith('exercise-1');
    expect(text).toContain('No data yet');
    expect(text).not.toContain('0 kg');
    expect(text).not.toContain('0 reps');
  });

  it('suggests an editable custom code from the exercise name', fakeAsync(() => {
    const fixture = TestBed.createComponent(ExerciseLibraryComponent);
    fixture.detectChanges();

    fixture.componentInstance.createForm.controls.name.setValue('Single arm row');
    tick(120);

    expect(fixture.componentInstance.createForm.controls.code.value).toBe('CUSTOM_SINGLE_ARM_ROW');
  }));
});
