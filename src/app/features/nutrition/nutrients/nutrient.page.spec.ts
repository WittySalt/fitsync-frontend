import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { anchorSteps } from '../../../core/guide/guide-testing.spec';
import { NutrientsService } from './nutrients.service';
import { NutrientsPage } from './nutrients.page';
import { NutrientPage, swipeTarget } from './nutrient.page';
import { detail, overview, tile } from './nutrients-testing.spec';
import { armScrollRestore, saveScroll, takeScroll } from './nutrients-scroll';

describe('NutrientPage', () => {
  let service: jasmine.SpyObj<NutrientsService>;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    sessionStorage.clear();
    service = jasmine.createSpyObj<NutrientsService>('NutrientsService', ['getAll', 'getOne']);
    service.getAll.and.callFake(() => of(overview()));
    service.getOne.and.callFake((code: string) => of(detail({ tile: tile({ code, displayName: code === 'VIT_E' ? 'Vitamin E' : 'Vitamin D' }) })));
    TestBed.configureTestingModule({
      providers: [
        { provide: NutrientsService, useValue: service },
        provideRouter([
          { path: 'nutrition/nutrients', component: NutrientsPage },
          { path: 'nutrition/nutrients/:code', component: NutrientPage }
        ])
      ]
    });
  });

  async function open(url = '/nutrition/nutrients/VIT_D?period=30d'): Promise<HTMLElement> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ');

  it('reads the nutrient of the URL for the period of the URL', async () => {
    await open();
    expect(service.getOne).toHaveBeenCalledWith('VIT_D', jasmine.any(String), jasmine.any(String));
    const [, from, to] = service.getOne.calls.mostRecent().args;
    expect((new Date(to).getTime() - new Date(from).getTime()) / 86400000).toBe(29);
  });

  it('offers How this changed to the same nutrient on Progress at 3 months when opened from Nutrition', async () => {
    const el = await open();
    const door = el.querySelector<HTMLAnchorElement>('a.door');
    expect(text(door)).toBe('How this changed ›');
    expect(door?.getAttribute('href')).toBe('/progress/food?period=3m&nutrient=VIT_D#nutrients');
  });

  it('follows ?range=90 from Progress without the door, reading 90 days', async () => {
    const el = await open('/nutrition/nutrients/VIT_D?range=90');
    expect(el.querySelector('a.door')).toBeNull();
    const [, from, to] = service.getOne.calls.mostRecent().args;
    expect((new Date(to).getTime() - new Date(from).getTime()) / 86400000).toBe(89);
    expect(el.querySelector('a.back')?.getAttribute('href')).toContain('range=90');
  });

  it('shows your figures and the guide', async () => {
    const el = await open();
    const yours = text(el.querySelector('app-nutrient-yours'));
    expect(yours).toContain('Each day');
    expect(yours).toContain('Where yours came from');
    expect(yours).toContain('Salmon');
    const guide = text(el.querySelector('app-nutrient-guide'));
    for (const heading of ['What it does', 'Too little, too much', 'How much a day', 'Richest foods', 'Good to know', 'Who may need more']) {
      expect(guide).toContain(heading);
    }
    expect(guide).toContain('NIH Office of Dietary Supplements');
    expect(guide).toContain('General information, not medical advice.');
  });

  it('anchors where yours came from and the guide, and has no period switch to point at', async () => {
    const el = await open();
    expect(anchorSteps(el, 'nutrition-nutrient')).toEqual(['sources', 'guide']);
  });

  it('marks the row of the person in the amounts table', async () => {
    const el = await open();
    const mine = el.querySelector('app-nutrient-guide tr.mine');
    expect(text(mine)).toContain('19 to 50');
    expect(mine?.getAttribute('aria-current')).toBe('true');
    expect(text(el.querySelector('app-nutrient-guide'))).toContain('You are in the 19 to 50 row.');
  });

  it('gives women and men their own columns only when they differ', async () => {
    service.getOne.and.returnValue(
      of(detail({ amounts: [{ ageBand: '19-50', label: '19 to 50', female: 18, male: 8, upperLimit: 45, mine: true }] }))
    );
    const el = await open();
    const heads = Array.from(el.querySelectorAll('app-nutrient-guide th')).map((th) => th.textContent?.trim());
    expect(heads).toEqual(['Age', 'Women', 'Men', 'Upper limit']);
  });

  it('leaves the guide sections out when the guide is null', async () => {
    service.getOne.and.returnValue(of(detail({ guide: null })));
    const el = await open();
    const guide = text(el.querySelector('app-nutrient-guide'));
    expect(guide).not.toContain('What it does');
    expect(guide).not.toContain('Good to know');
    expect(guide).not.toContain('General information, not medical advice.');
    expect(el.querySelector('app-nutrient-yours')).not.toBeNull();
  });

  it('leaves the whole guide out when there is nothing at all to show in it', async () => {
    service.getOne.and.returnValue(of(detail({ guide: null, amounts: [], richest: [] })));
    const el = await open();
    expect(el.querySelector('app-nutrient-guide')).toBeNull();
  });

  describe('back and the arrows', () => {
    it('goes back to All nutrients with the same period', async () => {
      const el = await open('/nutrition/nutrients/VIT_D?period=30d');
      const back = el.querySelector<HTMLAnchorElement>('a.back');
      expect(back?.getAttribute('href')).toBe('/nutrition/nutrients?period=30d');
    });

    it('arms the restore of the scroll that the table saved', async () => {
      const el = await open();
      saveScroll('30d', 480);
      el.querySelector<HTMLAnchorElement>('a.back')?.click();
      await harness.fixture.whenStable();
      expect(takeScroll('30d')).toBe(480);
    });

    it('does not restore a scroll that the way back did not arm', () => {
      saveScroll('30d', 480);
      expect(takeScroll('30d')).toBeNull();
      saveScroll('30d', 480);
      armScrollRestore();
      expect(takeScroll('7d')).toBeNull();
    });

    it('steps through the table in order, replacing the history entry', async () => {
      const el = await open('/nutrition/nutrients/VIT_D?period=30d');
      expect(el.querySelector('a[aria-label^="Previous nutrient"]')).toBeNull();
      expect(text(el.querySelector('.next-name'))).toContain('Vitamin E next');
      const router = TestBed.inject(Router);
      const spy = spyOn(router, 'navigate').and.callThrough();
      el.querySelector<HTMLAnchorElement>('a[aria-label^="Next nutrient"]')?.click();
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(router.url).toBe('/nutrition/nutrients/VIT_E?period=30d');
      expect(spy).not.toHaveBeenCalledWith(jasmine.anything(), jasmine.objectContaining({ replaceUrl: false }));
      expect(service.getOne).toHaveBeenCalledWith('VIT_E', jasmine.any(String), jasmine.any(String));
      expect(el.querySelector('a[aria-label^="Previous nutrient"]')).not.toBeNull();
    });

    it('has no arrows when the order could not load', async () => {
      service.getAll.and.returnValue(throwError(() => new Error('down')));
      const el = await open();
      expect(el.querySelector('a[aria-label^="Next nutrient"]')).toBeNull();
      expect(el.querySelector('app-nutrient-yours')).not.toBeNull();
    });
  });

  describe('swipe', () => {
    it('goes on to the next on a drag to the left and back on a drag to the right', () => {
      expect(swipeTarget(-120, 5, 'prev', 'next')).toBe('next');
      expect(swipeTarget(120, 5, 'prev', 'next')).toBe('prev');
    });

    it('treats a short or mostly vertical drag as a scroll', () => {
      expect(swipeTarget(-30, 0, 'prev', 'next')).toBeNull();
      expect(swipeTarget(-100, 90, 'prev', 'next')).toBeNull();
    });

    it('goes nowhere past the ends of the table', () => {
      expect(swipeTarget(120, 0, null, 'next')).toBeNull();
      expect(swipeTarget(-120, 0, 'prev', null)).toBeNull();
    });
  });

  it('shows a skeleton and then the error panel with a retry', async () => {
    service.getOne.and.returnValue(throwError(() => new Error('down')));
    const el = await open();
    expect(text(el)).toContain('Nutrient unavailable');
    service.getOne.and.callFake(() => of(detail()));
    el.querySelector<HTMLButtonElement>('app-state-panel button')?.click();
    harness.detectChanges();
    expect(el.querySelector('app-nutrient-yours')).not.toBeNull();
  });
});
