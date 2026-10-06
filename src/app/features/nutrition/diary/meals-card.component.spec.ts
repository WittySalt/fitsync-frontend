import { TestBed } from '@angular/core/testing';

import { UsualMeal } from '../../../core/fitsync.models';
import { DiaryMeal } from './diary.models';
import { MealsCardComponent } from './meals-card.component';
import { MealPart } from './diary-food';
import { item, meal } from './diary-testing.spec';

const usual = (mealType: string, sourceMealId: string | null): UsualMeal => ({
  mealType,
  label: mealType,
  usualTime: null,
  sourceMealId,
  totalCalories: 500,
  totalProteinGrams: 30,
  totalCarbsGrams: 50,
  totalFatGrams: 20,
  items: [{ name: 'Oats', calories: 150, proteinGrams: 5, categoryCode: 'GRAINS' }]
});

describe('MealsCardComponent', () => {
  function render(meals = [meal()], usualMeals: UsualMeal[] = []) {
    const fixture = TestBed.createComponent(MealsCardComponent);
    fixture.componentRef.setInput('meals', meals);
    fixture.componentRef.setInput('usual', usualMeals);
    fixture.detectChanges();
    return fixture;
  }

  it('has the four parts in one card', () => {
    const titles = Array.from<HTMLElement>(render().nativeElement.querySelectorAll('h3')).map((node) => node.textContent);
    expect(titles).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
  });

  it('offers a usual meal only in an empty part that is not the snack', () => {
    const element = render([meal()], [usual('LUNCH', 's1'), usual('DINNER', 's2'), usual('SNACK', 's3')]).nativeElement as HTMLElement;
    const labels = Array.from(element.querySelectorAll('.usual-label')).map((node) => node.textContent);
    expect(labels).toEqual(['Your usual lunch', 'Your usual dinner']);
  });

  it('offers no usual meal that came back without a source meal', () => {
    const element = render([], [usual('DINNER', null)]).nativeElement as HTMLElement;
    expect(element.querySelector('.usual')).toBeNull();
  });

  it('passes the part and the meal type up for each action', () => {
    const fixture = render([meal({ mealId: 'b1' })], [usual('LUNCH', 's1')]);
    const element = fixture.nativeElement as HTMLElement;
    const seen: string[] = [];
    fixture.componentInstance.addMeal.subscribe((type) => seen.push(`add ${type}`));
    fixture.componentInstance.deleteMeal.subscribe((part: MealPart) => seen.push(`delete ${part.mealIds.join()}`));
    fixture.componentInstance.logUsual.subscribe((value) => seen.push(`usual ${value.sourceMealId}`));
    element.querySelectorAll<HTMLButtonElement>('.add')[2].click();
    fixture.detectChanges();
    (element.querySelector('.add-menu [role="menuitem"]') as HTMLButtonElement).click();
    (element.querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    (element.querySelector('.menu .delete') as HTMLButtonElement).click();
    (element.querySelector('.log-it') as HTMLButtonElement).click();
    expect(seen).toEqual(['add DINNER', 'delete b1', 'usual s1']);
  });

  describe('nothing logged and fasted days', () => {
    const TODAY = '2026-10-05';
    function renderDay(meals: DiaryMeal[], date: string, extra: Record<string, unknown> = {}, usualMeals: UsualMeal[] = []) {
      const fixture = TestBed.createComponent(MealsCardComponent);
      fixture.componentRef.setInput('meals', meals);
      fixture.componentRef.setInput('usual', usualMeals);
      fixture.componentRef.setInput('date', date);
      fixture.componentRef.setInput('today', TODAY);
      Object.entries(extra).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
      fixture.detectChanges();
      return fixture;
    }
    const mark = (fixture: { nativeElement: HTMLElement }) => fixture.nativeElement.querySelector('app-day-mark .row');

    it('shows the nothing-logged line on a past day with no meal', () => {
      const fixture = renderDay([], '2026-09-29');
      expect(mark(fixture)?.textContent).toContain('Tuesday, nothing logged');
      expect(Array.from(fixture.nativeElement.querySelectorAll('.pill')).map((pill) => (pill as HTMLElement).textContent?.trim())).toEqual(['I fasted', "I ate, didn't log"]);
    });

    it('never shows it on today', () => {
      expect(mark(renderDay([], TODAY))).toBeNull();
    });

    it('does not show it on a past day that has a meal', () => {
      expect(mark(renderDay([meal()], '2026-09-29'))).toBeNull();
    });

    it('hides it for a day the person said they ate without logging', () => {
      expect(mark(renderDay([], '2026-09-29', { dismissed: true }))).toBeNull();
    });

    it('shows Fasted instead of the line when the day holds a fasted mark, and keeps the four parts', () => {
      const fixture = renderDay([meal({ mealId: 'f1', mealType: 'FAST', items: [] })], '2026-09-29');
      expect(fixture.nativeElement.querySelector('app-day-mark .fasted strong')?.textContent).toBe('Fasted');
      expect(fixture.nativeElement.querySelector('.pill')).toBeNull();
      expect(Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('h3')).map((node) => node.textContent)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
    });

    it('offers Log my usual only when a usual breakfast, lunch or dinner can be copied, and sends them together', () => {
      expect(renderDay([], '2026-09-29').nativeElement.querySelector('app-day-mark .link')).toBeNull();
      const fixture = renderDay([], '2026-09-29', {}, [usual('LUNCH', 's1'), usual('DINNER', 's2'), usual('SNACK', 's3')]);
      let sent: UsualMeal[] = [];
      fixture.componentInstance.logUsualDay.subscribe((meals) => (sent = meals));
      (fixture.nativeElement.querySelector('app-day-mark .link') as HTMLButtonElement).click();
      expect(sent.map((entry) => entry.sourceMealId)).toEqual(['s1', 's2']);
    });
  });

  it('fills a part with the foods of every meal of that type', () => {
    const element = render([meal({ mealId: 'a', items: [item()] }), meal({ mealId: 'b', items: [item({ mealItemId: 'x', foodName: 'Toast' })] })]).nativeElement as HTMLElement;
    expect(element.querySelectorAll('app-meal-part')[0].querySelectorAll('app-food-row').length).toBe(2);
  });
});
