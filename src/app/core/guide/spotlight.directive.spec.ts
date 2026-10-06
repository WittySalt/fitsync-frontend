import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GuideService } from './guide.service';
import { signInAs } from './guide-testing.spec';
import { SpotlightDirective } from './spotlight.directive';
import { placeCard } from './spotlight.component';

@Component({
  imports: [SpotlightDirective],
  template: `<button id="anchor" type="button" appSpotlight="workout">Start</button>`
})
class HostComponent {}

describe('SpotlightDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  function mount(): void {
    signInAs('tour-user');
    // Whatever earlier specs left in the document, the anchor counts as in view, so the directive takes its
    // synchronous path instead of scrolling first.
    if (!jasmine.isSpy(HTMLElement.prototype.getBoundingClientRect)) {
      spyOn(HTMLElement.prototype, 'getBoundingClientRect').and.returnValue(new DOMRect(120, 140, 90, 36));
    }
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
