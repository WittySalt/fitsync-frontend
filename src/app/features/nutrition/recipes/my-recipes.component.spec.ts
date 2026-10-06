import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { MY_RECIPES_EMPTY, MyRecipesComponent } from './my-recipes.component';
import { RecipeCard, RecipePageOf } from './recipes.models';
import { RecipesService } from './recipes.service';
import { card, recipesServiceStub } from './recipes-testing.spec';

describe('MyRecipesComponent', () => {
  let service: jasmine.SpyObj<RecipesService>;

  beforeEach(() => {
    service = recipesServiceStub();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: RecipesService, useValue: service }] });
  });

  function render(): ComponentFixture<MyRecipesComponent> {
    const fixture = TestBed.createComponent(MyRecipesComponent);
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<MyRecipesComponent>) => fixture.nativeElement as HTMLElement;
  const page = (count: number, total = count): RecipePageOf<RecipeCard> => ({
    items: Array.from({ length: count }, (_, index) => card({ id: `m${index}`, name: `Mine ${index}`, scope: 'USER' })),
    page: 0,
    totalPages: 1,
    totalElements: total
  });

  it('asks for the first four of the own recipes and shows them as cook cards with the New recipe button in the heading row', () => {
    service.list.and.returnValue(of(page(4)));
    const fixture = render();

    expect(service.list).toHaveBeenCalledWith({ scope: 'mine', size: 4 });
    expect(el(fixture).querySelector('h2')?.textContent).toBe('My recipes');
    expect(el(fixture).querySelector('.head .new')?.getAttribute('href')).toBe('/nutrition/recipes/new');
    expect(el(fixture).querySelectorAll('app-recipe-card').length).toBe(4);
    expect(el(fixture).querySelector('.heart')).toBeNull();
  });

  it('offers See all with the count only when there are more than shown, and says so when asked', () => {
    service.list.and.returnValue(of(page(4, 12)));
    const fixture = render();
    let asked = 0;
    fixture.componentInstance.seeAll.subscribe(() => (asked += 1));

    const link = el(fixture).querySelector('.see-all') as HTMLButtonElement;
    expect(link.textContent?.trim()).toBe('See all (12)');
    link.click();
    expect(asked).toBe(1);

    service.list.and.returnValue(of(page(3)));
    expect(el(render()).querySelector('.see-all')).toBeNull();
  });

  it('shows the one-line empty state, with the button still there', () => {
    service.list.and.returnValue(of(page(0)));
    const fixture = render();

    expect(el(fixture).querySelector('.quiet')?.textContent).toBe(MY_RECIPES_EMPTY);
    expect(el(fixture).querySelector('.head .new')).not.toBeNull();
    expect(el(fixture).querySelector('app-recipe-card')).toBeNull();
  });

  it('shows a skeleton while loading and one quiet line when it fails', () => {
    const pending = new Subject<RecipePageOf<RecipeCard>>();
    service.list.and.returnValue(pending);
    const loading = render();
    expect(el(loading).querySelector('[aria-busy=true]')).not.toBeNull();

    service.list.and.returnValue(throwError(() => new Error('down')));
    const failed = render();
    expect(el(failed).querySelector('.quiet')?.textContent).toBe('Your recipes could not load right now.');
    expect(el(failed).querySelector('.head .new')).not.toBeNull();
  });

  it('opens the Ready sheet from the Cook button of a card', () => {
    service.list.and.returnValue(of(page(2)));
    const fixture = render();

    (el(fixture).querySelector('app-recipe-card .cook') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('app-recipe-ready')).not.toBeNull();
  });
});
