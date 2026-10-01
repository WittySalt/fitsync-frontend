import { TestBed } from '@angular/core/testing';

import { UsualMeal } from '../../../core/fitsync.models';
import { MealPart, mealParts } from './diary-food';
import { MealPartComponent, usualNames } from './meal-part.component';
import { FoodRowComponent } from './food-row.component';
import { item, meal, spoken as text } from './diary-testing.spec';

const usualDinner: UsualMeal = {
  mealType: 'DINNER',
  label: 'Dinner',
  usualTime: '19:00',
  sourceMealId: 'source-1',
  totalCalories: 560,
  totalProteinGrams: 40,
  totalCarbsGrams: 50,
  totalFatGrams: 20,
  items: [
    { name: 'Salmon', calories: 300, proteinGrams: 30, categoryCode: 'SEAFOOD' },
    { name: 'Broccoli', calories: 50, proteinGrams: 4, categoryCode: 'VEGETABLES' },
    { name: 'Potato', calories: 210, proteinGrams: 5, categoryCode: 'VEGETABLES' }
  ]
};

describe('MealPartComponent', () => {
  function render(part: MealPart, usual: UsualMeal | null = null) {
    const fixture = TestBed.createComponent(MealPartComponent);
    fixture.componentRef.setInput('part', part);
    fixture.componentRef.setInput('usual', usual);
    fixture.detectChanges();
    return fixture;
  }

  const lunch = () =>
    mealParts([
      meal({
        mealId: 'lunch-1',
        mealType: 'LUNCH',
        consumedAt: new Date(2026, 9, 2, 12, 30).toISOString(),
        items: [item({ foodName: 'Chicken breast', calories: 248, proteinGrams: 46, gramsConsumed: 150, foodGroup: 'PROTEIN' }), item({ mealItemId: 'i2', foodName: 'Rice', calories: 260 })]
      })
    ])[1];
  const emptyDinner = () => mealParts([])[2];

  it('shows the name, the time and kcal, the split bar and a row for each food', () => {
    const element = render(lunch()).nativeElement as HTMLElement;
    expect(element.querySelector('h3')?.textContent).toBe('Lunch');
    expect(element.querySelector('.sub')?.textContent).toBe('12:30 · 508 kcal');
    expect(element.querySelectorAll('.split i').length).toBe(3);
    expect(element.querySelectorAll('app-food-row').length).toBe(2);
    expect(element.textContent).toContain('High protein');
  });

  it('emits add from the Add button', () => {
    const fixture = render(lunch());
    let added = 0;
    fixture.componentInstance.add.subscribe(() => (added += 1));
    (fixture.nativeElement.querySelector('.add') as HTMLButtonElement).click();
    expect(added).toBe(1);
  });

  it('opens a menu with Log again now, Save as a meal and a red Delete, and no Edit', () => {
    const fixture = render(lunch());
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.menu')).toBeNull();
    (element.querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = Array.from(element.querySelectorAll<HTMLButtonElement>('.menu [role="menuitem"]'));
    expect(items.map((entry) => entry.textContent?.trim())).toEqual(['Log again now', 'Save as a meal', 'Delete']);
    expect(items[2].classList.contains('delete')).toBeTrue();
    expect(items.some((entry) => entry.textContent?.includes('Edit'))).toBeFalse();
  });

  it('emits the chosen action and closes the menu', () => {
    const fixture = render(lunch());
    const seen: string[] = [];
    fixture.componentInstance.logAgain.subscribe(() => seen.push('log'));
    fixture.componentInstance.saveAsMeal.subscribe(() => seen.push('save'));
    fixture.componentInstance.deleteMeal.subscribe(() => seen.push('delete'));
    const element = fixture.nativeElement as HTMLElement;
    for (const index of [0, 1, 2]) {
      (element.querySelector('.more') as HTMLButtonElement).click();
      fixture.detectChanges();
      element.querySelectorAll<HTMLButtonElement>('.menu [role="menuitem"]')[index].click();
      fixture.detectChanges();
    }
    expect(seen).toEqual(['log', 'save', 'delete']);
    expect(element.querySelector('.menu')).toBeNull();
  });

  it('closes the menu on Escape and on a click elsewhere', () => {
    const fixture = render(lunch());
    const element = fixture.nativeElement as HTMLElement;
    (element.querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element.querySelector('.menu')).toBeNull();
    (element.querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(element.querySelector('.menu')).toBeNull();
  });

  it('has no menu button when nothing is logged', () => {
    const element = render(emptyDinner()).nativeElement as HTMLElement;
    expect(element.querySelector('.more')).toBeNull();
    expect(element.querySelector('.sub')?.textContent).toBe('Nothing logged yet');
    expect(element.querySelector('.rows')).toBeNull();
  });

  it('offers the usual meal for an empty part and logs it', () => {
    const fixture = render(emptyDinner(), usualDinner);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.usual-label')?.textContent).toBe('Your usual dinner');
    expect(text(element.querySelector('.usual-line'))).toBe('Salmon, Broccoli and Potato · 560 kcal');
    const logged: UsualMeal[] = [];
    fixture.componentInstance.logUsual.subscribe((value) => logged.push(value));
    (element.querySelector('.log-it') as HTMLButtonElement).click();
    expect(logged).toEqual([usualDinner]);
  });

  it('shows no usual meal when none is given or when the part has food', () => {
    expect((render(emptyDinner()).nativeElement as HTMLElement).querySelector('.usual')).toBeNull();
    expect((render(lunch(), usualDinner).nativeElement as HTMLElement).querySelector('.usual')).toBeNull();
  });

  it('disables the buttons while busy', () => {
    const fixture = TestBed.createComponent(MealPartComponent);
    fixture.componentRef.setInput('part', lunch());
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.add') as HTMLButtonElement).disabled).toBeTrue();
    expect((fixture.nativeElement.querySelector('.more') as HTMLButtonElement).disabled).toBeTrue();
  });
});

describe('usualNames', () => {
  const make = (...names: string[]): UsualMeal => ({ ...usualDinner, items: names.map((name) => ({ name, calories: 1, proteinGrams: 1, categoryCode: null })) });

  it('joins up to three names, and otherwise names two and counts the rest', () => {
    expect(usualNames(make('Oats'))).toBe('Oats');
    expect(usualNames(make('Oats', 'Milk'))).toBe('Oats and Milk');
    expect(usualNames(make('A', 'B', 'C'))).toBe('A, B and C');
    expect(usualNames(make('A', 'B', 'C', 'D', 'E'))).toBe('A, B and 3 more');
    expect(usualNames(make())).toBe('');
  });
});

describe('FoodRowComponent', () => {
  it('shows the icon, the macro line, the quality tags, kcal and amount', () => {
    const fixture = TestBed.createComponent(FoodRowComponent);
    fixture.componentRef.setInput('item', item({ foodName: 'Cheddar', calories: 400, proteinGrams: 25, sodiumMg: 1500, gramsConsumed: 100, amount: '100 g' }));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.name')?.textContent).toBe('Cheddar');
    expect(element.querySelector('.macros')?.textContent).toBe('P 25 · C 7 · F 8 g');
    const tags = Array.from(element.querySelectorAll('.tag')).map((tag) => ({ text: tag.textContent, good: tag.classList.contains('good') }));
    expect(tags).toEqual([{ text: 'High protein', good: true }, { text: 'High salt', good: false }]);
    expect(element.querySelector('.kcal')?.textContent).toBe('400');
    expect(element.querySelector('.amount')?.textContent).toBe('100 g');
    expect(element.querySelector('app-food-icon svg')).not.toBeNull();
  });

  it('shows no tag for a food with no weight', () => {
    const fixture = TestBed.createComponent(FoodRowComponent);
    fixture.componentRef.setInput('item', item({ gramsConsumed: null }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tag')).toBeNull();
  });
});
