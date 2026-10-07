import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Subject, of, throwError } from 'rxjs';

import { AccountDataService } from '../../../core/account-data.service';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { Leftover, Meal, UsualMeal } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { DiaryDayComponent } from './diary-day.component';
import { DiarySummary, FrequentDrink, WaterDay } from './diary.models';
import { NutritionDiaryService } from './nutrition-diary.service';
import { balanceEntry, diaryServiceStub, item, meal, nutrientRow, summary, waterDay, spoken as text } from './diary-testing.spec';
import { weekOf } from './diary-time';

const TODAY = '2026-10-02';

const lunch = () =>
  meal({
    mealId: 'lunch-1',
    mealType: 'LUNCH',
    name: 'Chicken and rice',
    consumedAt: new Date(2026, 9, 2, 12, 30).toISOString(),
    items: [item({ mealItemId: 'a', foodName: 'Chicken breast', foodGroup: 'PROTEIN', gramsConsumed: 150 }), item({ mealItemId: 'b', foodName: 'Rice', foodGroup: 'GRAINS', gramsConsumed: 200 })]
  });

describe('DiaryDayComponent', () => {
  let diary: jasmine.SpyObj<NutritionDiaryService>;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let toast: ToastService;

  beforeEach(() => {
    diary = diaryServiceStub();
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getUsualMeals', 'copyMeal', 'createMealTemplate', 'getLeftovers', 'eatLeftover']);
    data.getUsualMeals.and.returnValue(of([]));
    data.getLeftovers.and.returnValue(of([]));
    data.copyMeal.and.returnValue(of({ ok: true }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: NutritionDiaryService, useValue: diary },
        { provide: FitSyncDataService, useValue: data },
        { provide: AccountDataService, useValue: { getCurrentUser: () => of({ preferences: { nutrition: { waterGoalMl: 2500 } } }) } }
      ]
    });
    toast = TestBed.inject(ToastService);
  });

  function render(date = TODAY): ComponentFixture<DiaryDayComponent> {
    const fixture = TestBed.createComponent(DiaryDayComponent);
    fixture.componentRef.setInput('date', date);
    fixture.componentRef.setInput('dates', weekOf(TODAY));
    fixture.componentRef.setInput('today', TODAY);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }
  const q = <T extends Element>(fixture: ComponentFixture<unknown>, selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  const qa = <T extends Element>(fixture: ComponentFixture<unknown>, selector: string): T[] => Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];

  async function openMenuAndChoose(fixture: ComponentFixture<DiaryDayComponent>, choice: string): Promise<void> {
    (q(fixture, '.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    const entry = qa<HTMLButtonElement>(fixture, '.menu [role="menuitem"]').find((button) => button.textContent?.trim() === choice);
    entry?.click();
    fixture.detectChanges();
  }

  describe('loading', () => {
    it('loads the day, the water, the vitamins and the week the cards need, for the date shown', () => {
      render('2026-10-01');
      expect(diary.getSummary).toHaveBeenCalledWith('2026-10-01');
      expect(diary.getMeals).toHaveBeenCalledWith('2026-10-01');
      expect(diary.getWater).toHaveBeenCalledWith('2026-10-01');
      expect(diary.getNutrients).toHaveBeenCalledWith('2026-10-01', '2026-10-01');
      expect(diary.getNutrients).toHaveBeenCalledWith('2026-09-28', '2026-10-04');
      expect(diary.frequentDrinks).toHaveBeenCalledWith(2);
    });

    it('shows a skeleton for each card until its data arrives', () => {
      const pending = new Subject<DiarySummary>();
      diary.getSummary.and.returnValue(pending);
      const fixture = render();
      expect(qa(fixture, '.skeleton').length).toBeGreaterThan(0);
      expect(q(fixture, 'app-budget-card')).toBeNull();
      pending.next(summary());
      fixture.detectChanges();
      expect(q(fixture, 'app-budget-card')).not.toBeNull();
    });

    it('shows every card for a day with data', () => {
      diary.getMeals.and.returnValue(of([lunch()]));
      diary.getSummary.and.returnValue(of(summary({ balance: [balanceEntry()] })));
      const fixture = render();
      for (const tag of ['app-meals-card', 'app-water-card', 'app-plate-card', 'app-budget-card', 'app-balance-card', 'app-vitamins-card']) {
        expect(q(fixture, tag)).withContext(tag).not.toBeNull();
      }
    });

    it('hides the Balance card when the backend sends no balance and no protein by meal', () => {
      const fixture = render();
      expect(q(fixture, 'app-balance-card')).toBeNull();
    });

    it('shows the Balance card with protein by meal alone', () => {
      diary.getSummary.and.returnValue(of(summary({ proteinByMeal: { weightKg: null, lowGrams: 20, highGrams: 40, meals: [] } })));
      expect(q(render(), 'app-balance-card')).not.toBeNull();
    });

    it('labels the budget Today for today and by name for another day', () => {
      expect(text(q(render(), 'app-budget-card .eyebrow'))).toBe('Today');
      expect(text(q(render('2026-10-01'), 'app-budget-card .eyebrow'))).toBe('Thursday 1 Oct');
    });

    it('takes the water goal from the account preferences', () => {
      expect(text(q(render(), 'app-water-card .total'))).toBe('0 of 2,500 ml');
    });

    it('reloads when the date changes and ignores an answer that arrives late for the old date', () => {
      const first = new Subject<DiarySummary>();
      diary.getSummary.and.returnValue(first);
      const fixture = render('2026-09-30');
      diary.getSummary.and.returnValue(of(summary({ totalCalories: 777 })));
      fixture.componentRef.setInput('date', '2026-10-01');
      fixture.detectChanges();
      first.next(summary({ totalCalories: 111 }));
      fixture.detectChanges();
      expect(text(q(fixture, 'app-budget-card .eaten strong'))).toBe('777');
    });

    it('reloads when refresh is raised', () => {
      const fixture = render();
      const before = diary.getMeals.calls.count();
      fixture.componentRef.setInput('refresh', 1);
      fixture.detectChanges();
      expect(diary.getMeals.calls.count()).toBe(before + 1);
    });

    it('loads the day for Today and its Monday to Sunday week for This week, and keeps the week while the day stays inside it', () => {
      const fixture = render();
      expect(diary.getNutrients.calls.allArgs()).toEqual([[TODAY, TODAY], ['2026-09-28', '2026-10-04']]);
      fixture.componentRef.setInput('date', '2026-10-01');
      fixture.detectChanges();
      expect(diary.getNutrients.calls.allArgs().slice(2)).toEqual([['2026-10-01', '2026-10-01']]);
      fixture.componentRef.setInput('date', '2026-10-06');
      fixture.detectChanges();
      expect(diary.getNutrients.calls.allArgs().slice(3)).toEqual([['2026-10-06', '2026-10-06'], ['2026-10-05', '2026-10-11']]);
    });

    it('keeps showing the previous vitamins while the next day is on its way', () => {
      const fixture = render();
      diary.getNutrients.and.returnValue(NEVER);
      fixture.componentRef.setInput('date', '2026-10-01');
      fixture.detectChanges();
      expect(q(fixture, 'app-vitamins-card .skeleton')).toBeNull();
      expect(q(fixture, 'app-vitamins-card app-vitamins-today')).not.toBeNull();
    });
  });

  describe('when a card fails', () => {
    it('shows a retry for the summary and loads it again', () => {
      diary.getSummary.and.returnValue(throwError(() => new Error('down')));
      const fixture = render();
      expect(text(q(fixture, '.c-budget app-state-panel'))).toContain('Summary unavailable');
      expect(q(fixture, 'app-meals-card')).not.toBeNull();
      diary.getSummary.and.returnValue(of(summary()));
      (q(fixture, '.c-budget app-state-panel button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q(fixture, 'app-budget-card')).not.toBeNull();
    });

    it('shows a retry for the meals and leaves the plate out with them', () => {
      diary.getMeals.and.returnValue(throwError(() => new Error('down')));
      const fixture = render();
      expect(text(q(fixture, '.c-meals app-state-panel'))).toContain('Meals unavailable');
      expect(q(fixture, 'app-plate-card')).toBeNull();
      diary.getMeals.and.returnValue(of([lunch()]));
      (q(fixture, '.c-meals app-state-panel button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q(fixture, 'app-meals-card')).not.toBeNull();
      expect(q(fixture, 'app-plate-card')).not.toBeNull();
    });

    it('shows a retry for the water, and for the vitamins', () => {
      diary.getWater.and.returnValue(throwError(() => new Error('down')));
      diary.getNutrients.and.returnValue(throwError(() => new Error('down')));
      const fixture = render();
      expect(text(q(fixture, '.c-water app-state-panel'))).toContain('Water unavailable');
      expect(text(q(fixture, '.c-vitamins app-state-panel'))).toContain('Vitamins and minerals unavailable');
      diary.getWater.and.returnValue(of(waterDay()));
      (q(fixture, '.c-water app-state-panel button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q(fixture, 'app-water-card')).not.toBeNull();
    });
  });

  describe('meals', () => {
    beforeEach(() => diary.getMeals.and.returnValue(of([lunch()])));

    it('asks which meal type to log when Add is pressed', () => {
      const fixture = render();
      const added: string[] = [];
      fixture.componentInstance.addMeal.subscribe((type) => added.push(type));
      qa<HTMLButtonElement>(fixture, '.meal-part .add, app-meal-part .add')[2].click();
      fixture.detectChanges();
      q<HTMLButtonElement>(fixture, '.add-menu [role="menuitem"]').click();
      expect(added).toEqual(['DINNER']);
    });

    it('asks before deleting, and does nothing when the answer is Cancel', async () => {
      const fixture = render();
      await openMenuAndChoose(fixture, 'Delete');
      expect(text(q(fixture, 'app-confirm-dialog h2'))).toBe('Delete lunch?');
      expect(text(q(fixture, 'app-confirm-dialog p'))).toBe('Its foods are removed from Friday 2 Oct.');
      expect(q<HTMLButtonElement>(fixture, 'app-confirm-dialog .confirm').classList.contains('danger')).toBeTrue();
      (q(fixture, 'app-confirm-dialog .cancel') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q(fixture, 'app-confirm-dialog')).toBeNull();
      expect(diary.deleteMeal).not.toHaveBeenCalled();
    });

    it('deletes every meal of the part, tells the person, and reloads the day and the week', async () => {
      const fixture = render();
      let changed = 0;
      fixture.componentInstance.changed.subscribe(() => (changed += 1));
      const meals = diary.getMeals.calls.count();
      await openMenuAndChoose(fixture, 'Delete');
      (q(fixture, 'app-confirm-dialog .confirm') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(diary.deleteMeal).toHaveBeenCalledOnceWith('lunch-1');
      expect(q(fixture, 'app-confirm-dialog')).toBeNull();
      expect(toast.toasts().map((entry) => entry.message)).toContain('Deleted lunch.');
      expect(diary.getMeals.calls.count()).toBe(meals + 1);
      expect(changed).toBe(1);
    });

    it('keeps the question open and says so when the delete fails', async () => {
      diary.deleteMeal.and.returnValue(throwError(() => new Error('down')));
      const fixture = render();
      await openMenuAndChoose(fixture, 'Delete');
      (q(fixture, 'app-confirm-dialog .confirm') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q(fixture, 'app-confirm-dialog')).not.toBeNull();
      expect(toast.toasts().map((entry) => entry.message)).toContain('Unable to delete that meal. Please retry.');
    });

    it('logs the meals of the part again for now', async () => {
      const fixture = render();
      await openMenuAndChoose(fixture, 'Log again now');
      expect(data.copyMeal).toHaveBeenCalledOnceWith('lunch-1', 'LUNCH');
      expect(toast.toasts().map((entry) => entry.message)).toContain('Logged lunch again for now.');
    });

    it('says so when logging again fails', async () => {
      data.copyMeal.and.returnValue(throwError(() => new Error('down')));
      const fixture = render();
      await openMenuAndChoose(fixture, 'Log again now');
      expect(toast.toasts().map((entry) => entry.message)).toContain('Unable to log that meal again. Please retry.');
    });

    it('saves the part as a meal with its foods', async () => {
      data.createMealTemplate.and.returnValue(of({ templateId: 't1', name: 'x', mealType: 'LUNCH', note: '', totalCalories: 0, items: [] }));
      const fixture = render();
      await openMenuAndChoose(fixture, 'Save as a meal');
      const [request] = data.createMealTemplate.calls.mostRecent().args;
      expect(request.name).toBe('Chicken and rice');
      expect(request.mealType).toBe('LUNCH');
      expect(request.items.map((entry) => entry.foodName)).toEqual(['Chicken breast', 'Rice']);
      expect(toast.toasts().map((entry) => entry.message).join(' ')).toContain('Saved as a meal');
    });

    it('names a saved meal after its type and time when the meal has no name', async () => {
      diary.getMeals.and.returnValue(of([{ ...lunch(), name: '' }]));
      data.createMealTemplate.and.returnValue(of({ templateId: 't1', name: 'x', mealType: 'LUNCH', note: '', totalCalories: 0, items: [] }));
      const fixture = render();
      await openMenuAndChoose(fixture, 'Save as a meal');
      expect(data.createMealTemplate.calls.mostRecent().args[0].name).toBe('Lunch, 12:30');
    });

    it('says so when saving fails', async () => {
      data.createMealTemplate.and.returnValue(throwError(() => new Error('down')));
      const fixture = render();
      await openMenuAndChoose(fixture, 'Save as a meal');
      expect(toast.toasts().map((entry) => entry.message)).toContain('Unable to save that meal. Please retry.');
    });

    it('logs the usual meal of an empty part from its source meal', () => {
      const usual: UsualMeal = { mealType: 'DINNER', label: 'Dinner', usualTime: '19:00', sourceMealId: 'source-9', totalCalories: 560, totalProteinGrams: 40, totalCarbsGrams: 50, totalFatGrams: 20, items: [{ name: 'Salmon', calories: 300, proteinGrams: 30, categoryCode: 'SEAFOOD' }] };
      data.getUsualMeals.and.returnValue(of([usual]));
      const fixture = render();
      (q(fixture, '.log-it') as HTMLButtonElement).click();
      expect(data.copyMeal).toHaveBeenCalledOnceWith('source-9', 'DINNER', undefined);
      expect(toast.toasts().map((entry) => entry.message)).toContain('Logged your usual meal.');
    });

    it('logs the usual meal at the usual time when another day is shown', () => {
      const usual: UsualMeal = { mealType: 'DINNER', label: 'Dinner', usualTime: '19:00', sourceMealId: 'source-9', totalCalories: 560, totalProteinGrams: 40, totalCarbsGrams: 50, totalFatGrams: 20, items: [{ name: 'Salmon', calories: 300, proteinGrams: 30, categoryCode: 'SEAFOOD' }] };
      data.getUsualMeals.and.returnValue(of([usual]));
      const fixture = render('2026-10-01');
      (q(fixture, '.log-it') as HTMLButtonElement).click();
      const consumedAt = new Date(data.copyMeal.calls.mostRecent().args[2] ?? '');
      expect(consumedAt.getDate()).toBe(1);
      expect(consumedAt.getHours()).toBe(19);
    });
  });

  describe('fasted days', () => {
    const PAST = '2026-10-01';

    it('posts a fasted mark for a past day with nothing logged, then reloads the day', () => {
      const fixture = render(PAST);
      const loads = diary.getMeals.calls.count();
      qa<HTMLButtonElement>(fixture, '.pill')[0].click();

      expect(diary.markFasted).toHaveBeenCalledOnceWith(PAST, TODAY);
      expect(toast.toasts().map((entry) => entry.message)).toContain('Marked Thursday 1 Oct as fasted.');
      expect(diary.getMeals.calls.count()).toBe(loads + 1);
    });

    it('says so and keeps the line when the mark cannot be saved', () => {
      diary.markFasted.and.returnValue(throwError(() => new Error('down')));
      const fixture = render(PAST);
      qa<HTMLButtonElement>(fixture, '.pill')[0].click();

      expect(toast.toasts().map((entry) => entry.message)).toContain('Unable to mark that day. Please retry.');
      expect(q(fixture, 'app-day-mark .ask')).not.toBeNull();
    });

    it('offers the line on no day but a past one', () => {
      expect(q(render(TODAY), 'app-day-mark')).toBeNull();
      expect(q(render(PAST), 'app-day-mark .ask')).not.toBeNull();
    });

    it("hides the line for the day after I ate, didn't log, for this visit only, and brings it back on another day", () => {
      const fixture = render(PAST);
      qa<HTMLButtonElement>(fixture, '.pill')[1].click();
      fixture.detectChanges();
      expect(q(fixture, 'app-day-mark')).toBeNull();
      expect(diary.markFasted).not.toHaveBeenCalled();

      fixture.componentRef.setInput('date', '2026-09-30');
      fixture.detectChanges();
      fixture.detectChanges();
      expect(q(fixture, 'app-day-mark .ask')).not.toBeNull();
      fixture.componentRef.setInput('date', PAST);
      fixture.detectChanges();
      fixture.detectChanges();
      expect(q(fixture, 'app-day-mark')).toBeNull();
    });

    it('shows Fasted for a day that holds the mark, and Delete in its menu removes it after a confirmation', () => {
      diary.getMeals.and.returnValue(of([meal({ mealId: 'fast-1', mealType: 'FAST', items: [] })]));
      const fixture = render(PAST);
      expect(text(q(fixture, 'app-day-mark .fasted'))).toContain('Fasted');

      (q(fixture, 'app-day-mark .more') as HTMLButtonElement).click();
      fixture.detectChanges();
      (q(fixture, 'app-day-mark [role="menuitem"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(diary.deleteMeal).not.toHaveBeenCalled();
      expect(text(q(fixture, 'app-confirm-dialog h2'))).toBe('Delete the fasted mark?');

      (q(fixture, 'app-confirm-dialog .confirm') as HTMLButtonElement).click();
      expect(diary.deleteMeal).toHaveBeenCalledOnceWith('fast-1');
    });

    it('logs the usual breakfast, lunch and dinner at their usual times from Log my usual', () => {
      const usual = (mealType: string, id: string, time: string): UsualMeal => ({
        mealType,
        label: mealType,
        usualTime: time,
        sourceMealId: id,
        totalCalories: 500,
        totalProteinGrams: 30,
        totalCarbsGrams: 50,
        totalFatGrams: 20,
        items: [{ name: 'Oats', calories: 150, proteinGrams: 5, categoryCode: 'GRAINS' }]
      });
      data.getUsualMeals.and.returnValue(of([usual('BREAKFAST', 's-b', '07:30'), usual('DINNER', 's-d', '19:00')]));
      const fixture = render(PAST);
      (q(fixture, 'app-day-mark .link') as HTMLButtonElement).click();

      expect(data.copyMeal).toHaveBeenCalledTimes(2);
      expect(data.copyMeal.calls.argsFor(0).slice(0, 2)).toEqual(['s-b', 'BREAKFAST']);
      expect(data.copyMeal.calls.argsFor(1).slice(0, 2)).toEqual(['s-d', 'DINNER']);
      expect(toast.toasts().map((entry) => entry.message)).toContain('Logged your usual meals.');
    });
  });

  describe('water and drinks', () => {
    const toastWithUndo = () => toast.toasts().find((entry) => entry.action?.label === 'Undo');

    it('adds a glass of water at once and offers Undo, which removes the entry', () => {
      diary.logWater.and.returnValue(of({ waterId: 'w-1' }));
      const fixture = render();
      qa<HTMLButtonElement>(fixture, '.quick button')[0].click();
      expect(diary.logWater.calls.mostRecent().args[0]).toBe(250);
      const entry = toastWithUndo();
      expect(entry?.message).toBe('Added a glass of water.');
      const waters = diary.getWater.calls.count();
      toast.runAction(entry?.id ?? -1);
      expect(diary.deleteWater).toHaveBeenCalledOnceWith('w-1');
      expect(diary.getWater.calls.count()).toBe(waters + 1);
    });

    it('adds a bottle of 500 ml', () => {
      diary.logWater.and.returnValue(of({ waterId: 'w-2' }));
      const fixture = render();
      qa<HTMLButtonElement>(fixture, '.quick button')[1].click();
      expect(diary.logWater.calls.mostRecent().args[0]).toBe(500);
      expect(toastWithUndo()?.message).toBe('Added a bottle of water.');
    });

    it('offers no Undo when the server sent no id for the entry', () => {
      diary.logWater.and.returnValue(of({ waterId: '' }));
      const fixture = render();
      qa<HTMLButtonElement>(fixture, '.quick button')[0].click();
      expect(toastWithUndo()).toBeUndefined();
    });

    it('says so when adding water fails, and when the undo fails', () => {
      diary.logWater.and.returnValue(throwError(() => new Error('down')));
      const fixture = render();
      qa<HTMLButtonElement>(fixture, '.quick button')[0].click();
      expect(toast.toasts().map((entry) => entry.message)).toContain('Unable to add water. Please retry.');
      diary.logWater.and.returnValue(of({ waterId: 'w-3' }));
      diary.deleteWater.and.returnValue(throwError(() => new Error('down')));
      qa<HTMLButtonElement>(fixture, '.quick button')[0].click();
      toast.runAction(toastWithUndo()?.id ?? -1);
      expect(toast.toasts().map((entry) => entry.message)).toContain('Unable to undo that. Please retry.');
    });

    it('logs the day shown when it is not today, at noon', () => {
      diary.logWater.and.returnValue(of({ waterId: 'w-4' }));
      const fixture = render('2026-10-01');
      qa<HTMLButtonElement>(fixture, '.quick button')[0].click();
      const at = diary.logWater.calls.mostRecent().args[1];
      expect(at.getDate()).toBe(1);
      expect(at.getHours()).toBe(12);
    });

    it('adds a frequent drink as a meal of one food and removes the meal on Undo', () => {
      const latte: FrequentDrink = { name: 'Latte', calories: 110, draft: item({ foodName: 'Latte' }).draft };
      diary.frequentDrinks.and.returnValue(of([latte]));
      diary.logDrink.and.returnValue(of({ mealId: 'drink-meal-1' } as Meal));
      const fixture = render();
      qa<HTMLButtonElement>(fixture, '.quick button')[2].click();
      expect(diary.logDrink.calls.mostRecent().args[0]).toBe(latte.draft);
      const entry = toastWithUndo();
      expect(entry?.message).toBe('Added Latte.');
      const meals = diary.getMeals.calls.count();
      toast.runAction(entry?.id ?? -1);
      expect(diary.deleteMeal).toHaveBeenCalledOnceWith('drink-meal-1');
      expect(diary.getMeals.calls.count()).toBeGreaterThan(meals);
    });

    it('says so when adding a drink fails', () => {
      const latte: FrequentDrink = { name: 'Latte', calories: 110, draft: item().draft };
      diary.frequentDrinks.and.returnValue(of([latte]));
      diary.logDrink.and.returnValue(throwError(() => new Error('down')));
      const fixture = render();
      qa<HTMLButtonElement>(fixture, '.quick button')[2].click();
      expect(toast.toasts().map((entry) => entry.message)).toContain('Unable to add that drink. Please retry.');
    });

    it('opens the add dialog from Another amount or drink, adds the amount and closes', () => {
      diary.logWater.and.returnValue(of({ waterId: 'w-5' }));
      const fixture = render();
      (q(fixture, '.another') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q(fixture, 'app-add-drink-dialog')).not.toBeNull();
      (qa<HTMLButtonElement>(fixture, 'app-drink-water-panel .tile')[3]).click();
      fixture.detectChanges();
      (q(fixture, 'app-drink-water-panel .add') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(diary.logWater.calls.mostRecent().args[0]).toBe(500);
      expect(q(fixture, 'app-add-drink-dialog')).toBeNull();
      expect(toastWithUndo()?.message).toBe('Added 500 ml of water.');
    });

    it('keeps the dialog open when adding fails', () => {
      diary.logWater.and.returnValue(throwError(() => new Error('down')));
      const fixture = render();
      (q(fixture, '.another') as HTMLButtonElement).click();
      fixture.detectChanges();
      (q(fixture, 'app-drink-water-panel .add') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q(fixture, 'app-add-drink-dialog')).not.toBeNull();
    });

    it('closes the dialog without adding anything', () => {
      const fixture = render();
      (q(fixture, '.another') as HTMLButtonElement).click();
      fixture.detectChanges();
      (q(fixture, 'app-add-drink-dialog .close') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q(fixture, 'app-add-drink-dialog')).toBeNull();
      expect(diary.logWater).not.toHaveBeenCalled();
    });

    it('shows the water that came with drinks in the card', () => {
      const day: WaterDay = waterDay({ totalMl: 500, fromDrinksMl: 220 });
      diary.getWater.and.returnValue(of(day));
      expect(text(q(render(), 'app-water-card .key'))).toContain('220 ml from drinks');
    });
  });

  describe('plate and vitamins data', () => {
    it('gives the plate every food of the day', () => {
      diary.getMeals.and.returnValue(of([lunch()]));
      const fixture = render();
      expect(text(q(fixture, 'app-plate-card .grams'))).toBe('350 g of food, by weight');
    });

    it('shows the vitamins the service returns', () => {
      diary.getNutrients.and.returnValue(of({ daysLogged: 3, referenceLabel: 'for an adult', focusCodes: [], itemsLogged: 4, itemsWithoutNutrients: 1, nutrients: [nutrientRow()] }));
      const fixture = render();
      expect(text(q(fixture, 'app-vitamins-card .low-head'))).toContain('Vitamin D');
      expect(text(q(fixture, 'app-vitamins-card .coverage'))).toContain('1 of 4 logged foods');
    });
  });

  describe('leftovers', () => {
    const stew = (left: number): Leftover => ({ cookId: 'c1', recipeId: 'r1', name: 'Beef stew', imageUrl: null, cookedAt: '2026-09-30T11:00:00Z', servingsLeft: left, kcalPerServing: 540 });
    const pasta = (): Leftover => ({ cookId: 'c2', recipeId: 'r2', name: 'Pasta bake', imageUrl: null, cookedAt: '2026-10-01T18:00:00Z', servingsLeft: 1, kcalPerServing: 610 });

    function openLeftovers(fixture: ComponentFixture<DiaryDayComponent>): void {
      (qa<HTMLButtonElement>(fixture, '.add')[2] as HTMLButtonElement).click();
      fixture.detectChanges();
      qa<HTMLButtonElement>(fixture, '.add-menu [role="menuitem"]').find((button) => button.textContent?.includes('Leftovers'))?.click();
      fixture.detectChanges();
    }

    it('shows the servings left as a badge on the Leftovers entry of every Add menu', () => {
      data.getLeftovers.and.returnValue(of([stew(3), pasta()]));
      const fixture = render();
      (qa<HTMLButtonElement>(fixture, '.add')[0] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(text(q(fixture, '.add-menu .badge'))).toBe('4');
    });

    it('lists the leftovers with when they were cooked and how many are left', () => {
      data.getLeftovers.and.returnValue(of([stew(3), pasta()]));
      const fixture = render();
      openLeftovers(fixture);
      expect(text(q(fixture, 'app-leftovers-sheet h2'))).toBe('Leftovers for dinner');
      expect(qa(fixture, 'app-leftovers-sheet .row').map((row) => text(row as HTMLElement))).toEqual([
        'Beef stew Cooked Wednesday 3 left 540 kcal a serving',
        'Pasta bake Cooked yesterday 1 left 610 kcal a serving'
      ]);
    });

    it('logs one serving into the chosen meal, lowers the count and keeps the sheet open', () => {
      data.getLeftovers.and.returnValue(of([stew(3), pasta()]));
      data.eatLeftover.and.returnValue(of({ cookId: 'c1', servingsLeft: 2 }));
      const fixture = render();
      openLeftovers(fixture);
      qa<HTMLButtonElement>(fixture, 'app-leftovers-sheet .row')[0].click();
      fixture.detectChanges();
      expect(data.eatLeftover).toHaveBeenCalledOnceWith('c1', { mealType: 'DINNER', servings: 1 });
      expect(text(qa(fixture, 'app-leftovers-sheet .row')[0] as HTMLElement)).toContain('2 left');
      expect(diary.getMeals.calls.count()).toBeGreaterThan(1);
    });

    it('drops a row at zero and closes the sheet when the last serving goes', () => {
      data.getLeftovers.and.returnValue(of([pasta()]));
      data.eatLeftover.and.returnValue(of({ cookId: 'c2', servingsLeft: 0 }));
      const fixture = render();
      openLeftovers(fixture);
      qa<HTMLButtonElement>(fixture, 'app-leftovers-sheet .row')[0].click();
      fixture.detectChanges();
      expect(q(fixture, 'app-leftovers-sheet')).toBeNull();
    });

    it('says so and reloads when the server answers that none are left', () => {
      data.getLeftovers.and.returnValue(of([stew(1)]));
      data.eatLeftover.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
      const fixture = render();
      openLeftovers(fixture);
      qa<HTMLButtonElement>(fixture, 'app-leftovers-sheet .row')[0].click();
      fixture.detectChanges();
      expect(text(q(fixture, 'app-leftovers-sheet .error'))).toBe('That one has no servings left.');
      expect(data.getLeftovers).toHaveBeenCalledTimes(2);
    });

    it('opens with a quiet line when nothing is left', () => {
      const fixture = render();
      openLeftovers(fixture);
      expect(text(q(fixture, 'app-leftovers-sheet .none'))).toBe('Nothing is left from the last 7 days.');
    });
  });
});
