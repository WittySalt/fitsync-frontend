import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { GuideBackendFake, signInAs } from './guide-testing.spec';
import { GuideService } from './guide.service';
import { SpotlightDirective } from './spotlight.directive';

@Component({ template: '' })
class BlankComponent {}

/** One page that carries the anchors of several surfaces, all pinned inside the viewport. */
@Component({
  imports: [SpotlightDirective],
  styles: `
    button {
      position: fixed;
      left: 20px;
    }
  `,
  template: `
    @if (history()) {
      <button id="h-filters" style="top: 60px" appSpotlight="workout-history" spotlightStep="filters">Filters</button>
      <button id="h-row" style="top: 100px" appSpotlight="workout-history" spotlightStep="row">Row</button>
      <button id="h-trends" style="top: 140px" appSpotlight="workout-history" spotlightStep="trends">Trends</button>
    }
    @if (plans()) {
      <button id="p-card" style="top: 180px" appSpotlight="workout-plans" spotlightStep="card">Card</button>
      <button id="p-new" style="top: 220px" appSpotlight="workout-plans" spotlightStep="new">New</button>
    }
    @if (dock()) {
      <button id="d-questions" style="top: 300px" appSpotlight="coach-dock" spotlightStep="questions">Questions</button>
      <button id="d-composer" style="top: 340px" appSpotlight="coach-dock" spotlightStep="composer">Composer</button>
    }
    @if (player()) {
      <button id="s-strip" style="top: 60px" appSpotlight="workout-session-player" spotlightStep="strip">Strip</button>
      <button id="s-sets" style="top: 100px" appSpotlight="workout-session-player" spotlightStep="sets">Sets</button>
      <button id="s-finish" style="top: 140px" appSpotlight="workout-session-player" spotlightStep="finish">Finish</button>
    }
  `
})
class HostComponent {
  readonly history = signal(true);
  readonly plans = signal(false);
  readonly dock = signal(false);
  readonly player = signal(false);
}

describe('What the spotlight path starts on its own below the four pages', () => {
  let fixture: ComponentFixture<HostComponent>;
  let guide: GuideService;
  let backend: GuideBackendFake;

  const overlay = (): HTMLElement | null => document.body.querySelector('app-spotlight');
  const eyebrow = (): string => overlay()?.querySelector('.eyebrow')?.textContent?.trim() ?? '';
  const title = (): string => overlay()?.querySelector('h2')?.textContent?.trim() ?? '';
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(overlay()?.querySelectorAll('button') ?? []).find((b) => b.textContent?.trim() === label);

  function mount(setup?: (host: HostComponent) => void): void {
    signInAs('surface-user');
    void TestBed.inject(Router).navigateByUrl('/x');
    tick();
    fixture = TestBed.createComponent(HostComponent);
    setup?.(fixture.componentInstance);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
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
    backend = new GuideBackendFake();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: BlankComponent }]), ...backend.providers()]
    });
    guide = TestBed.inject(GuideService);
  });

  afterEach(() => {
    fixture?.destroy();
    overlay()?.remove();
    localStorage.clear();
  });

  it('starts no surface by itself, however new the account and however many of its anchors are on screen', fakeAsync(() => {
    mount((host) => {
      host.plans.set(true);
      host.dock.set(true);
    });
    guide.reportUsed('workout-plans', false);
    guide.reportUsed('workout-history', false);
    tick(400);
    fixture.detectChanges();

    expect(guide.ready()).toBeTrue();
    expect(overlay()).toBeNull();
    wrapUp();
  }));

  it('does not start the dock path while the dock is open either', fakeAsync(() => {
    mount((host) => {
      host.history.set(false);
      host.dock.set(true);
    });
    expect(overlay()).toBeNull();
    wrapUp();
  }));

  it('starts the session player path on the very first session, once the page has said so', fakeAsync(() => {
    mount((host) => {
      host.history.set(false);
      host.player.set(true);
    });
    expect(overlay()).toBeNull();

    guide.reportUsed('workout-session-player', false);
    tick(400);
    fixture.detectChanges();

    expect(eyebrow()).toBe('Step 1 of 3');
    expect(title()).toBe('The session');
    button('Next')?.click();
    expect(title()).toBe('Your sets');
    button('Next')?.click();
    expect(title()).toBe('Finish');
    button('Done')?.click();
    expect(overlay()).toBeNull();
    expect(guide.seen('workout-session-player')).toBeTrue();
    wrapUp();
  }));

  it('leaves the player path out, and records it, when a session has been completed before', fakeAsync(() => {
    mount((host) => {
      host.history.set(false);
      host.player.set(true);
    });
    guide.reportUsed('workout-session-player', true);
    tick(400);
    fixture.detectChanges();

    expect(overlay()).toBeNull();
    expect(guide.map()['workout-session-player']?.skippedByData).toBeTrue();
    wrapUp();
  }));

  it('does not start the player path again once it was seen', fakeAsync(() => {
    signInAs('surface-user');
    guide.start();
    guide.markSeen('workout-session-player');
    mount((host) => {
      host.history.set(false);
      host.player.set(true);
    });
    guide.reportUsed('workout-session-player', false);
    tick(400);
    fixture.detectChanges();

    expect(overlay()).toBeNull();
    wrapUp();
  }));

  it('does not start anything when the state could not be loaded', fakeAsync(() => {
    backend.failLoad = true;
    mount((host) => {
      host.history.set(false);
      host.player.set(true);
    });
    guide.reportUsed('workout-session-player', false);
    tick(400);
    fixture.detectChanges();

    expect(guide.loadFailed()).toBeTrue();
    expect(overlay()).toBeNull();
    wrapUp();
  }));
});
