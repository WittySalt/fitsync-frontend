import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ToastService } from '../../../core/toast/toast.service';
import { NutritionDiaryService } from '../diary/nutrition-diary.service';
import { diaryServiceStub, spoken } from '../diary/diary-testing.spec';
import { leadItem, SavedMealsComponent } from './saved-meals.component';
import { SavedMeal } from './recipes.models';
import { RecipesService } from './recipes.service';
import { detail, recipesServiceStub, savedMeal } from './recipes-testing.spec';

const withRecipe = (): SavedMeal =>
  savedMeal({
    templateId: 't2',
    name: 'Salad lunch',
    mealType: 'LUNCH',
    totalCalories: 614,
    items: [
      { templateItemId: 'a', foodName: 'Salmon Avocado Salad', quantity: 1, unit: 'serving', calories: 612, recipeId: 'r1', recipeServings: 1, categoryCode: null, foodGroup: null },
      { templateItemId: 'b', foodName: 'Black coffee', quantity: 1, unit: 'serving', calories: 2, recipeId: null, recipeServings: null, categoryCode: 'BEVERAGES', foodGroup: 'DRINKS' }
    ]
  });

describe('SavedMealsComponent', () => {
  let service: jasmine.SpyObj<RecipesService>;
  let diary: jasmine.SpyObj<NutritionDiaryService>;
  let toast: ToastService;

  beforeEach(() => {
    service = recipesServiceStub();
    diary = diaryServiceStub();
    service.savedMeals.and.returnValue(of([savedMeal(), withRecipe()]));
    TestBed.configureTestingModule({
      providers: [
        { provide: RecipesService, useValue: service },
        { provide: NutritionDiaryService, useValue: diary }
      ]
    });
    toast = TestBed.inject(ToastService);
  });

  function render(logTo: string | null = null): ComponentFixture<SavedMealsComponent> {
    const fixture = TestBed.createComponent(SavedMealsComponent);
    fixture.componentRef.setInput('logTo', logTo);
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<SavedMealsComponent>) => fixture.nativeElement as HTMLElement;

  it('lists each saved meal with its foods, its kcal and a Log it button', () => {
    const rows = Array.from(el(render()).querySelectorAll('li'));

    expect(rows.length).toBe(2);
    expect(spoken(rows[0])).toContain('Usual breakfast');
    expect(rows[0].querySelector('.text span')?.textContent).toBe('Greek yogurt');
    expect(rows[0].querySelector('.kcal')?.textContent).toBe('499');
    expect(rows[0].querySelector('.log')?.textContent?.trim()).toBe('Log it');
  });

  it('shows a recipe in a saved meal with its cover and its servings', () => {
    const second = Array.from(el(render()).querySelectorAll('li'))[1];

    expect(second.querySelector('app-recipe-cover')).not.toBeNull();
    expect(second.querySelector('app-food-icon')).toBeNull();
    expect(second.querySelector('.text span')?.textContent).toBe('Salmon Avocado Salad · 1 serving, Black coffee');
    expect(service.lookup).toHaveBeenCalledWith('r1');
    expect(second.querySelector('app-recipe-cover img')?.getAttribute('src')).toBe(detail().imageUrl);
  });

  it('shows a plain food icon for a saved meal of foods only', () => {
    const first = Array.from(el(render()).querySelectorAll('li'))[0];

    expect(first.querySelector('app-food-icon')).not.toBeNull();
    expect(first.querySelector('app-recipe-cover')).toBeNull();
  });

  it('picks the first recipe as the lead of a saved meal, else the first food', () => {
    expect(leadItem(withRecipe())?.recipeId).toBe('r1');
    expect(leadItem(savedMeal())?.foodName).toBe('Greek yogurt');
    expect(leadItem(savedMeal({ items: [] }))).toBeNull();
  });

  it('logs a saved meal under the meal being picked for, and offers to undo', () => {
    const fixture = render('DINNER');

    (el(fixture).querySelector('.log') as HTMLButtonElement).click();

    expect(service.logSavedMeal).toHaveBeenCalledWith('t1', 'DINNER');
    const logged = toast.toasts().find((entry) => entry.type === 'success');
    expect(logged?.message).toBe('Logged Usual breakfast.');
    toast.runAction(logged?.id ?? -1);
    expect(diary.deleteMeal).toHaveBeenCalledWith('m2');
  });

  it('keeps the meal type a saved meal was saved with when no meal is being picked for', () => {
    const fixture = render();

    (el(fixture).querySelector('.log') as HTMLButtonElement).click();

    expect(service.logSavedMeal).toHaveBeenCalledWith('t1', null);
  });

  it('says so when logging fails', () => {
    service.logSavedMeal.and.returnValue(throwError(() => new Error('no')));
    const fixture = render();

    (el(fixture).querySelector('.log') as HTMLButtonElement).click();

    expect(toast.toasts().some((entry) => entry.type === 'error')).toBeTrue();
    expect((el(fixture).querySelector('.log') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('explains an empty list', () => {
    service.savedMeals.and.returnValue(of([]));

    expect(el(render()).querySelector('.empty strong')?.textContent).toBe('No saved meals yet');
  });

  it('shows an error with a retry', () => {
    service.savedMeals.and.returnValue(throwError(() => new Error('down')));
    const fixture = render();
    expect(el(fixture).querySelector('app-state-panel')?.textContent).toContain('could not load');

    service.savedMeals.and.returnValue(of([savedMeal()]));
    (el(fixture).querySelector('app-state-panel button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el(fixture).querySelectorAll('li').length).toBe(1);
  });
});
