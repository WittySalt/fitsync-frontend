import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AnalyticsApiService } from './analytics-api.service';
import { FitSyncDataService } from './fitsync-data.service';
import { mapBadge, mapBadges, mapFootprint } from './me-mappers';

describe('me mappers', () => {
  describe('mapFootprint', () => {
    it('keeps the days in order with their flags and the totals', () => {
      const footprint = mapFootprint({
        memberSince: '2026-08-04',
        from: '2026-08-03',
        to: '2026-08-09',
        days: [
          { date: '2026-08-05', trained: true, logged: false },
          { date: '2026-08-04', trained: false, logged: true }
        ],
        totals: { workouts: 31, daysLogged: 58, badges: 7 }
      });

      expect(footprint.days.map((day) => [day.date, day.trained, day.logged])).toEqual([
        ['2026-08-04', false, true],
        ['2026-08-05', true, false]
      ]);
      expect(footprint.from).toBe('2026-08-03');
      expect(footprint.totals).toEqual({ workouts: 31, daysLogged: 58, badges: 7 });
    });

    it('survives an empty or damaged response', () => {
      expect(mapFootprint(null).days).toEqual([]);
      expect(mapFootprint({ days: [{ date: 'nope' }, null, { date: '2026-08-04' }], totals: { workouts: 'x' } })).toEqual({
        memberSince: '',
        from: '2026-08-04',
        to: '2026-08-04',
        days: [{ date: '2026-08-04', trained: false, logged: false }],
        totals: { workouts: 0, daysLogged: 0, badges: 0 }
      });
    });
  });

  describe('mapBadge and mapBadges', () => {
    it('reads a badge with its progress and evidence', () => {
      expect(
        mapBadge({
          code: 'FULL_WEEK',
          theme: 'SHOWING_UP',
          name: 'A full week',
          how: 'A week that met the target',
          earnedOn: '2026-09-27T10:00:00Z',
          progress: { current: 1, target: 1, unit: 'weeks' },
          evidence: { weekStart: '2026-09-21' }
        })
      ).toEqual({
        code: 'FULL_WEEK',
        theme: 'SHOWING_UP',
        name: 'A full week',
        how: 'A week that met the target',
        earnedOn: '2026-09-27',
        progress: { current: 1, target: 1, unit: 'weeks' },
        evidence: { weekStart: '2026-09-21', sessionId: null, recordId: null, line: null },
        pace: null
      });
    });

    it('drops badges without a code and falls back to the code for a missing name', () => {
      expect(mapBadge({ name: 'No code' })).toBeNull();
      expect(mapBadge({ code: 'NEW_ONE' })?.name).toBe('NEW_ONE');
      expect(mapBadge({ code: 'NEW_ONE' })?.earnedOn).toBeNull();
    });

    it('builds themes, counts and the earlier row, and keeps only two next-up entries', () => {
      const model = mapBadges({
        earned: 1,
        total: 17,
        themes: [
          {
            code: 'SHOWING_UP',
            name: 'Showing up',
            paths: [{ nodes: [{ code: 'FIRST_WORKOUT', earnedOn: '2026-08-07' }, { code: 'WORKOUTS_10' }] }, { nodes: [] }]
          }
        ],
        latest: { code: 'FIRST_WORKOUT', earnedOn: '2026-08-07' },
        nextUp: [{ code: 'A' }, { code: 'B' }, { code: 'C' }],
        earlier: [{ code: 'STREAK_7', name: '7-day streak', earnedOn: '2026-09-01' }]
      });

      expect(model.themes.length).toBe(1);
      expect(model.themes[0].paths.length).toBe(1);
      expect(model.earned).toBe(1);
      expect(model.total).toBe(17);
      expect(model.latest?.code).toBe('FIRST_WORKOUT');
      expect(model.nextUp.map((node) => node.code)).toEqual(['A', 'B']);
      expect(model.earlier.map((node) => node.code)).toEqual(['STREAK_7']);
    });

    it('counts the earned and total itself when the server sent neither', () => {
      const model = mapBadges({ themes: [{ code: 'T', name: 'T', paths: [{ nodes: [{ code: 'A', earnedOn: '2026-08-07' }, { code: 'B' }] }] }] });
      expect([model.earned, model.total]).toEqual([1, 2]);
    });

    it('reads an empty response as no badges', () => {
      expect(mapBadges(undefined)).toEqual({ themes: [], earned: 0, total: 0, latest: null, nextUp: [], earlier: [], since: '' });
    });
  });
});

describe('the data layer for Me', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the footprint from the analytics service', () => {
    let days = 0;
    TestBed.inject(FitSyncDataService)
      .getFootprint()
      .subscribe((footprint) => (days = footprint.days.length));

    http.expectOne('/api/v1/analytics/me/footprint').flush({ days: [{ date: '2026-08-04', trained: true, logged: true }] });

    expect(days).toBe(1);
  });

  it('loads the badges from the achievements endpoint', () => {
    let codes: string[] = [];
    TestBed.inject(FitSyncDataService)
      .getBadges()
      .subscribe((model) => (codes = model.themes.flatMap((theme) => theme.paths.flatMap((path) => path.nodes.map((node) => node.code)))));

    http.expectOne('/api/v1/analytics/achievements').flush({ themes: [{ code: 'T', name: 'T', paths: [{ nodes: [{ code: 'FIRST_WORKOUT' }] }] }] });

    expect(codes).toEqual(['FIRST_WORKOUT']);
  });

  it('still gives the month view and the celebration their flat list from the themed response', () => {
    let result: { code: string; unlocked: boolean; unlockedAt: string | null; progress: number }[] = [];
    TestBed.inject(AnalyticsApiService)
      .getAchievements()
      .subscribe((value) => (result = value.achievements));

    http.expectOne('/api/v1/analytics/achievements').flush({
      themes: [
        {
          code: 'T',
          name: 'T',
          paths: [
            {
              nodes: [
                { code: 'FIRST_WORKOUT', earnedOn: '2026-08-07', progress: { current: 1, target: 1, unit: 'workouts' } },
                { code: 'WORKOUTS_50', progress: { current: 31, target: 50, unit: 'workouts' } }
              ]
            }
          ]
        }
      ]
    });

    expect(result.map((entry) => [entry.code, entry.unlocked, entry.progress])).toEqual([
      ['FIRST_WORKOUT', true, 1],
      ['WORKOUTS_50', false, 0.62]
    ]);
    expect(result[0].unlockedAt).toBe('2026-08-07T00:00:00Z');
  });
});
