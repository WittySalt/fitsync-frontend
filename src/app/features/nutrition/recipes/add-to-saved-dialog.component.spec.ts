import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ToastService } from '../../../core/toast/toast.service';
import { AddToSavedDialogComponent } from './add-to-saved-dialog.component';
import { RecipesService } from './recipes.service';
import { recipesServiceStub, savedMeal } from './recipes-testing.spec';

describe('AddToSavedDialogComponent', () => {
  let service: jasmine.SpyObj<RecipesService>;
  let toast: ToastService;

  beforeEach(() => {
    service = recipesServiceStub();
    service.savedMeals.and.returnValue(of([savedMeal()]));
    TestBed.configureTestingModule({ providers: [{ provide: RecipesService, useValue: service }] });
    toast = TestBed.inject(ToastService);
  });

  function render(inputs: Record<string, unknown> = {}): ComponentFixture<AddToSavedDialogComponent> {
    const fixture = TestBed.createComponent(AddToSavedDialogComponent);
    fixture.componentRef.setInput('recipeId', 'r1');
    fixture.componentRef.setInput('recipeName', 'Salmon Avocado Salad');
    fixture.componentRef.setInput('servings', 1.5);
    fixture.componentRef.setInput('mealType', 'LUNCH');
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<AddToSavedDialogComponent>) => fixture.nativeElement as HTMLElement;
  const options = (fixture: ComponentFixture<AddToSavedDialogComponent>) => Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  const add = (fixture: ComponentFixture<AddToSavedDialogComponent>) => el(fixture).querySelector('.confirm') as HTMLButtonElement;

  it('names the recipe and the servings, and lists the saved meals and a new one', () => {
    const fixture = render();

    expect(el(fixture).querySelector('.sub')?.textContent).toBe('Salmon Avocado Salad · 1.5 servings');
    expect(options(fixture).map((option) => option.querySelector('strong')?.textContent)).toEqual(['Usual breakfast', 'A new saved meal']);
    expect(add(fixture).disabled).toBeTrue();
  });

  it('adds the recipe to the saved meal that was chosen', () => {
    const fixture = render();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    options(fixture)[0].click();
    fixture.detectChanges();
    add(fixture).click();

    expect(service.addRecipeToSavedMeal).toHaveBeenCalledWith('t1', 'r1', 1.5);
    expect(toast.toasts().some((entry) => entry.message === 'Added to Usual breakfast.')).toBeTrue();
    expect(closed).toBe(1);
  });

  it('needs a name for a new saved meal, then makes it with the recipe', () => {
    const fixture = render();
    options(fixture)[1].click();
    fixture.detectChanges();
    expect(add(fixture).disabled).toBeTrue();

    const input = el(fixture).querySelector('.name input') as HTMLInputElement;
    expect(input.getAttribute('maxlength')).toBe('120');
    input.value = '  Salad lunch ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    add(fixture).click();

    expect(service.createSavedMealWithRecipe).toHaveBeenCalledWith('Salad lunch', 'LUNCH', 'r1', 1.5);
  });

  it('starts on a new saved meal when there are none', () => {
    service.savedMeals.and.returnValue(of([]));
    const fixture = render();

    expect(options(fixture).length).toBe(1);
    expect(el(fixture).querySelector('.name input')).not.toBeNull();
  });

  it('says so and stays open when saving fails', () => {
    service.addRecipeToSavedMeal.and.returnValue(throwError(() => new Error('no')));
    const fixture = render();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    options(fixture)[0].click();
    fixture.detectChanges();
    add(fixture).click();

    expect(toast.toasts().some((entry) => entry.type === 'error')).toBeTrue();
    expect(closed).toBe(0);
  });

  it('shows an error with a retry when the saved meals cannot be read', () => {
    service.savedMeals.and.returnValue(throwError(() => new Error('down')));
    const fixture = render();
    expect(el(fixture).querySelector('app-state-panel')).not.toBeNull();
    expect(add(fixture).disabled).toBeTrue();

    service.savedMeals.and.returnValue(of([savedMeal()]));
    (el(fixture).querySelector('app-state-panel button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(options(fixture).length).toBe(2);
  });

  it('closes on Cancel, the backdrop and Escape', () => {
    const fixture = render();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    (el(fixture).querySelector('.cancel') as HTMLButtonElement).click();
    (el(fixture).querySelector('.backdrop') as HTMLElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toBe(3);
  });
});
