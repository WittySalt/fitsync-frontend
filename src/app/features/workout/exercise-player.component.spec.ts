import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  ExerciseDetail,
  WorkoutPlan,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { ExercisePlayerComponent } from './exercise-player.component';
import { WorkoutLiveService } from './workout-live.service';
import { WorkoutCelebrationComponent } from './workout-celebration.component';

function detail(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return {
    sessionId: 'session-live',
    planId: 'plan-1',
    name: 'Today strength',
    workoutType: 'STRENGTH',
    status: 'IN_PROGRESS',
    source: 'PLAN',
    startedAt: '2026-06-20T02:00:00Z',
    completedAt: '',
    durationMinutes: 0,
    caloriesBurned: 0,
    exerciseCount: 2,
    perceivedExertion: null,
    notes: '',
    exercises: [
      {
        exerciseLogId: 'log-1',
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Goblet Squat',
        sequence: 1,
        performedSets: 0,
        performedReps: 0,
        totalVolumeKg: null,
        distanceKm: null,
        durationSeconds: null,
        averageHeartRate: null,
        maxHeartRate: null,
        notes: '',
        sets: []
      },
      {
        exerciseLogId: 'log-2',
        exerciseId: 'exercise-2',
        exerciseNameSnapshot: 'Push-Up',
        sequence: 2,
        performedSets: 0,
        performedReps: 0,
        totalVolumeKg: null,
        distanceKm: null,
        durationSeconds: null,
        averageHeartRate: null,
        maxHeartRate: null,
        notes: '',
        sets: []
      }
    ],
    createdAt: '',
    updatedAt: '',
    ...overrides
  };
}

function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    planId: 'plan-1',
    name: 'Today plan',
    description: '',
    goalFocus: 'STRENGTH',
    workoutType: 'STRENGTH',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 30,
    status: 'ACTIVE',
    exerciseCount: 2,
    exercises: [
      {
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Goblet Squat',
        sequence: 1,
        targetSets: 1,
        targetReps: 10,
        targetWeightKg: 20,
        targetDurationSeconds: null,
        targetDistanceKm: null,
        restSeconds: 1,
        notes: '',
        setTargets: []
      },
      {
        exerciseId: 'exercise-2',
        exerciseNameSnapshot: 'Push-Up',
        sequence: 2,
        targetSets: 1,
        targetReps: 8,
        targetWeightKg: null,
        targetDurationSeconds: null,
        targetDistanceKm: null,
        restSeconds: 0,
        notes: '',
        setTargets: []
      }
    ],
    ...overrides
  };
}

function exerciseDetail(overrides: Partial<ExerciseDetail> = {}): ExerciseDetail {
  return {
    exerciseId: 'exercise-1',
    code: 'GOBLET_SQUAT',
    name: 'Goblet Squat',
    description: 'Hold the weight close and keep your chest tall.',
    exerciseType: 'STRENGTH',
    primaryMuscleGroup: 'QUADS',
    equipment: 'DUMBBELLS',
    difficulty: 'BEGINNER',
    status: 'ACTIVE',
    custom: false,
    videoUrl: null,
    animationUrl: null,
    images: [],
    imageUrls: [],
    instructions: [
      { stepNumber: 2, text: 'Drive through your feet to stand tall.' },
      { stepNumber: 1, text: 'Brace your core before you descend.' }
    ],
    secondaryMuscleGroups: ['GLUTES'],
    ...overrides
  };
}

describe('ExercisePlayerComponent', () => {
  let fixture: ComponentFixture<ExercisePlayerComponent>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let live: WorkoutLiveService;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'startWorkoutPlan',
      'startAdHocSession',
      'getExercise',
      'upsertSessionSet',
      'completeSession',
      'cancelSession'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    dataService.upsertSessionSet.and.returnValue(of(detail({
      exercises: [
        {
          ...detail().exercises[0],
          performedSets: 1,
          performedReps: 10,
          sets: [{
            setLogId: 'set-1',
            setNumber: 1,
            reps: 10,
            weightKg: 20,
            durationSeconds: null,
            distanceKm: null,
            restSeconds: 1,
            perceivedExertion: null,
            logged: true,
            notes: ''
          }]
        },
        detail().exercises[1]
      ]
    })));
    dataService.completeSession.and.returnValue(of(detail({ status: 'COMPLETED' })));
    dataService.cancelSession.and.returnValue(of(detail({ status: 'CANCELLED' })));
    dataService.getExercise.and.callFake((exerciseId) =>
      of(
        exerciseId === 'exercise-2'
          ? exerciseDetail({
              exerciseId: 'exercise-2',
              code: 'PUSH_UP',
              name: 'Push-Up',
              description: 'Keep a straight line from shoulders to heels.',
              primaryMuscleGroup: 'CHEST',
              equipment: 'BODYWEIGHT',
              difficulty: 'INTERMEDIATE',
              instructions: [{ stepNumber: 1, text: 'Lower under control, then press away from the floor.' }],
              secondaryMuscleGroups: ['TRICEPS']
            })
          : exerciseDetail()
      )
    );

    await TestBed.configureTestingModule({
      imports: [ExercisePlayerComponent],
      providers: [
        WorkoutLiveService,
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    live = TestBed.inject(WorkoutLiveService);
    fixture = TestBed.createComponent(ExercisePlayerComponent);
    fixture.componentRef.setInput('session', detail());
    fixture.componentRef.setInput('activePlan', plan());
    fixture.detectChanges();
  });

  afterEach(() => {
    live.reset();
  });

  function renderPlayer(activePlan: WorkoutPlan): ComponentFixture<ExercisePlayerComponent> {
    live.reset();
    dataService.upsertSessionSet.calls.reset();
    const player = TestBed.createComponent(ExercisePlayerComponent);
    player.componentRef.setInput('session', detail());
    player.componentRef.setInput('activePlan', activePlan);
    player.detectChanges();
    return player;
  }

  it('saves the current set with session, exercise log, set number, and target values', () => {
    fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();

    expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
      'session-live',
      'log-1',
      1,
      jasmine.objectContaining({ reps: 10, weightKg: 20, restSeconds: 1 })
    );
  });

  it('shows a short Done cue when a set is saved', fakeAsync(() => {
    fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.setCompleteCue()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Done');
    expect(fixture.nativeElement.textContent).toContain('Set complete');

    tick(1_000);
    fixture.detectChanges();

    expect(fixture.componentInstance.setCompleteCue()).toBeFalse();

    tick(800);
  }));

  it('shows the rest countdown after completing a set', () => {
    fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Rest');
    expect(fixture.nativeElement.textContent).toContain('0:01');
  });

  it('does not record a set automatically before the guide is started', fakeAsync(() => {
    tick(10_000);

    expect(dataService.upsertSessionSet).not.toHaveBeenCalled();
  }));

  it('auto-completes a timed set at zero and enters rest', fakeAsync(() => {
    const timed = renderPlayer(plan({
      exercises: [
        {
          ...plan().exercises[0],
          targetReps: null,
          targetDurationSeconds: 2,
          restSeconds: 1
        },
        plan().exercises[1]
      ]
    }));

    timed.componentInstance.startGuidedSet();
    tick(2_000);
    timed.detectChanges();

    expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
      'session-live',
      'log-1',
      1,
      jasmine.objectContaining({ reps: null, durationSeconds: 2, restSeconds: 1 })
    );
    expect(timed.nativeElement.textContent).toContain('Rest');

    tick(1_000);
    tick(800);
  }));

  it('counts reps during tempo guidance and records the target reps when it completes', fakeAsync(() => {
    const tempo = renderPlayer(plan({
      exercises: [
        {
          ...plan().exercises[0],
          targetReps: 2,
          restSeconds: 0
        },
        plan().exercises[1]
      ]
    }));

    tempo.componentInstance.startGuidedSet();
    tick(3_000);
    tempo.detectChanges();

    expect(tempo.componentInstance.guidedRepCount()).toBe(1);

    tick(3_000);

    expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
      'session-live',
      'log-1',
      1,
      jasmine.objectContaining({ reps: 2, durationSeconds: 6 })
    );
  }));

  it('stops tempo guidance and records only the reached reps', fakeAsync(() => {
    const tempo = renderPlayer(plan({
      exercises: [
        {
          ...plan().exercises[0],
          targetReps: 3,
          restSeconds: 0
        },
        plan().exercises[1]
      ]
    }));

    tempo.componentInstance.startGuidedSet();
    tick(3_000);
    tempo.componentInstance.stopGuidedSet();

    expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
      'session-live',
      'log-1',
      1,
      jasmine.objectContaining({ reps: 1, durationSeconds: 3 })
    );
  }));

  it('advances to the next exercise after rest finishes', fakeAsync(() => {
    fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();
    tick(1_000);
    fixture.detectChanges();

    expect(fixture.componentInstance.currentLog()?.exerciseLogId).toBe('log-2');
    expect(fixture.nativeElement.textContent).toContain('Push-Up');
    expect(fixture.componentInstance.restCompleteCue()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Next set');

    tick(800);
    fixture.detectChanges();

    expect(fixture.componentInstance.restCompleteCue()).toBeFalse();
  }));

  it('labels heart rate as mock and calories as estimated', () => {
    live.heartRate.set(128);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('128 bpm mock');
    expect(fixture.nativeElement.textContent).toContain('kcal estimated');
  });

  it('starts focused on the requested initial exercise', () => {
    const focused = TestBed.createComponent(ExercisePlayerComponent);
    focused.componentRef.setInput('session', detail());
    focused.componentRef.setInput('activePlan', plan());
    focused.componentRef.setInput('initialExerciseId', 'exercise-2');
    focused.detectChanges();

    expect(focused.componentInstance.currentLog()?.exerciseLogId).toBe('log-2');
    expect(focused.nativeElement.textContent).toContain('Push-Up');
  });

  it('renders a clean placeholder when the current exercise has no media', () => {
    expect(fixture.nativeElement.querySelector('.media-placeholder')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.media-placeholder')?.textContent).toContain('G');
    expect(fixture.nativeElement.querySelector('.movement-media img')).toBeNull();
  });

  it('uses catalog detail images as sorted animation frames and advances them on a loop', fakeAsync(() => {
    dataService.getExercise.and.returnValue(of(exerciseDetail({
      images: [
        { position: 2, url: 'https://cdn.example.test/goblet-squat/1.jpg' },
        { position: 1, url: 'https://cdn.example.test/goblet-squat/0.jpg' }
      ]
    })));

    const withFrames = renderPlayer(plan());

    expect(withFrames.componentInstance.mediaFrames()).toEqual([
      'https://cdn.example.test/goblet-squat/0.jpg',
      'https://cdn.example.test/goblet-squat/1.jpg'
    ]);
    expect(withFrames.componentInstance.currentMediaUrl()).toBe('https://cdn.example.test/goblet-squat/0.jpg');

    tick(900);
    withFrames.detectChanges();

    expect(withFrames.componentInstance.mediaFrameIndex()).toBe(1);
    expect(withFrames.componentInstance.currentMediaUrl()).toBe('https://cdn.example.test/goblet-squat/1.jpg');
    expect((withFrames.nativeElement as HTMLElement).querySelector<HTMLImageElement>('.movement-media img')?.getAttribute('src'))
      .toBe('https://cdn.example.test/goblet-squat/1.jpg');

    withFrames.destroy();
  }));

  it('keeps single catalog images static', fakeAsync(() => {
    dataService.getExercise.and.returnValue(of(exerciseDetail({
      images: [{ position: 1, url: 'https://cdn.example.test/goblet-squat/0.jpg' }]
    })));

    const withOneFrame = renderPlayer(plan());

    tick(1_800);
    withOneFrame.detectChanges();

    expect(withOneFrame.componentInstance.mediaFrames()).toEqual(['https://cdn.example.test/goblet-squat/0.jpg']);
    expect(withOneFrame.componentInstance.mediaFrameIndex()).toBe(0);
    expect(withOneFrame.componentInstance.currentMediaUrl()).toBe('https://cdn.example.test/goblet-squat/0.jpg');
  }));

  it('does not advance animation frames when reduced motion is enabled', fakeAsync(() => {
    spyOn(window, 'matchMedia').and.returnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    } as MediaQueryList);
    dataService.getExercise.and.returnValue(of(exerciseDetail({
      images: [
        { position: 1, url: 'https://cdn.example.test/goblet-squat/0.jpg' },
        { position: 2, url: 'https://cdn.example.test/goblet-squat/1.jpg' }
      ]
    })));

    const reducedMotion = renderPlayer(plan());

    tick(1_800);
    reducedMotion.detectChanges();

    expect(reducedMotion.componentInstance.mediaFrames().length).toBe(2);
    expect(reducedMotion.componentInstance.mediaFrameIndex()).toBe(0);
    expect(reducedMotion.componentInstance.currentMediaUrl()).toBe('https://cdn.example.test/goblet-squat/0.jpg');
  }));

  it('renders current exercise guidance with description, sorted steps, and metadata', () => {
    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

    expect(text).toContain('How to perform');
    expect(text).toContain('Hold the weight close and keep your chest tall.');
    expect(text.indexOf('Brace your core before you descend.')).toBeLessThan(text.indexOf('Drive through your feet to stand tall.'));
    expect(text).toContain('Quads');
    expect(text).toContain('Glutes');
    expect(text).toContain('Dumbbells');
    expect(text).toContain('Beginner');
  });

  it('renders an optional video guide inside the guidance panel', () => {
    dataService.getExercise.and.returnValue(of(exerciseDetail({
      videoUrl: 'https://www.youtube.com/watch?v=abc123def45'
    })));
    const withVideo = renderPlayer(plan());
    withVideo.detectChanges();

    expect(withVideo.nativeElement.textContent).toContain('Watch video');
    expect(withVideo.nativeElement.querySelector('.guidance-panel app-exercise-video .video-preview')).not.toBeNull();
  });

  it('updates guidance when the current exercise changes and reuses cached details', fakeAsync(() => {
    expect(dataService.getExercise.calls.allArgs().filter(([exerciseId]) => exerciseId === 'exercise-1').length).toBe(1);

    fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();
    tick(1_000);
    tick(800);
    fixture.detectChanges();

    let text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(text).toContain('Keep a straight line from shoulders to heels.');
    expect(text).toContain('Lower under control, then press away from the floor.');
    expect(dataService.getExercise.calls.allArgs().filter(([exerciseId]) => exerciseId === 'exercise-2').length).toBe(1);

    fixture.componentInstance.currentExerciseIndex.set(0);
    fixture.detectChanges();

    text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(text).toContain('Hold the weight close and keep your chest tall.');
    expect(dataService.getExercise.calls.allArgs().filter(([exerciseId]) => exerciseId === 'exercise-1').length).toBe(1);
  }));

  it('shows an honest guidance empty state when the current exercise has no catalog id', () => {
    const withoutCatalogId = TestBed.createComponent(ExercisePlayerComponent);
    withoutCatalogId.componentRef.setInput(
      'session',
      detail({
        exercises: [
          {
            ...detail().exercises[0],
            exerciseId: ''
          }
        ]
      })
    );
    withoutCatalogId.componentRef.setInput('activePlan', plan({ exercises: [] }));
    withoutCatalogId.detectChanges();

    expect(dataService.getExercise).not.toHaveBeenCalledWith('');
    expect(withoutCatalogId.nativeElement.textContent).toContain('No guidance available for this movement.');
  });

  it('renders the exercise image when media is available', () => {
    const withMedia = TestBed.createComponent(ExercisePlayerComponent);
    withMedia.componentRef.setInput('session', detail());
    withMedia.componentRef.setInput('activePlan', plan({
      exercises: [
        {
          ...plan().exercises[0],
          images: ['https://cdn.example.test/goblet-squat.png']
        },
        plan().exercises[1]
      ]
    }));
    withMedia.detectChanges();

    const image = (withMedia.nativeElement as HTMLElement).querySelector<HTMLImageElement>('.movement-media img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('https://cdn.example.test/goblet-squat.png');
    expect(image?.getAttribute('alt')).toBe('Goblet Squat movement reference');
  });

  it('falls back to the placeholder when exercise media fails to load', () => {
    const withMedia = TestBed.createComponent(ExercisePlayerComponent);
    withMedia.componentRef.setInput('session', detail());
    withMedia.componentRef.setInput('activePlan', plan({
      exercises: [
        {
          ...plan().exercises[0],
          animationUrl: 'https://cdn.example.test/goblet-squat.gif'
        },
        plan().exercises[1]
      ]
    }));
    withMedia.detectChanges();

    (withMedia.nativeElement as HTMLElement).querySelector<HTMLImageElement>('.movement-media img')
      ?.dispatchEvent(new Event('error'));
    withMedia.detectChanges();

    expect(withMedia.nativeElement.querySelector('.movement-media img')).toBeNull();
    expect(withMedia.nativeElement.querySelector('.media-placeholder')).not.toBeNull();
  });

  it('skips only the failed animation frame and keeps other frames available', () => {
    dataService.getExercise.and.returnValue(of(exerciseDetail({
      images: [
        { position: 1, url: 'https://cdn.example.test/goblet-squat/0.jpg' },
        { position: 2, url: 'https://cdn.example.test/goblet-squat/1.jpg' }
      ]
    })));

    const withFrames = renderPlayer(plan());
    (withFrames.nativeElement as HTMLElement).querySelector<HTMLImageElement>('.movement-media img')
      ?.dispatchEvent(new Event('error'));
    withFrames.detectChanges();

    expect(withFrames.componentInstance.mediaFrames()).toEqual(['https://cdn.example.test/goblet-squat/1.jpg']);
    expect(withFrames.componentInstance.currentMediaUrl()).toBe('https://cdn.example.test/goblet-squat/1.jpg');
  });

  it('surfaces set write failures through toast', () => {
    dataService.upsertSessionSet.and.returnValue(throwError(() => new Error('boom')));

    fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();

    expect(toast.error).toHaveBeenCalledWith('Unable to save this set. Please retry.');
  });

  it('shows the workout celebration after a completed finish and emits only after Continue', () => {
    spyOn(live, 'finish').and.returnValue(of(detail({ status: 'COMPLETED' })));
    const completedSpy = jasmine.createSpy('completed');
    fixture.componentInstance.completed.subscribe(completedSpy);

    fixture.componentInstance.finish();
    fixture.detectChanges();

    expect(fixture.componentInstance.showCelebration()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Great work!');
    expect(fixture.nativeElement.textContent).toContain('Workout complete');
    expect(completedSpy).not.toHaveBeenCalled();

    fixture.debugElement.query(By.css('app-workout-celebration button')).nativeElement.click();
    fixture.detectChanges();

    expect(completedSpy).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'COMPLETED' }));
    expect(fixture.componentInstance.showCelebration()).toBeFalse();
  });

  it('does not show the workout celebration for cancelled short finishes', () => {
    spyOn(live, 'finish').and.returnValue(of(detail({ status: 'CANCELLED' })));
    const cancelledSpy = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelledSpy);

    fixture.componentInstance.finish();
    fixture.detectChanges();

    expect(fixture.componentInstance.showCelebration()).toBeFalse();
    expect(fixture.nativeElement.querySelector('app-workout-celebration')).toBeNull();
    expect(cancelledSpy).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'CANCELLED' }));
  });

  it('passes reduced motion into the workout celebration', () => {
    spyOn(window, 'matchMedia').and.returnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    } as MediaQueryList);
    const reduced = TestBed.createComponent(ExercisePlayerComponent);
    reduced.componentRef.setInput('session', detail());
    reduced.componentRef.setInput('activePlan', plan());
    reduced.detectChanges();
    const reducedLive = TestBed.inject(WorkoutLiveService);
    spyOn(reducedLive, 'finish').and.returnValue(of(detail({ status: 'COMPLETED' })));

    reduced.componentInstance.finish();
    reduced.detectChanges();

    const celebration = reduced.debugElement.query(By.directive(WorkoutCelebrationComponent));
    expect(reduced.componentInstance.prefersReducedMotion).toBeTrue();
    expect(celebration.componentInstance.reducedMotion).toBeTrue();
  });
});
