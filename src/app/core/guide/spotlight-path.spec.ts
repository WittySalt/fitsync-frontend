import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { FitSyncDataService } from '../fitsync-data.service';
import { ToastService } from '../toast/toast.service';
import { GUIDE_PATHS } from './guide-paths';
import { GuideService } from './guide.service';
import { signInAs } from './guide-testing.spec';
import { placeCard } from './spotlight.component';
import { SpotlightDirective } from './spotlight.directive';

@Component({ template: '' })
class BlankComponent {}

/** A page with the anchors of three paths, all pinned inside the viewport so no scrolling is needed. */
@Component({
  imports: [SpotlightDirective],
  styles: `
    button {
      position: fixed;
      left: 20px;
    }
  `,
  template: `
    @if (withMe()) {
      <button id="targets" style="top: 20px" appSpotlight="me" spotlightStep="targets">Targets</button>
      @if (showAbout()) {
        <button id="about" style="top: 60px" appSpotlight="me" spotlightStep="about">About</button>
      }
      <button id="achievements" style="top: 100px" appSpotlight="me" spotlightStep="achievements">Achievements</button>
    }
    @if (withWorkout()) {
      <button id="today" style="top: 140px" appSpotlight="workout" spotlightStep="today" [spotlightVariant]="variant()">Today</button>
      @if (twinFocus()) {
        <button id="focus-hidden" style="display: none" appSpotlight="workout" spotlightStep="focus">Hidden</button>
        <button id="focus-shown" style="top: 160px" appSpotlight="workout" spotlightStep="focus">Shown</button>
      }
      <button id="tabs" style="top: 180px" appSpotlight="workout" spotlightStep="tabs">Tabs</button>
    }
    @if (withNutrition()) {
      <button id="log" style="top: 220px" appSpotlight="nutrition" spotlightStep="log">Add</button>
    }
  `
})
class HostComponent {
  readonly withMe = signal(true);
  readonly withWorkout = signal(false);
  readonly withNutrition = signal(false);
  readonly showAbout = signal(true);
  readonly variant = signal('');
  readonly twinFocus = signal(false);
}

describe('The spotlight path', () => {
  let fixture: ComponentFixture<HostComponent>;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let guide: GuideService;

  const overlay = (): HTMLElement | null => document.body.querySelector('app-spotlight');
  const eyebrow = (): string => overlay()?.querySelector('.eyebrow')?.textContent?.trim() ?? '';
  const title = (): string => overlay()?.querySelector('h2')?.textContent?.trim() ?? '';
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(overlay()?.querySelectorAll('button') ?? []).find((b) => b.textContent?.trim() === label);
  const escape = (): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  };

  /** Mounts the page and lets its anchors settle. */
  function mount(setup?: (host: HostComponent) => void): void {
    fixture = TestBed.createComponent(HostComponent);
    setup?.(fixture.componentInstance);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();
  }

  /** Signs in, goes to `url` and mounts the page. */
  function open(url: string, setup?: (host: HostComponent) => void): void {
    signInAs('tour-user');
    void TestBed.inject(Router).navigateByUrl(url);
    tick();
    mount(setup);
  }

  /** Ends a test cleanly: no poll left running and no toast timer pending. */
  function wrapUp(): void {
    guide.stopFollowing();
    escape();
    escape();
    escape();
    fixture?.destroy();
    discardPeriodicTasks();
    flush();
  }

  beforeEach(() => {
    localStorage.clear();
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getWorkoutPlans', 'getWorkoutSessionPage', 'hasLoggedMeal', 'getGoals']);
    data.getWorkoutPlans.and.returnValue(of([]));
    data.getWorkoutSessionPage.and.returnValue(of({ sessions: [] }) as never);
    data.hasLoggedMeal.and.returnValue(of(false));
    data.getGoals.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: BlankComponent }]), { provide: FitSyncDataService, useValue: data }]
    });
    guide = TestBed.inject(GuideService);
  });

  afterEach(() => {
    fixture?.destroy();
    overlay()?.remove();
    localStorage.clear();
  });

  it('opens the first step of a first visit with its eyebrow, the page words and a cut-out around the anchor', fakeAsync(() => {
    open('/me');

    expect(overlay()).not.toBeNull();
    expect(eyebrow()).toBe('Step 1 of 3');
    expect(title()).toBe('Your targets');
    expect(overlay()?.textContent).toContain('Weight, calories, protein and sessions a week.');
    expect(button('Next')).toBeDefined();
    expect(button('Skip the tour')).toBeDefined();
    const anchor = (fixture.nativeElement as HTMLElement).querySelector('#targets') as HTMLElement;
    const box = anchor.getBoundingClientRect();
    const cut = overlay()?.querySelector('.cut') as HTMLElement;
    expect(parseFloat(cut.style.left)).toBeCloseTo(box.left - 6, 1);
    expect(parseFloat(cut.style.top)).toBeCloseTo(box.top - 6, 1);
    expect(parseFloat(cut.style.width)).toBeCloseTo(box.width + 12, 1);
    wrapUp();
  }));

  it('walks the steps in path order, shows Done on the last one and records the page as seen', fakeAsync(() => {
    open('/me');

    button('Next')?.click();
    expect(eyebrow()).toBe('Step 2 of 3');
    expect(title()).toBe('What your coach reads');
    button('Next')?.click();
    expect(eyebrow()).toBe('Step 3 of 3');
    expect(button('Next')).toBeUndefined();
    expect(title()).toBe('Your badges');
    button('Done')?.click();

    expect(overlay()).toBeNull();
    expect(JSON.parse(localStorage.getItem('fitsync.guide.tour-user.tour-map') ?? '{}').me.seen).toBeTrue();
    expect(guide.pathRunning()).toBeFalse();
    wrapUp();
  }));

  it('treats Esc as Next, and as Done on the last step', fakeAsync(() => {
    open('/me');

    escape();
    expect(eyebrow()).toBe('Step 2 of 3');
    escape();
    escape();
    expect(overlay()).toBeNull();
    expect(JSON.parse(localStorage.getItem('fitsync.guide.tour-user.tour-map') ?? '{}').me.seen).toBeTrue();
    wrapUp();
  }));

  it('treats a click on the scrim as Next', fakeAsync(() => {
    open('/me');
    (overlay()?.querySelector('.scrim') as HTMLElement).click();
    expect(eyebrow()).toBe('Step 2 of 3');
    wrapUp();
  }));

  it('skips a step whose anchor is not on the page and counts only the steps that are', fakeAsync(() => {
    open('/me', (host) => host.showAbout.set(false));

    expect(eyebrow()).toBe('Step 1 of 2');
    button('Next')?.click();
    expect(eyebrow()).toBe('Step 2 of 2');
    expect(title()).toBe('Your badges');
    wrapUp();
  }));

  it('points a step with two anchors at the one that has a box on screen', fakeAsync(() => {
    open('/workout', (host) => {
      host.withMe.set(false);
      host.withWorkout.set(true);
      host.twinFocus.set(true);
    });

    button('Next')?.click();
    expect(title()).toBe('Today’s focus');
    const shown = (fixture.nativeElement as HTMLElement).querySelector('#focus-shown') as HTMLElement;
    const cut = overlay()?.querySelector('.cut') as HTMLElement;
    expect(parseFloat(cut.style.top)).toBeCloseTo(shown.getBoundingClientRect().top - 6, 1);
    wrapUp();
  }));

  it('moves on when the anchor of the open step leaves the page', fakeAsync(() => {
    open('/me');
    button('Next')?.click();
    expect(title()).toBe('What your coach reads');

    fixture.componentInstance.showAbout.set(false);
    fixture.detectChanges();

    expect(title()).toBe('Your badges');
    expect(eyebrow()).toBe('Step 2 of 2');
    wrapUp();
  }));

  it('"Skip the tour" closes the path and silences every page', fakeAsync(() => {
    open('/me');
    button('Skip the tour')?.click();

    expect(overlay()).toBeNull();
    expect(guide.spotlightDue('workout')).toBeFalse();
    expect(guide.spotlightDue('workout', true)).toBeFalse();
    wrapUp();
  }));

  it('runs once per page and again after the guide is restarted', fakeAsync(() => {
    open('/me');
    escape();
    escape();
    escape();
    expect(overlay()).toBeNull();
    fixture.destroy();

    mount();
    expect(overlay()).toBeNull();
    fixture.destroy();

    guide.restart();
    mount();
    expect(eyebrow()).toBe('Step 1 of 3');
    wrapUp();
  }));

  it('does not open on its own for an account older than 14 days, but does when the page is opened with ?guide=', fakeAsync(() => {
    signInAs('tour-user');
    localStorage.setItem('fitsync.guide.tour-user.first-seen', String(Date.now() - 30 * 24 * 3600 * 1000));
    void TestBed.inject(Router).navigateByUrl('/me');
    tick();
    mount();
    expect(overlay()).toBeNull();
    fixture.destroy();

    void TestBed.inject(Router).navigateByUrl('/me?guide=me');
    tick();
    mount();
    expect(eyebrow()).toBe('Step 1 of 3');
    wrapUp();
  }));

  it('starts the path of the page named by ?guide= before the other pages on screen', fakeAsync(() => {
    open('/workout?guide=workout-session', (host) => host.withWorkout.set(true));

    // Me comes first in the tour order, but the person arrived for the workout path.
    expect(title()).toBe('Today starts here');
    expect(eyebrow()).toBe('Step 1 of 2');
    wrapUp();
  }));

  describe('copy by account state', () => {
    it('asks for a plan first when there is none', fakeAsync(() => {
      open('/workout?guide=workout', (host) => {
        host.withMe.set(false);
        host.withWorkout.set(true);
        host.variant.set('empty');
      });

      expect(title()).toBe('Start with a plan');
      expect(overlay()?.textContent).toContain('Pick a plan first. The coach fills the week for you.');
      wrapUp();
    }));

    it('points at starting the session once there is a plan', fakeAsync(() => {
      open('/workout?guide=workout', (host) => {
        host.withMe.set(false);
        host.withWorkout.set(true);
      });

      expect(title()).toBe('Today starts here');
      expect(overlay()?.textContent).toContain('Start the session when you are ready.');
      wrapUp();
    }));
  });

  describe('following the Home card task', () => {
    const onlyNutrition = (host: HostComponent): void => {
      host.withMe.set(false);
      host.withNutrition.set(true);
    };
    const toasts = (): string[] => TestBed.inject(ToastService).toasts().map((toast) => toast.message);

    it('says the step is done, with a way back to Home, once the task is done and the path is closed', fakeAsync(() => {
      open('/nutrition?guide=nutrition', onlyNutrition);
      expect(guide.following()).toBe('meal');

      data.hasLoggedMeal.and.returnValue(of(true));
      tick(6000);
      expect(toasts()).toEqual([]);

      escape();
      expect(toasts()).toEqual(['Step 3 done.']);
      const action = TestBed.inject(ToastService).toasts()[0].action;
      expect(action?.label).toContain('Back to Home');
      expect(guide.following()).toBeNull();
      wrapUp();
    }));

    it('keeps watching until the task is done', fakeAsync(() => {
      open('/nutrition?guide=nutrition', onlyNutrition);
      escape();
      tick(6000);
      expect(toasts()).toEqual([]);

      data.hasLoggedMeal.and.returnValue(of(true));
      tick(6000);
      expect(toasts()).toEqual(['Step 3 done.']);
      wrapUp();
    }));

    it('does not follow a task that was already done on arrival', fakeAsync(() => {
      data.hasLoggedMeal.and.returnValue(of(true));
      open('/nutrition?guide=nutrition', onlyNutrition);

      expect(guide.following()).toBeNull();
      tick(6000);
      expect(toasts()).toEqual([]);
      wrapUp();
    }));

    it('does not follow a page that was not opened from a card', fakeAsync(() => {
      open('/nutrition', onlyNutrition);
      expect(guide.following()).toBeNull();
      wrapUp();
    }));
  });

  describe('every path', () => {
    it('has two or three steps, with unique ids and plain copy', () => {
      for (const [page, steps] of Object.entries(GUIDE_PATHS)) {
        expect(steps.length).withContext(page).toBeGreaterThanOrEqual(2);
        expect(steps.length).withContext(page).toBeLessThanOrEqual(3);
        expect(new Set(steps.map((step) => step.id)).size).withContext(page).toBe(steps.length);
        for (const step of steps) {
          for (const variant of ['', 'empty']) {
            const { title: heading, text } = step.copy(variant);
            expect(`${heading} ${text}`).withContext(`${page}.${step.id}`).not.toMatch(/!|—/);
            expect(text.length).withContext(`${page}.${step.id}`).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe('placeCard', () => {
    const view = { width: 1000, height: 700 };
    const inside = (p: { top: number; left: number }, h = 170, w = 320): boolean =>
      p.top >= 16 && p.left >= 16 && p.top + h <= view.height - 16 && p.left + w <= view.width - 16;

    it('puts the card under an anchor with room below', () => {
      const p = placeCard({ top: 100, left: 200, width: 120, height: 40 }, view);
      expect(p.top).toBe(152);
      expect(inside(p)).toBeTrue();
    });

    it('flips above the anchor near the bottom of the viewport', () => {
      const cut = { top: 600, left: 200, width: 120, height: 40 };
      const p = placeCard(cut, view);
      expect(p.top + 170).toBeLessThanOrEqual(cut.top);
      expect(inside(p)).toBeTrue();
    });

    it('keeps the card inside the viewport for an anchor below the fold and at the right edge', () => {
      const p = placeCard({ top: 900, left: 950, width: 120, height: 40 }, view);
      expect(inside(p)).toBeTrue();
    });

    it('clamps to a 16 px gutter on a narrow screen', () => {
      const p = placeCard({ top: 100, left: -20, width: 120, height: 40 }, { width: 360, height: 640 });
      expect(p.left).toBe(16);
    });
  });
});
