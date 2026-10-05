import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { FoodDetail, FoodSearchResult } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { item, meal } from '../diary/diary-testing.spec';
import { EditorStartComponent } from './editor-start.component';
import { IngredientPickerComponent } from './ingredient-picker.component';
import { RecipeEditorPage } from './recipe-editor.page';
import { RecipesService } from './recipes.service';
import { card, detail, perServing, recipesServiceStub } from './recipes-testing.spec';

const oatsDetail: FoodDetail = {
  foodId: 'f1',
  displayName: 'Rolled oats',
  brandName: '',
  categoryName: 'Grains',
  scope: 'CATALOG',
  calories: 380,
  proteinGrams: 13,
  carbsGrams: 68,
  fatGrams: 7,
  fiberGrams: null,
  sugarGrams: null,
  sodiumMg: null,
  basisQuantity: 100,
  basisUnit: 'g',
  densityGramsPerMl: null,
  primaryBarcode: '',
  sourceDataset: null,
  servings: []
};
const oats: FoodSearchResult = { foodId: 'f1', displayName: 'Rolled oats', brandName: '', categoryName: 'Grains', scope: 'CATALOG', calories: 380, proteinGrams: 0, basisUnit: 'g', basisLabel: '100 g', primaryBarcode: '', verified: true };

describe('RecipeEditorPage', () => {
  let service: jasmine.SpyObj<RecipesService>;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let router: Router;
  let navigate: jasmine.Spy;
  let toast: ToastService;

  beforeEach(() => {
    service = recipesServiceStub();
    service.create.and.returnValue(of('new-1'));
    service.update.and.returnValue(of('r1'));
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getFoodDetail', 'searchFoods']);
    data.getFoodDetail.and.returnValue(of(oatsDetail));
    data.searchFoods.and.returnValue(of([]));
  });

  function setup(id: string | null): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RecipesService, useValue: service },
        { provide: FitSyncDataService, useValue: data },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(id ? { id } : {})), snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    });
    router = TestBed.inject(Router);
    navigate = spyOn(router, 'navigate').and.resolveTo(true);
    toast = TestBed.inject(ToastService);
  }

  function render(id: string | null = null): ComponentFixture<RecipeEditorPage> {
    setup(id);
    const fixture = TestBed.createComponent(RecipeEditorPage);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  it('has a Back link to the recipes tab', () => {
    const back = el(render()).querySelector('.back') as HTMLAnchorElement;
    expect(back.textContent).toBe('\u2190 Back');
    expect(back.getAttribute('href')).toBe('/nutrition?tab=recipes&section=mine');
  });

  const el = (fixture: ComponentFixture<RecipeEditorPage>) => fixture.nativeElement as HTMLElement;
  const type = (fixture: ComponentFixture<RecipeEditorPage>, selector: string, value: string) => {
    const input = el(fixture).querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const addOats = (fixture: ComponentFixture<RecipeEditorPage>) => {
    fixture.debugElement.query(By.directive(IngredientPickerComponent)).componentInstance.pick.emit(oats);
    fixture.detectChanges();
  };
  const macros = (fixture: ComponentFixture<RecipeEditorPage>) => Array.from(el(fixture).querySelectorAll('.live .macros strong')).map((cell) => cell.textContent);
  const submit = (fixture: ComponentFixture<RecipeEditorPage>) => {
    el(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  describe('a new recipe', () => {
    it('opens empty with a name, servings, ingredients, steps and a serving at zero', () => {
      const fixture = render();

      expect(el(fixture).querySelector('h2')?.textContent).toBe('New recipe');
      expect((el(fixture).querySelector('[name="servings"]') as HTMLInputElement).value).toBe('2');
      expect(el(fixture).querySelectorAll('.rows li').length).toBe(0);
      expect(el(fixture).querySelectorAll('.steps li').length).toBe(1);
      expect(macros(fixture)).toEqual(['0', '0 g', '0 g', '0 g']);
      expect(el(fixture).querySelector('.delete')).toBeNull();
    });

    it('adds an ingredient from the food search at 100 g and works out a serving as it goes', () => {
      const fixture = render();

      addOats(fixture);
      expect(data.getFoodDetail).toHaveBeenCalledWith('f1');
      expect(el(fixture).querySelectorAll('.rows li').length).toBe(1);
      expect(macros(fixture)).toEqual(['190', '7 g', '34 g', '4 g']);

      type(fixture, '.grams input', '200');
      expect(macros(fixture)).toEqual(['380', '13 g', '68 g', '7 g']);

      type(fixture, '[name="servings"]', '4');
      expect(macros(fixture)).toEqual(['190', '7 g', '34 g', '4 g']);
    });

    it('says an ingredient is not counted while it has no amount', () => {
      const fixture = render();
      addOats(fixture);

      type(fixture, '.grams input', '');

      expect(el(fixture).querySelector('.live .hint')?.textContent).toContain('1 ingredient is not counted');
    });

    it('still adds a food whose figures could not load, and says it is not counted', () => {
      data.getFoodDetail.and.returnValue(of(null));
      const fixture = render();

      addOats(fixture);

      expect(el(fixture).querySelectorAll('.rows li').length).toBe(1);
      expect(toast.toasts().some((entry) => entry.type === 'info')).toBeTrue();
      expect(el(fixture).querySelector('.live .hint')).not.toBeNull();
    });

    it('removes an ingredient', () => {
      const fixture = render();
      addOats(fixture);

      (el(fixture).querySelector('.rows .remove') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el(fixture).querySelectorAll('.rows li').length).toBe(0);
    });

    it('adds and removes steps one at a time, keeping one box', () => {
      const fixture = render();

      (el(fixture).querySelector('.steps ~ .link') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el(fixture).querySelectorAll('.steps li').length).toBe(2);

      type(fixture, '.steps li:first-child textarea', 'Stir.');
      (el(fixture).querySelector('.steps li:last-child .remove') as HTMLButtonElement).click();
      fixture.detectChanges();
      (el(fixture).querySelector('.steps li .remove') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el(fixture).querySelectorAll('.steps li').length).toBe(1);
      expect((el(fixture).querySelector('.steps textarea') as HTMLTextAreaElement).value).toBe('');
    });

    it('shows what is missing on Save and sends nothing', () => {
      const fixture = render();
      expect(el(fixture).querySelector('em[role="alert"]')).toBeNull();

      submit(fixture);

      const alerts = Array.from(el(fixture).querySelectorAll('em[role="alert"]')).map((alert) => alert.textContent);
      expect(alerts).toEqual(['Give the recipe a name.', 'Add at least one ingredient.']);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('asks for grams above zero and servings above zero', () => {
      const fixture = render();
      addOats(fixture);
      type(fixture, '[name="name"]', 'Oats');
      type(fixture, '.grams input', '0');
      type(fixture, '[name="servings"]', '0');

      submit(fixture);

      expect(el(fixture).textContent).toContain('Every ingredient needs an amount in grams above 0.');
      expect(el(fixture).textContent).toContain('Servings must be more than 0');
    });

    it('saves with the grams, the line as written and the steps, then opens the recipe', () => {
      const fixture = render();
      type(fixture, '[name="name"]', ' Overnight oats ');
      addOats(fixture);
      type(fixture, '.grams input', '160');
      type(fixture, '.steps textarea', ' Stir the oats and milk together. ');

      submit(fixture);

      expect(service.create).toHaveBeenCalledOnceWith({
        name: 'Overnight oats',
        servings: 2,
        ingredients: [{ foodCatalogItemId: 'f1', grams: 160, displayText: 'Rolled oats' }],
        steps: ['Stir the oats and milk together.']
      });
      expect(navigate).toHaveBeenCalledWith(['/nutrition/recipes', 'new-1']);
      expect(toast.toasts().some((entry) => entry.type === 'success')).toBeTrue();
    });

    it('says so and stays when saving fails', () => {
      service.create.and.returnValue(throwError(() => new Error('no')));
      const fixture = render();
      type(fixture, '[name="name"]', 'Oats');
      addOats(fixture);

      submit(fixture);

      expect(toast.toasts().some((entry) => entry.type === 'error')).toBeTrue();
      expect(navigate).not.toHaveBeenCalled();
      expect((el(fixture).querySelector('.save') as HTMLButtonElement).disabled).toBeFalse();
    });

    it('limits the name and each step', () => {
      const fixture = render();

      expect(el(fixture).querySelector('[name="name"]')?.getAttribute('maxlength')).toBe('120');
      expect(el(fixture).querySelector('.steps textarea')?.getAttribute('maxlength')).toBe('1000');
    });
  });

  describe('writing a recipe with the page beside it', () => {
    const start = (fixture: ComponentFixture<RecipeEditorPage>) => fixture.debugElement.query(By.directive(EditorStartComponent)).componentInstance as EditorStartComponent;

    it('shows the three ways to start for a new recipe and none when changing one', () => {
      expect(el(render()).querySelector('app-editor-start')).not.toBeNull();
      TestBed.resetTestingModule();
      service.get.and.returnValue(of(detail({ id: 'r1', editable: true, scope: 'USER' })));
      expect(el(render('r1')).querySelector('app-editor-start')).toBeNull();
    });

    it('draws the preview from what is typed: name, cover, tags, facts and a serving', () => {
      const fixture = render();
      type(fixture, '[name="name"]', 'Peanut banana oats');
      addOats(fixture);
      type(fixture, '.steps textarea', 'Stir the oats and simmer for 5 minutes.');

      const preview = el(fixture).querySelector('app-recipe-preview') as HTMLElement;
      expect(preview.querySelector('.title')?.textContent).toBe('Peanut banana oats');
      expect(preview.querySelector('app-recipe-cover .fallback')).not.toBeNull();
      expect(Array.from(preview.querySelectorAll('.facts div')).map((cell) => `${cell.querySelector('strong')?.textContent} ${cell.querySelector('span')?.textContent}`)).toEqual([
        '2 servings',
        '1 ingredient',
        '1 step',
        '1 timer'
      ]);
      expect(preview.querySelector('.tags')?.textContent).toContain('Vegan');
      expect(el(fixture).querySelector('input[type=file]')).toBeNull();
    });

    it('gives a food added from the search its plate group, so it has an icon', () => {
      const fixture = render();
      addOats(fixture);
      expect(el(fixture).querySelector('.rows li app-food-icon svg')).not.toBeNull();
    });

    it('reorders the ingredients and the steps, and saves them in the new order', () => {
      data.getFoodDetail.and.callFake((id: string) => of({ ...oatsDetail, foodId: id, displayName: id }));
      const fixture = render();
      type(fixture, '[name="name"]', 'Oats');
      const picker = fixture.debugElement.query(By.directive(IngredientPickerComponent)).componentInstance as IngredientPickerComponent;
      picker.pick.emit({ ...oats, foodId: 'a', displayName: 'First' });
      picker.pick.emit({ ...oats, foodId: 'b', displayName: 'Second' });
      fixture.detectChanges();
      (el(fixture).querySelectorAll('.rows li')[1].querySelector('.up') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(Array.from(el(fixture).querySelectorAll('.rows .name')).map((cell) => cell.textContent)).toEqual(['Second', 'First']);

      type(fixture, '.steps li:first-child textarea', 'Mix.');
      (el(fixture).querySelector('.steps ~ .link') as HTMLButtonElement).click();
      fixture.detectChanges();
      type(fixture, '.steps li:last-child textarea', 'Serve.');
      // Move up and Move down belong to the step being edited, so the second step is opened first.
      el(fixture).querySelectorAll('.steps li')[1].querySelector('textarea')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();
      (el(fixture).querySelectorAll('.steps li')[1].querySelector('.up') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(Array.from(el(fixture).querySelectorAll<HTMLTextAreaElement>('.steps textarea')).map((box) => box.value)).toEqual(['Serve.', 'Mix.']);

      submit(fixture);
      expect(service.create).toHaveBeenCalledWith(jasmine.objectContaining({ steps: ['Serve.', 'Mix.'], ingredients: [jasmine.objectContaining({ foodCatalogItemId: 'b' }), jasmine.objectContaining({ foodCatalogItemId: 'a' })] }));
    });

    it('starts from a meal: its foods and grams become the ingredients, with their figures, and the meal name is the name', () => {
      const fixture = render();
      const logged = meal({ name: 'Dinner', items: [item({ gramsConsumed: 180 }), item({ mealItemId: 'c', foodName: 'Soup', draft: { ...item().draft, foodCatalogItemId: null, customFoodId: 'c1' } })] });

      start(fixture).fromMeal.emit(logged);
      fixture.detectChanges();

      expect(Array.from(el(fixture).querySelectorAll('.rows .name')).map((cell) => cell.textContent)).toEqual(['Greek yogurt']);
      expect((el(fixture).querySelector('.rows .grams input') as HTMLInputElement).value).toBe('180');
      expect((el(fixture).querySelector('[name="name"]') as HTMLInputElement).value).toBe('Dinner');
      expect(data.getFoodDetail).toHaveBeenCalledWith('food-1');
      expect(macros(fixture)).toEqual(['342', '12 g', '61 g', '6 g']);
      expect(toast.toasts().some((entry) => entry.type === 'info' && entry.message.includes('1 food you added by hand'))).toBeTrue();
    });

    it('keeps the name already typed and adds the meal after the foods already there', () => {
      const fixture = render();
      type(fixture, '[name="name"]', 'My own');
      addOats(fixture);

      start(fixture).fromMeal.emit(meal({ name: 'Dinner' }));
      fixture.detectChanges();

      expect(el(fixture).querySelectorAll('.rows li').length).toBe(2);
      expect((el(fixture).querySelector('[name="name"]') as HTMLInputElement).value).toBe('My own');
    });

    it('asks for grams when a food of the meal was logged in servings', () => {
      const fixture = render();
      start(fixture).fromMeal.emit(meal({ items: [item({ gramsConsumed: null, draft: { ...item().draft, unit: 'serving', quantity: 2 } })] }));
      fixture.detectChanges();

      expect((el(fixture).querySelector('.rows .grams input') as HTMLInputElement).value).toBe('');
      expect(toast.toasts().some((entry) => entry.message.includes('need an amount in grams'))).toBeTrue();
    });

    it('starts from a copy: copies the library recipe and opens the copy to change', () => {
      service.copy.and.returnValue(of(detail({ id: 'copy-9', scope: 'USER', editable: true })));
      const fixture = render();

      start(fixture).recipeChosen.emit(card({ id: 'lib-1' }));

      expect(service.copy).toHaveBeenCalledWith('lib-1');
      expect(navigate).toHaveBeenCalledWith(['/nutrition/recipes', 'copy-9', 'edit']);
      expect(toast.toasts().some((entry) => entry.type === 'success')).toBeTrue();
    });

    it('says so and stays when copying fails', () => {
      service.copy.and.returnValue(throwError(() => new Error('no')));
      const fixture = render();

      start(fixture).recipeChosen.emit(card({ id: 'lib-1' }));

      expect(navigate).not.toHaveBeenCalled();
      expect(toast.toasts().some((entry) => entry.type === 'error')).toBeTrue();
    });
  });

  describe('changing a recipe', () => {
    const own = () =>
      detail({
        id: 'r1',
        name: 'Overnight oats',
        scope: 'USER',
        servings: 4,
        editable: true,
        ingredients: [{ ingredientId: 'i1', displayText: 'Rolled oats', foodCatalogItemId: 'f1', foodName: 'Rolled oats', name: 'Rolled oats', grams: 160, foodGroup: 'GRAINS', categoryCode: 'GRAINS' }],
        steps: [{ stepNumber: 1, text: 'Stir.', title: null, ingredientIds: [], timers: [] }],
        perServing: perServing({ kcal: 152, proteinGrams: 5, carbsGrams: 27, fatGrams: 3 })
      });

    beforeEach(() => service.get.and.returnValue(of(own())));

    it('fills the form from the recipe and shows the server figures until something changes', () => {
      const fixture = render('r1');

      expect(el(fixture).querySelector('h2')?.textContent).toBe('Edit recipe');
      expect((el(fixture).querySelector('[name="name"]') as HTMLInputElement).value).toBe('Overnight oats');
      expect((el(fixture).querySelector('[name="servings"]') as HTMLInputElement).value).toBe('4');
      expect((el(fixture).querySelector('.grams input') as HTMLInputElement).value).toBe('160');
      expect((el(fixture).querySelector('.steps textarea') as HTMLTextAreaElement).value).toBe('Stir.');
      expect(macros(fixture)).toEqual(['152', '5 g', '27 g', '3 g']);
    });

    it('works the serving out again from the rows once an amount changes', () => {
      const fixture = render('r1');

      type(fixture, '.grams input', '320');

      expect(macros(fixture)).toEqual(['304', '10 g', '54 g', '6 g']);
    });

    it('saves the changes to the same recipe', () => {
      const fixture = render('r1');
      type(fixture, '[name="name"]', 'Peanut oats');

      submit(fixture);

      expect(service.update).toHaveBeenCalledWith('r1', jasmine.objectContaining({ name: 'Peanut oats', servings: 4 }));
      expect(navigate).toHaveBeenCalledWith(['/nutrition/recipes', 'r1']);
    });

    it('opens the recipe page instead when it is not the person own', () => {
      service.get.and.returnValue(of(detail({ editable: false })));
      render('r1');

      expect(navigate).toHaveBeenCalledWith(['/nutrition/recipes', 'r1'], { replaceUrl: true });
    });

    it('shows an error with a retry when the recipe cannot load', () => {
      service.get.and.returnValue(throwError(() => new Error('down')));
      const fixture = render('r1');
      expect(el(fixture).querySelector('app-state-panel')).not.toBeNull();

      service.get.and.returnValue(of(own()));
      (el(fixture).querySelector('app-state-panel button') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el(fixture).querySelector('form')).not.toBeNull();
    });

    it('has a red Delete that asks first, and does nothing on Cancel', () => {
      const fixture = render('r1');
      const remove = el(fixture).querySelector('.delete') as HTMLButtonElement;
      expect(remove.textContent?.trim()).toBe('Delete');

      remove.click();
      fixture.detectChanges();
      const dialog = el(fixture).querySelector('app-confirm-dialog') as HTMLElement;
      expect(dialog.textContent).toContain('Delete this recipe?');
      expect(dialog.querySelector('.confirm')?.classList.contains('danger')).toBeTrue();

      (dialog.querySelector('.cancel') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(service.remove).not.toHaveBeenCalled();
      expect(el(fixture).querySelector('app-confirm-dialog')).toBeNull();
    });

    it('deletes after the answer is yes and goes back to My recipes', () => {
      const fixture = render('r1');
      (el(fixture).querySelector('.delete') as HTMLButtonElement).click();
      fixture.detectChanges();

      (el(fixture).querySelector('app-confirm-dialog .confirm') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(service.remove).toHaveBeenCalledWith('r1');
      expect(navigate).toHaveBeenCalledWith(['/nutrition'], { queryParams: { tab: 'recipes', section: 'mine' } });
    });

    it('says so when deleting fails and keeps the recipe', () => {
      service.remove.and.returnValue(throwError(() => new Error('no')));
      const fixture = render('r1');
      (el(fixture).querySelector('.delete') as HTMLButtonElement).click();
      fixture.detectChanges();

      (el(fixture).querySelector('app-confirm-dialog .confirm') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(toast.toasts().some((entry) => entry.type === 'error')).toBeTrue();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it('links back to My recipes', () => {
    expect(el(render()).querySelector('.back')?.getAttribute('href')).toBe('/nutrition?tab=recipes&section=mine');
  });
});
