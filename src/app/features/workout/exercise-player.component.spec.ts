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
import { COUNTDOWN_GO_MS } from './player-timer-stage.component';

/**
 * Completes the current set the way a person does: a counted set is started, its countdown is
 * skipped, and "Complete set" is pressed. A timed set has its own quiet "Complete set" button.
 */
function completeSet(host: ComponentFixture<ExercisePlayerComponent>): void {
  const root = host.nativeElement as HTMLElement;
  const start = root.querySelector<HTMLButtonElement>('.start-set');
  if (start) {
    start.click();
    host.detectChanges();
    host.componentInstance.onCountdownStarted();
    host.detectChanges();
  }
  root.querySelector<HTMLButtonElement>('.complete-set')?.click();
}

function clearStoredRuns(): void {
  try {
    sessionStorage.clear();
  } catch {
    // Storage may be missing; the tests then have nothing to clear.
  }
}

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
    clearStoredRuns();
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

  it('keeps every step in order and leaves out a description that only repeats the first step', () => {
    fixture.componentInstance.currentDetail.set(exerciseDetail({
      description: 'Brace your core and keep a flat back.',
      instructions: [
        { stepNumber: 1, text: 'Brace your core and keep a flat back.' },
        { stepNumber: 2, text: 'Hinge at the hips and lower the bar.' }
      ]
    }));

    const subject = fixture.componentInstance.currentSubject();
    expect(subject.fullSteps).toEqual(['Brace your core and keep a flat back.', 'Hinge at the hips and lower the bar.']);
    expect(subject.description).toBe('');
  });

  it('shows the original instructions in full in the guide while the carousel keeps the short steps', () => {
    const long = 'Lie on the bench with your feet flat on the floor, grip the bar slightly wider than your shoulders, unrack it and lower it under control to the middle of your chest.';
    fixture.componentInstance.currentDetail.set(exerciseDetail({
      description: 'Get into a prone position on the floor.',
      shortSteps: ['Brace the core.', 'Hold a straight line.'],
      instructions: [
        { stepNumber: 2, text: 'Press the bar back up.' },
        { stepNumber: 1, text: long },
        { stepNumber: 3, text: 'Repeat for the prescribed number of repetitions.' }
      ]
    }));
    fixture.componentInstance.openGuide();
    fixture.detectChanges();

    const guide = (fixture.nativeElement as HTMLElement).querySelector('app-exercise-guide') as HTMLElement;
    const items = Array.from(guide.querySelectorAll('.steps li .text')).map((item) => item.textContent?.trim());
    expect(items).toEqual([long, 'Press the bar back up.']);
    expect(guide.querySelector('.description')?.textContent).toContain('prone position');
    expect(fixture.componentInstance.currentSubject().steps).toEqual(['Brace the core.', 'Hold a straight line.']);
  });

  it('reads the full steps of the guide in order, on its own, and leaves the carousel alone', () => {
    fixture.componentInstance.currentDetail.set(exerciseDetail({
      shortSteps: ['Brace.', 'Hold.'],
      instructions: [
        { stepNumber: 1, text: 'Lie on the bench and unrack the bar with straight arms.' },
        { stepNumber: 2, text: 'Lower the bar under control to the middle of your chest.' }
      ]
    }));
    fixture.componentInstance.openGuide();
    fixture.detectChanges();

    const guide = (fixture.nativeElement as HTMLElement).querySelector('app-exercise-guide') as HTMLElement;
    guide.querySelector<HTMLButtonElement>('.read')?.click();
    fixture.detectChanges();

    expect(speech.speak.calls.mostRecent().args[0]).toBe('Lie on the bench and unrack the bar with straight arms.');
    expect(fixture.componentInstance.readAloud()).toBeFalse();
    speech.speak.calls.mostRecent().args[1].ended();
    fixture.detectChanges();
    expect(speech.speak.calls.mostRecent().args[0]).toBe('Lower the bar under control to the middle of your chest.');
  });

  it('falls back to the short steps in the guide when the exercise has no original instructions', () => {
    fixture.componentInstance.currentDetail.set(exerciseDetail({
      shortSteps: ['Brace the core.', 'Hold a straight line.'],
      instructions: []
    }));
    fixture.componentInstance.openGuide();
    fixture.detectChanges();

    const guide = (fixture.nativeElement as HTMLElement).querySelector('app-exercise-guide') as HTMLElement;
    expect(guide.querySelectorAll('.steps li').length).toBe(2);
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

  it('makes the confirming Discard a filled red button and keeps Keep going outlined', () => {
    fixture.componentInstance.confirm.set('discard');
    fixture.detectChanges();

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-workout-modal button'));
    expect(buttons.find((button) => button.textContent?.trim() === 'Discard')?.classList.contains('danger-solid')).toBeTrue();
    expect(buttons.find((button) => button.textContent?.trim() === 'Keep going')?.classList.contains('secondary')).toBeTrue();
  });

  it('makes Finish and save the filled green action of the finish question, and Discard workout a red text action', () => {
    fixture.componentInstance.confirm.set('finish');
    fixture.detectChanges();

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-workout-modal button'));
    expect(buttons.find((button) => button.textContent?.trim() === 'Finish and save')?.classList.contains('primary')).toBeTrue();
    expect(buttons.find((button) => button.textContent?.trim() === 'Keep going')?.classList.contains('secondary')).toBeTrue();
    expect(buttons.find((button) => button.textContent?.trim() === 'Discard workout')?.classList.contains('danger-text')).toBeTrue();
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
    completeSet(fixture);

    expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
      'session-live',
      'log-1',
      1,
      jasmine.objectContaining({ reps: 10, weightKg: 20, restSeconds: 1 })
    );
  });

  it('shows a short Done cue when a set is saved', fakeAsync(() => {
    completeSet(fixture);
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
    completeSet(fixture);
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

  it('advances to the next exercise after rest finishes', fakeAsync(() => {
    completeSet(fixture);
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
      expect(guide.querySelector('li[aria-current]')).toBeNull();

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

      completeSet(fixture);
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

    completeSet(fixture);

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
      const start = (player.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.start-set');
      expect(start?.disabled).toBeTrue();
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
                        logged: (input.status ?? 'DONE') !== 'SKIPPED'
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

        completeSet(player);

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

        completeSet(player);

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

        completeSet(player);
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
          completeSet(player);
          player.componentInstance.skipRest();
          player.detectChanges();
        }

        completeSet(player);
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

      it('shows a set ready first: nothing counts down until Start set is pressed', fakeAsync(() => {
        const player = mountStrength();

        expect(player.componentInstance.stage()).toBe('set');
        expect(textOf(player, '.start-set')).toBe('Start set');
        expect(root(player).querySelector('.complete-set')).toBeNull();
        expect(root(player).querySelector('.start-tempo')).toBeNull();
        expect(root(player).querySelectorAll('app-player-stepper').length).toBe(2);
        expect(textOf(player, '.ready .eyebrow')).toBe('This set');
        expect(root(player).querySelector('app-player-ring')).toBeNull();
        expect(root(player).querySelector('app-step-carousel')).not.toBeNull();

        tick(10_000);
        player.detectChanges();
        expect(player.componentInstance.stage()).toBe('set');

        button(player, '.start-set').click();
        player.detectChanges();

        expect(player.componentInstance.stage()).toBe('countdown');
        expect(textOf(player, 'app-player-timer-stage .figure')).toBe('3');
        expect(textOf(player, 'app-player-timer-stage .line')).toBe('Set 1 of 3 · 10 reps · 20 kg');
        settle();
      }));

      it('counts three, two, one and Go after Start set, announcing each figure once, then the set is active', fakeAsync(() => {
        const player = mountStrength();
        const announced: string[] = [];
        const note = () => announced.push(player.componentInstance.liveAnnouncement());

        button(player, '.start-set').click();
        player.detectChanges();
        note();
        for (const figure of ['2', '1', 'Go']) {
          tick(1000);
          player.detectChanges();
          expect(textOf(player, 'app-player-timer-stage .figure')).toBe(figure);
          note();
        }
        expect(announced).toEqual(['3', '2', '1', 'Go']);
        expect(root(player).querySelector('app-player-ring [aria-live]')).toBeNull();

        tick(COUNTDOWN_GO_MS);
        player.detectChanges();

        expect(player.componentInstance.stage()).toBe('set');
        expect(player.componentInstance.setActive()).toBeTrue();
        expect(textOf(player, '.complete-set')).toBe('Complete set');
        expect(root(player).querySelector('.running app-player-ring')).not.toBeNull();
        expect(root(player).querySelectorAll('app-player-stepper').length).toBe(0);
        expect(textOf(player, '.at-weight')).toBe('at 20 kg');
        expect(document.activeElement).toBe(button(player, '.complete-set'));
        player.componentInstance.skipCurrentSet();
        settle();
      }));

      it('skips the countdown with Start now or a tap on the ring', fakeAsync(() => {
        const player = mountStrength();

        button(player, '.start-set').click();
        player.detectChanges();
        buttonByText(player, 'Start now').click();
        player.detectChanges();
        expect(player.componentInstance.setActive()).toBeTrue();
        player.componentInstance.skipCurrentSet();
        settle();

        const other = mountStrength();
        button(other, '.start-set').click();
        other.detectChanges();
        button(other, '.ring-tap').click();
        other.detectChanges();
        expect(other.componentInstance.setActive()).toBeTrue();
        other.componentInstance.skipCurrentSet();
        settle();
      }));

      it('guides the reps of an active counted set with a ring at the tempo, and never ends the set by itself', fakeAsync(() => {
        const player = mountStrength();
        button(player, '.start-set').click();
        player.detectChanges();
        buttonByText(player, 'Start now').click();
        player.detectChanges();

        const centre = () => textOf(player, '.running .figure');
        const caption = () => textOf(player, '.running .caption');
        expect(centre()).toBe('0 / 10');
        expect(caption()).toBe('0:00');

        tick(7000);
        player.detectChanges();
        expect(centre()).toBe('2 / 10');
        expect(caption()).toBe('0:07');
        expect(root(player).querySelector('.running [role="img"]')?.getAttribute('aria-label')).toBe('2 of 10 reps, set time 0:07');

        tick(23_000);
        player.detectChanges();
        expect(centre()).toBe('10 / 10');
        expect(root(player).querySelector('.running .ring.urgent')).not.toBeNull();

        tick(30_000);
        player.detectChanges();
        expect(centre()).toBe('10 / 10');
        expect(caption()).toBe('1:00');
        expect(dataService.upsertSessionSet).not.toHaveBeenCalled();
        expect(player.componentInstance.setActive()).toBeTrue();

        // The ring is a guide, and the running set has no steppers: what is recorded was chosen in Ready.
        expect(root(player).querySelector('app-player-stepper')).toBeNull();
        button(player, '.complete-set').click();
        expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
          'session-live',
          'log-1',
          1,
          jasmine.objectContaining({ reps: 10, weightKg: 20 })
        );
        player.componentInstance.skipRest();
        settle();
      }));

      it('counts the ring toward the reps chosen in Ready, shows the chosen weight, and records both', fakeAsync(() => {
        const player = mountStrength();
        button(player, '[aria-label="Less reps"]').click();
        button(player, '[aria-label="Less reps"]').click();
        button(player, '[aria-label="More weight"]').click();
        player.detectChanges();
        button(player, '.start-set').click();
        player.detectChanges();
        buttonByText(player, 'Start now').click();
        tick(30_000);
        player.detectChanges();

        expect(textOf(player, '.running .figure')).toBe('8 / 8');
        expect(textOf(player, '.at-weight')).toBe('at 22.5 kg');
        expect(player.componentInstance.live.run()?.targetReps).toBe(8);
        expect(root(player).querySelector('app-player-stepper')).toBeNull();

        button(player, '.complete-set').click();

        expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
          'session-live',
          'log-1',
          1,
          jasmine.objectContaining({ reps: 8, weightKg: 22.5 })
        );
        player.componentInstance.skipRest();
        settle();
      }));

      it('keeps the chosen reps and weight in the run, so a reopened active set counts toward them', fakeAsync(() => {
        const player = mountStrength();
        button(player, '[aria-label="More reps"]').click();
        button(player, '[aria-label="More weight"]').click();
        player.detectChanges();
        button(player, '.start-set').click();
        player.detectChanges();
        buttonByText(player, 'Start now').click();
        tick(10_000);
        player.destroy();
        const stored = JSON.parse(sessionStorage.getItem('fitsync.workout.run.session-live') ?? '{}');
        expect(stored.targetReps).toBe(11);
        expect(stored.weightKg).toBe(22.5);

        const again = TestBed.createComponent(ExercisePlayerComponent);
        again.componentRef.setInput('session', live.session());
        again.componentRef.setInput('activePlan', weeklyPlan());
        again.detectChanges();

        expect(textOf(again, '.running .figure')).toBe('3 / 11');
        expect(textOf(again, '.at-weight')).toBe('at 22.5 kg');
        button(again, '.complete-set').click();
        expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
          'session-live',
          'log-1',
          1,
          jasmine.objectContaining({ reps: 11, weightKg: 22.5 })
        );
        again.componentInstance.skipRest();
        settle();
      }));

      it('counts a timed set down from the time chosen in Ready, and records what ran', fakeAsync(() => {
        const player = mountPlank();
        button(player, '[aria-label="More time"]').click();
        player.detectChanges();
        button(player, '.start-timer').click();
        player.detectChanges();
        buttonByText(player, 'Start now').click();
        player.detectChanges();

        expect(root(player).querySelector('app-player-stepper')).toBeNull();
        expect(textOf(player, 'app-player-timer-stage .figure')).toBe('0:50');
        tick(10_000);
        player.detectChanges();
        expect(textOf(player, 'app-player-timer-stage .figure')).toBe('0:40');

        button(player, 'app-player-timer-stage .quiet').click();
        expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
          'session-live',
          'log-1',
          1,
          jasmine.objectContaining({ reps: null, durationSeconds: 10 })
        );
        player.componentInstance.skipRest();
        settle();
      }));

      describe('correcting a set afterwards', () => {
        /** Bench press with set 1 done at 10 x 20 kg and set 2 skipped. */
        function finishedSession(): WorkoutSessionDetail {
          const session = strengthSession();
          return {
            ...session,
            exercises: [
              {
                ...session.exercises[0],
                sets: [
                  { ...session.exercises[0].sets[0], logged: true, status: 'DONE', reps: 10, weightKg: 20, restSeconds: 30, setLogId: 's1' },
                  { ...session.exercises[0].sets[1], status: 'SKIPPED' },
                  session.exercises[0].sets[2]
                ]
              },
              session.exercises[1]
            ]
          };
        }

        function mountFinished(): ComponentFixture<ExercisePlayerComponent> {
          followWrites(finishedSession());
          return mount(finishedSession(), weeklyPlan());
        }

        const rows = (player: ComponentFixture<ExercisePlayerComponent>) =>
          Array.from(root(player).querySelectorAll<HTMLButtonElement>('app-player-set-list button.row'));

        it('names a done row and a skipped row as buttons that edit, and leaves the open one alone', () => {
          const player = mountFinished();

          expect(rows(player).map((row) => row.getAttribute('aria-label'))).toEqual([
            'Set 1, 10 reps at 20 kg, done. Edit',
            'Set 2, skipped. Edit'
          ]);
          expect(root(player).querySelectorAll('app-player-set-list li').length).toBe(3);
          expect(root(player).querySelector('app-player-set-list li:nth-child(3) button')).toBeNull();
          expect(root(player).querySelector('app-workout-modal')).toBeNull();
        });

        it('saves the edited values of a done row through the record path, for the same set', () => {
          const player = mountFinished();
          rows(player)[0].click();
          player.detectChanges();

          expect(textOf(player, 'app-workout-modal h2')).toBe('Edit set 1');
          const modal = root(player).querySelector('app-workout-modal') as HTMLElement;
          const values = () => Array.from(modal.querySelectorAll('app-player-stepper .value')).map((node) => node.textContent?.trim());
          expect(values()).toEqual(['10', '20']);
          modal.querySelector<HTMLButtonElement>('[aria-label="Less reps"]')?.click();
          modal.querySelector<HTMLButtonElement>('[aria-label="More weight"]')?.click();
          player.detectChanges();
          dataService.upsertSessionSet.calls.reset();
          modal.querySelector<HTMLButtonElement>('.save')?.click();
          player.detectChanges();

          expect(dataService.upsertSessionSet).toHaveBeenCalledTimes(1);
          const [sessionId, logId, setNumber, input] = dataService.upsertSessionSet.calls.mostRecent().args;
          expect([sessionId, logId, setNumber]).toEqual(['session-live', 'log-1', 1]);
          expect(input).toEqual(jasmine.objectContaining({ reps: 9, weightKg: 22.5 }));
          expect(input.status).toBeUndefined();
          expect(root(player).querySelector('app-workout-modal')).toBeNull();
          expect(textOf(player, 'app-player-set-list li:first-child .values')).toBe('9 × 22.5 kg');
        });

        it('turns a skipped row into a done set when it is saved', () => {
          const player = mountFinished();
          rows(player)[1].click();
          player.detectChanges();
          const modal = root(player).querySelector('app-workout-modal') as HTMLElement;
          dataService.upsertSessionSet.calls.reset();
          modal.querySelector<HTMLButtonElement>('.save')?.click();
          player.detectChanges();

          const [, , setNumber, input] = dataService.upsertSessionSet.calls.mostRecent().args;
          expect(setNumber).toBe(2);
          expect(input).toEqual(jasmine.objectContaining({ reps: 10, weightKg: 20 }));
          expect(input.status).toBeUndefined();
          const row = root(player).querySelector('app-player-set-list li:nth-child(2)');
          expect(row?.classList).toContain('done');
          expect(row?.classList).not.toContain('skipped');
        });

        it('leaves the set unchanged on Cancel and on Escape', () => {
          const player = mountFinished();
          dataService.upsertSessionSet.calls.reset();
          rows(player)[0].click();
          player.detectChanges();
          const modal = root(player).querySelector('app-workout-modal') as HTMLElement;
          modal.querySelector<HTMLButtonElement>('[aria-label="Less reps"]')?.click();
          modal.querySelector<HTMLButtonElement>('.cancel')?.click();
          player.detectChanges();

          expect(root(player).querySelector('app-workout-modal')).toBeNull();
          expect(dataService.upsertSessionSet).not.toHaveBeenCalled();
          expect(textOf(player, 'app-player-set-list li:first-child .values')).toBe('10 × 20 kg');

          rows(player)[0].click();
          player.detectChanges();
          (root(player).querySelector('dialog') as HTMLDialogElement).dispatchEvent(new Event('cancel', { cancelable: true }));
          player.detectChanges();
          expect(root(player).querySelector('app-workout-modal')).toBeNull();
          expect(dataService.upsertSessionSet).not.toHaveBeenCalled();
        });
      });

      it('takes the pace of the ring from the type of the exercise', fakeAsync(() => {
        dataService.getExercise.and.returnValue(of(exerciseDetail({ exerciseType: 'MOBILITY' })));
        const player = mountStrength();
        button(player, '.start-set').click();
        player.detectChanges();
        buttonByText(player, 'Start now').click();
        tick(8000);
        player.detectChanges();

        expect(textOf(player, '.running .figure')).toBe('2 / 10');
        player.componentInstance.skipCurrentSet();
        settle();
      }));

      it('shows only a quiet set time while the set has no reps to count', fakeAsync(() => {
        const session = detail({
          planDayId: 'day-1',
          exercises: [{ ...detail().exercises[0], sets: [weeklySet(1, { restSeconds: 0 })] }]
        });
        followWrites(session);
        const player = mount(session, weeklyPlan());
        button(player, '.start-set').click();
        player.detectChanges();
        buttonByText(player, 'Start now').click();
        tick(5000);
        player.detectChanges();

        expect(root(player).querySelector('.running app-player-ring')).toBeNull();
        expect(textOf(player, '.set-clock')).toBe('Set time 0:05');
        player.componentInstance.skipCurrentSet();
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
        player.componentInstance.stopGuidedSet();
        settle();
      }));

      it('starts the timed set itself when the countdown reaches zero, and Stop and save records it', fakeAsync(() => {
        const player = mountPlank();

        button(player, '.start-timer').click();
        player.detectChanges();
        tick(3000 + COUNTDOWN_GO_MS);
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

      it('records a timed set at zero and goes to rest, as the on-screen timer does', fakeAsync(() => {
        const player = mountPlank();

        button(player, '.start-timer').click();
        player.detectChanges();
        buttonByText(player, 'Start now').click();
        tick(45_000);
        player.detectChanges();

        expect(dataService.upsertSessionSet).toHaveBeenCalledTimes(1);
        expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
          'session-live',
          'log-1',
          1,
          jasmine.objectContaining({ reps: null, durationSeconds: 45, restSeconds: 30 })
        );
        expect(player.componentInstance.stage()).toBe('rest');
        player.componentInstance.skipRest();
        settle();
      }));

      it('shows the next timed set ready when a rest ends, with no countdown, and the primary button has focus', fakeAsync(() => {
        const player = mountPlank();

        completeSet(player);
        player.detectChanges();
        expect(player.componentInstance.stage()).toBe('rest');

        tick(30_000);
        player.detectChanges();
        player.detectChanges();

        expect(player.componentInstance.currentSetNumber()).toBe(2);
        expect(player.componentInstance.stage()).toBe('set');
        expect(textOf(player, '.start-timer')).toBe('Start timer');
        expect(document.activeElement).toBe(button(player, '.start-timer'));
        tick(5000);
        expect(player.componentInstance.stage()).toBe('set');
        settle();
      }));

      it('shows the next set of reps ready when a rest ends, and again after Skip rest', fakeAsync(() => {
        const player = mountStrength();

        completeSet(player);
        player.detectChanges();
        tick(30_000);
        player.detectChanges();

        expect(player.componentInstance.stage()).toBe('set');
        expect(player.componentInstance.currentSetNumber()).toBe(2);
        expect(textOf(player, '.start-set')).toBe('Start set');
        expect(root(player).querySelector('app-player-timer-stage')).toBeNull();

        completeSet(player);
        player.componentInstance.skipRest();
        player.detectChanges();

        expect(player.componentInstance.stage()).toBe('set');
        expect(player.componentInstance.currentSetNumber()).toBe(3);
        expect(textOf(player, '.start-set')).toBe('Start set');
        settle();
      }));

      it('stops reading aloud when the set is completed', () => {
        const player = mountStrength();
        player.componentInstance.readAloud.set(true);
        player.detectChanges();

        completeSet(player);

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

      describe('with three exercises of three sets', () => {
        function threeSession(): WorkoutSessionDetail {
          const base = detail();
          const exercise = (n: number, id: string, name: string) => ({
            ...base.exercises[0],
            exerciseLogId: `log-${n}`,
            exerciseId: id,
            exerciseNameSnapshot: name,
            sequence: n,
            sets: [1, 2, 3].map((set) => weeklySet(set, { reps: 10, weightKg: 20, restSeconds: 30 }))
          });
          return detail({ planDayId: 'day-1', exercises: [exercise(1, 'ex-a', 'Bench Press'), exercise(2, 'ex-b', 'Row'), exercise(3, 'ex-c', 'Squat')] });
        }

        function mountThree(): ComponentFixture<ExercisePlayerComponent> {
          followWrites(threeSession());
          return mount(threeSession(), weeklyPlan());
        }

        it('counts the open sets of the whole workout in the finish question and in the rest line', fakeAsync(() => {
          const player = mountThree();

          buttonByText(player, 'Finish').click();
          player.detectChanges();
          expect(root(player).querySelector('app-workout-modal')?.textContent).toContain('9 sets are still open.');
          buttonByText(player, 'Keep going').click();
          player.detectChanges();

          completeSet(player);
          player.detectChanges();

          expect(textOf(player, 'app-player-rest .said')).toBe('Eight sets left in this workout.');
          buttonByText(player, 'Finish').click();
          player.detectChanges();
          expect(root(player).querySelector('app-workout-modal')?.textContent).toContain('8 sets are still open.');
          player.componentInstance.skipRest();
          settle();
        }));

        it('leaves a skipped set out of the sets still open', () => {
          const player = mountThree();

          button(player, '.skip-set').click();
          player.detectChanges();
          buttonByText(player, 'Finish').click();
          player.detectChanges();

          expect(root(player).querySelector('app-workout-modal')?.textContent).toContain('8 sets are still open.');
        });

        it('opens on the first set that is neither done nor skipped when the screen is reopened', () => {
          const session = threeSession();
          session.exercises[0].sets[0] = { ...session.exercises[0].sets[0], status: 'DONE', logged: true };
          session.exercises[0].sets[1] = { ...session.exercises[0].sets[1], status: 'SKIPPED', logged: false };

          const player = mount(session, weeklyPlan());

          expect(player.componentInstance.currentExerciseIndex()).toBe(0);
          expect(player.componentInstance.currentSetNumber()).toBe(3);
          expect(textOf(player, 'app-player-set-list li.current')).toContain('Set 3');
        });

        it('moves past a set that was skipped ahead of the current one', () => {
          const session = threeSession();
          session.exercises[0].sets[1] = { ...session.exercises[0].sets[1], status: 'SKIPPED', logged: false };
          followWrites(session);
          const player = mount(session, weeklyPlan());

          button(player, '.skip-set').click();
          player.detectChanges();

          expect(player.componentInstance.currentSetNumber()).toBe(3);
        });

        it('carries Skip this exercise in the session itself, so a reload lands on the next exercise', () => {
          const player = mountThree();

          button(player, '[aria-label="More"]').click();
          player.detectChanges();
          buttonByText(player, 'Skip this exercise').click();
          player.detectChanges();

          expect(player.componentInstance.currentExerciseIndex()).toBe(1);
          expect(live.nextSet()).toEqual(jasmine.objectContaining({ exerciseId: 'ex-b', setNumber: 1 }));
          expect(live.currentLabel()).toBe('Row \u00b7 set 1 of 3');

          // Reopening from the bar asks the live service where the person is.
          live.open();
          const reopened = TestBed.createComponent(ExercisePlayerComponent);
          reopened.componentRef.setInput('session', live.session());
          reopened.componentRef.setInput('activePlan', weeklyPlan());
          reopened.componentRef.setInput('initialExerciseId', live.playerStart().exerciseId);
          reopened.componentRef.setInput('initialSetNumber', live.nextSet()?.setNumber ?? null);
          reopened.detectChanges();
          expect(reopened.componentInstance.currentExerciseIndex()).toBe(1);
          expect(reopened.componentInstance.currentSetNumber()).toBe(1);
        });

        it('goes on to the exercise after, not to one whose sets are all skipped already', () => {
          const session = threeSession();
          session.exercises[1].sets = session.exercises[1].sets.map((row) => ({ ...row, status: 'SKIPPED', logged: false }));
          followWrites(session);
          const player = mount(session, weeklyPlan());

          button(player, '[aria-label="More"]').click();
          player.detectChanges();
          buttonByText(player, 'Skip this exercise').click();
          player.detectChanges();

          expect(player.componentInstance.currentExerciseIndex()).toBe(2);
        });
      });

      describe('a set that keeps running while the screen is away', () => {
        const reopen = (): ComponentFixture<ExercisePlayerComponent> => {
          const player = TestBed.createComponent(ExercisePlayerComponent);
          player.componentRef.setInput('session', live.session());
          player.componentRef.setInput('activePlan', weeklyPlan());
          player.detectChanges();
          return player;
        };
        const startTimed = (player: ComponentFixture<ExercisePlayerComponent>) => {
          button(player, '.start-timer').click();
          player.detectChanges();
          buttonByText(player, 'Start now').click();
          player.detectChanges();
        };
        const startCounted = (player: ComponentFixture<ExercisePlayerComponent>) => {
          button(player, '.start-set').click();
          player.detectChanges();
          buttonByText(player, 'Start now').click();
          player.detectChanges();
        };

        it('reopens a timed set with the ring at the right point', fakeAsync(() => {
          const player = mountPlank();
          startTimed(player);
          tick(10_000);
          player.destroy();
          tick(5_000);

          const again = reopen();

          expect(again.componentInstance.stage()).toBe('timed');
          expect(textOf(again, 'app-player-timer-stage .figure')).toBe('0:30');
          expect(again.componentInstance.currentSetNumber()).toBe(1);
          again.componentInstance.stopGuidedSet();
          settle();
        }));

        it('reopens an active counted set with its ring and its set time', fakeAsync(() => {
          const player = mountStrength();
          startCounted(player);
          tick(10_000);
          player.destroy();
          tick(5_000);

          const again = reopen();

          expect(again.componentInstance.setActive()).toBeTrue();
          expect(textOf(again, '.running .figure')).toBe('5 / 10');
          expect(textOf(again, '.running .caption')).toBe('0:15');
          expect(textOf(again, '.complete-set')).toBe('Complete set');
          again.componentInstance.skipCurrentSet();
          settle();
        }));

        it('reopens a timed set that ended while away on its rest, and the set after it once the rest is over', fakeAsync(() => {
          const player = mountPlank();
          startTimed(player);
          tick(5_000);
          player.destroy();
          tick(40_000);

          expect(dataService.upsertSessionSet).toHaveBeenCalledTimes(1);
          expect(dataService.upsertSessionSet).toHaveBeenCalledWith(
            'session-live',
            'log-1',
            1,
            jasmine.objectContaining({ reps: null, durationSeconds: 45, restSeconds: 30 })
          );
          const resting = reopen();
          expect(resting.componentInstance.stage()).toBe('rest');
          expect(resting.componentInstance.restRemainingSeconds()).toBe(30);
          resting.destroy();

          tick(30_000);
          const ready = reopen();

          expect(ready.componentInstance.stage()).toBe('set');
          expect(ready.componentInstance.currentSetNumber()).toBe(2);
          expect(textOf(ready, '.start-timer')).toBe('Start timer');
          expect(dataService.upsertSessionSet).toHaveBeenCalledTimes(1);
          settle();
        }));

        it('reopens a rest with the right time left', fakeAsync(() => {
          const player = mountStrength();
          completeSet(player);
          player.detectChanges();
          tick(12_000);
          player.destroy();
          tick(8_000);

          const again = reopen();

          expect(again.componentInstance.stage()).toBe('rest');
          expect(again.componentInstance.restRemainingSeconds()).toBe(10);
          expect(again.componentInstance.currentSetNumber()).toBe(1);
          again.componentInstance.skipRest();
          settle();
        }));

        it('resumes a countdown that was in progress as the set ready, not as a countdown', fakeAsync(() => {
          const player = mountStrength();
          button(player, '.start-set').click();
          player.detectChanges();
          expect(player.componentInstance.stage()).toBe('countdown');
          player.destroy();

          const again = reopen();

          expect(again.componentInstance.stage()).toBe('set');
          expect(textOf(again, '.start-set')).toBe('Start set');
          settle();
        }));

        it('keeps a pause through the minimise', fakeAsync(() => {
          const player = mountPlank();
          startTimed(player);
          tick(10_000);
          buttonByText(player, 'Pause').click();
          player.destroy();
          tick(20_000);

          const again = reopen();

          expect(live.paused()).toBeTrue();
          expect(textOf(again, 'app-player-timer-stage .figure')).toBe('0:35');
          expect(textOf(again, 'app-player-timer-stage .caption')).toBe('Paused');
          buttonByText(again, 'Resume').click();
          again.componentInstance.stopGuidedSet();
          settle();
        }));

        it('clears the stored set when the set is completed or skipped', fakeAsync(() => {
          const key = 'fitsync.workout.run.session-live';
          const session = detail({
            planDayId: 'day-1',
            exercises: [{ ...detail().exercises[0], sets: [weeklySet(1, { reps: 10, restSeconds: 0 }), weeklySet(2, { reps: 10, restSeconds: 0 })] }]
          });
          followWrites(session);
          const player = mount(session, weeklyPlan());
          startCounted(player);
          expect(sessionStorage.getItem(key)).not.toBeNull();

          button(player, '.complete-set').click();
          player.detectChanges();
          expect(sessionStorage.getItem(key)).toBeNull();

          startCounted(player);
          expect(sessionStorage.getItem(key)).not.toBeNull();
          button(player, '.skip-set').click();
          player.detectChanges();
          expect(sessionStorage.getItem(key)).toBeNull();
          settle();
        }));
      });

      describe('the one Pause', () => {
        it('has a single Pause during a timed set, and it holds the set timer too', fakeAsync(() => {
          const player = mountPlank();

          button(player, '.start-timer').click();
          player.detectChanges();
          buttonByText(player, 'Start now').click();
          player.detectChanges();
          expect(player.componentInstance.stage()).toBe('timed');

          const pauses = Array.from(root(player).querySelectorAll('button')).filter((candidate) => /^Pause$/.test(candidate.textContent?.trim() ?? ''));
          expect(pauses.length).toBe(1);
          expect(root(player).querySelector('app-player-timer-stage')?.textContent).not.toContain('Pause');

          pauses[0].click();
          tick(5000);
          player.detectChanges();
          expect(textOf(player, 'app-player-timer-stage .figure')).toBe('0:45');
          expect(textOf(player, 'app-player-timer-stage .caption')).toBe('Paused');

          buttonByText(player, 'Resume').click();
          tick(2000);
          player.detectChanges();
          expect(textOf(player, 'app-player-timer-stage .figure')).toBe('0:43');
          buttonByText(player, 'Stop and save').click();
          player.componentInstance.skipRest();
          settle();
        }));
      });
    });
  });
});
