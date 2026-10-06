import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../fitsync-data.service';
import { signInAs } from './guide-testing.spec';
import { GuideService, TOUR_ACCOUNT_AGE_DAYS } from './guide.service';

const DAY_MS = 24 * 3600 * 1000;
const USER = 'user-guide-1';
const key = (name: string): string => `fitsync.guide.${USER}.${name}`;

describe('GuideService', () => {
  let guide: GuideService;
  let data: jasmine.SpyObj<FitSyncDataService>;

  function setup(answers: { plan?: boolean; session?: boolean; meal?: boolean | 'fail' } = {}): void {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getWorkoutPlans', 'getWorkoutSessionPage', 'hasLoggedMeal']);
    data.getWorkoutPlans.and.returnValue(of(answers.plan ? [{ status: 'ACTIVE' } as never] : []));
    data.getWorkoutSessionPage.and.returnValue(of({ sessions: answers.session ? [{}] : [] }) as never);
    data.hasLoggedMeal.and.returnValue(answers.meal === 'fail' ? throwError(() => new Error('down')) : of(answers.meal === true));
    TestBed.configureTestingModule({
      providers: [
        { provide: FitSyncDataService, useValue: data }
      ]
    });
    signInAs(USER);
    guide = TestBed.inject(GuideService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('finds the person from the stored sign-in without a request', () => {
    setup();
    guide.start();
    expect(guide.ready()).toBeTrue();
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

  it('hides the card for good and remembers it per user', () => {
    setup();
    guide.load([]);
    guide.hideCard();

    expect(guide.cardVisible()).toBeFalse();
    expect(localStorage.getItem(key('card-hidden'))).toBe('1');
  });

  it('shows a spotlight once to a new account', () => {
    setup();
    guide.adopt(USER);

    expect(guide.spotlightDue('workout')).toBeTrue();
    expect(guide.spotlightDue('workout', true)).toBeTrue();
    guide.markSeen('workout');
    expect(guide.spotlightDue('workout')).toBeFalse();
    expect(guide.spotlightDue('nutrition')).toBeTrue();
    expect(JSON.parse(localStorage.getItem(key('tour-map')) ?? '{}').workout.seen).toBeTrue();
  });

  it('stops every spotlight after Skip the tour', () => {
    setup();
    guide.adopt(USER);
    guide.skipTour();

    expect(guide.spotlightDue('progress')).toBeFalse();
    expect(localStorage.getItem(key('tour-skipped'))).toBe('1');
  });

  it('leaves an account older than 14 days alone', () => {
    localStorage.setItem(key('first-seen'), String(Date.now() - (TOUR_ACCOUNT_AGE_DAYS + 1) * DAY_MS));
    setup();
    guide.adopt(USER);

    expect(guide.spotlightDue('workout')).toBeFalse();
  });

  it('restarts the guide for an old account and clears every flag', () => {
    localStorage.setItem(key('first-seen'), String(Date.now() - 60 * DAY_MS));
    localStorage.setItem(key('card-hidden'), '1');
    localStorage.setItem(key('tour-skipped'), '1');
    localStorage.setItem(key('tour.me'), '1');
    setup();
    guide.adopt(USER);
    expect(guide.spotlightDue('me')).toBeFalse();

    guide.restart(USER);

    expect(guide.spotlightDue('me')).toBeTrue();
    expect(guide.spotlightDue('workout')).toBeTrue();
    expect(localStorage.getItem(key('card-hidden'))).toBeNull();
    expect(localStorage.getItem(key('tour-skipped'))).toBeNull();
    expect(localStorage.getItem(key('tour.me'))).toBeNull();
    guide.load([]);
    expect(guide.cardVisible()).toBeTrue();
  });

  it('does not share flags between two accounts of one browser', () => {
    setup();
    guide.adopt(USER);
    guide.hideCard();
    guide.adopt('someone-else');

    expect(guide.cardVisible()).toBeFalse();
    guide.load([]);
    expect(guide.cardVisible()).toBeTrue();
  });
});
