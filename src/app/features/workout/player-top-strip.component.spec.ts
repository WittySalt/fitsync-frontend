import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerTopStripComponent } from './player-top-strip.component';

describe('PlayerTopStripComponent', () => {
  let fixture: ComponentFixture<PlayerTopStripComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PlayerTopStripComponent] });
    fixture = TestBed.createComponent(PlayerTopStripComponent);
    fixture.componentRef.setInput('segments', [1, 0.5, 0, 0]);
    fixture.componentRef.setInput('current', 1);
    fixture.componentRef.setInput('setsDone', 3);
    fixture.componentRef.setInput('setsTotal', 12);
    fixture.componentRef.setInput('clock', '12:34');
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;

  it('has one segment for each exercise, filled by its share of done sets', () => {
    const fills = Array.from(root().querySelectorAll<HTMLElement>('.fill')).map((fill) => fill.style.width);

    expect(fills).toEqual(['100%', '50%', '0%', '0%']);
  });

  it('gives the progress a text equivalent', () => {
    expect(root().querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Exercise 2 of 4, 3 of 12 sets done');
  });

  it('shows the sets done and the time, and does not announce the time', () => {
    expect(root().querySelector('.sets')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('3 of 12 sets');
    expect(root().querySelector('.elapsed')?.textContent).toBe('12:34');
    expect(root().querySelector('[aria-live]')).toBeNull();
  });

  it('carries the "?" of the guide at the right end of the strip, for the session player', () => {
    const strip = root().querySelector('.strip') as HTMLElement;
    const entry = strip.lastElementChild as HTMLElement;

    expect(entry.tagName.toLowerCase()).toBe('app-how-this-works');
    const button = entry.querySelector<HTMLButtonElement>('.round');
    expect(button?.getAttribute('aria-label')).toBe('How this works');
    button?.click();
    fixture.detectChanges();
    expect(entry.querySelector('.eyebrow')?.textContent?.trim()).toBe('The session');
  });

  it('is the first anchor of the player path', () => {
    const strip = root().querySelector('.strip') as HTMLElement;
    expect(strip.getAttribute('appspotlight')).toBe('workout-session-player');
    expect(strip.getAttribute('spotlightstep')).toBe('strip');
  });

  it('has a labelled Minimise button that says so', () => {
    const minimised = jasmine.createSpy('minimise');
    fixture.componentInstance.minimise.subscribe(minimised);

    const button = root().querySelector<HTMLButtonElement>('.minimise');
    button?.click();

    expect(button?.getAttribute('aria-label')).toBe('Minimise');
    expect(minimised).toHaveBeenCalledTimes(1);
  });
});
