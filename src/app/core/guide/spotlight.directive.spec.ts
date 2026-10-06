import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GuideService } from './guide.service';
import { signInAs } from './guide-testing.spec';
import { SpotlightDirective } from './spotlight.directive';

@Component({
  imports: [SpotlightDirective],
  template: `<button id="anchor" type="button" appSpotlight="workout">Start</button>`
})
class HostComponent {}

describe('SpotlightDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  function mount(): void {
    signInAs('tour-user');
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    TestBed.flushEffects?.();
    fixture.detectChanges();
  }

  const overlay = (): HTMLElement | null => document.body.querySelector('app-spotlight');

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    fixture?.destroy();
    overlay()?.remove();
    localStorage.clear();
  });

  it('opens once for a new account with a cut-out around the anchor and the page words', () => {
    mount();
    const pop = overlay();

    expect(pop).not.toBeNull();
    expect(pop?.textContent).toContain('Today starts here');
    expect(pop?.textContent).toContain('Got it');
    expect(pop?.textContent).toContain('Skip the tour');
    const anchor = (fixture.nativeElement as HTMLElement).querySelector('#anchor') as HTMLElement;
    const box = anchor.getBoundingClientRect();
    const cut = pop?.querySelector('.cut') as HTMLElement;
    expect(parseFloat(cut.style.left)).toBeCloseTo(box.left - 6, 1);
    expect(parseFloat(cut.style.top)).toBeCloseTo(box.top - 6, 1);
    expect(parseFloat(cut.style.width)).toBeCloseTo(box.width + 12, 1);
    expect(parseFloat(cut.style.height)).toBeCloseTo(box.height + 12, 1);
  });

  it('closes on Esc as Got it and is not shown a second time', () => {
    mount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(overlay()).toBeNull();
    expect(localStorage.getItem('fitsync.guide.tour-user.tour.workout')).toBe('1');

    fixture.destroy();
    mount();
    expect(overlay()).toBeNull();
  });

  it('closes when the scrim is clicked', () => {
    mount();
    (overlay()?.querySelector('.scrim') as HTMLElement).click();
    expect(overlay()).toBeNull();
  });

  it('Skip the tour closes it and silences the other pages', () => {
    mount();
    const skip = Array.from(overlay()?.querySelectorAll('button') ?? []).find((b) => b.textContent?.includes('Skip the tour'));
    skip?.click();

    expect(overlay()).toBeNull();
    expect(TestBed.inject(GuideService).spotlightDue('me')).toBeFalse();
  });

  it('does not open for an account older than 14 days', () => {
    localStorage.setItem('fitsync.guide.tour-user.first-seen', String(Date.now() - 30 * 24 * 3600 * 1000));
    mount();
    expect(overlay()).toBeNull();
  });
});
