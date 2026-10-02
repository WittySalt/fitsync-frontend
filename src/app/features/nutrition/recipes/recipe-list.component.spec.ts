import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ToastService } from '../../../core/toast/toast.service';
import { RecipeListComponent } from './recipe-list.component';
import { RecipeCard, RecipePageOf } from './recipes.models';
import { RecipesService } from './recipes.service';
import { card, recipesServiceStub } from './recipes-testing.spec';

describe('RecipeListComponent', () => {
  let service: jasmine.SpyObj<RecipesService>;
  let toast: ToastService;

  beforeEach(() => {
    service = recipesServiceStub();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: RecipesService, useValue: service }]
    });
    toast = TestBed.inject(ToastService);
  });

  function render(scope: 'library' | 'mine' = 'library', logTo: string | null = null): ComponentFixture<RecipeListComponent> {
    const fixture = TestBed.createComponent(RecipeListComponent);
    fixture.componentRef.setInput('scope', scope);
    fixture.componentRef.setInput('logTo', logTo);
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<RecipeListComponent>) => fixture.nativeElement as HTMLElement;
  const buttons = (fixture: ComponentFixture<RecipeListComponent>, group: string) =>
    Array.from(el(fixture).querySelectorAll<HTMLButtonElement>(`[aria-label="${group}"] button`));
  const lastQuery = () => service.list.calls.mostRecent().args[0];
  const cards = (count: number): RecipeCard[] => Array.from({ length: count }, (_, index) => card({ id: `r${index}`, name: `Recipe ${index}` }));

  it('shows skeletons while the library loads, then a card for each recipe', fakeAsync(() => {
    const pending = new Subject<RecipePageOf<RecipeCard>>();
    service.list.and.returnValue(pending);
    const fixture = render();
    tick();
    fixture.detectChanges();
    expect(el(fixture).querySelectorAll('.card-skeleton').length).toBe(6);

    pending.next({ items: [card()], page: 0, totalPages: 1, totalElements: 1 });
    tick();
    fixture.detectChanges();

    expect(el(fixture).querySelectorAll('app-recipe-card').length).toBe(1);
    expect(el(fixture).querySelector('.count')?.textContent).toBe('1 recipe · from TheMealDB, with nutrition from USDA');
    expect(lastQuery()).toEqual(jasmine.objectContaining({ scope: 'library', page: 0, size: 18 }));
  }));

  it('offers All and the categories present, and filters by the one chosen', fakeAsync(() => {
    const fixture = render();
    tick();
    fixture.detectChanges();

    expect(buttons(fixture, 'Category').map((button) => button.textContent?.trim())).toEqual(['All', 'Breakfast', 'Seafood']);
    buttons(fixture, 'Category')[2].click();
    tick();
    fixture.detectChanges();

    expect(lastQuery().category).toBe('Seafood');
    expect(buttons(fixture, 'Category')[2].getAttribute('aria-pressed')).toBe('true');
  }));

  it('waits for a pause in typing before searching, and caps the box at 80 characters', fakeAsync(() => {
    const fixture = render();
    tick();
    fixture.detectChanges();
    const calls = service.list.calls.count();
    const input = el(fixture).querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('maxlength')).toBe('80');

    input.value = 'sal';
    input.dispatchEvent(new Event('input'));
    tick(100);
    input.value = 'salmon';
    input.dispatchEvent(new Event('input'));
    tick(299);
    fixture.detectChanges();
    expect(service.list.calls.count()).toBe(calls);

    tick(1);
    fixture.detectChanges();
    tick();

    expect(service.list.calls.count()).toBe(calls + 1);
    expect(lastQuery().q).toBe('salmon');
  }));

  it('cuts a pasted search to 80 characters', fakeAsync(() => {
    const fixture = render();
    tick();
    const input = el(fixture).querySelector('input') as HTMLInputElement;

    input.value = 'x'.repeat(120);
    input.dispatchEvent(new Event('input'));
    tick(300);
    fixture.detectChanges();
    tick();

    expect(lastQuery().q?.length).toBe(80);
  }));

  it('filters by diet, one at a time, and by Saved', fakeAsync(() => {
    const fixture = render();
    tick();
    fixture.detectChanges();
    const show = () => buttons(fixture, 'Show');

    show()[1].click();
    tick();
    fixture.detectChanges();
    expect(lastQuery().diet).toBe('VEGETARIAN');

    show()[2].click();
    tick();
    fixture.detectChanges();
    expect(lastQuery().diet).toBe('VEGAN');

    show()[2].click();
    tick();
    fixture.detectChanges();
    expect(lastQuery().diet).toBeUndefined();

    show()[3].click();
    tick();
    fixture.detectChanges();
    expect(lastQuery().scope).toBe('favorites');
  }));

  it('sends the HIGH_PROTEIN tag from the chip and goes back to the first page', fakeAsync(() => {
    service.list.and.returnValue(of({ items: cards(18), page: 0, totalPages: 3, totalElements: 50 }));
    const fixture = render();
    tick();
    fixture.detectChanges();
    (el(fixture).querySelector('.step.next') as HTMLButtonElement).click();
    tick();
    fixture.detectChanges();
    expect(lastQuery().page).toBe(1);

    buttons(fixture, 'Show')[0].click();
    tick();
    fixture.detectChanges();

    expect(lastQuery().tag).toBe('HIGH_PROTEIN');
    expect(lastQuery().page).toBe(0);
  }));

  it('moves between pages with the pager', fakeAsync(() => {
    service.list.and.returnValue(of({ items: cards(18), page: 0, totalPages: 3, totalElements: 50 }));
    const fixture = render();
    tick();
    fixture.detectChanges();

    (el(fixture).querySelector('.step.next') as HTMLButtonElement).click();
    tick();
    fixture.detectChanges();

    expect(lastQuery().page).toBe(1);
  }));

  it('says nothing matches and clears the filters', fakeAsync(() => {
    service.list.and.returnValue(of({ items: [], page: 0, totalPages: 0, totalElements: 0 }));
    const fixture = render();
    tick();
    buttons(fixture, 'Show')[1].click();
    tick();
    fixture.detectChanges();

    expect(el(fixture).querySelector('.empty strong')?.textContent).toBe('No recipes match');
    (el(fixture).querySelector('.empty button') as HTMLButtonElement).click();
    tick();
    fixture.detectChanges();

    expect(lastQuery().diet).toBeUndefined();
  }));

  it('explains an empty Saved filter', fakeAsync(() => {
    service.list.and.returnValue(of({ items: [], page: 0, totalPages: 0, totalElements: 0 }));
    const fixture = render();
    tick();
    buttons(fixture, 'Show')[3].click();
    tick();
    fixture.detectChanges();

    expect(el(fixture).querySelector('.empty strong')?.textContent).toBe('No saved recipes yet');
    expect(el(fixture).querySelector('.empty p')?.textContent).toContain('heart');
  }));

  it('shows an error with a retry that loads again', fakeAsync(() => {
    service.list.and.returnValue(throwError(() => new Error('down')));
    const fixture = render();
    tick();
    fixture.detectChanges();
    expect(el(fixture).querySelector('app-state-panel')?.textContent).toContain('could not load');

    service.list.and.returnValue(of({ items: cards(2), page: 0, totalPages: 1, totalElements: 2 }));
    (el(fixture).querySelector('app-state-panel button') as HTMLButtonElement).click();
    tick();
    fixture.detectChanges();

    expect(el(fixture).querySelectorAll('app-recipe-card').length).toBe(2);
  }));

  it('flips the heart at once and keeps it when the server agrees', fakeAsync(() => {
    const fixture = render();
    tick();
    fixture.detectChanges();

    (el(fixture).querySelector('.heart') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(service.setFavorite).toHaveBeenCalledWith('r1', true);
    expect(el(fixture).querySelector('.heart')?.getAttribute('aria-pressed')).toBe('true');
  }));

  it('puts the heart back and says so when the server refuses', fakeAsync(() => {
    service.setFavorite.and.returnValue(throwError(() => new Error('no')));
    const fixture = render();
    tick();
    fixture.detectChanges();

    (el(fixture).querySelector('.heart') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el(fixture).querySelector('.heart')?.getAttribute('aria-pressed')).toBe('false');
    expect(toast.toasts().some((entry) => entry.type === 'error')).toBeTrue();
    tick(7000);
  }));

  describe('My recipes', () => {
    it('lists the own recipes with no chips and no hearts', fakeAsync(() => {
      const fixture = render('mine');
      tick();
      fixture.detectChanges();

      expect(lastQuery().scope).toBe('mine');
      expect(el(fixture).querySelector('.chips')).toBeNull();
      expect(el(fixture).querySelector('.heart')).toBeNull();
      expect(el(fixture).querySelector('.count')?.textContent).toBe('1 of your recipe');
    }));

    it('invites the person to write a first recipe', fakeAsync(() => {
      service.list.and.returnValue(of({ items: [], page: 0, totalPages: 0, totalElements: 0 }));
      const fixture = render('mine');
      tick();
      fixture.detectChanges();

      expect(el(fixture).querySelector('.empty strong')?.textContent).toBe('No recipes of your own yet');
      expect(el(fixture).querySelector('.empty a')?.getAttribute('href')).toBe('/nutrition/recipes/new');
    }));
  });

  it('passes the meal being picked for to each card', fakeAsync(() => {
    const fixture = render('library', 'DINNER');
    tick();
    fixture.detectChanges();

    expect(el(fixture).querySelector('.name')?.getAttribute('href')).toBe('/nutrition/recipes/r1?logTo=DINNER');
  }));
});
