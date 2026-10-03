import { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { DashboardData, FitSyncDataService } from '../../../core/fitsync-data.service';
import { DayMeal, NutritionSummary, ProgressInsight, UsualMeal } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { BRIEF_NOW } from '../brief/brief-time';
import { TodayCardComponent } from './today-card.component';
import { TODAY_TAB_STORAGE_KEY } from './today-tab';

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

// The weight trend of a person with too few weigh-ins to draw, so the card specs see the figures only.
const noInsight: ProgressInsight = {
  referenceDate: '2026-09-30',
  weightKg: null,
  measuredOn: null,
  weeklyRateKg: null,
  goalWeightKg: null,
  goalDate: null,
  projectedDate: null,
  series: []
};

const dashboard: DashboardData = {
  profile: {
    displayName: 'Wang Xu',
    firstName: 'Wang',
    lastName: 'Xu',
    heightCm: 178,
    activityLevel: 'MODERATELY_ACTIVE',
    timezone: 'Asia/Singapore',
    onboardingCompleted: true
  },
  nutrition,
  latestWorkout: null,
  latestMeal: null,
  latestBodyMetric: { weightKg: 71.1, bodyFatRate: 21.4, bmi: 22.4, measuredAt: '2026-09-30', weightChange30dKg: -1.4 },
  goals: [
    {
      goalId: 'g-weight',
      goalType: 'WEIGHT',
      targetValue: 68,
      targetUnit: 'kg',
      targetDate: '2026-11-29',
      status: 'ACTIVE',
      progressRatio: 0.31,
      currentValue: 71.1
    },
    {
      goalId: 'g-protein',
      goalType: 'PROTEIN',
      targetValue: 140,
      targetUnit: 'g',
      targetDate: '2026-11-29',
      status: 'ACTIVE',
      progressRatio: 1.4,
      currentValue: 86
    }
  ]
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
    localStorage.removeItem(TODAY_TAB_STORAGE_KEY);
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getMealsForDay', 'getUsualMeals', 'copyMeal', 'getProgressInsight']);
    dataService.getMealsForDay.and.returnValue(of([]));
    dataService.getUsualMeals.and.returnValue(of([]));
    dataService.copyMeal.and.returnValue(of({ ok: true }));
    dataService.getProgressInsight.and.returnValue(of(noInsight));
  });

  afterEach(() => localStorage.removeItem(TODAY_TAB_STORAGE_KEY));

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
    const inputs = { dashboard, nutrition, ...options.inputs };
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function tabs(): HTMLButtonElement[] {
    return Array.from(el().querySelectorAll<HTMLButtonElement>('.tab'));
  }

  function slots(): HTMLButtonElement[] {
    return Array.from(el().querySelectorAll<HTMLButtonElement>('.slot'));
  }

  function selectedTabLabel(): string {
    return tabs().find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent?.trim() ?? '';
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

  function panelText(tab: 'food' | 'body' | 'goals'): string {
    return spaced(el().querySelector(`#today-panel-${tab}`));
  }

  function press(target: HTMLElement, key: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function drag(from: [number, number], to: [number, number], pointerType = 'touch'): void {
    const panels = el().querySelector('.panels') as HTMLElement;
    panels.dispatchEvent(new PointerEvent('pointerdown', { pointerType, clientX: from[0], clientY: from[1], bubbles: true }));
    panels.dispatchEvent(new PointerEvent('pointerup', { pointerType, clientX: to[0], clientY: to[1], bubbles: true }));
    fixture.detectChanges();
  }

  describe('tab list', () => {
    it('is a real ARIA tab list with a panel behind every tab', () => {
      create();

      const list = el().querySelector('[role="tablist"]');
      expect(list).toBeTruthy();
      expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(['Food', 'Body', 'Goals']);
      expect(el().querySelector('.eyebrow')?.textContent).toBe('Today');
      for (const tab of tabs()) {
        expect(tab.getAttribute('role')).toBe('tab');
        const panel = el().querySelector(`#${tab.getAttribute('aria-controls')}`);
        expect(panel?.getAttribute('role')).toBe('tabpanel');
        expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
      }
      expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
      expect(tabs().map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    });

    it('shows only the selected panel', () => {
      create();
      tabs()[1].click();
      fixture.detectChanges();

      expect(el().querySelector('#today-panel-food')?.hasAttribute('hidden')).toBeTrue();
      expect(el().querySelector('#today-panel-body')?.hasAttribute('hidden')).toBeFalse();
      expect(el().querySelector('#today-panel-goals')?.hasAttribute('hidden')).toBeTrue();
    });

    it('moves between tabs with the arrow keys, wrapping, and takes focus with it', () => {
      create();

      press(tabs()[0], 'ArrowRight');
      expect(selectedTabLabel()).toBe('Body');
      expect(document.activeElement).toBe(tabs()[1]);

      press(tabs()[1], 'ArrowRight');
      expect(selectedTabLabel()).toBe('Goals');

      press(tabs()[2], 'ArrowRight');
      expect(selectedTabLabel()).toBe('Food');

      press(tabs()[0], 'ArrowLeft');
      expect(selectedTabLabel()).toBe('Goals');
    });

    it('goes to the first and last tab with Home and End and ignores other keys', () => {
      create();

      press(tabs()[0], 'End');
      expect(selectedTabLabel()).toBe('Goals');

      press(tabs()[2], 'Home');
      expect(selectedTabLabel()).toBe('Food');

      press(tabs()[0], 'x');
      expect(selectedTabLabel()).toBe('Food');
    });
  });

  describe('swipe', () => {
    it('moves to the next tab on a leftward swipe and the previous on a rightward one', () => {
      create();

      drag([300, 100], [200, 104]);
      expect(selectedTabLabel()).toBe('Body');

      drag([100, 100], [220, 90]);
      expect(selectedTabLabel()).toBe('Food');
    });

    it('does not change tab on a vertical drag', () => {
      create();

      drag([200, 100], [190, 300]);

      expect(selectedTabLabel()).toBe('Food');
    });

    it('does not change tab on a diagonal drag that is not mostly horizontal', () => {
      create();

      drag([200, 100], [120, 180]);

      expect(selectedTabLabel()).toBe('Food');
    });

    it('does not change tab below the 48 px threshold or for a mouse', () => {
      create();

      drag([200, 100], [160, 100]);
      expect(selectedTabLabel()).toBe('Food');

      drag([300, 100], [100, 100], 'mouse');
      expect(selectedTabLabel()).toBe('Food');
    });

    it('stops at the ends instead of wrapping', () => {
      create();

      drag([100, 100], [300, 100]);
      expect(selectedTabLabel()).toBe('Food');

      tabs()[2].click();
      fixture.detectChanges();
      drag([300, 100], [100, 100]);
      expect(selectedTabLabel()).toBe('Goals');
    });

    it('ignores a gesture that was cancelled', () => {
      create();
      const panels = el().querySelector('.panels') as HTMLElement;

      panels.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: 300, clientY: 100, bubbles: true }));
      panels.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'touch', bubbles: true }));
      panels.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', clientX: 100, clientY: 100, bubbles: true }));
      fixture.detectChanges();

      expect(selectedTabLabel()).toBe('Food');
    });
  });

  describe('opening tab', () => {
    it('opens on Food by default', () => {
      create();

      expect(selectedTabLabel()).toBe('Food');
    });

    it('opens on Body the morning after a weigh-in', () => {
      create({ inputs: { dashboard: { ...dashboard, latestBodyMetric: { ...dashboard.latestBodyMetric!, measuredAt: '2026-09-29' } } } });

      expect(selectedTabLabel()).toBe('Body');
    });

    it('opens on Body with no weight once a meal is logged, and stays on Food when nothing is', () => {
      dataService.getMealsForDay.and.returnValue(of([meal('BREAKFAST', 8, 400)]));
      create({ inputs: { dashboard: { ...dashboard, latestBodyMetric: null } } });
      expect(selectedTabLabel()).toBe('Body');

      TestBed.resetTestingModule();
      dataService.getMealsForDay.and.returnValue(of([]));
      create({ inputs: { dashboard: { ...dashboard, latestBodyMetric: null } } });
      expect(selectedTabLabel()).toBe('Food');
    });

    it('is decided once and does not turn the tab when the meals reload later', () => {
      create();
      expect(selectedTabLabel()).toBe('Food');

      dataService.getMealsForDay.and.returnValue(of([meal('BREAKFAST', 8, 400)]));
      fixture.componentInstance.loadMeals();
      fixture.componentRef.setInput('dashboard', { ...dashboard, latestBodyMetric: null });
      fixture.detectChanges();

      expect(selectedTabLabel()).toBe('Food');
    });

    it('remembers the tab the person picked for the rest of the day', () => {
      create();
      tabs()[2].click();
      fixture.detectChanges();

      expect(JSON.parse(localStorage.getItem(TODAY_TAB_STORAGE_KEY) ?? 'null')).toEqual({ date: '2026-09-30', tab: 'goals' });

      TestBed.resetTestingModule();
      create({ inputs: { dashboard: { ...dashboard, latestBodyMetric: { ...dashboard.latestBodyMetric!, measuredAt: '2026-09-29' } } } });
      expect(selectedTabLabel()).toBe('Goals');
    });

    it('ignores a choice from another day and applies the rule again', () => {
      localStorage.setItem(TODAY_TAB_STORAGE_KEY, JSON.stringify({ date: '2026-09-29', tab: 'goals' }));

      create();

      expect(selectedTabLabel()).toBe('Food');
    });

    it('keeps working when storage refuses to be read or written', () => {
      spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
      spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
      create();

      tabs()[1].click();
      fixture.detectChanges();

      expect(selectedTabLabel()).toBe('Body');
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

    it('says it could not load when the meals fail, retries, and leaves the other tabs working', () => {
      dataService.getMealsForDay.and.returnValue(throwError(() => new Error('down')));
      create();

      expect(panelText('food')).toBe('This could not be loaded. Try again');

      tabs()[1].click();
      fixture.detectChanges();
      expect(panelText('body')).toContain('71.1 kg');

      tabs()[0].click();
      fixture.detectChanges();
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

  describe('body tab', () => {
    function openBody(): void {
      tabs()[1].click();
      fixture.detectChanges();
    }

    it('shows the latest weight with its date, the 30-day change, body fat and BMI', () => {
      create();
      openBody();

      const text = panelText('body');
      expect(text).toContain('71.1 kg');
      expect(text).toContain('Weighed today');
      expect(text).toContain('Down 1.4 kg in 30 days');
      expect(text).toContain('Body fat 21.4%');
      expect(text).toContain('BMI 22.4');
      const link = el().querySelector<HTMLAnchorElement>('#today-panel-body .action');
      expect(link?.textContent?.trim()).toBe('All measurements');
      expect(link?.getAttribute('href')).toBe('/body');
    });

    it('asks for the weight trend without a timezone argument', () => {
      create();

      expect(dataService.getProgressInsight).toHaveBeenCalledOnceWith();
    });

    it('writes an older weigh-in as a date with the Sept spelling', () => {
      create({ inputs: { dashboard: { ...dashboard, latestBodyMetric: { ...dashboard.latestBodyMetric!, measuredAt: '2026-09-13' } } } });
      openBody();

      expect(panelText('body')).toContain('Weighed 13 Sept');
    });

    it('leaves out body fat, BMI and the change together with their labels when they are missing', () => {
      create({
        inputs: {
          dashboard: { ...dashboard, latestBodyMetric: { weightKg: 71.1, bodyFatRate: 0, bmi: 0, measuredAt: null, weightChange30dKg: null } }
        }
      });
      openBody();

      const text = panelText('body');
      expect(text).toContain('71.1 kg');
      expect(text).not.toContain('Body fat');
      expect(text).not.toContain('BMI');
      expect(text).not.toContain('Weighed');
      expect(text).not.toContain('30 days');
      expect(text).not.toMatch(/null|undefined|NaN/);
    });

    it('says No measurement yet and offers to record one when there is no weight', () => {
      create({ inputs: { dashboard: { ...dashboard, latestBodyMetric: null } } });
      openBody();

      expect(panelText('body')).toBe('No measurement yet Record a measurement');
      expect(el().querySelector('#today-panel-body .action')?.getAttribute('href')).toBe('/body');
    });

    it('treats a snapshot that only carries zeroes as no measurement', () => {
      create({ inputs: { dashboard: { ...dashboard, latestBodyMetric: { weightKg: 0, bodyFatRate: 0, bmi: 22.4, measuredAt: '2026-09-30' } } } });
      openBody();

      expect(panelText('body')).toContain('No measurement yet');
    });

    it('shows a skeleton while the dashboard loads and a retry when it failed', () => {
      create({ inputs: { dashboard: null } });
      openBody();
      expect(el().querySelector('#today-panel-body .panel-skeleton')).toBeTruthy();

      fixture.componentRef.setInput('dashboardFailed', true);
      fixture.detectChanges();
      expect(panelText('body')).toBe('This could not be loaded. Try again');

      const retried = jasmine.createSpy('retried');
      fixture.componentInstance.retryDashboard.subscribe(retried);
      el().querySelector<HTMLButtonElement>('#today-panel-body .retry')?.click();
      expect(retried).toHaveBeenCalledTimes(1);
    });
  });

  describe('goals tab', () => {
    function openGoals(): void {
      tabs()[2].click();
      fixture.detectChanges();
    }

    it('shows a row per goal with its figure, a clamped bar and the due date', () => {
      create();
      openGoals();

      const rows = Array.from(el().querySelectorAll('#today-panel-goals .goal')).map((row) => spaced(row));
      expect(rows).toEqual(['Weight 71.1 kg, goal 68 kg by 29 Nov 2026', 'Protein 86 of 140 g']);
      const fills = Array.from(el().querySelectorAll<HTMLElement>('#today-panel-goals .bar span')).map((bar) => bar.style.width);
      expect(fills).toEqual(['31%', '100%']);
    });

    it('links Manage to where the old goals card linked', () => {
      create();
      openGoals();

      const link = el().querySelector<HTMLAnchorElement>('#today-panel-goals .action');
      expect(link?.textContent?.trim()).toBe('Manage');
      expect(link?.getAttribute('href')).toBe('/me#goal-lifecycle');
    });

    it('says No goals yet and offers to add one', () => {
      create({ inputs: { dashboard: { ...dashboard, goals: [] } } });
      openGoals();

      expect(panelText('goals')).toBe('No goals yet Add a goal');
    });

    it('shows a retry when the dashboard failed while the Food tab still works', () => {
      create({ inputs: { dashboard: null, dashboardFailed: true } });
      openGoals();

      expect(panelText('goals')).toBe('This could not be loaded. Try again');
      expect(panelText('food')).toContain('1,420 of 2,100 kcal');
    });
  });

  it('shows one skeleton in place of the panels while the page loads', () => {
    create({ inputs: { loading: true, dashboard: null, nutrition: null } });

    expect(el().querySelector('.panels')).toBeNull();
    expect(el().querySelector('.panel-skeleton')).toBeTruthy();
    expect(el().textContent).not.toMatch(/null|undefined|NaN/);
  });
});
