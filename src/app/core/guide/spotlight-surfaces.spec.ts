import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { FitSyncDataService } from '../fitsync-data.service';
import { GuideService } from './guide.service';
import { signInAs } from './guide-testing.spec';
import { HowThisWorksComponent } from './how-this-works.component';
import { SpotlightDirective } from './spotlight.directive';

@Component({ template: '' })
class BlankComponent {}

/** One page that carries the anchors of three second-level surfaces, all pinned inside the viewport. */
@Component({
  imports: [SpotlightDirective, HowThisWorksComponent],
  styles: `
    button {
      position: fixed;
      left: 20px;
    }
  `,
  template: `
    <app-how-this-works surface="workout-history" />
    @if (history()) {
      <button id="h-filters" style="top: 60px" appSpotlight="workout-history" spotlightStep="filters">Filters</button>
      <button id="h-row" style="top: 100px" appSpotlight="workout-history" spotlightStep="row">Row</button>
      <button id="h-trends" style="top: 140px" appSpotlight="workout-history" spotlightStep="trends">Trends</button>
    }
    @if (plans()) {
      <button id="p-card" style="top: 180px" appSpotlight="workout-plans" spotlightStep="card">Card</button>
      <button id="p-new" style="top: 220px" appSpotlight="workout-plans" spotlightStep="new">New</button>
    }
    @if (lone()) {
      <button id="l-week" style="top: 260px" appSpotlight="workout-library" spotlightStep="progress">Week</button>
    }
    @if (dock()) {
      <button id="d-questions" style="top: 300px" appSpotlight="coach-dock" spotlightStep="questions">Questions</button>
      <button id="d-composer" style="top: 340px" appSpotlight="coach-dock" spotlightStep="composer">Composer</button>
    }
  `
})
class HostComponent {
  readonly history = signal(true);
  readonly plans = signal(false);
  readonly lone = signal(false);
  readonly dock = signal(false);
}

describe('The spotlight path on the second-level surfaces', () => {
  let fixture: ComponentFixture<HostComponent>;
  let guide: GuideService;

  const overlay = (): HTMLElement | null => document.body.querySelector('app-spotlight');
  const eyebrow = (): string => overlay()?.querySelector('.eyebrow')?.textContent?.trim() ?? '';
  const title = (): string => overlay()?.querySelector('h2')?.textContent?.trim() ?? '';
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(overlay()?.querySelectorAll('button') ?? []).find((b) => b.textContent?.trim() === label);

  function mount(setup?: (host: HostComponent) => void): void {
    fixture = TestBed.createComponent(HostComponent);
    setup?.(fixture.componentInstance);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();
  }

  function open(setup?: (host: HostComponent) => void): void {
    signInAs('surface-user');
    void TestBed.inject(Router).navigateByUrl('/x');
    tick();
    mount(setup);
  }

  function wrapUp(): void {
    for (let i = 0; i < 4; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
    fixture?.destroy();
    discardPeriodicTasks();
    flush();
  }

  const stored = (): Record<string, { seen: boolean; skippedByData: boolean; replayedAt: string | null }> =>
    JSON.parse(localStorage.getItem('fitsync.guide.surface-user.tour-map') ?? '{}');

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: BlankComponent }]), { provide: FitSyncDataService, useValue: {} }]
    });
    guide = TestBed.inject(GuideService);
  });

  afterEach(() => {
    fixture?.destroy();
    overlay()?.remove();
    localStorage.clear();
  });

  it('runs a surface path once on the first visit, with Step n of m, and records it in the tour map', fakeAsync(() => {
    open();

    expect(eyebrow()).toBe('Step 1 of 3');
    expect(title()).toBe('Find a session');
    button('Next')?.click();
    expect(title()).toBe('Open a session');
    button('Next')?.click();
    expect(eyebrow()).toBe('Step 3 of 3');
    button('Done')?.click();

    expect(overlay()).toBeNull();
    expect(stored()['workout-history'].seen).toBeTrue();
    wrapUp();
  }));

  it('does not show a surface that was seen', fakeAsync(() => {
    signInAs('surface-user');
    guide.adopt('surface-user');
    guide.markSeen('workout-history');
    void TestBed.inject(Router).navigateByUrl('/x');
    tick();
    mount();

    expect(overlay()).toBeNull();
    wrapUp();
  }));

  it('skips a step whose anchor is not on the page', fakeAsync(() => {
    open((host) => {
      host.history.set(false);
      host.plans.set(true);
    });
    guide.reportUsed('workout-plans', false);
    tick(400);
    fixture.detectChanges();

    expect(eyebrow()).toBe('Step 1 of 2');
    expect(title()).toBe('Your week');
    wrapUp();
  }));

  it('does not start a path from a single stray anchor', fakeAsync(() => {
    open((host) => {
      host.history.set(false);
      host.lone.set(true);
    });

    expect(overlay()).toBeNull();
    wrapUp();
  }));

  it('leaves a surface out, and records skippedByData, when the person already uses it', fakeAsync(() => {
    signInAs('surface-user');
    guide.adopt('surface-user');
    guide.bump('session-opened');
    guide.bump('session-opened');
    guide.bump('session-opened');
    void TestBed.inject(Router).navigateByUrl('/x');
    tick();
    mount();

    expect(overlay()).toBeNull();
    expect(stored()['workout-history'].skippedByData).toBeTrue();
    wrapUp();
  }));

  it('waits for the data of a data condition and starts once the page reports it is not in use', fakeAsync(() => {
    open((host) => {
      host.history.set(false);
      host.plans.set(true);
    });
    expect(overlay()).toBeNull();

    guide.reportUsed('workout-plans', false);
    tick(400);
    fixture.detectChanges();

    expect(title()).toBe('Your week');
    wrapUp();
  }));

  it('records skippedByData when the data says the plan is in use', fakeAsync(() => {
    open((host) => {
      host.history.set(false);
      host.plans.set(true);
    });
    guide.reportUsed('workout-plans', true);
    tick(400);
    fixture.detectChanges();

    expect(overlay()).toBeNull();
    expect(stored()['workout-plans'].skippedByData).toBeTrue();
    wrapUp();
  }));

  it('gives the open coach dock the path before any page behind it', fakeAsync(() => {
    open((host) => host.dock.set(true));

    expect(eyebrow()).toBe('Step 1 of 2');
    expect(title()).toBe('Questions to start from');
    wrapUp();
  }));
});

describe('How this works', () => {
  let fixture: ComponentFixture<HostComponent>;
  let guide: GuideService;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const sheet = (): HTMLElement | null => root().querySelector('.sheet');
  const link = (): HTMLButtonElement => root().querySelector('.link') as HTMLButtonElement;
  const overlay = (): HTMLElement | null => document.body.querySelector('app-spotlight');

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: BlankComponent }]), { provide: FitSyncDataService, useValue: {} }]
    });
    guide = TestBed.inject(GuideService);
    signInAs('surface-user');
    guide.adopt('surface-user');
  });

  afterEach(() => {
    fixture?.destroy();
    overlay()?.remove();
    localStorage.clear();
  });

  function mount(): void {
    void TestBed.inject(Router).navigateByUrl('/x');
    tick();
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();
  }

  it('is a quiet link that opens nothing by itself', fakeAsync(() => {
    guide.markSeen('workout-history');
    mount();

    expect(link().textContent?.trim()).toBe('How this works');
    expect(sheet()).toBeNull();
    fixture.destroy();
    flush();
  }));

  it('opens a sheet with three bullets taken from the steps of the path, and closes with Close and Esc', fakeAsync(() => {
    guide.markSeen('workout-history');
    mount();

    link().click();
    fixture.detectChanges();

    const bullets = Array.from(sheet()?.querySelectorAll('li') ?? []).map((li) => li.textContent?.trim());
    expect(bullets).toEqual(['Filter by kind or date.', 'Open a session for every set and segment.', 'Longer changes live in Progress.']);
    expect(sheet()?.querySelector('h2')?.textContent?.trim()).toBe('How this works');
    expect(Array.from(sheet()?.querySelectorAll('button') ?? []).map((b) => b.textContent?.trim())).toEqual(['Show me', 'Close']);

    (Array.from(sheet()?.querySelectorAll('button') ?? []).find((b) => b.textContent?.trim() === 'Close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(sheet()).toBeNull();

    link().click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(sheet()).toBeNull();
    fixture.destroy();
    flush();
  }));

  it('replays the path on Show me, although it was seen and the skip condition holds, and notes the replay', fakeAsync(() => {
    guide.markSeen('workout-history');
    guide.bump('session-opened');
    guide.bump('session-opened');
    guide.bump('session-opened');
    mount();
    expect(overlay()).toBeNull();

    link().click();
    fixture.detectChanges();
    (sheet()?.querySelector('.primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick(10);
    fixture.detectChanges();

    expect(sheet()).toBeNull();
    expect(overlay()?.querySelector('.eyebrow')?.textContent?.trim()).toBe('Step 1 of 3');
    expect(overlay()?.querySelector('h2')?.textContent?.trim()).toBe('Find a session');
    const entry = guide.map()['workout-history'];
    expect(entry?.replayedAt).toBeTruthy();

    for (let i = 0; i < 4; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
    fixture.destroy();
    discardPeriodicTasks();
    flush();
  }));
});
