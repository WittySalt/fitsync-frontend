import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Goal } from '../../../core/fitsync.models';
import { GuideBackendFake, signInAs } from '../../../core/guide/guide-testing.spec';
import { GuideService, MEAL_RETRY_DELAY_MS } from '../../../core/guide/guide.service';
import { GuideCardComponent } from './guide-card.component';

const goal = (goalType: string): Goal => ({ goalType, status: 'ACTIVE' }) as Goal;

describe('GuideCardComponent', () => {
  let fixture: ComponentFixture<GuideCardComponent>;
  /** The server the guide reads; it lives across a reset of the testing module, like the real one. */
  let backend: GuideBackendFake;

  function render(done: { goals?: Goal[]; plan?: boolean; meal?: boolean | 'fail'; session?: boolean }): HTMLElement {
    const data = backend.data as unknown as Record<string, unknown>;
    data['getWorkoutPlans'] = () => of(done.plan ? [{ status: 'ACTIVE' }] : []);
    data['getWorkoutSessionPage'] = () => of({ sessions: done.session ? [{}] : [] });
    data['hasLoggedMeal'] = () => (done.meal === 'fail' ? throwError(() => new Error('503')) : of(!!done.meal));
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...backend.providers()] });
    signInAs('card-user');
    fixture = TestBed.createComponent(GuideCardComponent);
    fixture.componentRef.setInput('goals', done.goals ?? []);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const hideButton = (el: HTMLElement, label: string): HTMLButtonElement =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('.hide')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement;

  beforeEach(() => {
    localStorage.clear();
    backend = new GuideBackendFake();
  });
  afterEach(() => localStorage.clear());

  it('shows four numbered steps with the first undone one highlighted when nothing is done', () => {
    const el = render({});

    expect(el.querySelector('.eyebrow')?.textContent).toContain('Getting started');
    expect(el.querySelector('h2')?.textContent).toContain('Four steps to your first week');
    const tiles = el.querySelectorAll('.tile');
    expect(tiles.length).toBe(4);
    expect(Array.from(tiles).map((tile) => tile.querySelector('.disc')?.textContent?.trim())).toEqual(['1', '2', '3', '4']);
    expect(tiles[0].classList).toContain('current');
    expect(el.querySelectorAll('.go.primary').length).toBe(1);
    const links = Array.from(el.querySelectorAll('a.go')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/me?guide=me#goal-lifecycle', '/workout?guide=workout', '/nutrition?log=BREAKFAST&guide=nutrition', '/workout?guide=workout-session']);
  });

  it('keeps the meal step neutral when the meal check cannot be read, never showing it as open or done', fakeAsync(() => {
    const el = render({ goals: [goal('WEIGHT')], plan: true, meal: 'fail' });
    tick(MEAL_RETRY_DELAY_MS);
    fixture.detectChanges();

    const meal = el.querySelector('.tile[data-step="meal"]') as HTMLElement;
    expect(meal.classList).toContain('unknown');
    expect(meal.classList).not.toContain('done');
    expect(meal.classList).not.toContain('current');
    expect(meal.querySelector('.done-note')).toBeNull();
    expect(meal.querySelector('.disc')?.textContent?.trim()).toBe('3');
    expect(meal.querySelector('.go.primary')).toBeNull();
    expect(el.querySelector('.tile[data-step="session"]')?.classList).toContain('current');
  }));

  it('marks finished steps with a check, drops their button and moves the highlight on', () => {
    const el = render({ goals: [goal('WEIGHT')], plan: true });

    const tiles = el.querySelectorAll('.tile');
    expect(tiles[0].classList).toContain('done');
    expect(tiles[1].classList).toContain('done');
    expect(tiles[0].querySelector('.go')).toBeNull();
    expect(tiles[0].querySelector('.disc')?.classList).toContain('filled');
    expect(tiles[2].classList).toContain('current');
    expect(el.querySelectorAll('a.go').length).toBe(2);
  });

  it('keeps the card at three of four done', () => {
    const el = render({ goals: [goal('WEIGHT')], plan: true, meal: true });

    expect(el.querySelectorAll('.tile.done').length).toBe(3);
    expect(el.querySelector('.tile.current')?.getAttribute('data-step')).toBe('session');
  });

  it('renders nothing when all four are done', () => {
    const el = render({ goals: [goal('WORKOUT_FREQUENCY')], plan: true, meal: true, session: true });

    expect(el.querySelector('section')).toBeNull();
    expect(el.querySelector('.folded-line')).toBeNull();
    expect(el.querySelector('.hide')).toBeNull();
    expect(el.textContent).not.toContain("You're set up");
  });

  it('"Take the tour again" brings every page path back and scrolls to the card', () => {
    backend.state = { tourSkipped: true, tourMap: { workout: { seen: true, skippedByData: false, replayedAt: null } } };
    const el = render({});
    const guide = TestBed.inject(GuideService);
    expect(guide.spotlightDue('workout')).toBeFalse();
    const scroll = spyOn(fixture.nativeElement as HTMLElement, 'scrollIntoView');

    hideButton(el, 'Take the tour again').click();
    fixture.detectChanges();

    expect(guide.seen('workout')).toBeFalse();
    expect(guide.spotlightDue('workout')).toBeTrue();
    expect(guide.spotlightDue('workout-history')).toBeFalse();
    expect(scroll).toHaveBeenCalled();
    expect(el.querySelector('.tiles')).not.toBeNull();
  });

  it('is hidden by Hide and stays hidden on the next visit', () => {
    const el = render({});
    hideButton(el, 'Hide').click();
    fixture.detectChanges();

    expect(el.querySelector('section')).toBeNull();

    TestBed.resetTestingModule();
    const again = render({});
    expect(again.querySelector('section')).toBeNull();
  });
});
