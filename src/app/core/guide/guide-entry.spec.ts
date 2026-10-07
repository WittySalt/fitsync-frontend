import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { GUIDE_PATHS, SURFACE_LABELS, surfaceForUrl } from './guide-paths';
import { GuideBackendFake, signInAs } from './guide-testing.spec';
import { GuideService, TOUR_PAGES, TourPage, publishSurface } from './guide.service';
import { HowThisWorksComponent } from './how-this-works.component';
import { SpotlightDirective } from './spotlight.directive';

@Component({ template: '' })
class BlankComponent {}

/** A top bar with the "?" and a page with the three anchors of the History path. */
@Component({
  imports: [HowThisWorksComponent, SpotlightDirective],
  styles: `
    button.anchor {
      position: fixed;
      left: 20px;
    }
  `,
  template: `
    <app-how-this-works [surface]="named()" />
    <button class="anchor" id="h-filters" style="top: 60px" appSpotlight="workout-history" spotlightStep="filters">Filters</button>
    <button class="anchor" id="h-row" style="top: 100px" appSpotlight="workout-history" spotlightStep="row">Row</button>
    <button class="anchor" id="h-trends" style="top: 140px" appSpotlight="workout-history" spotlightStep="trends">Trends</button>
  `
})
class BarComponent {
  readonly named = signal<TourPage | null>(null);
}

/** A page that publishes its surface the way the tabbed pages do. */
@Component({ template: '' })
class PublishingPage {
  readonly tab = signal<TourPage>('workout-history');
  private readonly published = publishSurface(() => this.tab());
}

describe('The route fallback map', () => {
  it('names the surface of every route that has a path', () => {
    const expected: Record<string, TourPage> = {
      '/workout': 'workout',
      '/workout?tab=history': 'workout',
      '/workout/plans/new': 'workout-plan-flow',
      '/workout/plans/p-1/edit': 'workout-plan-flow',
      '/workout/sessions/s-1': 'workout-session-detail',
      '/coach/plan': 'coach-plan-studio',
      '/nutrition': 'nutrition',
      '/nutrition/nutrients': 'nutrition-nutrients',
      '/nutrition/nutrients/protein': 'nutrition-nutrient',
      '/nutrition/recipes/r-1': 'nutrition-recipe',
      '/nutrition/recipes/r-1/cook': 'nutrition-cook',
      '/progress': 'progress',
      '/progress?period=90d': 'progress',
      '/progress/goal': 'progress-goal',
      '/progress/food': 'progress-food',
      '/progress/training': 'progress-training',
      '/me': 'me',
      '/me/achievements': 'me-achievements',
      '/settings': 'settings',
      '/settings?section=preferences#personal': 'settings'
    };
    for (const [url, page] of Object.entries(expected)) {
      expect(surfaceForUrl(url)).withContext(url).toBe(page);
    }
  });

  it('names nothing for Home, onboarding, sign-in, the admin console, the editors and the deeper Progress pages', () => {
    for (const url of [
      '/dashboard',
      '/',
      '/onboarding',
      '/auth/login',
      '/logout/callback',
      '/admin',
      '/admin/coach-quality',
      '/nutrition/recipes/new',
      '/nutrition/recipes/r-1/edit',
      '/progress/training/exercises/e-1',
      '/progress/training/activities/run',
      '/settings/avatar'
    ]) {
      expect(surfaceForUrl(url)).withContext(url).toBeNull();
    }
  });

  it('only ever names a surface that has a path', () => {
    for (const url of ['/workout', '/coach/plan', '/me/achievements', '/nutrition/recipes/r-1/cook']) {
      const page = surfaceForUrl(url);
      expect(page && GUIDE_PATHS[page].length).withContext(url).toBeGreaterThan(0);
    }
  });
});

describe('The "?" in the top bar', () => {
  let fixture: ComponentFixture<BarComponent>;
  let guide: GuideService;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const trigger = (): HTMLButtonElement | null => root().querySelector('app-how-this-works .round');
  const sheet = (): HTMLElement | null => root().querySelector('.sheet');
  const overlay = (): HTMLElement | null => document.body.querySelector('app-spotlight');
  const go = (url: string): void => {
    void TestBed.inject(Router).navigateByUrl(url);
    tick();
    fixture?.detectChanges();
  };

  function mount(url: string): void {
    signInAs('entry-user');
    go(url);
    fixture = TestBed.createComponent(BarComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();
  }

  function wrapUp(): void {
    for (let i = 0; i < 4; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
    fixture?.destroy();
    discardPeriodicTasks();
    flush();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: BlankComponent }]), ...new GuideBackendFake().providers()]
    });
    guide = TestBed.inject(GuideService);
  });

  afterEach(() => {
    fixture?.destroy();
    overlay()?.remove();
    localStorage.clear();
  });

  it('is a round button named How this works, in aria-label and title', fakeAsync(() => {
    mount('/progress');

    const button = trigger();
    expect(button).not.toBeNull();
    expect(button?.textContent?.trim()).toBe('?');
    expect(button?.getAttribute('aria-label')).toBe('How this works');
    expect(button?.getAttribute('title')).toBe('How this works');
    expect(button?.getAttribute('aria-haspopup')).toBe('dialog');
    wrapUp();
  }));

  it('is not drawn where the surface has no path: Home, onboarding, the editors', fakeAsync(() => {
    mount('/dashboard');
    expect(trigger()).toBeNull();

    go('/onboarding');
    expect(trigger()).toBeNull();

    go('/nutrition/recipes/new');
    expect(trigger()).toBeNull();

    go('/progress/goal');
    expect(trigger()).not.toBeNull();
    wrapUp();
  }));

  it('follows the route when the page publishes nothing, and opens that surface\'s sheet', fakeAsync(() => {
    mount('/me/achievements');

    trigger()?.click();
    fixture.detectChanges();

    expect(sheet()?.querySelector('.eyebrow')?.textContent?.trim()).toBe(SURFACE_LABELS['me-achievements']);
    const bullets = Array.from(sheet()?.querySelectorAll('li') ?? []).map((li) => li.textContent?.trim());
    expect(bullets).toEqual(GUIDE_PATHS['me-achievements'].map((step) => step.copy('').text));
    wrapUp();
  }));

  it('prefers the surface a page published over the route, and takes it back when the page goes', fakeAsync(() => {
    mount('/workout');
    expect(sheetLabelAfterOpen()).toBe('Workout');

    guide.publishSurface('workout-history');
    fixture.detectChanges();
    expect(sheetLabelAfterOpen()).toBe('Workout history');

    guide.clearSurface('workout-plans');
    fixture.detectChanges();
    expect(sheetLabelAfterOpen()).toBe('Workout history');

    guide.clearSurface('workout-history');
    fixture.detectChanges();
    expect(sheetLabelAfterOpen()).toBe('Workout');
    wrapUp();
  }));

  it('gives an open overlay, the coach dock, the say over the page', fakeAsync(() => {
    mount('/workout');
    guide.publishSurface('workout-history');
    guide.overlay.set('coach-dock');
    fixture.detectChanges();

    expect(sheetLabelAfterOpen()).toBe('The coach');

    guide.overlay.set(null);
    fixture.detectChanges();
    expect(sheetLabelAfterOpen()).toBe('Workout history');
    wrapUp();
  }));

  it('steps aside while a full-screen view carries its own, and a view that names its surface still shows', fakeAsync(() => {
    mount('/workout');
    guide.fullScreen.set(true);
    fixture.detectChanges();
    expect(trigger()).toBeNull();

    fixture.componentInstance.named.set('workout-live');
    fixture.detectChanges();
    expect(sheetLabelAfterOpen()).toBe('The live tracker');
    wrapUp();
  }));

  it('opens a sheet with the bullets of the path, and closes it with Close and Esc', fakeAsync(() => {
    mount('/progress');
    guide.publishSurface('workout-history');
    fixture.detectChanges();

    trigger()?.click();
    fixture.detectChanges();
    const bullets = Array.from(sheet()?.querySelectorAll('li') ?? []).map((li) => li.textContent?.trim());
    expect(bullets).toEqual(['Filter by kind or date.', 'Open a session for every set and segment.', 'Longer changes live in Progress.']);
    expect(sheet()?.querySelector('h2')?.textContent?.trim()).toBe('How this works');
    expect(Array.from(sheet()?.querySelectorAll('button') ?? []).map((b) => b.textContent?.trim())).toEqual(['Show me', 'Close']);

    (Array.from(sheet()?.querySelectorAll('button') ?? []).find((b) => b.textContent?.trim() === 'Close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(sheet()).toBeNull();

    trigger()?.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(sheet()).toBeNull();
    wrapUp();
  }));

  it('replays the path on Show me, although it was seen, and notes the replay', fakeAsync(() => {
    mount('/progress');
    guide.markSeen('workout-history');
    guide.publishSurface('workout-history');
    fixture.detectChanges();
    expect(overlay()).toBeNull();

    trigger()?.click();
    fixture.detectChanges();
    (sheet()?.querySelector('.primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();

    expect(sheet()).toBeNull();
    expect(overlay()?.querySelector('.eyebrow')?.textContent?.trim()).toBe('Step 1 of 3');
    expect(overlay()?.querySelector('h2')?.textContent?.trim()).toBe('Find a session');
    expect(guide.map()['workout-history']?.replayedAt).toBeTruthy();
    wrapUp();
  }));

  /** Opens the sheet of the button as it stands and reads which surface it is for. */
  function sheetLabelAfterOpen(): string {
    const button = trigger();
    if (!button) {
      return '';
    }
    button.click();
    fixture.detectChanges();
    const label = sheet()?.querySelector('.eyebrow')?.textContent?.trim() ?? '';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    return label;
  }

  describe('publishSurface', () => {
    it('publishes the open tab while the page lives and takes it back on destroy', fakeAsync(() => {
      signInAs('entry-user');
      const page = TestBed.createComponent(PublishingPage);
      page.detectChanges();
      expect(guide.surface()).toBe('workout-history');

      page.componentInstance.tab.set('workout-library');
      page.detectChanges();
      expect(guide.surface()).toBe('workout-library');

      page.destroy();
      expect(guide.surface()).toBeNull();
      expect(guide.fullScreen()).toBeFalse();
      flush();
    }));

    it('does not take back what the next page published first', fakeAsync(() => {
      const first = TestBed.createComponent(PublishingPage);
      first.detectChanges();
      guide.publishSurface('nutrition');
      first.destroy();
      expect(guide.surface()).toBe('nutrition');
      flush();
    }));
  });
});

describe('Every path', () => {
  it('has a label, two to four steps, unique step ids and plain copy', () => {
    for (const page of TOUR_PAGES) {
      const steps = GUIDE_PATHS[page];
      expect(SURFACE_LABELS[page]).withContext(page).toBeTruthy();
      expect(steps.length).withContext(page).toBeGreaterThanOrEqual(2);
      expect(steps.length).withContext(page).toBeLessThanOrEqual(4);
      expect(new Set(steps.map((step) => step.id)).size).withContext(page).toBe(steps.length);
      for (const step of steps) {
        for (const variant of ['', 'empty', 'continue']) {
          const { title, text } = step.copy(variant);
          expect(`${title} ${text}`).withContext(`${page}.${step.id}`).not.toMatch(/[!—]|should|prioriti/i);
          expect(text.length).withContext(`${page}.${step.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('lists the steps of the ten new paths, in order', () => {
    const ids = (page: TourPage): string[] => GUIDE_PATHS[page].map((step) => step.id);
    expect(ids('workout-session-player')).toEqual(['strip', 'sets', 'steps', 'finish']);
    expect(ids('workout-live')).toEqual(['figures', 'segments', 'finish']);
    expect(ids('workout-plan-flow')).toEqual(['week', 'day', 'save']);
    expect(ids('coach-plan-studio')).toEqual(['request', 'draft', 'start']);
    expect(ids('workout-session-detail')).toEqual(['summary', 'sets', 'more']);
    expect(ids('nutrition-recipe')).toEqual(['fit', 'ingredients', 'cook']);
    expect(ids('nutrition-cook')).toEqual(['step', 'timers', 'finish']);
    expect(ids('nutrition-nutrient')).toEqual(['sources', 'guide']);
    expect(ids('me-achievements')).toEqual(['path', 'badge', 'next']);
    expect(ids('settings')).toEqual(['sections', 'guide', 'data']);
  });

  it('says what the spec says on the steps it words', () => {
    const text = (page: TourPage, id: string, variant = ''): string => GUIDE_PATHS[page].find((step) => step.id === id)?.copy(variant).text ?? '';
    expect(text('workout-session-player', 'sets')).toBe('Each set: tap when done, change the weight if it differs.');
    expect(text('workout-session-player', 'steps')).toBe('The steps turn by themselves while a set runs. Tap to hold one.');
    expect(text('workout-session-player', 'finish')).toBe('End here. The summary and your badges follow.');
    expect(text('workout-live', 'segments')).toBe('The planned segments. The current one is lit.');
    expect(text('workout-plan-flow', 'week')).toBe('Seven days. Tap a day to change its kind.');
    expect(text('workout-plan-flow', 'day')).toBe('Drag to change a length, tap a move to swap it.');
    expect(text('workout-plan-flow', 'save')).toBe('Saving makes this your active plan. Today’s session is on Workout.');
    expect(text('coach-plan-studio', 'request')).toBe('Say what you want to train and what you have.');
    expect(text('coach-plan-studio', 'start')).toBe('Nothing is saved until you start it.');
    expect(text('nutrition-recipe', 'fit')).toBe('How it fits what is left today.');
    expect(text('nutrition-recipe', 'cook')).toBe('Cook opens the Ready sheet, then timers.');
    expect(text('nutrition-cook', 'timers')).toBe('Start a timer from a step, or add your own.');
    expect(text('nutrition-nutrient', 'sources')).toBe('Which foods gave you this.');
    expect(text('nutrition-nutrient', 'guide')).toBe('What it does and where it comes from.');
    expect(text('me-achievements', 'path')).toBe('Each badge is a milestone on a path.');
    expect(text('me-achievements', 'badge')).toBe('Tap a badge for the sessions or meals behind it.');
    expect(text('me-achievements', 'next')).toBe('What is left for the next one.');
    expect(text('settings', 'data')).toBe('Export or delete your data.');
  });

  it('words the plan flow\'s Continue differently from its Save', () => {
    const step = GUIDE_PATHS['workout-plan-flow'].find((candidate) => candidate.id === 'save');
    expect(step?.copy('continue').title).toBe('Review and save');
    expect(step?.copy('').title).toBe('Save');
  });
});
