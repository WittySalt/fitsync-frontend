import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DayKind } from '../fitsync.models';
import { CoachContextService, surfaceFor } from './coach-context.service';

/**
 * The route-to-surface table. Each surface's suggested questions are the product's promise about
 * what the coach can answer, so the mapping is worth pinning: a page bound to the wrong surface
 * would offer questions the coach cannot ground.
 */
describe('surfaceFor', () => {
  it('binds each page to its surface', () => {
    expect(surfaceFor('/dashboard').id).toBe('dashboard');
    expect(surfaceFor('/').id).toBe('dashboard');
    expect(surfaceFor('/workout').id).toBe('workout');
    expect(surfaceFor('/nutrition').id).toBe('nutrition');
    expect(surfaceFor('/progress').id).toBe('progress');
    expect(surfaceFor('/body').id).toBe('progress');
    expect(surfaceFor('/me').id).toBe('profile');
    expect(surfaceFor('/settings').id).toBe('profile');
    expect(surfaceFor('/coach/plan').id).toBe('coach');
  });

  it('ignores query strings and fragments', () => {
    expect(surfaceFor('/workout?tab=history#top').id).toBe('workout');
  });

  it('falls back to a general surface for anything else', () => {
    expect(surfaceFor('/auth/login').id).toBe('other');
  });

  it('gives every surface at least one suggestion and a label', () => {
    for (const url of ['/dashboard', '/workout', '/nutrition', '/progress', '/me', '/coach', '/x']) {
      const surface = surfaceFor(url);
      expect(surface.label).withContext(url).not.toBe('');
      expect(surface.suggestions.length).withContext(url).toBeGreaterThan(0);
    }
  });

  it('marks the build-me-a-session suggestions as generative', () => {
    const generative = surfaceFor('/workout').suggestions.filter((s) => s.generative);
    expect(generative.map((s) => s.text)).toEqual(['Build me a session for today']);
  });

  describe('with the kind of today known', () => {
    const texts = (url: string, kind: DayKind | null) => surfaceFor(url, kind).suggestions.map((s) => s.text);

    const expected: Array<[DayKind, string[]]> = [
      ['STRENGTH', ['What should I lift today?', 'Build me a session for today', 'How is my week going?']],
      ['CARDIO', ['How far did I run last time?', 'Build me a session for today', 'How is my week going?']],
      ['MOBILITY', ['How long was my last mobility session?', 'Build me a session for today', 'How is my week going?']],
      ['SPORT', ['How long did I play last time?', 'How is my week going?', 'What did I train yesterday?']],
      ['REST', ['What did I train yesterday?', 'How is my week going?', 'When is my next session?']]
    ];

    for (const [kind, questions] of expected) {
      it(`offers the ${kind} questions on the workout and home surfaces`, () => {
        expect(texts('/workout', kind)).toEqual(questions);
        expect(texts('/dashboard', kind)).toEqual(questions);
      });
    }

    it('offers no session to build on a rest day or a sport day', () => {
      expect(surfaceFor('/workout', 'REST').suggestions.some((s) => s.generative)).toBeFalse();
      expect(surfaceFor('/dashboard', 'SPORT').suggestions.some((s) => s.generative)).toBeFalse();
    });

    it('keeps the surface own questions for an open or unknown day', () => {
      expect(texts('/workout', 'OPEN')).toEqual(texts('/workout', null));
      expect(texts('/workout', null)).toEqual(['Should I train today?', 'Build me a session for today', 'How is my week going?']);
      expect(texts('/dashboard', null)).toEqual(['How is my day going?', 'Build me a session for today', 'What should I eat tonight?']);
    });

    it('leaves the other surfaces unchanged', () => {
      for (const url of ['/nutrition', '/progress', '/me', '/coach', '/x']) {
        expect(texts(url, 'CARDIO')).withContext(url).toEqual(texts(url, null));
      }
    });

    it('follows the kind a page sets on the service', () => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const context = TestBed.inject(CoachContextService);
      const before = context.surface().suggestions.map((s) => s.text);

      context.setTodayKind('REST');
      expect(context.todayKind()).toBe('REST');
      expect(context.surface().suggestions.map((s) => s.text)).toEqual(texts('/dashboard', 'REST'));

      context.setTodayKind(null);
      expect(context.surface().suggestions.map((s) => s.text)).toEqual(before);
    });

    it('keeps the surface id, label and server code', () => {
      const surface = surfaceFor('/workout', 'CARDIO');
      expect(surface.id).toBe('workout');
      expect(surface.code).toBe('WORKOUT');
      expect(surface.label).toBe('Workout, this week');
    });
  });
});
