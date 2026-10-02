import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { item, meal } from '../diary/diary-testing.spec';
import { DiaryMeal } from '../diary/diary.models';
import { EditorStartComponent, mealTitle } from './editor-start.component';
import { RecipeCard, RecipePageOf } from './recipes.models';
import { RecipesService } from './recipes.service';
import { card, recipesServiceStub } from './recipes-testing.spec';

describe('EditorStartComponent', () => {
  let service: jasmine.SpyObj<RecipesService>;
  let fixture: ComponentFixture<EditorStartComponent>;
  const picked: string[] = [];

  beforeEach(() => {
    picked.length = 0;
    service = recipesServiceStub();
    TestBed.configureTestingModule({ providers: [{ provide: RecipesService, useValue: service }] });
    fixture = TestBed.createComponent(EditorStartComponent);
    fixture.componentInstance.fromMeal.subscribe((value) => picked.push(`meal ${value.mealId}`));
    fixture.componentInstance.recipeChosen.subscribe((value) => picked.push(`copy ${value.id}`));
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const starts = () => Array.from(el().querySelectorAll<HTMLButtonElement>('.starts button'));

  it('offers three ways to start with From scratch chosen, and opens no list for it', () => {
    expect(starts().map((button) => button.querySelector('strong')?.textContent)).toEqual(['From scratch', 'From a meal', 'Copy a recipe']);
    expect(starts().map((button) => button.querySelector('span')?.textContent)).toEqual(['an empty recipe', 'one you logged', 'from the library']);
    expect(starts()[0].getAttribute('aria-pressed')).toBe('true');
    expect(el().querySelector('.pick')).toBeNull();
    expect(service.recentMeals).not.toHaveBeenCalled();
  });

  describe('from a meal', () => {
    const meals = (): DiaryMeal[] => [
      meal({ mealId: 'm1', mealType: 'DINNER', consumedAt: new Date(2026, 9, 2, 19, 0).toISOString(), totalCalories: 640, items: [item(), item({ mealItemId: 'b' })] }),
      meal({ mealId: 'm2', mealType: 'BREAKFAST', consumedAt: new Date(2026, 9, 1, 7, 0).toISOString(), totalCalories: 300, items: [item()] })
    ];

    it('asks for the meals of the last 14 days and lists them with their foods and calories', () => {
      service.recentMeals.and.returnValue(of(meals()));
      starts()[1].click();
      fixture.detectChanges();

      expect(service.recentMeals).toHaveBeenCalledWith(14);
      expect(starts()[1].getAttribute('aria-pressed')).toBe('true');
      const rows = Array.from(el().querySelectorAll('.pick li button'));
      expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual(['Dinner · Fri 2 Oct', 'Breakfast · Thu 1 Oct']);
      expect(rows.map((row) => row.querySelector('span')?.textContent)).toEqual(['2 foods · 640 kcal', '1 food · 300 kcal']);
    });

    it('reports the meal chosen', () => {
      service.recentMeals.and.returnValue(of(meals()));
      starts()[1].click();
      fixture.detectChanges();
      (el().querySelectorAll('.pick li button')[1] as HTMLButtonElement).click();
      expect(picked).toEqual(['meal m2']);
    });

    it('shows a loading note, an empty note and an error with a retry', () => {
      const pending = new Subject<DiaryMeal[]>();
      service.recentMeals.and.returnValue(pending);
      starts()[1].click();
      fixture.detectChanges();
      expect(el().querySelector('.note')?.getAttribute('aria-busy')).toBe('true');

      pending.next([]);
      fixture.detectChanges();
      expect(el().querySelector('.note')?.textContent).toContain('No meals logged in the last 14 days');

      service.recentMeals.and.returnValue(throwError(() => new Error('down')));
      starts()[1].click();
      fixture.detectChanges();
      expect(el().querySelector('.note[role="alert"]')?.textContent).toContain('Your meals could not load.');
      service.recentMeals.and.returnValue(of(meals()));
      (el().querySelector('.note .link') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().querySelectorAll('.pick li').length).toBe(2);
    });
  });

  describe('copy a recipe', () => {
    it('lists library recipes to pick from and reports the one chosen', () => {
      service.list.and.returnValue(of({ items: [card({ id: 'a', name: 'Pad Thai' }), card({ id: 'b', name: 'Dal', category: null })], page: 0, totalPages: 1, totalElements: 2 }));
      starts()[2].click();
      fixture.detectChanges();

      expect(service.list).toHaveBeenCalledWith({ scope: 'library', q: '', size: 6 });
      const rows = Array.from(el().querySelectorAll('.pick li button'));
      expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual(['Pad Thai', 'Dal']);
      expect(rows[1].querySelector('span')?.textContent).toBe('Recipe · 612 kcal a serving');
      (rows[0] as HTMLButtonElement).click();
      expect(picked).toEqual(['copy a']);
    });

    it('searches as the person types, after a pause, and cuts a pasted search to 80 characters', fakeAsync(() => {
      starts()[2].click();
      fixture.detectChanges();
      service.list.calls.reset();
      const input = el().querySelector('.pick input') as HTMLInputElement;
      expect(input.getAttribute('maxlength')).toBe('80');

      input.value = 'pad';
      input.dispatchEvent(new Event('input'));
      tick(299);
      expect(service.list).not.toHaveBeenCalled();
      tick(1);
      fixture.detectChanges();
      expect(service.list).toHaveBeenCalledWith({ scope: 'library', q: 'pad', size: 6 });

      input.value = 'x'.repeat(120);
      input.dispatchEvent(new Event('input'));
      tick(300);
      expect(service.list.calls.mostRecent().args[0].q?.length).toBe(80);
    }));

    it('says so when nothing matches and when the library cannot load, with a retry', () => {
      service.list.and.returnValue(of({ items: [], page: 0, totalPages: 0, totalElements: 0 }));
      starts()[2].click();
      fixture.detectChanges();
      expect(el().querySelector('.note')?.textContent).toContain('No library recipes match that.');

      service.list.and.returnValue(throwError(() => new Error('down')));
      starts()[2].click();
      fixture.detectChanges();
      expect(el().querySelector('.note[role="alert"]')?.textContent).toContain('The library could not load.');
      service.list.and.returnValue(of({ items: [card()], page: 0, totalPages: 1, totalElements: 1 } as RecipePageOf<RecipeCard>));
      (el().querySelector('.note .link') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().querySelectorAll('.pick li').length).toBe(1);
    });

    it('waits while a copy is on its way', () => {
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();
      expect(starts().every((button) => button.disabled)).toBeTrue();
    });
  });

  it('names a meal by its type and day', () => {
    expect(mealTitle({ mealType: 'LUNCH', consumedAt: new Date(2026, 8, 30, 12).toISOString() })).toBe('Lunch · Wed 30 Sept');
    expect(mealTitle({ mealType: 'LUNCH', consumedAt: 'nope' })).toBe('Lunch');
    expect(mealTitle({ mealType: 'OTHER', consumedAt: 'nope' })).toBe('Meal');
  });
});
