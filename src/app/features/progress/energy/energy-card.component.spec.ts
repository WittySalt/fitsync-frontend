import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { EnergyApiService } from './energy-api.service';
import { EnergyCardComponent } from './energy-card.component';
import { EnergyWeek } from './energy.models';
import { shiftWeek, thisMonday } from './energy-figures';
import { energyWeek } from './energy-testing.spec';
import { toIsoDate } from '../../nutrition/diary/diary-time';

describe('EnergyCardComponent', () => {
  let api: jasmine.SpyObj<EnergyApiService>;
  let fixture: ComponentFixture<EnergyCardComponent>;

  beforeEach(() => {
    api = jasmine.createSpyObj<EnergyApiService>('EnergyApiService', ['getWeek']);
    api.getWeek.and.callFake(() => of(energyWeek()));
    TestBed.configureTestingModule({ providers: [{ provide: EnergyApiService, useValue: api }, provideRouter([])] });
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(EnergyCardComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const click = (el: HTMLElement, selector: string) => {
    el.querySelector<HTMLElement>(selector)?.click();
    fixture.detectChanges();
  };

  describe('a week with figures', () => {
    it('opens on this week, asking the server for no particular week', () => {
      render();
      expect(api.getWeek).toHaveBeenCalledOnceWith(undefined);
    });

    it('shows the big number under, with its sub line, in words that are not a warning', () => {
      const el = render();
      expect(text(el.querySelector('.number'))).toBe('241 kcal a day under');
      expect(text(el.querySelector('.sub'))).toBe('about 0.22 kg a week · food logged on 5 of 7 days');
      expect(el.querySelector('.danger, .error, [class*="red"]')).toBeNull();
    });

    it('shows over in the same way', () => {
      api.getWeek.and.returnValue(of(energyWeek({ average: { eaten: 2400, resting: 1968, workouts: 120, used: 2088, balance: 312 }, weeklyKgEquivalent: 0.28 })));
      const el = render();
      expect(text(el.querySelector('.number'))).toBe('312 kcal a day over');
      expect(text(el.querySelector('app-energy-bars'))).toContain('312 over');
    });

    it('draws the dial, the two bars, the days and the eight weeks', () => {
      const el = render();
      expect(el.querySelector('app-energy-dial svg')?.getAttribute('aria-label')).toContain('241 kcal under');
      expect(text(el.querySelector('app-energy-bars'))).toContain('241 under');
      expect(el.querySelector('app-energy-days')).not.toBeNull();
      expect(text(el.querySelector('app-energy-weeks'))).toContain('Log says');
      expect(text(el.querySelector('app-energy-weeks'))).toContain('Days without a food log are not counted');
    });

    it('says nothing about estimates when the resting figure is exact', () => {
      expect(text(render())).not.toContain('Estimated without your age or sex');
    });

    it('adds a quiet line when the resting figure is estimated', () => {
      api.getWeek.and.returnValue(of(energyWeek({ bmrEstimated: true })));
      const el = render();
      expect(text(el.querySelector('.estimated'))).toBe('Estimated without your age or sex. Add them in Me for a closer figure.');
    });
  });

  describe('the week switcher', () => {
    it('names the week from the API and steps back by a Monday week', () => {
      const el = render();
      expect(text(el.querySelector('.switcher strong'))).toMatch(/^28 Sep(t)? to 4 Oct$/);
      click(el, 'button[aria-label="Previous week"]');
      expect(api.getWeek).toHaveBeenCalledWith('2026-09-21');
    });

    it('steps forward from an earlier week', () => {
      api.getWeek.and.returnValue(of(energyWeek({ weekStart: '2026-09-07', weekEnd: '2026-09-13' })));
      const el = render();
      click(el, 'button[aria-label="Next week"]');
      expect(api.getWeek).toHaveBeenCalledWith('2026-09-14');
    });

    it('cannot go past this week', () => {
      const monday = thisMonday(toIsoDate(new Date()));
      api.getWeek.and.returnValue(of(energyWeek({ weekStart: monday, weekEnd: shiftWeek(monday, 1) })));
      const el = render();
      expect(el.querySelector<HTMLButtonElement>('button[aria-label="Next week"]')?.disabled).toBeTrue();
      click(el, 'button[aria-label="Next week"]');
      expect(api.getWeek).toHaveBeenCalledTimes(1);
    });

    it('keeps the switcher on the last week while another is loading, and waits for it', () => {
      const pending = new Subject<EnergyWeek>();
      const el = render();
      api.getWeek.and.returnValue(pending as Observable<EnergyWeek>);
      click(el, 'button[aria-label="Previous week"]');
      expect(el.querySelector('.skeleton')).not.toBeNull();
      expect(text(el.querySelector('.switcher strong'))).toMatch(/^28 Sep/);
      expect(el.querySelector<HTMLButtonElement>('button[aria-label="Previous week"]')?.disabled).toBeTrue();
      pending.next(energyWeek({ weekStart: '2026-09-21', weekEnd: '2026-09-27' }));
      fixture.detectChanges();
      expect(text(el.querySelector('.switcher strong'))).toMatch(/^21 Sep/);
    });
  });

  describe('each day and adding up', () => {
    it('starts on each day and switches to adding up and back', () => {
      const el = render();
      const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('app-energy-days .segmented button'));
      expect(buttons()[0].getAttribute('aria-pressed')).toBe('true');
      expect(el.querySelector('app-energy-days .shadow')).not.toBeNull();
      buttons()[1].click();
      fixture.detectChanges();
      expect(buttons()[1].getAttribute('aria-pressed')).toBe('true');
      expect(el.querySelector('app-energy-days .shadow')).toBeNull();
      expect(el.querySelector('app-energy-days .line')).not.toBeNull();
      expect(text(el.querySelector('app-energy-days .end'))).toBe('−1,205 kcal');
      buttons()[0].click();
      fixture.detectChanges();
      expect(el.querySelector('app-energy-days .shadow')).not.toBeNull();
    });

    it('shows empty shadows and not-logged notes for the unlogged days, and a sign for estimated workouts', () => {
      const el = render();
      expect(el.querySelectorAll('app-energy-days .shadow.empty').length).toBe(2);
      expect(el.querySelectorAll('app-energy-days .label.off').length).toBe(2);
      expect(text(el.querySelector('app-energy-days .labels'))).toContain('not logged');
      expect(text(el.querySelector('app-energy-days .labels'))).toContain('≈');
    });

    it('draws the unlogged days as hollow dots when adding up', () => {
      const el = render();
      el.querySelectorAll<HTMLButtonElement>('app-energy-days .segmented button')[1].click();
      fixture.detectChanges();
      expect(el.querySelectorAll('app-energy-days .dot.hollow').length).toBe(2);
    });

    it('describes each chart in text', () => {
      const el = render();
      expect(el.querySelector('app-energy-days svg')?.getAttribute('aria-label')).toContain('food logged on 5 of 7 days');
      el.querySelectorAll<HTMLButtonElement>('app-energy-days .segmented button')[1].click();
      fixture.detectChanges();
      expect(el.querySelector('app-energy-days svg')?.getAttribute('aria-label')).toContain('Running total');
    });
  });

  describe('a week without figures', () => {
    it('asks for height and weight when there is no profile, with a way to add them', () => {
      api.getWeek.and.returnValue(of(energyWeek({ status: 'NO_PROFILE', bmrKcal: null, average: null, mealSplit: null, weeklyKgEquivalent: null })));
      const el = render();
      expect(text(el.querySelector('.message'))).toContain('Add your height and weight to see what you use.');
      const add = el.querySelector<HTMLAnchorElement>('.message a');
      expect(add?.textContent?.trim()).toBe('Add in Me');
      expect(add?.getAttribute('href')).toBe('/me');
      expect(el.querySelector('app-energy-dial')).toBeNull();
      expect(el.querySelector('app-energy-days')).toBeNull();
    });

    it('asks for three logged days and says how many there are so far', () => {
      api.getWeek.and.returnValue(of(energyWeek({ status: 'TOO_FEW_DAYS', daysLogged: 2, average: null, mealSplit: null, weeklyKgEquivalent: null })));
      const el = render();
      expect(text(el.querySelector('.message'))).toBe('Log food on 3 days this week to see the balance. 2 so far.');
      expect(el.querySelector('app-energy-dial')).toBeNull();
      expect(el.querySelector('app-energy-days')).not.toBeNull();
    });

    it('treats a full status with no balance as too few days rather than showing a zero', () => {
      api.getWeek.and.returnValue(of(energyWeek({ average: null })));
      const el = render();
      expect(text(el.querySelector('.message'))).toContain('Log food on 3 days');
    });
  });

  describe('loading and failure', () => {
    it('shows a skeleton until the week arrives', () => {
      const pending = new Subject<EnergyWeek>();
      api.getWeek.and.returnValue(pending as Observable<EnergyWeek>);
      const el = render();
      expect(el.querySelector('.skeleton[aria-busy="true"]')).not.toBeNull();
      expect(el.querySelector('app-energy-top')).toBeNull();
      pending.next(energyWeek());
      fixture.detectChanges();
      expect(el.querySelector('.skeleton')).toBeNull();
      expect(el.querySelector('app-energy-top')).not.toBeNull();
    });

    it('shows an error panel with a retry that asks for the same week again', () => {
      api.getWeek.and.returnValue(throwError(() => new Error('down')));
      const el = render();
      expect(text(el)).toContain('Energy unavailable');
      api.getWeek.and.returnValue(of(energyWeek()));
      click(el, 'app-state-panel button');
      expect(api.getWeek).toHaveBeenCalledTimes(2);
      expect(api.getWeek.calls.mostRecent().args).toEqual([undefined]);
      expect(el.querySelector('app-energy-top')).not.toBeNull();
    });
  });
});
