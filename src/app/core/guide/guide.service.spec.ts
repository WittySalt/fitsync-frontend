import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { FitSyncDataService } from '../fitsync-data.service';
import { GuideBackendFake, createdDaysAgo, signInAs } from './guide-testing.spec';
import { GUIDE_SAVE_DEBOUNCE_MS, GuideService, TOUR_ACCOUNT_AGE_DAYS } from './guide.service';

const USER = 'user-guide-1';
const cacheKey = `fitsync.guide.${USER}.state`;

describe('GuideService', () => {
  let guide: GuideService;
  let backend: GuideBackendFake;

  function setup(
    answers: { plan?: boolean; session?: boolean; meal?: boolean | 'fail' } = {},
    configure?: (fake: GuideBackendFake) => void
  ): void {
    backend = new GuideBackendFake();
    configure?.(backend);
    const data = backend.data as unknown as Record<string, unknown>;
    data['getWorkoutPlans'] = () => of(answers.plan ? [{ status: 'ACTIVE' }] : []);
    data['getWorkoutSessionPage'] = () => of({ sessions: answers.session ? [{}] : [] });
    data['hasLoggedMeal'] = () => (answers.meal === 'fail' ? throwError(() => new Error('down')) : of(answers.meal === true));
    TestBed.configureTestingModule({ providers: backend.providers() });
    signInAs(USER);
    guide = TestBed.inject(GuideService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('the four steps of the card', () => {
    it('finds the person from the stored sign-in and loads the state once', () => {
      setup();
      expect(guide.ready()).toBeFalse();
      guide.start();
      expect(backend.gets).toBe(1);
      expect(guide.ready()).toBeTrue();
      guide.start();
      expect(backend.gets).toBe(1);
    });

    it('reads each step from the account data and never ticks one by hand', () => {
      setup({ plan: true, meal: true });
      guide.load([{ goalType: 'WEIGHT', status: 'ACTIVE' }]);

      expect(guide.steps()).toEqual({ targets: true, plan: true, meal: true, session: false });
      expect(guide.doneCount()).toBe(3);
      expect(guide.nextStep()).toBe('session');
      expect(guide.allDone()).toBeFalse();
      expect(guide.cardVisible()).toBeTrue();
    });

    it('counts only an active weight or sessions target for step 1', () => {
      setup();
      guide.load([
        { goalType: 'WEIGHT', status: 'ARCHIVED' },
        { goalType: 'CALORIES', status: 'ACTIVE' }
      ]);
      expect(guide.steps().targets).toBeFalse();
      expect(guide.nextStep()).toBe('targets');
    });

    it('leaves a step open when its request fails', () => {
      setup({ meal: 'fail' });
      guide.load([]);
      expect(guide.steps().meal).toBeFalse();
      expect(guide.loaded()).toBeTrue();
    });

    it('is all done when the four steps are', () => {
      setup({ plan: true, session: true, meal: true });
      guide.load([{ goalType: 'WORKOUT_FREQUENCY', status: 'ACTIVE' }]);
      expect(guide.allDone()).toBeTrue();
      expect(guide.nextStep()).toBeNull();
    });
  });

  describe('state on the server', () => {
    it('does not let anything start until the state has been loaded', () => {
      setup();
      expect(guide.spotlightDue('workout')).toBeFalse();
      guide.start();
      expect(guide.spotlightDue('workout')).toBeTrue();
    });

    it('waits for a slow server, whatever the cached copy says', () => {
      localStorage.setItem(cacheKey, JSON.stringify({ cardHidden: true }));
      backend = new GuideBackendFake();
      const answer = new Subject<{ state: null; updatedAt: null }>();
      backend.data.getGuideState = () => answer as never;
      TestBed.configureTestingModule({ providers: backend.providers() });
      signInAs(USER);
      guide = TestBed.inject(GuideService);
      guide.start();

      expect(guide.ready()).toBeFalse();
      expect(guide.spotlightDue('workout', true)).toBeFalse();
      answer.next({ state: null, updatedAt: null });
      answer.complete();
      expect(guide.ready()).toBeTrue();
      expect(guide.spotlightDue('workout')).toBeTrue();
    });

    it('leaves the guide off for the visit when the load fails', () => {
      setup({}, (fake) => (fake.failLoad = true));
      guide.start();

      expect(guide.ready()).toBeFalse();
      expect(guide.loadFailed()).toBeTrue();
      expect(guide.spotlightDue('workout')).toBeFalse();
      expect(guide.spotlightDue('workout', true)).toBeFalse();
      expect(guide.cardVisible()).toBeFalse();
    });

    it('does not write anything back after a failed load', fakeAsync(() => {
      setup({}, (fake) => (fake.failLoad = true));
      guide.start();
      guide.markSeen('workout');
      tick(GUIDE_SAVE_DEBOUNCE_MS);
      expect(backend.puts).toEqual([]);
    }));

    it('lets the server copy win over the copy cached in this browser', () => {
      localStorage.setItem(cacheKey, JSON.stringify({ tourMap: { workout: { seen: true } }, cardHidden: true }));
      setup({}, (fake) => (fake.state = { tourMap: { nutrition: { seen: true, skippedByData: false, replayedAt: null } }, cardHidden: false }));
      guide.start();

      expect(guide.seen('nutrition')).toBeTrue();
      expect(guide.seen('workout')).toBeFalse();
      guide.load([]);
      expect(guide.cardVisible()).toBeTrue();
    });

    it('moves what this browser knew up to the server when the server has no row', fakeAsync(() => {
      localStorage.setItem(cacheKey, JSON.stringify({ tourMap: { workout: { seen: true, skippedByData: false, replayedAt: null } }, cardHidden: true }));
      setup();
      guide.start();
      tick(GUIDE_SAVE_DEBOUNCE_MS);

      expect(guide.seen('workout')).toBeTrue();
      expect(backend.puts.length).toBe(1);
      expect(backend.puts[0]['cardHidden']).toBeTrue();
    }));

    it('reads the notes older versions kept key by key when nothing else is cached', () => {
      localStorage.setItem(`fitsync.guide.${USER}.card-hidden`, '1');
      localStorage.setItem(`fitsync.guide.${USER}.tour.me`, '1');
      setup();
      guide.start();
      guide.load([]);

      expect(guide.cardVisible()).toBeFalse();
      expect(guide.seen('me')).toBeTrue();
    });

    it('writes the whole state back 500 ms after the last change, once', fakeAsync(() => {
      setup();
      guide.start();
      guide.markSeen('workout');
      tick(GUIDE_SAVE_DEBOUNCE_MS - 100);
      guide.hideCard();
      tick(GUIDE_SAVE_DEBOUNCE_MS - 1);
      expect(backend.puts).toEqual([]);
      tick(1);

      expect(backend.puts.length).toBe(1);
      expect(backend.puts[0]).toEqual({
        tourMap: { workout: { seen: true, skippedByData: false, replayedAt: null } },
        cardHidden: true,
        tourSkipped: false,
        restarted: false,
        counters: {}
      });
      expect(JSON.parse(localStorage.getItem(cacheKey) ?? '{}').cardHidden).toBeTrue();
    }));

    it('keeps a change that fails to save in memory and in the cache', fakeAsync(() => {
      setup();
      backend.data.putGuideState = () => throwError(() => new Error('down'));
      guide.start();
      guide.skipTour();
      tick(GUIDE_SAVE_DEBOUNCE_MS);

      expect(guide.spotlightDue('workout')).toBeFalse();
      expect(JSON.parse(localStorage.getItem(cacheKey) ?? '{}').tourSkipped).toBeTrue();
    }));

    it('adds what was opened before the state arrived to the counters it brings', () => {
      setup({}, (fake) => (fake.state = { counters: { 'exercise-opened': 2 } }));
      guide.bump('exercise-opened');
      expect(guide.count('exercise-opened')).toBe(3);
    });

    it('does not share state between two accounts of one browser', () => {
      setup();
      guide.adopt(USER);
      guide.hideCard();
      backend.state = null;
      signInAs('someone-else');
      guide.start();

      guide.load([]);
      expect(guide.cardVisible()).toBeTrue();
    });
  });

  describe('a new account', () => {
    it('is one whose profile was created within 14 days', () => {
      setup({}, (fake) => (fake.createdAt = createdDaysAgo(TOUR_ACCOUNT_AGE_DAYS - 1)));
      guide.start();
      expect(guide.spotlightDue('workout')).toBeTrue();
    });

    it('is left alone after 14 days', () => {
      setup({}, (fake) => (fake.createdAt = createdDaysAgo(TOUR_ACCOUNT_AGE_DAYS + 1)));
      guide.start();
      expect(guide.spotlightDue('workout')).toBeFalse();
      expect(guide.spotlightDue('workout', true)).toBeTrue();
    });

    it('is not guessed when the profile has no creation time', () => {
      setup({}, (fake) => (fake.createdAt = null));
      guide.start();
      expect(guide.spotlightDue('workout')).toBeFalse();
    });
  });

  describe('what starts on its own', () => {
    beforeEach(() => {
      setup();
      guide.start();
    });

    it('is the four first-tour pages for a new account, once', () => {
      for (const page of ['workout', 'nutrition', 'progress', 'me'] as const) {
        expect(guide.spotlightDue(page)).withContext(page).toBeTrue();
      }
      guide.markSeen('workout');
      expect(guide.spotlightDue('workout')).toBeFalse();
      expect(guide.spotlightDue('nutrition')).toBeTrue();
    });

    it('is no other surface', () => {
      for (const page of [
        'workout-plans', 'workout-history', 'workout-library', 'nutrition-recipes', 'nutrition-nutrients', 'progress-goal',
        'progress-training', 'progress-food', 'coach-dock', 'workout-live', 'workout-plan-flow', 'coach-plan-studio',
        'workout-session-detail', 'nutrition-recipe', 'nutrition-cook', 'nutrition-nutrient', 'me-achievements', 'settings'
      ] as const) {
        expect(guide.spotlightDue(page)).withContext(page).toBeFalse();
      }
    });

    it('is a page opened with ?guide=, even for an older account', () => {
      expect(guide.spotlightDue('workout', true)).toBeTrue();
    });

    it('includes the session player, whose condition is that no session has been completed yet', () => {
      expect(guide.spotlightDue('workout-session-player')).toBeTrue();
      expect(guide.gate('workout-session-player')).toBe('wait');
      guide.reportUsed('workout-session-player', false);
      expect(guide.gate('workout-session-player')).toBe('go');
      guide.reportUsed('workout-session-player', true);
      expect(guide.gate('workout-session-player')).toBe('skip');
    });

    it('asks the completed-session count for that', () => {
      backend.data.getWorkoutSessionPage = () => of({ sessions: backend.completedSessions ? [{}] : [] });
      guide.checkFirstSession();
      expect(guide.gate('workout-session-player')).toBe('go');
      backend.completedSessions = 1;
      guide.checkFirstSession();
      expect(guide.gate('workout-session-player')).toBe('skip');
    });

    it('stays unreported when the count cannot be read', () => {
      backend.data.getWorkoutSessionPage = () => throwError(() => new Error('down')) as never;
      guide.checkFirstSession();
      expect(guide.gate('workout-session-player')).toBe('wait');
    });

    it('stops every spotlight after Skip the tour', () => {
      guide.skipTour();
      expect(guide.spotlightDue('progress')).toBeFalse();
      expect(guide.spotlightDue('workout-session-player')).toBeFalse();
    });
  });

  describe('restarting', () => {
    it('resets the state on the server and re-enables only the four first-tour pages', fakeAsync(() => {
      setup({}, (fake) => {
        fake.createdAt = createdDaysAgo(60);
        fake.state = {
          cardHidden: true,
          tourSkipped: true,
          tourMap: { me: { seen: true }, 'workout-history': { seen: true } },
          counters: { 'exercise-opened': 4 }
        };
      });
      guide.start();
      expect(guide.spotlightDue('me')).toBeFalse();

      guide.restart(USER);
      tick(GUIDE_SAVE_DEBOUNCE_MS);

      expect(guide.spotlightDue('me')).toBeTrue();
      expect(guide.spotlightDue('workout')).toBeTrue();
      expect(guide.spotlightDue('workout-history')).toBeFalse();
      expect(guide.count('exercise-opened')).toBe(0);
      expect(backend.puts.length).toBe(1);
      expect(backend.puts[0]).toEqual({ tourMap: {}, cardHidden: false, tourSkipped: false, restarted: true, counters: {} });
      guide.load([]);
      expect(guide.cardVisible()).toBeTrue();
    }));

    it('works while the load is still on its way, and the late answer does not undo it', () => {
      backend = new GuideBackendFake();
      const answer = new Subject<{ state: Record<string, unknown>; updatedAt: null }>();
      backend.data.getGuideState = () => answer as never;
      TestBed.configureTestingModule({ providers: backend.providers() });
      signInAs(USER);
      guide = TestBed.inject(GuideService);
      guide.start();
      guide.restart(USER);
      answer.next({ state: { tourSkipped: true }, updatedAt: null });
      answer.complete();

      expect(guide.ready()).toBeTrue();
      expect(guide.spotlightDue('workout')).toBeTrue();
    });

    it('does not need the data service to reset a page that only restarts the guide', () => {
      TestBed.configureTestingModule({ providers: [{ provide: FitSyncDataService, useValue: {} }] });
      signInAs(USER);
      guide = TestBed.inject(GuideService);
      expect(() => guide.restart(USER)).not.toThrow();
      expect(guide.ready()).toBeTrue();
    });
  });
});
