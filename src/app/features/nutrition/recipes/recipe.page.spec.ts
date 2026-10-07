import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { CoachStore } from '../../../core/coach/coach.store';
import { ToastService } from '../../../core/toast/toast.service';
import { NutritionDiaryService } from '../diary/nutrition-diary.service';
import { diaryServiceStub, nutrientRow, spoken, summary } from '../diary/diary-testing.spec';
import { toIsoDate } from '../diary/diary-time';
import { RecipeDetail } from './recipes.models';
import { anchorSteps } from '../../../core/guide/guide-testing.spec';
import { RecipePage } from './recipe.page';
import { RecipesService } from './recipes.service';
import { card, detail, recipesServiceStub } from './recipes-testing.spec';

describe('RecipePage', () => {
  let service: jasmine.SpyObj<RecipesService>;
  let diary: jasmine.SpyObj<NutritionDiaryService>;
  let toast: ToastService;

  beforeEach(() => {
    service = recipesServiceStub();
    diary = diaryServiceStub();
    diary.getSummary.and.returnValue(of(summary({ totalCalories: 1268, targetCalories: 2100, totalProteinGrams: 87, targetProteinGrams: 140, targetFatGrams: 70 })));
    diary.getNutrients.and.returnValue(
      of({ daysLogged: 1, referenceLabel: null, focusCodes: [], itemsLogged: null, itemsWithoutNutrients: null, nutrients: [nutrientRow({ code: 'VIT_D', displayName: 'Vitamin D', share: 0.2 })] })
    );
  });

  function setup(query: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RecipesService, useValue: service },
        { provide: NutritionDiaryService, useValue: diary },
        { provide: CoachStore, useValue: jasmine.createSpyObj<CoachStore>('CoachStore', ['open', 'ask']) },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'r1' })), snapshot: { queryParamMap: convertToParamMap(query) } } }
      ]
    });
    toast = TestBed.inject(ToastService);
  }

  function render(query: Record<string, string> = {}): ComponentFixture<RecipePage> {
    setup(query);
    const fixture = TestBed.createComponent(RecipePage);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<RecipePage>) => fixture.nativeElement as HTMLElement;
  const click = (fixture: ComponentFixture<RecipePage>, selector: string) => {
    (el(fixture).querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };

  it('shows the photo with the title, the facts, the eat card, a serving, the ingredients and the steps', () => {
    const element = el(render());

    expect(service.get).toHaveBeenCalledWith('r1');
    expect(element.querySelector('app-recipe-hero h2')?.textContent).toBe('Salmon Avocado Salad');
    expect(Array.from(element.querySelectorAll('.facts div')).map((cell) => spoken(cell))).toEqual(['4 servings', '2 ingredients', '2 steps', '612 kcal a serving']);
    expect(element.querySelector('app-eat-card')).not.toBeNull();
    expect(element.querySelector('app-serving-highlights')).not.toBeNull();
    expect(element.querySelector('app-ingredients-card')).not.toBeNull();
    expect(element.querySelector('app-recipe-steps .credit')?.textContent).toContain('TheMealDB');
    // The path: the fit line, the two Cook buttons (card and phone bar), the ingredients.
    expect(anchorSteps(element, 'nutrition-recipe')).toEqual(['fit', 'cook', 'ingredients', 'cook']);
  });

  it('says under the title how often it was cooked, and says nothing when it never was', () => {
    expect(el(render()).querySelector('app-recipe-hero .cooked')).toBeNull();
    TestBed.resetTestingModule();
    service.get.and.returnValue(of(detail({ cookCount: 3, lastCookedAt: new Date().toISOString() })));
    expect(el(render()).querySelector('app-recipe-hero .cooked')?.textContent).toBe('Cooked 3 times \u00b7 last today');
  });

  it('has a Recipes link back that opens the tab', () => {
    const back = el(render()).querySelector('.back') as HTMLAnchorElement;

    expect(back.textContent).toBe('\u2190 Recipes');
    expect(back.getAttribute('href')).toBe('/nutrition?tab=recipes');
  });

  it('goes back to My recipes for a recipe of the own, and keeps the meal being picked for', () => {
    service.get.and.returnValue(of(detail({ editable: true, scope: 'USER' })));
    const back = el(render({ logTo: 'dinner' })).querySelector('.back') as HTMLAnchorElement;

    expect(back.getAttribute('href')).toBe('/nutrition?tab=recipes&section=mine&logTo=DINNER');
  });

  it('shows skeletons while the recipe loads', () => {
    service.get.and.returnValue(new Subject<RecipeDetail>());

    expect(el(render()).querySelector('.hero-skeleton')).not.toBeNull();
  });

  it('shows an error with a retry', () => {
    service.get.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const fixture = render();
    expect(el(fixture).querySelector('app-state-panel')?.textContent).toContain('could not load');

    service.get.and.returnValue(of(detail()));
    click(fixture, 'app-state-panel button');

    expect(el(fixture).querySelector('app-recipe-hero')).not.toBeNull();
  });

  it('says a recipe is not found, without a retry, on a 404', () => {
    service.get.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const element = el(render());

    expect(element.querySelector('app-state-panel strong')?.textContent).toBe('Recipe not found');
    expect(element.querySelector('app-state-panel button')).toBeNull();
  });

  it('measures the servings against today and moves the figures with the servings', () => {
    const fixture = render();
    const today = toIsoDate(new Date());
    expect(diary.getSummary).toHaveBeenCalledWith(today);
    expect(diary.getNutrients).toHaveBeenCalledWith(today, today);
    const rows = () => Array.from(el(fixture).querySelectorAll('app-fit-today .row')).map((row) => spoken(row));

    expect(rows()[0]).toBe('Calories 1,268 → 1,880 of 2,100');
    expect(rows()[2]).toContain('Vitamin D 20% → 74%');

    click(fixture, '[aria-label="More servings"]');
    expect(rows()[0]).toBe('Calories 1,268 → 2,033 of 2,100');
  });

  it('rescales the ingredient amounts with the servings', () => {
    const fixture = render();
    const grams = () => Array.from(el(fixture).querySelectorAll('app-ingredients-card .grams')).map((cell) => cell.textContent);
    expect(grams()).toEqual(['100 g', '113 g']);

    click(fixture, '[aria-label="More servings"]');
    click(fixture, '[aria-label="More servings"]');

    expect(grams()).toEqual(['150 g', '170 g']);
  });

  it('shows the weight of a serving from the ingredients', () => {
    expect(el(render()).querySelector('app-serving-highlights .head span')?.textContent).toBe('213 g');
  });

  it('leaves the weight out when an ingredient has none', () => {
    service.get.and.returnValue(of(detail({ ingredients: [{ ...detail().ingredients[0], grams: null }] })));

    expect(el(render()).querySelector('app-serving-highlights .head span')).toBeNull();
  });

  it('says so when today could not load, and still lets the person log', () => {
    diary.getSummary.and.returnValue(throwError(() => new Error('down')));
    const fixture = render();

    expect(el(fixture).querySelector('app-fit-today .note')?.textContent).toContain('Logging still works');
    expect((el(fixture).querySelector('.log') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('keeps calories and protein when only the vitamins fail', () => {
    diary.getNutrients.and.returnValue(throwError(() => new Error('down')));
    const fixture = render();

    expect(el(fixture).querySelectorAll('app-fit-today .row').length).toBe(2);
  });

  describe('logging', () => {
    it('logs the servings now under the meal by the clock, with a toast that can undo it', () => {
      const fixture = render();
      click(fixture, '[aria-label="More servings"]');

      click(fixture, '.log');

      const [id, request] = service.logRecipe.calls.mostRecent().args;
      expect(id).toBe('r1');
      expect(request.servings).toBe(1.25);
      expect(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']).toContain(request.mealType);
      expect(Math.abs(request.consumedAt.getTime() - Date.now())).toBeLessThan(5000);
      const logged = toast.toasts().find((entry) => entry.type === 'success');
      expect(logged?.message).toBe('Logged 1.25 servings of Salmon Avocado Salad.');

      toast.runAction(logged?.id ?? -1);
      expect(diary.deleteMeal).toHaveBeenCalledWith('m1');
    });

    it('reads the day again after a log, so the figures include it', () => {
      const fixture = render();
      const calls = diary.getSummary.calls.count();

      click(fixture, '.log');

      expect(diary.getSummary.calls.count()).toBe(calls + 1);
    });

    it('logs under the meal the link asked for', () => {
      const fixture = render({ logTo: 'dinner' });

      click(fixture, '.log');

      expect(service.logRecipe.calls.mostRecent().args[1].mealType).toBe('DINNER');
    });

    it('ignores a meal type it does not know in the link', () => {
      const fixture = render({ logTo: 'FASTING' });

      click(fixture, '.log');

      expect(service.logRecipe.calls.mostRecent().args[1].mealType).not.toBe('FASTING');
    });

    it('says so, and can try again, when logging fails', () => {
      service.logRecipe.and.returnValue(throwError(() => new Error('no')));
      const fixture = render();

      click(fixture, '.log');

      expect(toast.toasts().some((entry) => entry.type === 'error')).toBeTrue();
      expect((el(fixture).querySelector('.log') as HTMLButtonElement).disabled).toBeFalse();
    });

    it('logs from the bar a phone shows, with the same servings and kcal', () => {
      const fixture = render();
      click(fixture, '[aria-label="More servings"]');
      const bar = el(fixture).querySelector('.bar .log') as HTMLButtonElement;

      expect(bar.textContent?.trim()).toBe('Log 1.25 servings · 765 kcal');
      bar.click();
      expect(service.logRecipe).toHaveBeenCalled();
    });

    it('opens the Ready screen from Cook in the bar and from Start cooking, with the servings chosen', () => {
      const fixture = render();
      click(fixture, '[aria-label="More servings"]');
      expect(el(fixture).querySelector('app-recipe-ready')).toBeNull();

      click(fixture, '.bar .cook');
      expect(el(fixture).querySelector('app-recipe-ready')).not.toBeNull();
      expect(el(fixture).querySelector('app-recipe-ready .row')?.textContent).toContain('1.25 of 4');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(el(fixture).querySelector('app-recipe-ready')).toBeNull();

      click(fixture, 'app-eat-card .cook');
      expect(el(fixture).querySelector('app-recipe-ready')).not.toBeNull();
    });

    it('has the coach row with the recipe it is about', () => {
      const element = el(render());
      expect(element.querySelector('app-recipe-coach-row h3')?.textContent).toContain('Ask your coach about this recipe');
      expect(element.querySelectorAll('app-recipe-coach-row button').length).toBe(3);
    });
  });

  describe('save, copy and saved meals', () => {
    it('saves a recipe at once and puts it back when the server refuses', () => {
      const fixture = render();
      click(fixture, '.small:first-child');
      expect(service.setFavorite).toHaveBeenCalledWith('r1', true);
      expect(spoken(el(fixture).querySelector('.small'))).toBe('Saved');

      service.setFavorite.and.returnValue(throwError(() => new Error('no')));
      click(fixture, '.small:first-child');

      expect(spoken(el(fixture).querySelector('.small'))).toBe('Saved');
      expect(toast.toasts().some((entry) => entry.type === 'error')).toBeTrue();
    });

    it('copies the recipe and opens the copy', () => {
      service.copy.and.returnValue(of(detail({ id: 'copy-1', scope: 'USER', editable: true })));
      const router = (setup(), TestBed.inject(Router));
      const navigate = spyOn(router, 'navigate').and.resolveTo(true);
      const fixture = TestBed.createComponent(RecipePage);
      fixture.detectChanges();
      fixture.detectChanges();

      click(fixture, '.small:last-child');

      expect(service.copy).toHaveBeenCalledWith('r1');
      expect(navigate).toHaveBeenCalledWith(['/nutrition/recipes', 'copy-1']);
    });

    it('says so when copying fails', () => {
      service.copy.and.returnValue(throwError(() => new Error('no')));
      const fixture = render();

      click(fixture, '.small:last-child');

      expect(toast.toasts().some((entry) => entry.type === 'error')).toBeTrue();
    });

    it('offers Edit for a recipe of the own', () => {
      service.get.and.returnValue(of(detail({ editable: true, scope: 'USER' })));

      expect(el(render()).querySelector('.small')?.getAttribute('href')).toBe('/nutrition/recipes/r1/edit');
    });

    it('opens the saved meal dialog with the recipe and servings, and closes it', () => {
      const fixture = render();
      click(fixture, '.save-meal');

      const dialog = el(fixture).querySelector('app-add-to-saved-dialog');
      expect(dialog).not.toBeNull();
      expect(dialog?.querySelector('.sub')?.textContent).toBe('Salmon Avocado Salad · 1 serving');

      click(fixture, 'app-add-to-saved-dialog .cancel');
      expect(el(fixture).querySelector('app-add-to-saved-dialog')).toBeNull();
    });
  });

  it('shows more like this from the same category', () => {
    service.similar.and.returnValue(of([card({ id: 'b', name: 'Honey Teriyaki Salmon' })]));
    const fixture = render();

    expect(service.similar).toHaveBeenCalledWith('Seafood', 'r1');
    expect(el(fixture).querySelector('app-similar-recipes')?.textContent).toContain('Honey Teriyaki Salmon');
  });
});
