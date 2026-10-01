import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  ExerciseDetail,
  WorkoutExerciseSetLog,
  WorkoutPlan,
  WorkoutSessionDetail
} from '../../core/fitsync.models';
import { CoachStore } from '../../core/coach/coach.store';
import { ToastService } from '../../core/toast/toast.service';
import { SpeechService } from './speech.service';
import { ExercisePlayerComponent } from './exercise-player.component';
import { WorkoutLiveService } from './workout-live.service';
import { WorkoutCelebrationComponent } from './workout-celebration.component';

/** Lets the timers that a test leaves behind (the step carousel, the cues) run out before it ends. */
function settle(): void {
  discardPeriodicTasks();
  flush();
}

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
  let coach: jasmine.SpyObj<CoachStore>;
  let speech: { available: boolean; speak: jasmine.Spy; cancel: jasmine.Spy };
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
    coach = jasmine.createSpyObj<CoachStore>('CoachStore', ['open', 'ask']);
    speech = { available: true, speak: jasmine.createSpy('speak'), cancel: jasmine.createSpy('cancel') };

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
        { provide: ToastService, useValue: toast },
        { provide: CoachStore, useValue: coach },
        { provide: SpeechService, useValue: speech }
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

    const steps = fixture.componentInstance.currentSubject().steps;
    expect(steps).toEqual(['Hinge at the hips and lower the bar.']);
  });

  it('asks once before discarding, and Keep going leaves the workout alone', () => {
    fixture.componentInstance.confirm.set('discard');
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('app-workout-modal') as HTMLElement;
    expect(dialog.textContent).toContain('Discard this workout?');

    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Keep going'))?.click();
    fixture.detectChanges();

    expect(dataService.cancelSession).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-workout-modal')).toBeNull();
  });

  it('discards through the live service once the dialog is answered', () => {
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelled);
    fixture.componentInstance.confirm.set('discard');
    fixture.detectChanges();

    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-workout-modal button'))
      .find((button) => button.textContent?.trim() === 'Discard')?.click();

    expect(dataService.cancelSession).toHaveBeenCalledWith('session-live');
    expect(cancelled).toHaveBeenCalled();
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
    settle();
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
    settle();
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
    settle();
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
    settle();
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
    settle();
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
    settle();
  }));

  it('shows no mock heart rate and no calorie estimate', () => {
    live.heartRate.set(128);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('bpm');
    expect(fixture.nativeElement.textContent).not.toContain('kcal');
  });

  it('shows the sets done in the top strip, with one segment for each exercise', () => {
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
    expect(root.querySelector('.sets')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1 of 6 sets');
    expect(root.querySelectorAll('.segment').length).toBe(2);
    expect(withSetProgress.componentInstance.segments()).toEqual([1 / 3, 0]);
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
    settle();
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
    settle();
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
    settle();
  }));

  describe('the guide', () => {
    const asText = (node: HTMLElement) => (node.textContent ?? '').replace(/\s+/g, ' ');

    function setWidth(player: ComponentFixture<ExercisePlayerComponent>, width: number): void {
      (player.nativeElement as HTMLElement).style.display = 'block';
      (player.nativeElement as HTMLElement).style.width = `${width}px`;
    }

    it('shows the steps of the exercise in the carousel, cut to their first sentence and in order', () => {
      const carousel = fixture.nativeElement.querySelector('app-step-carousel') as HTMLElement;

      expect(asText(carousel)).toContain('Brace your core before you descend.');
      expect(fixture.componentInstance.currentSubject().steps).toEqual([
        'Brace your core before you descend.',
        'Drive through your feet to stand tall.'
      ]);
    });

    it('prefers the short steps of the exercise when it has them', () => {
      dataService.getExercise.and.returnValue(of(exerciseDetail({ shortSteps: ['Hold the weight at the chest.', 'Sit down between the heels.'] })));

      const withShortSteps = renderPlayer(plan());

      expect(withShortSteps.componentInstance.currentSubject().steps).toEqual([
        'Hold the weight at the chest.',
        'Sit down between the heels.'
      ]);
    });

    it('opens as a full view with a Back button on a narrow screen, and the workout keeps its place', () => {
      setWidth(fixture, 360);
      fixture.debugElement.query(By.css('app-exercise-picture button')).nativeElement.click();
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      const guide = root.querySelector('app-exercise-guide') as HTMLElement;
      expect(root.querySelector('app-workout-modal')).toBeNull();
      expect(guide.querySelector('.bar [aria-label="Back to the set"]')).not.toBeNull();
      const text = asText(guide);
      expect(text).toContain('Goblet Squat');
      expect(text).toContain('Quads');
      expect(text).toContain('Glutes');
      expect(text).toContain('Dumbbells');
      expect(text).toContain('Beginner');
      expect(text).toContain('Hold the weight close and keep your chest tall.');
      expect(text.indexOf('Brace your core before you descend.')).toBeLessThan(text.indexOf('Drive through your feet to stand tall.'));
      expect(text).toContain('Back to set 1');
      expect(guide.querySelector('li[aria-current="step"]')?.textContent).toContain('Brace your core');

      guide.querySelector<HTMLButtonElement>('.primary')?.click();
      fixture.detectChanges();

      expect(root.querySelector('app-exercise-guide')).toBeNull();
      expect(fixture.componentInstance.guideOpen()).toBeFalse();
    });

    it('closes the full view with Escape', () => {
      setWidth(fixture, 360);
      fixture.componentInstance.openGuide();
      fixture.detectChanges();

      const guide = fixture.nativeElement.querySelector('.guide') as HTMLElement;
      guide.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.componentInstance.guideOpen()).toBeFalse();
    });

    it('opens in the dialog on a wide screen, and Escape closes it', () => {
      setWidth(fixture, 960);
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.howto'))[0].click();
      fixture.detectChanges();

      const dialog = fixture.nativeElement.querySelector('app-workout-modal') as HTMLElement;
      expect(dialog).not.toBeNull();
      expect(dialog.querySelector('app-exercise-guide')).not.toBeNull();
      expect(dialog.querySelector('h2')?.textContent).toContain('Goblet Squat');

      dialog.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-workout-modal')).toBeNull();
    });

    it('renders an optional video guide inside the guide', () => {
      dataService.getExercise.and.returnValue(of(exerciseDetail({
        videoUrl: 'https://www.youtube.com/watch?v=abc123def45'
      })));
      const withVideo = renderPlayer(plan());
      setWidth(withVideo, 360);
      withVideo.componentInstance.openGuide();
      withVideo.detectChanges();

      expect(withVideo.nativeElement.textContent).toContain('Watch video');
      expect(withVideo.nativeElement.querySelector('app-exercise-guide app-exercise-video .video-preview')).not.toBeNull();
    });

    it('follows the exercise when it changes and reuses cached details', fakeAsync(() => {
      expect(dataService.getExercise.calls.allArgs().filter(([exerciseId]) => exerciseId === 'exercise-1').length).toBe(1);

      fixture.debugElement.query(By.css('.complete-set')).nativeElement.click();
      tick(1_000);
      tick(800);
      fixture.detectChanges();

      expect(fixture.componentInstance.currentSubject().steps).toEqual(['Lower under control, then press away from the floor.']);
      expect(asText(fixture.nativeElement.querySelector('app-step-carousel'))).toContain('Lower under control');
      expect(dataService.getExercise.calls.allArgs().filter(([exerciseId]) => exerciseId === 'exercise-2').length).toBe(1);

      fixture.componentInstance.currentExerciseIndex.set(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.currentSubject().steps[0]).toBe('Brace your core before you descend.');
      expect(dataService.getExercise.calls.allArgs().filter(([exerciseId]) => exerciseId === 'exercise-1').length).toBe(1);
      settle();
    }));

    it('says so in the guide when the exercise has no catalog id, and shows no carousel', () => {
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
      setWidth(withoutCatalogId, 360);
      withoutCatalogId.componentInstance.openGuide();
      withoutCatalogId.detectChanges();

      expect(dataService.getExercise).not.toHaveBeenCalledWith('');
      expect(withoutCatalogId.nativeElement.querySelector('app-step-carousel .carousel')).toBeNull();
      expect(withoutCatalogId.nativeElement.textContent).toContain('No steps are listed for this movement.');
    });
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

      expect(textOf(player, '.sets')).toBe('0 of 4 sets');

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

      expect(textOf(player, '.sets')).toBe('1 of 4 sets');
      expect(player.componentInstance.segments()).toEqual([1 / 3, 0]);
    });

    it('shows the real number of sets and the target of the current set', () => {
      const player = mount(weeklySession(), weeklyPlan());

      expect(root(player).querySelectorAll('app-player-set-list li').length).toBe(3);
      expect(textOf(player, '.target')).toBe('45 sec · 30 sec rest');
      expect(text(player)).not.toContain('Follow the plan target');
    });

    it('offers the timer for a timed set and records the target values', () => {
      const player = mount(weeklySession(), weeklyPlan());
      player.componentRef.setInput('initialExerciseId', 'exercise-run');
      player.detectChanges();

      expect(text(player)).toContain('Start timer');
      expect(textOf(player, '.target')).toBe('30 min · 5.75 km');

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
        'Set 1 planned 10 × 20 kg, did 8 × 20 kg',
        'Set 2 10 × 20 kg',
        'Set 3 Skipped',
        'Set 4 10 × 20 kg'
      ]);
      expect(root(player).querySelector('app-player-set-list ol')).not.toBeNull();
      expect(root(player).querySelectorAll('app-player-set-list [aria-label="Done"]').length).toBe(2);
      expect(root(player).querySelector('app-player-set-list li.current')?.textContent).toContain('Set 4');
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

      expect(textOf(player, '.sets')).toBe('0 of 5 sets');
      expect(root(player).querySelectorAll('app-player-set-list li').length).toBe(3);
      expect(textOf(player, '.target')).toBe('12 reps · 15 kg · 1 sec rest');
    });

    it('shows no target line and one set when nothing is known', () => {
      const player = mount(detail(), plan({ exercises: [], days: [] }));

      expect(textOf(player, '.sets')).toBe('0 of 2 sets');
      expect(root(player).querySelector('.target')).toBeNull();
      expect(text(player)).not.toContain('Follow the plan target');
    });

    it('shows the elapsed time the way the workout bar does', () => {
      const player = mount(weeklySession(), weeklyPlan());

      expect(textOf(player, '.elapsed')).toBe(live.elapsedLabel());
    });

    describe('working through the sets', () => {
      /** Bench press and goblet squat, three sets each, with a rest after every set. */
      function strengthSession(): WorkoutSessionDetail {
        const base = detail();
        return detail({
          planDayId: 'day-1',
          exercises: [
            {
              ...base.exercises[0],
              exerciseId: 'ex-bench',
              exerciseNameSnapshot: 'Bench Press',
              sets: [1, 2, 3].map((n) => weeklySet(n, { reps: 10, weightKg: 20, restSeconds: 30 }))
            },
            {
              ...base.exercises[1],
              exerciseId: 'ex-squat',
              exerciseNameSnapshot: 'Goblet Squat',
              sets: [1, 2, 3].map((n) => weeklySet(n, { reps: 12, weightKg: 16, restSeconds: 30 }))
            }
          ]
        });
      }

      /** Answers every write with the workout as the server would hold it afterwards. */
      function followWrites(start: WorkoutSessionDetail): void {
        let current = start;
        dataService.upsertSessionSet.and.callFake((_sessionId, logId, setNumber, input) => {
          current = {
            ...current,
            exercises: current.exercises.map((log) => log.exerciseLogId !== logId
              ? log
              : {
                  ...log,
                  sets: log.sets.map((row) => row.setNumber !== setNumber
                    ? row
                    : {
                        ...row,
                        reps: input.reps,
                        weightKg: input.weightKg,
                        durationSeconds: input.durationSeconds,
                        restSeconds: input.restSeconds,
                        status: input.status ?? 'DONE',
                        logged: true
                      })
                })
          };
          return of(current);
        });
      }

      const button = (player: ComponentFixture<ExercisePlayerComponent>, selector: string) =>
        root(player).querySelector<HTMLButtonElement>(selector) as HTMLButtonElement;
      const buttonByText = (player: ComponentFixture<ExercisePlayerComponent>, label: string) =>
        Array.from(root(player).querySelectorAll<HTMLButtonElement>('button')).find((candidate) => candidate.textContent?.trim() === label) as HTMLButtonElement;

      function mountStrength(): ComponentFixture<ExercisePlayerComponent> {
        followWrites(strengthSession());
        return mount(strengthSession(), weeklyPlan());
      }

      function mountPlank(): ComponentFixture<ExercisePlayerComponent> {
        followWrites(weeklySession());
        return mount(weeklySession(), weeklyPlan());
      }

      it('says what comes next under the set list, with the rest before it', () => {
        const player = mountStrength();

        expect(textOf(player, '.next-line')).toBe('Next Set 2 of 3 · 10 reps · 20 kg, after 30 sec of rest');
      });

      it('names the next exercise on the last set of an exercise', () => {
        const player = mountStrength();
        player.componentInstance.currentSetNumber.set(3);
        player.detectChanges();

        expect(textOf(player, '.next-line')).toBe('Next Goblet Squat · Set 1 of 3 · 12 reps · 16 kg, after 30 sec of rest');
      });

      it('starts the steppers from the target and saves what was dialled in', () => {
        const player = mountStrength();

        const values = () => Array.from(root(player).querySelectorAll('app-player-stepper .value')).map((node) => node.textContent?.trim());
        expect(values()).toEqual(['10', '20']);

        button(player, '[aria-label="More weight"]').click();
        button(player, '[aria-label="Less reps"]').click();
        button(player, '[aria-label="Less reps"]').click();
        player.detectChanges();
        expect(values()).toEqual(['8', '22.5']);

        button(player, '.complete-set').click();

        expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
          'session-live',
          'log-1',
          1,
          jasmine.objectContaining({ reps: 8, weightKg: 22.5, restSeconds: 30 })
        );
      });

      it('shows a time stepper in steps of five seconds for a timed set', () => {
        const player = mountPlank();

        const value = () => textOf(player, 'app-player-stepper .value');
        expect(value()).toBe('0:45');
        button(player, '[aria-label="More time"]').click();
        player.detectChanges();
        expect(value()).toBe('0:50');

        button(player, '.complete-set').click();

        expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
          'session-live',
          'log-1',
          1,
          jasmine.objectContaining({ reps: null, durationSeconds: 50 })
        );
      });

      it('skips a set through the same endpoint and moves on without a rest', () => {
        const player = mountStrength();

        button(player, '.skip-set').click();
        player.detectChanges();

        expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
          'session-live',
          'log-1',
          1,
          jasmine.objectContaining({ status: 'SKIPPED', reps: null, weightKg: null, durationSeconds: null })
        );
        expect(player.componentInstance.currentSetNumber()).toBe(2);
        expect(player.componentInstance.restRemainingSeconds()).toBe(0);
        expect(root(player).querySelector('app-player-rest')).toBeNull();
        expect(textOf(player, 'app-player-set-list li:first-child')).toContain('Skipped');
      });

      it('skips the rest of an exercise from the More menu', () => {
        const player = mountStrength();

        const more = button(player, '[aria-label="More"]');
        expect(more.getAttribute('aria-expanded')).toBe('false');
        more.click();
        player.detectChanges();
        expect(more.getAttribute('aria-expanded')).toBe('true');

        buttonByText(player, 'Skip this exercise').click();
        player.detectChanges();

        const skipped = dataService.upsertSessionSet.calls.allArgs().filter(([, , , input]) => input.status === 'SKIPPED');
        expect(skipped.map(([, logId, setNumber]) => `${logId}:${setNumber}`)).toEqual(['log-1:1', 'log-1:2', 'log-1:3']);
        expect(player.componentInstance.currentExerciseIndex()).toBe(1);
        expect(textOf(player, '.name')).toBe('Goblet Squat');
        expect(more.getAttribute('aria-expanded')).toBe('false');
      });

      it('shows the rest with the next set of the same exercise and a line of fact from the coach', fakeAsync(() => {
        const player = mountStrength();

        button(player, '.complete-set').click();
        player.detectChanges();

        expect(textOf(player, 'app-player-rest .kicker')).toBe('Next');
        expect(textOf(player, 'app-player-rest .line')).toBe('Set 2 of 3 · 10 reps · 20 kg');
        expect(root(player).querySelector('app-player-rest .name')).toBeNull();
        expect(textOf(player, 'app-player-rest .said')).toBe('Five sets left in this workout.');
        expect(root(player).querySelector('app-player-rest [role="img"]')?.getAttribute('aria-label')).toBe('Rest, 0:30 left');

        buttonByText(player, '+15 sec').click();
        player.detectChanges();
        expect(player.componentInstance.restRemainingSeconds()).toBe(45);

        buttonByText(player, 'Skip rest').click();
        player.detectChanges();
        expect(player.componentInstance.currentSetNumber()).toBe(2);
        expect(root(player).querySelector('app-player-rest')).toBeNull();
        settle();
      }));

      it('shows the next exercise with its name and target when the last set of an exercise is done', fakeAsync(() => {
        dataService.getExercise.and.callFake((exerciseId) => of(exerciseId === 'ex-squat'
          ? exerciseDetail({ exerciseId: 'ex-squat', name: 'Goblet Squat', shortSteps: ['Sit down between the heels.'] })
          : exerciseDetail()));
        const player = mountStrength();
        for (let set = 1; set <= 2; set++) {
          button(player, '.complete-set').click();
          player.componentInstance.skipRest();
          player.detectChanges();
        }

        button(player, '.complete-set').click();
        player.detectChanges();

        expect(textOf(player, 'app-player-rest .kicker')).toBe('Next · exercise 2 of 2');
        expect(textOf(player, 'app-player-rest .name')).toBe('Goblet Squat');
        expect(textOf(player, 'app-player-rest .line')).toBe('Set 1 of 3 · 12 reps · 16 kg');
        expect(textOf(player, 'app-player-rest .said')).toBe('Three sets of bench press done, at 20 kg.');
        expect(textOf(player, 'app-player-rest app-step-carousel')).toContain('Sit down between the heels.');

        button(player, 'app-player-rest .ask').click();

        expect(coach.open).toHaveBeenCalled();
        expect(coach.ask).toHaveBeenCalledWith('How did my bench press sets go?');
        player.componentInstance.skipRest();
        settle();
      }));

      it('counts down three, two, one before a timed set, and Start now skips it', fakeAsync(() => {
        const player = mountPlank();

        button(player, '.start-timer').click();
        player.detectChanges();

        expect(player.componentInstance.stage()).toBe('countdown');
        expect(textOf(player, 'app-player-timer-stage .figure')).toBe('3');
        expect(textOf(player, 'app-player-timer-stage .line')).toBe('Set 1 of 3 · 45 sec');
        expect(textOf(player, 'app-player-timer-stage .name')).toBe('Plank');

        tick(1000);
        player.detectChanges();
        expect(textOf(player, 'app-player-timer-stage .figure')).toBe('2');

        buttonByText(player, 'Start now').click();
        player.detectChanges();

        expect(player.componentInstance.stage()).toBe('timed');
        expect(player.componentInstance.workGuideActive()).toBeTrue();
        expect(textOf(player, 'app-player-timer-stage .figure')).toBe('0:45');
        settle();
      }));

      it('starts the timed set itself when the countdown reaches zero, and Stop and save records it', fakeAsync(() => {
        const player = mountPlank();

        button(player, '.start-timer').click();
        player.detectChanges();
        tick(3000);
        player.detectChanges();
        expect(player.componentInstance.stage()).toBe('timed');

        tick(10_000);
        player.detectChanges();
        expect(textOf(player, 'app-player-timer-stage .figure')).toBe('0:35');
        expect(root(player).querySelector('app-player-timer-stage [role="img"]')?.getAttribute('aria-label')).toBe('0:35 left');

        buttonByText(player, 'Stop and save').click();

        expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
          'session-live',
          'log-1',
          1,
          jasmine.objectContaining({ durationSeconds: 10 })
        );
        player.componentInstance.skipRest();
        settle();
      }));

      it('starts the countdown when a rest ends and the next set is timed', fakeAsync(() => {
        const player = mountPlank();

        button(player, '.complete-set').click();
        player.detectChanges();
        expect(player.componentInstance.stage()).toBe('rest');

        tick(30_000);
        player.detectChanges();

        expect(player.componentInstance.currentSetNumber()).toBe(2);
        expect(player.componentInstance.stage()).toBe('countdown');

        tick(3000);
        player.detectChanges();
        expect(player.componentInstance.stage()).toBe('timed');
        settle();
      }));

      it('does not count down before a set of reps', fakeAsync(() => {
        const player = mountStrength();

        button(player, '.complete-set').click();
        player.componentInstance.skipRest();
        player.detectChanges();

        expect(player.componentInstance.stage()).toBe('set');
        expect(root(player).querySelector('app-player-timer-stage')).toBeNull();
        settle();
      }));

      it('stops reading aloud when the set is completed', () => {
        const player = mountStrength();
        player.componentInstance.readAloud.set(true);
        player.detectChanges();

        button(player, '.complete-set').click();

        expect(speech.cancel).toHaveBeenCalled();
        expect(player.componentInstance.readAloud()).toBeFalse();
        player.componentInstance.skipRest();
      });

      it('stops reading aloud when the screen is minimised', () => {
        const player = mountStrength();
        const minimised = jasmine.createSpy('minimise');
        player.componentInstance.minimise.subscribe(minimised);
        player.componentInstance.readAloud.set(true);
        player.detectChanges();

        button(player, '.minimise').click();

        expect(speech.cancel).toHaveBeenCalled();
        expect(minimised).toHaveBeenCalledTimes(1);
      });

      it('asks once before finishing with sets open, and Keep going leaves the workout running', () => {
        const player = mountStrength();
        spyOn(live, 'finish').and.returnValue(of(detail({ status: 'COMPLETED' })));

        buttonByText(player, 'Finish').click();
        player.detectChanges();

        const dialog = root(player).querySelector('app-workout-modal') as HTMLElement;
        expect(dialog.querySelector('h2')?.textContent).toBe('Finish now?');
        expect(dialog.textContent).toContain('6 sets are still open.');
        expect(live.finish).not.toHaveBeenCalled();

        buttonByText(player, 'Keep going').click();
        player.detectChanges();
        expect(root(player).querySelector('app-workout-modal')).toBeNull();
        expect(live.finish).not.toHaveBeenCalled();

        buttonByText(player, 'Finish').click();
        player.detectChanges();
        buttonByText(player, 'Finish and save').click();
        expect(live.finish).toHaveBeenCalledTimes(1);
      });

      it('offers Discard workout in the finish question, and asks again before it discards', () => {
        const player = mountStrength();

        buttonByText(player, 'Finish').click();
        player.detectChanges();
        buttonByText(player, 'Discard workout').click();
        player.detectChanges();

        expect(root(player).querySelector('app-workout-modal h2')?.textContent).toBe('Discard this workout?');
        expect(dataService.cancelSession).not.toHaveBeenCalled();
      });

      it('finishes at once when no set is open', () => {
        const done = strengthSession();
        const player = mount({
          ...done,
          exercises: done.exercises.map((log) => ({ ...log, sets: log.sets.map((row) => ({ ...row, logged: true })) }))
        }, weeklyPlan());
        spyOn(live, 'finish').and.returnValue(of(detail({ status: 'COMPLETED' })));

        buttonByText(player, 'Finish').click();

        expect(root(player).querySelector('app-workout-modal')).toBeNull();
        expect(live.finish).toHaveBeenCalledTimes(1);
      });

      it('has no separate Abort button', () => {
        const player = mountStrength();

        expect(text(player)).not.toContain('Abort');
      });
    });
  });
});
