import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';

import { NutrientsOverview } from './nutrients.models';
import { NutrientsService } from './nutrients.service';
import { NutrientsPage } from './nutrients.page';
import { NutrientPage } from './nutrient.page';
import { detail, overview } from './nutrients-testing.spec';
import { takeScroll } from './nutrients-scroll';
import { ProgressBack } from '../../progress/cards/progress-back';

describe('NutrientsPage', () => {
  let service: jasmine.SpyObj<NutrientsService>;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    sessionStorage.clear();
    service = jasmine.createSpyObj<NutrientsService>('NutrientsService', ['getAll', 'getOne']);
    service.getAll.and.callFake(() => of(overview()));
    service.getOne.and.callFake(() => of(detail()));
    TestBed.configureTestingModule({
      providers: [
        { provide: NutrientsService, useValue: service },
        provideRouter([
          { path: 'nutrition/nutrients', component: NutrientsPage },
          { path: 'nutrition/nutrients/:code', component: NutrientPage },
          { path: 'nutrition', children: [] },
          { path: 'settings', children: [] }
        ])
      ]
    });
  });

  let sizing: HTMLStyleElement;

  afterEach(() => sizing?.remove());

  /** Opens the page at a URL with the page host set to a width, which the page measures to pick its layout. */
  async function open(url = '/nutrition/nutrients', width = 1000): Promise<HTMLElement> {
    sizing = document.createElement('style');
    sizing.textContent = `app-nutrients-page { display: block; width: ${width}px; }`;
    document.head.appendChild(sizing);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  const text = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ');

  it('heads the page with a Back that steps back through ProgressBack and falls back to Nutrition', async () => {
    const el = await open();
    const back = spyOn(TestBed.inject(ProgressBack), 'back');
    const link = el.querySelector<HTMLAnchorElement>('a.back');

    expect(link?.textContent?.trim()).toBe('‹ Back');
    link?.click();

    expect(back).toHaveBeenCalledOnceWith('/nutrition');
  });

  it('lands on Nutrition when Back has no earlier page of the app to return to', async () => {
    const el = await open();
    el.querySelector<HTMLAnchorElement>('a.back')?.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/nutrition');
  });

  it('opens on 7 days when the URL names no period', async () => {
    const el = await open();
    expect(service.getAll).toHaveBeenCalledTimes(1);
    const [from, to] = service.getAll.calls.mostRecent().args;
    expect((new Date(to).getTime() - new Date(from).getTime()) / 86400000).toBe(6);
    const pressed = el.querySelector('.periods button[aria-pressed="true"]');
    expect(pressed?.textContent?.trim()).toBe('7 days');
  });

  it('remembers the period in the URL and reads it back', async () => {
    const el = await open('/nutrition/nutrients?period=30d');
    expect(el.querySelector('.periods button[aria-pressed="true"]')?.textContent?.trim()).toBe('30 days');
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('.periods button'));
    buttons.find((button) => button.textContent?.trim() === 'Today')?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toContain('period=today');
    expect(service.getAll).toHaveBeenCalledTimes(2);
  });

  it('shows the days logged, the reference label and the Change link to Settings', async () => {
    const el = await open('/nutrition/nutrients?period=7d');
    const line = text(el.querySelector('.sub') as HTMLElement);
    expect(line).toContain('5 of 7 days logged');
    expect(line).toContain('Male ranges, aged 19 to 30');
    const change = el.querySelector<HTMLAnchorElement>('.sub a');
    expect(change?.textContent).toBe('Change');
    expect(change?.getAttribute('href')).toContain('/settings');
    expect(change?.getAttribute('href')).toContain('section=preferences');
  });

  it('draws the hero, the table and a tile for every nutrient with a spoken label', async () => {
    const el = await open();
    expect(el.querySelector('app-nutrient-hero')).not.toBeNull();
    const tiles = el.querySelectorAll('app-nutrient-table button.tile');
    expect(tiles.length).toBe(7);
    const labels = Array.from(tiles).map((button) => button.getAttribute('aria-label'));
    expect(labels).toContain('Vitamin D, 34% of the daily amount');
    expect(el.querySelector('app-nutrient-petals svg')?.getAttribute('aria-label')).toContain('Lowest');
  });

  it('fills the side panel from a tile on a wide screen and loads the foods once', async () => {
    const el = await open('/nutrition/nutrients', 1000);
    expect(el.querySelector('app-nutrient-side-panel')).not.toBeNull();
    const iron = Array.from(el.querySelectorAll<HTMLButtonElement>('app-nutrient-table button.tile')).find((b) => b.getAttribute('aria-label')?.startsWith('Iron'));
    iron?.click();
    harness.detectChanges();
    expect(text(el.querySelector('app-nutrient-side-panel') as HTMLElement)).toContain('Iron');
    expect(service.getOne).toHaveBeenCalledWith('IRON', jasmine.any(String), jasmine.any(String));
    iron?.click();
    harness.detectChanges();
    expect(service.getOne.calls.allArgs().filter((args) => args[0] === 'IRON').length).toBe(1);
  });

  it('opens the nutrient page from a tile on a phone, with the period', async () => {
    const el = await open('/nutrition/nutrients?period=30d', 400);
    expect(el.querySelector('app-nutrient-side-panel')).toBeNull();
    const zinc = Array.from(el.querySelectorAll<HTMLButtonElement>('app-nutrient-table button.tile')).find((b) => b.getAttribute('aria-label')?.startsWith('Zinc'));
    zinc?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/nutrition/nutrients/ZINC?period=30d');
  });

  it('opens a nutrient page from the chips of the lowest three', async () => {
    const el = await open('/nutrition/nutrients', 1000);
    el.querySelector<HTMLButtonElement>('app-nutrient-hero .chip')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('/nutrition/nutrients/VIT_D');
  });

  it('shows a skeleton while it loads', async () => {
    let release: (value: NutrientsOverview) => void = () => undefined;
    service.getAll.and.returnValue(new Observable<NutrientsOverview>((subscriber) => { release = (value) => { subscriber.next(value); subscriber.complete(); }; }));
    const el = await open();
    expect(el.querySelector('.skeleton[aria-busy="true"]')).not.toBeNull();
    release(overview());
    harness.detectChanges();
    expect(el.querySelector('.skeleton')).toBeNull();
  });

  it('shows an error panel with a retry that reloads', async () => {
    service.getAll.and.returnValue(throwError(() => new Error('down')));
    const el = await open();
    expect(text(el)).toContain('Nutrients unavailable');
    service.getAll.and.callFake(() => of(overview()));
    el.querySelector<HTMLButtonElement>('app-state-panel button')?.click();
    harness.detectChanges();
    expect(el.querySelector('app-nutrient-table')).not.toBeNull();
  });

  it('says so when there are no nutrients at all', async () => {
    service.getAll.and.returnValue(of(overview([])));
    const el = await open();
    expect(text(el)).toContain('No nutrients yet');
  });

  it('reads an unknown nutrient as no data and not as a low one', async () => {
    const el = await open();
    const zinc = Array.from(el.querySelectorAll('app-nutrient-table button.tile')).find((b) => b.getAttribute('aria-label')?.startsWith('Zinc'));
    expect(zinc?.getAttribute('aria-label')).toBe('Zinc, no data yet');
  });

  it('saves its place when it is left, for the way back to restore', async () => {
    await open();
    await TestBed.inject(Router).navigateByUrl('/nutrition');
    expect(takeScroll('7d')).toBeNull();
  });
});
