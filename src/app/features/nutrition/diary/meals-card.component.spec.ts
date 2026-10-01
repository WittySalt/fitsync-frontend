import { TestBed } from '@angular/core/testing';

import { UsualMeal } from '../../../core/fitsync.models';
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
    (element.querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    (element.querySelector('.menu .delete') as HTMLButtonElement).click();
    (element.querySelector('.log-it') as HTMLButtonElement).click();
    expect(seen).toEqual(['add DINNER', 'delete b1', 'usual s1']);
  });

  it('fills a part with the foods of every meal of that type', () => {
    const element = render([meal({ mealId: 'a', items: [item()] }), meal({ mealId: 'b', items: [item({ mealItemId: 'x', foodName: 'Toast' })] })]).nativeElement as HTMLElement;
    expect(element.querySelectorAll('app-meal-part')[0].querySelectorAll('app-food-row').length).toBe(2);
  });
});
