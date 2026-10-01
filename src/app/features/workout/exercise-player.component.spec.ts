import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  ExerciseDetail,
  WorkoutExerciseSetLog,
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

function setLog(setNumber: number, logged: boolean): WorkoutExerciseSetLog {
  return {
    setLogId: logged ? `set-${setNumber}` : '',
    setNumber,
    reps: logged ? 10 : null,
    weightKg: logged ? 20 : null,
    durationSeconds: null,
    distanceKm: null,
    restSeconds: logged ? 1 : null,
    perceivedExertion: null,
    logged,
    notes: ''
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

  it('drops a leading instruction that merely repeats the description', () => {
    fixture.componentInstance.currentDetail.set(exerciseDetail({
      description: 'Brace your core and keep a flat back.',
      instructions: [
        { stepNumber: 1, text: 'Brace your core and keep a flat back.' },
        { stepNumber: 2, text: 'Hinge at the hips and lower the bar.' }
      ]
    }));

    const steps = fixture.componentInstance.guidanceInstructions();
    expect(steps.length).toBe(1);
    expect(steps[0].text).toBe('Hinge at the hips and lower the bar.');
  });

  it('does not abort when the confirmation is dismissed', () => {
    spyOn(window, 'confirm').and.returnValue(false);

    fixture.componentInstance.abort();

    expect(dataService.cancelSession).not.toHaveBeenCalled();
  });

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

  it('shows recorded set progress against planned targets in the movement queue', () => {
    const withSetProgress = TestBed.createComponent(ExercisePlayerComponent);
    withSetProgress.componentRef.setInput('session', detail({
      exercises: [
        {
          ...detail().exercises[0],
          sets: [setLog(1, true), setLog(2, false), setLog(3, false)]
        },
        {
          ...detail().exercises[1],
          sets: [setLog(1, false), setLog(2, false), setLog(3, false)]
        }
      ]
    }));
    withSetProgress.componentRef.setInput('activePlan', plan({
      exercises: [
        { ...plan().exercises[0], targetSets: 3 },
        { ...plan().exercises[1], targetSets: 3 }
      ]
    }));
    withSetProgress.detectChanges();

    const root = withSetProgress.nativeElement as HTMLElement;
    const texts = (selector: string) =>
      Array.from(root.querySelectorAll(`.movement-queue .queue-item ${selector}`)).map((node) => node.textContent?.trim());

    expect(texts('small:not(.queue-plan)')).toEqual(['1 / 3 sets', '0 / 3 sets']);
    expect(texts('.queue-plan')).toEqual(['3 × 10 · 20 kg', '3 × 8']);
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

  describe('picking a workout up where it was left', () => {
    function reopened(inputs: Record<string, unknown>): ComponentFixture<ExercisePlayerComponent> {
      live.reset();
      const player = TestBed.createComponent(ExercisePlayerComponent);
      player.componentRef.setInput('session', detail());
      player.componentRef.setInput('activePlan', plan());
      for (const [name, value] of Object.entries(inputs)) {
        player.componentRef.setInput(name, value);
      }
      player.detectChanges();
      return player;
    }

    it('opens on the exercise and set it was asked to', () => {
      const player = reopened({ initialExerciseId: 'exercise-2', initialSetNumber: 3 });

      expect(player.componentInstance.currentExerciseIndex()).toBe(1);
      expect(player.componentInstance.currentSetNumber()).toBe(3);
      expect(player.componentInstance.allTargetsComplete()).toBeFalse();
    });

    it('opens on the last exercise with Finish as the next step when every set is done', () => {
      const player = reopened({ allDoneOnOpen: true });

      expect(player.componentInstance.currentExerciseIndex()).toBe(1);
      expect(player.componentInstance.allTargetsComplete()).toBeTrue();
      expect((player.nativeElement as HTMLElement).querySelector('.completion-note')).not.toBeNull();
      const complete = (player.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.complete-set');
      expect(complete?.disabled).toBeTrue();
    });

    it('keeps its place while the same workout comes back with more sets recorded', () => {
      const player = reopened({ initialExerciseId: 'exercise-2', initialSetNumber: 1 });

      player.componentRef.setInput('session', detail({ updatedAt: 'later' }));
      player.detectChanges();

      expect(player.componentInstance.currentExerciseIndex()).toBe(1);
    });

    it('goes back to the start for another workout, and moves when asked to open somewhere else', () => {
      const player = reopened({ initialExerciseId: 'exercise-2' });

      player.componentRef.setInput('session', detail({ sessionId: 'session-other' }));
      player.componentRef.setInput('initialExerciseId', null);
      player.detectChanges();
      expect(player.componentInstance.currentExerciseIndex()).toBe(0);

      player.componentRef.setInput('initialExerciseId', 'exercise-2');
      player.detectChanges();
      expect(player.componentInstance.currentExerciseIndex()).toBe(1);
    });

    it('offers a Minimise control that says so to its owner', () => {
      const minimised = jasmine.createSpy('minimise');
      fixture.componentInstance.minimise.subscribe(minimised);

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.minimise')?.click();

      expect(minimised).toHaveBeenCalledTimes(1);
    });
  });

  describe('a session started from a weekly plan', () => {
    function weeklySet(setNumber: number, values: Partial<WorkoutExerciseSetLog>): WorkoutExerciseSetLog {
      return {
        setLogId: '',
        setNumber,
        status: 'PENDING',
        reps: null,
        weightKg: null,
        durationSeconds: null,
        distanceKm: null,
        restSeconds: 0,
        perceivedExertion: null,
        logged: false,
        notes: '',
        ...values
      };
    }

    function weeklySession(overrides: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
      const base = detail();
      return detail({
        planDayId: 'day-1',
        exercises: [
          {
            ...base.exercises[0],
            exerciseId: 'exercise-plank',
            exerciseNameSnapshot: 'Plank',
            sets: [1, 2, 3].map((n) => weeklySet(n, { durationSeconds: 45, restSeconds: 30 }))
          },
          {
            ...base.exercises[1],
            exerciseId: 'exercise-run',
            exerciseNameSnapshot: 'Treadmill',
            sets: [weeklySet(1, { durationSeconds: 1800, distanceKm: 5.75 })]
          }
        ],
        ...overrides
      });
    }

    const weeklyPlan = () => plan({ exercises: [], days: [] });
    const root = (player: ComponentFixture<ExercisePlayerComponent>) => player.nativeElement as HTMLElement;
    const text = (player: ComponentFixture<ExercisePlayerComponent>) => root(player).textContent ?? '';
    const textOf = (player: ComponentFixture<ExercisePlayerComponent>, selector: string) =>
      root(player).querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

    function mount(session: WorkoutSessionDetail, activePlan: WorkoutPlan): ComponentFixture<ExercisePlayerComponent> {
      live.reset();
      dataService.upsertSessionSet.calls.reset();
      const player = TestBed.createComponent(ExercisePlayerComponent);
      player.componentRef.setInput('session', session);
      player.componentRef.setInput('activePlan', activePlan);
      player.detectChanges();
      return player;
    }

    it('counts the planned sets of the session, and the progress bar follows', () => {
      const player = mount(weeklySession(), weeklyPlan());

      expect(text(player)).toContain('0 of 4 sets done');

      live.setSession(weeklySession({
        exercises: [
          {
            ...weeklySession().exercises[0],
            sets: [
              weeklySet(1, { durationSeconds: 45, restSeconds: 30, logged: true, status: 'DONE' }),
              weeklySet(2, { durationSeconds: 45, restSeconds: 30 }),
              weeklySet(3, { durationSeconds: 45, restSeconds: 30 })
            ]
          },
          weeklySession().exercises[1]
        ]
      }));
      player.detectChanges();

      expect(text(player)).toContain('1 of 4 sets done');
      expect(player.componentInstance.progressPercent()).toBe(25);
    });

    it('shows the real number of sets and the target of the current set', () => {
      const player = mount(weeklySession(), weeklyPlan());

      expect(textOf(player, '.set-panel strong')).toBe('1 / 3');
      expect(textOf(player, '.focus-copy p')).toBe('45 sec · 30 sec rest');
      expect(text(player)).not.toContain('Follow the plan target');
    });

    it('offers the timer for a timed set and records the target values', () => {
      const player = mount(weeklySession(), weeklyPlan());
      player.componentRef.setInput('initialExerciseId', 'exercise-run');
      player.detectChanges();

      expect(text(player)).toContain('Start timer');
      expect(textOf(player, '.focus-copy p')).toBe('30 min · 5.75 km');

      root(player).querySelector<HTMLButtonElement>('.complete-set')?.click();

      expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
        'session-live',
        'log-2',
        1,
        jasmine.objectContaining({ reps: null, durationSeconds: 1800, distanceKm: 5.75 })
      );
    });

    it('lists the sets of the current exercise with the planned and the logged values', () => {
      const session = weeklySession({
        exercises: [
          {
            ...weeklySession().exercises[0],
            exerciseId: 'ex-bench',
            exerciseNameSnapshot: 'Bench',
            sets: [
              weeklySet(1, { reps: 8, weightKg: 20, logged: true, status: 'DONE' }),
              weeklySet(2, { reps: 10, weightKg: 20, logged: true, status: 'DONE' }),
              weeklySet(3, { status: 'SKIPPED', logged: true }),
              weeklySet(4, { reps: 10, weightKg: 20 })
            ]
          }
        ]
      });
      const benchPlan = plan({
        exercises: [{ ...plan().exercises[0], exerciseId: 'ex-bench', targetSets: 4, targetReps: 10, targetWeightKg: 20 }]
      });
      const player = mount(session, benchPlan);

      const items = Array.from(root(player).querySelectorAll('app-player-set-list li'))
        .map((item) => item.textContent?.replace(/\s+/g, ' ').trim());

      expect(items).toEqual([
        'Set 1 planned 10 × 20 kg, did 8 × 20 kg ✓',
        'Set 2 10 × 20 kg ✓',
        'Set 3 Skipped',
        'Set 4 10 × 20 kg'
      ]);
      expect(root(player).querySelector('app-player-set-list ol')).not.toBeNull();
      expect(root(player).querySelector('app-player-set-list [aria-label="Done"]')).not.toBeNull();
    });

    it('writes the plan of each exercise in the movement queue', () => {
      const player = mount(weeklySession(), weeklyPlan());

      const lines = Array.from(root(player).querySelectorAll('.queue-plan')).map((node) => node.textContent?.trim());

      expect(lines).toEqual(['3 × 45 sec', '30 min · 5.75 km']);
    });

    it('takes the sets from the plan day of the session when the exercise has no set rows', () => {
      const day = {
        planDayId: 'day-1', dayOfWeek: 1, kind: 'STRENGTH', title: 'Legs', sportActivity: null, sportLabel: null,
        estimatedDurationMinutes: null,
        exercises: [
          { ...plan().exercises[0], targetSets: 3, targetReps: 12, targetWeightKg: 15 },
          { ...plan().exercises[1], targetSets: 2, targetReps: 8 }
        ]
      } as unknown as NonNullable<WorkoutPlan['days']>[number];
      const player = mount(detail({ planDayId: 'day-1' }), plan({ exercises: [], days: [day] }));

      expect(text(player)).toContain('0 of 5 sets done');
      expect(textOf(player, '.set-panel strong')).toBe('1 / 3');
      expect(textOf(player, '.focus-copy p')).toBe('12 reps · 15 kg · 1 sec rest');
    });

    it('shows no target line and one set when nothing is known', () => {
      const player = mount(detail(), plan({ exercises: [], days: [] }));

      expect(text(player)).toContain('0 of 2 sets done');
      expect(root(player).querySelector('.focus-copy p')).toBeNull();
      expect(text(player)).not.toContain('Follow the plan target');
    });

    it('shows the elapsed time the way the workout bar does', () => {
      const player = mount(weeklySession(), weeklyPlan());

      expect(textOf(player, '.elapsed')).toBe(live.elapsedLabel());
    });
  });
});
