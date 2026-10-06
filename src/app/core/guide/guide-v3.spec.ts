import { TestBed } from '@angular/core/testing';

import { FitSyncDataService } from '../fitsync-data.service';
import { GUIDE_GATES, plansInUse } from './guide-gates';
import { GUIDE_PATHS, SURFACE_LABELS } from './guide-paths';
import { signInAs } from './guide-testing.spec';
import { GuideService, TOUR_PAGES, TOUR_SURFACES, TourPage } from './guide.service';

const DAY_MS = 24 * 3600 * 1000;
const USER = 'user-v3';
const key = (name: string): string => `fitsync.guide.${USER}.${name}`;
const stored = (): Record<string, { seen: boolean; skippedByData: boolean; replayedAt: string | null }> =>
  JSON.parse(localStorage.getItem(key('tour-map')) ?? '{}');

describe('The paths of the second-level surfaces', () => {
  it('gives every surface three steps with words, a label and no urging', () => {
    for (const page of TOUR_PAGES) {
      expect(GUIDE_PATHS[page].length).withContext(page).toBe(3);
      expect(SURFACE_LABELS[page]).withContext(page).toBeTruthy();
      for (const step of GUIDE_PATHS[page]) {
        for (const variant of ['', 'empty']) {
          const copy = step.copy(variant);
          expect(copy.title).withContext(`${page}/${step.id}`).toBeTruthy();
          expect(copy.text).withContext(`${page}/${step.id}`).toBeTruthy();
          expect(copy.text + copy.title).withContext(`${page}/${step.id}`).not.toMatch(/[!—]|should|prioriti|must/i);
        }
      }
    }
  });

  it('lists the steps of each new path in the order of the spec', () => {
    const ids = (page: TourPage): string[] => GUIDE_PATHS[page].map((step) => step.id);
    expect(ids('workout-plans')).toEqual(['card', 'new', 'week']);
    expect(ids('workout-history')).toEqual(['filters', 'row', 'trends']);
    expect(ids('workout-library')).toEqual(['search', 'filters', 'progress']);
    expect(ids('nutrition-recipes')).toEqual(['tonight', 'sort', 'cook']);
    expect(ids('nutrition-nutrients')).toEqual(['period', 'tile', 'door']);
    expect(ids('progress-goal')).toEqual(['nav', 'ask', 'back']);
    expect(ids('progress-training')).toEqual(['nav', 'ask', 'back']);
    expect(ids('progress-food')).toEqual(['nav', 'ask', 'back']);
    expect(ids('coach-dock')).toEqual(['reading', 'questions', 'composer']);
  });

  it('says what the spec says on the steps it words', () => {
    const text = (page: TourPage, id: string): string => GUIDE_PATHS[page].find((step) => step.id === id)?.copy('').text ?? '';
    expect(text('workout-plans', 'card')).toBe('This is your week. Each day says what it is for.');
    expect(text('workout-plans', 'new')).toBe('The coach fills a week from your profile. Change any day.');
    expect(text('workout-history', 'filters')).toBe('Filter by kind or date.');
    expect(text('workout-library', 'progress')).toBe('Every exercise has its own history.');
    expect(text('nutrition-recipes', 'cook')).toBe('Cook opens the Ready sheet, then cook mode with timers.');
    expect(text('nutrition-nutrients', 'tile')).toBe('Tap a nutrient for its page and guide.');
    expect(text('progress-food', 'back')).toBe('Back to the overview.');
    expect(text('coach-dock', 'composer')).toBe('Ask, or ask it to build something.');
  });
});

describe('The skip conditions', () => {
  it('judges an active plan as in use only when a day was edited after it was made', () => {
    expect(plansInUse(null)).toBeFalse();
    expect(plansInUse({ createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:20Z' })).toBeFalse();
    expect(plansInUse({ createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-03T09:00:00Z' })).toBeTrue();
    expect(plansInUse({ createdAt: null, updatedAt: '2026-10-03T09:00:00Z' })).toBeFalse();
  });

  it('names a condition for every surface the spec gates, and none for the dock', () => {
    expect(Object.keys(GUIDE_GATES).sort()).toEqual(
      ['nutrition-nutrients', 'nutrition-recipes', 'progress-food', 'progress-goal', 'progress-training', 'workout-history', 'workout-library', 'workout-plans']
    );
    expect(GUIDE_GATES['coach-dock']).toBeUndefined();
  });
});

describe('GuideService in v3', () => {
  let guide: GuideService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: FitSyncDataService, useValue: {} }] });
    signInAs(USER);
    guide = TestBed.inject(GuideService);
    guide.adopt(USER);
  });
  afterEach(() => localStorage.clear());

  it('does not hold the new surfaces back for the age of the account', () => {
    localStorage.setItem(key('first-seen'), String(Date.now() - 90 * DAY_MS));
    guide.adopt(USER);

    expect(guide.spotlightDue('workout')).toBeFalse();
    expect(guide.spotlightDue('workout-history')).toBeTrue();
  });

  it('keeps seen, skippedByData and replayedAt per surface in the tour map', () => {
    guide.markSeen('workout-plans');
    guide.markSkippedByData('workout-library');
    guide.markReplayed('coach-dock');

    const map = stored();
    expect(map['workout-plans']).toEqual({ seen: true, skippedByData: false, replayedAt: null });
    expect(map['workout-library']).toEqual({ seen: false, skippedByData: true, replayedAt: null });
    expect(map['coach-dock'].replayedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(guide.spotlightDue('workout-plans')).toBeFalse();
    expect(guide.spotlightDue('workout-library')).toBeFalse();
    expect(guide.spotlightDue('coach-dock')).toBeTrue();
  });

  it('reads the map back for the same person and folds in the older per-page flag', () => {
    guide.markSeen('progress-goal');
    localStorage.setItem(key('tour.me'), '1');
    guide.adopt(USER);

    expect(guide.seen('progress-goal')).toBeTrue();
    expect(guide.seen('me')).toBeTrue();
    expect(guide.seen('progress-food')).toBeFalse();
  });

  it('shows the surfaces nothing has marked, in the map of every surface', () => {
    for (const page of TOUR_SURFACES) {
      expect(guide.spotlightDue(page)).withContext(page).toBeTrue();
    }
  });

  it('decides a count condition from what was opened', () => {
    expect(guide.gate('workout-history')).toBe('go');
    guide.bump('session-opened');
    guide.bump('session-opened');
    expect(guide.gate('workout-history')).toBe('go');
    guide.bump('session-opened');
    expect(guide.gate('workout-history')).toBe('skip');

    expect(guide.gate('workout-library')).toBe('go');
    guide.bump('exercise-opened');
    expect(guide.gate('workout-library')).toBe('skip');
  });

  it('skips a page opened twice before, on its third visit', () => {
    guide.noteVisit('progress-goal');
    guide.noteVisit('progress-goal');
    expect(guide.gate('progress-goal')).toBe('go');
    guide.noteVisit('progress-goal');
    expect(guide.gate('progress-goal')).toBe('skip');
    expect(guide.gate('progress-food')).toBe('go');
  });

  it('waits for the data of a data condition, then goes or skips by what the page reports', () => {
    expect(guide.gate('workout-plans')).toBe('wait');
    let reported = 0;
    guide.usageReported.subscribe(() => reported++);
    guide.reportUsed('workout-plans', false);
    expect(guide.gate('workout-plans')).toBe('go');
    guide.reportUsed('workout-plans', true);
    expect(guide.gate('workout-plans')).toBe('skip');
    expect(reported).toBe(2);
    expect(guide.gate('coach-dock')).toBe('go');
  });

  it('keeps counters across a reload of the same person', () => {
    guide.bump('session-opened');
    guide.adopt(USER);
    expect(guide.count('session-opened')).toBe(1);
  });

  it('clears seen and skippedByData for every surface on restart, and keeps when each was replayed', () => {
    guide.markSeen('workout-plans');
    guide.markSeen('me');
    guide.markSkippedByData('workout-library');
    guide.markReplayed('workout-plans');
    guide.bump('exercise-opened');
    guide.reportUsed('workout-plans', true);

    guide.restart(USER);

    const map = stored();
    expect(map['workout-plans']).toEqual({ seen: false, skippedByData: false, replayedAt: jasmine.any(String) as unknown as string });
    expect(map['me']).toBeUndefined();
    expect(map['workout-library']).toBeUndefined();
    for (const page of TOUR_PAGES) {
      expect(guide.spotlightDue(page)).withContext(page).toBeTrue();
    }
    expect(guide.count('exercise-opened')).toBe(0);
    expect(guide.gate('workout-plans')).toBe('wait');
  });
});
