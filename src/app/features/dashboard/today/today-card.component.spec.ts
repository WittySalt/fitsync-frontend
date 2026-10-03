import { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { DayMeal, NutritionSummary, UsualMeal } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { BRIEF_NOW } from '../brief/brief-time';
import { TodayCardComponent } from './today-card.component';

// Wednesday 30 September 2026 at 08:10, built from local parts so the specs hold in any timezone.
const NOW = new Date(2026, 8, 30, 8, 10);

const nutrition: NutritionSummary = {
  totalCalories: 1420,
  targetCalories: 2100,
  totalProteinGrams: 86,
  targetProteinGrams: 140,
  totalCarbsGrams: 150,
  targetCarbsGrams: null,
  totalFatGrams: 50,
  targetFatGrams: null,
  mealCount: 3,
  totalFiberGrams: null,
  totalSugarGrams: null,
  totalSodiumMg: null,
  fiberTargetGrams: null,
  sugarLimitGrams: null,
  sodiumLimitMg: null,
  fiberTargetMet: null,
  sugarWithinLimit: null,
  sodiumWithinLimit: null
};

function usualMeal(mealType: string, usualTime: string | null, extra: Partial<UsualMeal> = {}): UsualMeal {
  return {
    mealType,
    label: mealType,
    usualTime,
    sourceMealId: `usual-${mealType}`,
    totalCalories: 499,
    totalProteinGrams: 30,
    totalCarbsGrams: 60,
    totalFatGrams: 14,
    items: [
      { name: 'Oats', calories: 228, proteinGrams: 8, categoryCode: 'GRAINS' },
      { name: 'Greek yogurt', calories: 271, proteinGrams: 22, categoryCode: 'DAIRY' }
    ],
    ...extra
  };
}

function meal(mealType: string, hour: number, calories: number, extra: Partial<DayMeal> = {}): DayMeal {
  return {
    mealId: `${mealType}-${hour}-${calories}`,
    mealType,
    consumedAt: new Date(2026, 8, 30, hour, 0).toISOString(),
    totalCalories: calories,
    totalProteinGrams: 20,
    totalCarbsGrams: 40,
    totalFatGrams: 10,
    items: [],
    ...extra
  };
}

describe('TodayCardComponent', () => {
  let fixture: ComponentFixture<TodayCardComponent>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(() => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMealsForDay', 'getUsualMeals', 'copyMeal']);
    dataService.getMealsForDay.and.returnValue(of([]));
    dataService.getUsualMeals.and.returnValue(of([]));
    dataService.copyMeal.and.returnValue(of({ ok: true }));
  });

  function create(options: { now?: Date; inputs?: Partial<Record<string, unknown>>; providers?: Provider[] } = {}): void {
    TestBed.configureTestingModule({
      imports: [TodayCardComponent],
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: dataService },
        { provide: BRIEF_NOW, useValue: () => options.now ?? NOW },
        ...(options.providers ?? [])
      ]
    });
    fixture = TestBed.createComponent(TodayCardComponent);
    const inputs = { nutrition, ...options.inputs };
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }


  function slots(): HTMLButtonElement[] {
    return Array.from(el().querySelectorAll<HTMLButtonElement>('.slot'));
  }


  // Angular drops the whitespace between elements, so the text of neighbouring elements is joined
  // with a space to read the way a person sees it.
  function spaced(node: Element | null): string {
    if (!node) {
      return '';
    }
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const value = (text.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (value) {
        parts.push(value);
      }
    }
    return parts.join(' ');
  }

  function panelText(tab: 'food'): string {
    return spaced(el().querySelector(`#today-panel-${tab}`));
  }

  function press(target: HTMLElement, key: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }





  describe('the card', () => {
    it('holds Food only, without tabs, and links Body and goals to the Goal page', () => {
      create();

      expect(el().querySelector('.head [role="tablist"], .tab')).toBeNull();
      expect(el().querySelector('#today-panel-food')).toBeTruthy();
      expect(el().querySelector('#today-panel-body, #today-panel-goals')).toBeNull();
      const link = el().querySelector('a.more');
      expect(link?.textContent?.trim()).toBe('Body and goals ›');
      expect(link?.getAttribute('href')).toBe('/progress/goal');
    });

  });

  describe('food tab', () => {
    it('writes both budgets as consumed of target', () => {
      create();

      const text = panelText('food');
      expect(text).toContain('1,420 of 2,100 kcal');
      expect(text).toContain('86 of 140 g');
      const fills = Array.from(el().querySelectorAll<HTMLElement>('.budget .bar span')).map((bar) => bar.style.width);
      expect(fills).toEqual(['68%', '61%']);
    });

    it('writes the figure alone with an empty bar and a Set a target link when there is no target', () => {
      create({ inputs: { nutrition: { ...nutrition, targetCalories: null, targetProteinGrams: null } } });

      const text = panelText('food');
      expect(text).toContain('1,420 kcal');
      expect(text).toContain('86 g');
      expect(text).not.toContain(' of 2,100');
      const links = Array.from(el().querySelectorAll<HTMLAnchorElement>('.quiet-link'));
      expect(links.map((link) => link.textContent?.trim())).toEqual(['Set a target', 'Set a target']);
      expect(links.every((link) => link.getAttribute('href') === '/nutrition')).toBeTrue();
      const fills = Array.from(el().querySelectorAll<HTMLElement>('.budget .bar span')).map((bar) => bar.style.width);
      expect(fills).toEqual(['0%', '0%']);
    });

    it('shows four slots that are logged with a check and kcal or not logged with a dash', () => {
      dataService.getMealsForDay.and.returnValue(of([meal('BREAKFAST', 8, 453), meal('LUNCH', 12, 598)]));
      create();

      expect(slots().map((slot) => slot.querySelector('.slot-name')?.textContent)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
      expect(slots()[0].querySelector('.slot-check')).toBeTruthy();
      expect(slots()[0].textContent).toContain('453 kcal');
      expect(slots()[1].textContent).toContain('598 kcal');
      expect(slots()[2].querySelector('.slot-check')).toBeNull();
      expect(slots()[2].querySelector('.slot-dash')?.textContent).toBe('–');
      expect(slots()[3].querySelector('.slot-dash')).toBeTruthy();
    });

    it('opens the slot of the latest logged meal', () => {
      dataService.getMealsForDay.and.returnValue(of([meal('BREAKFAST', 8, 453), meal('LUNCH', 12, 598)]));
      create();

      expect(slots().map((slot) => slot.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false']);
    });

    it('opens the slot whose window holds the time when nothing is logged', () => {
      create({ now: new Date(2026, 8, 30, 12, 0) });

      expect(slots().map((slot) => slot.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false']);
    });

    it('shows a logged meal with its kcal, share of the day, macro bar, legend and one card per food', () => {
      dataService.getMealsForDay.and.returnValue(
        of([
          meal('BREAKFAST', 8, 420, {
            totalProteinGrams: 27,
            totalCarbsGrams: 60,
            totalFatGrams: 12,
            items: [
              { name: 'Oats', calories: 228, proteinGrams: 8 },
              { name: 'Greek yogurt', calories: 192, proteinGrams: 19 }
            ]
          })
        ])
      );
      create();

      const text = panelText('food');
      expect(el().querySelector('.meal-kcal strong')?.textContent).toBe('420');
      expect(text).toContain('20% of today\'s target');
      expect(text).toContain('Protein 27 g');
      expect(text).toContain('Carbs 60 g');
      expect(text).toContain('Fat 12 g');
      const widths = Array.from(el().querySelectorAll<HTMLElement>('.macro-bar span')).map((part) => parseFloat(part.style.width));
      expect(widths.length).toBe(3);
      expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100, 4);
      expect(widths[1]).toBeGreaterThan(widths[0]);
      const foods = Array.from(el().querySelectorAll('.food')).map((card) => spaced(card));
      expect(foods).toEqual(['Oats 228 kcal · 8 g protein', 'Greek yogurt 192 kcal · 19 g protein']);
      const edit = Array.from(el().querySelectorAll<HTMLAnchorElement>('.action')).find((link) => link.textContent?.trim() === 'Edit this meal');
      expect(edit?.getAttribute('href')).toBe('/nutrition');
    });

    it('sums several meals of one type and lists all their foods', () => {
      dataService.getMealsForDay.and.returnValue(
        of([
          meal('LUNCH', 12, 400, { items: [{ name: 'Rice', calories: 250, proteinGrams: 5 }] }),
          meal('LUNCH', 15, 150, { items: [{ name: 'Apple', calories: 95, proteinGrams: 0 }] })
        ])
      );
      create();

      expect(el().querySelector('.meal-kcal strong')?.textContent).toBe('550');
      expect(slots()[1].textContent).toContain('550 kcal');
      expect(el().querySelectorAll('.food').length).toBe(2);
    });

    it('leaves the share out without a calorie target and never prints a bad value', () => {
      dataService.getMealsForDay.and.returnValue(of([meal('BREAKFAST', 8, 420)]));
      create({ inputs: { nutrition: { ...nutrition, targetCalories: null } } });

      const text = panelText('food');
      expect(text).not.toContain('% of today');
      expect(text).not.toMatch(/null|undefined|NaN/);
    });

    it('leaves the macro bar and food grid out for a meal with neither', () => {
      dataService.getMealsForDay.and.returnValue(
        of([meal('SNACK', 16, 200, { totalProteinGrams: 0, totalCarbsGrams: 0, totalFatGrams: 0, items: [] })])
      );
      create();

      expect(el().querySelector('.macro-bar')).toBeNull();
      expect(el().querySelector('.foods')).toBeNull();
      expect(panelText('food')).toContain('Edit this meal');
    });

    it('shows Nothing logged and a Log action for a slot without a meal, following the picked slot', () => {
      dataService.getMealsForDay.and.returnValue(of([meal('BREAKFAST', 8, 453)]));
      create();

      slots()[2].click();
      fixture.detectChanges();

      expect(panelText('food')).toContain('Nothing logged');
      const log = el().querySelector<HTMLAnchorElement>('.action.primary');
      expect(log?.textContent?.trim()).toBe('Log dinner');
      expect(log?.getAttribute('href')).toBe('/nutrition?log=DINNER');

      slots()[3].click();
      fixture.detectChanges();
      expect(el().querySelector('.action.primary')?.textContent?.trim()).toBe('Log snack');
    });

    it('moves between meal slots with the arrow keys', () => {
      create({ now: new Date(2026, 8, 30, 12, 0) });

      press(slots()[1], 'ArrowRight');
      expect(slots()[2].getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(slots()[2]);

      press(slots()[2], 'End');
      expect(slots()[3].getAttribute('aria-selected')).toBe('true');

      press(slots()[3], 'Home');
      expect(slots()[0].getAttribute('aria-selected')).toBe('true');
    });

    it('shows a skeleton and no figures while the meals load', () => {
      dataService.getMealsForDay.and.returnValue(new Subject<DayMeal[]>());
      create();

      expect(el().querySelector('#today-panel-food .panel-skeleton')).toBeTruthy();
      expect(panelText('food')).not.toContain('Nothing logged');
      expect(el().querySelector('#today-panel-food')?.getAttribute('aria-busy')).toBe('true');
    });

    it('shows a skeleton while the nutrition summary is missing', () => {
      create({ inputs: { nutrition: null } });

      expect(el().querySelector('#today-panel-food .panel-skeleton')).toBeTruthy();
    });

    it('says it could not load when the meals fail, and retries', () => {
      dataService.getMealsForDay.and.returnValue(throwError(() => new Error('down')));
      create();

      expect(panelText('food')).toBe('This could not be loaded. Try again');

      dataService.getMealsForDay.and.returnValue(of([meal('BREAKFAST', 8, 453)]));
      el().querySelector<HTMLButtonElement>('#today-panel-food .retry')?.click();
      fixture.detectChanges();

      expect(panelText('food')).not.toContain('This could not be loaded.');
      expect(panelText('food')).toContain('453 kcal');
    });

    it('asks the page to reload the nutrition summary when that is what failed', () => {
      create({ inputs: { nutrition: null, nutritionFailed: true } });
      const retried = jasmine.createSpy('retried');
      fixture.componentInstance.retryNutrition.subscribe(retried);

      expect(panelText('food')).toBe('This could not be loaded. Try again');
      el().querySelector<HTMLButtonElement>('#today-panel-food .retry')?.click();

      expect(retried).toHaveBeenCalledTimes(1);
      expect(dataService.getMealsForDay).toHaveBeenCalledTimes(1);
    });
  });

  describe('food tab with a usual meal', () => {
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    function createWithUsual(usual: UsualMeal[], now = NOW): void {
      dataService.getUsualMeals.and.returnValue(of(usual));
      create({ now, providers: [{ provide: ToastService, useValue: toast }] });
    }

    function panel(): HTMLElement {
      return el().querySelector<HTMLElement>('#today-slot-panel') as HTMLElement;
    }

    function actions(): HTMLButtonElement[] {
      return Array.from(panel().querySelectorAll<HTMLButtonElement>('button.action'));
    }

    beforeEach(() => toast.error.calls.reset());

    it('shows the eyebrow, the figures, the food cards and both actions', () => {
      createWithUsual([usualMeal('BREAKFAST', '08:30')]);

      expect(panel().querySelector('.eyebrow')?.textContent).toBe('Your usual breakfast');
      expect(panel().querySelector('.usual-figure')?.textContent).toBe('499 kcal · 30 g protein');
      const cards = Array.from(panel().querySelectorAll('.food')).map((card) => spaced(card));
      expect(cards).toEqual(['Oats 228 kcal · 8 g protein', 'Greek yogurt 271 kcal · 22 g protein']);
      expect(actions().map((button) => button.textContent?.trim())).toEqual(['Log it now', 'Log for 08:30']);
      expect(panel().textContent).not.toContain('Nothing logged');
      expect(el().textContent).not.toMatch(/null|undefined|NaN/);
    });

    it('leaves out Log for once the usual time has passed', () => {
      createWithUsual([usualMeal('BREAKFAST', '07:30')]);

      expect(actions().map((button) => button.textContent?.trim())).toEqual(['Log it now']);
    });

    it('leaves out a missing figure with its separator', () => {
      createWithUsual([usualMeal('BREAKFAST', '08:30', { totalProteinGrams: null })]);

      expect(panel().querySelector('.usual-figure')?.textContent).toBe('499 kcal');
    });

    it('keeps Nothing logged and the Log link when the meal type has only a usual time', () => {
      createWithUsual([usualMeal('BREAKFAST', '08:30', { sourceMealId: null, totalCalories: null, totalProteinGrams: null, items: [] })]);

      expect(panel().textContent).toContain('Nothing logged');
      const link = panel().querySelector<HTMLAnchorElement>('a.action');
      expect(link?.textContent?.trim()).toBe('Log breakfast');
      expect(link?.getAttribute('href')).toBe('/nutrition?log=BREAKFAST');
      expect(actions().length).toBe(0);
    });

    it('logs the combination now with the slot type and reloads the meals and the budget', () => {
      createWithUsual([usualMeal('BREAKFAST', '08:30')]);
      const retried = jasmine.createSpy('retried');
      fixture.componentInstance.retryNutrition.subscribe(retried);
      dataService.getMealsForDay.and.returnValue(of([meal('BREAKFAST', 8, 499, { consumedAt: NOW.toISOString() })]));

      actions()[0].click();
      fixture.detectChanges();

      const [mealId, mealType, consumedAt] = dataService.copyMeal.calls.mostRecent().args;
      expect([mealId, mealType]).toEqual(['usual-BREAKFAST', 'BREAKFAST']);
      expect(new Date(consumedAt as string).getTime()).toBe(NOW.getTime());
      expect(dataService.getMealsForDay).toHaveBeenCalledTimes(2);
      expect(retried).toHaveBeenCalledTimes(1);
      expect(slots()[0].querySelector('.slot-check')).toBeTruthy();
      expect(panel().querySelector('.eyebrow')).toBeNull();
      expect(panel().textContent).toContain('Edit this meal');
    });

    it('logs for today at the usual time in the local zone', () => {
      createWithUsual([usualMeal('BREAKFAST', '08:30')]);

      actions()[1].click();

      const consumedAt = dataService.copyMeal.calls.mostRecent().args[2] as string;
      expect(new Date(consumedAt).getTime()).toBe(new Date(2026, 8, 30, 8, 30).getTime());
    });

    it('disables both buttons and marks them busy while the copy runs', () => {
      createWithUsual([usualMeal('BREAKFAST', '08:30')]);
      dataService.copyMeal.and.returnValue(new Subject<{ ok: true }>());

      actions()[0].click();
      fixture.detectChanges();

      expect(actions().every((button) => button.disabled && button.getAttribute('aria-busy') === 'true')).toBeTrue();
      expect(dataService.copyMeal).toHaveBeenCalledTimes(1);
    });

    it('reports a failure with the toast and keeps the panel and the buttons', () => {
      createWithUsual([usualMeal('BREAKFAST', '08:30')]);
      dataService.copyMeal.and.returnValue(throwError(() => new Error('down')));

      actions()[0].click();
      fixture.detectChanges();

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(panel().querySelector('.eyebrow')?.textContent).toBe('Your usual breakfast');
      expect(actions().every((button) => !button.disabled)).toBeTrue();
      expect(dataService.getMealsForDay).toHaveBeenCalledTimes(1);
    });

    it('labels a meal logged ahead of its time', () => {
      dataService.getMealsForDay.and.returnValue(of([meal('LUNCH', 12, 600, { consumedAt: new Date(2026, 8, 30, 12, 30).toISOString() })]));
      createWithUsual([], new Date(2026, 8, 30, 9, 0));

      expect(panel().querySelector('.ahead')?.textContent).toBe('Logged ahead');
    });

    it('drops the label once the time of the meal has passed', () => {
      dataService.getMealsForDay.and.returnValue(of([meal('LUNCH', 12, 600, { consumedAt: new Date(2026, 8, 30, 12, 30).toISOString() })]));
      createWithUsual([], new Date(2026, 8, 30, 13, 0));

      expect(panel().querySelector('.ahead')).toBeNull();
    });

    it('puts the green dot on the meal due now and keeps it there when another slot is opened', () => {
      createWithUsual([usualMeal('BREAKFAST', '08:30')]);

      const dotted = () => slots().map((slot) => !!slot.querySelector('.slot-dot'));
      expect(dotted()).toEqual([true, false, false, false]);

      slots()[2].click();
      fixture.detectChanges();

      expect(slots()[2].getAttribute('aria-selected')).toBe('true');
      expect(dotted()).toEqual([true, false, false, false]);
    });

    it('takes the window from the usual time instead of the default', () => {
      createWithUsual([usualMeal('LUNCH', '10:00', { sourceMealId: null })], new Date(2026, 8, 30, 10, 30));

      expect(slots().map((slot) => slot.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false']);
    });
  });

  it('shows one skeleton in place of the panel while the page loads', () => {
    create({ inputs: { loading: true, nutrition: null } });

    expect(el().querySelector('#today-panel-food')).toBeNull();
    expect(el().querySelector('.panel-skeleton')).toBeTruthy();
    expect(el().textContent).not.toMatch(/null|undefined|NaN/);
  });
});
