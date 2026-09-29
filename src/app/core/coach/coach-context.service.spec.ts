import { surfaceFor } from './coach-context.service';

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
});
