import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { CookedRecentlyComponent } from './cooked-recently.component';
import { RecipeCard, RecipePageOf } from './recipes.models';
import { RecipesService } from './recipes.service';
import { card, recipesServiceStub } from './recipes-testing.spec';

describe('CookedRecentlyComponent', () => {
  let service: jasmine.SpyObj<RecipesService>;

  beforeEach(() => {
    service = recipesServiceStub();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: RecipesService, useValue: service }] });
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(CookedRecentlyComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('asks for the recent recipes and shows each with when it was cooked, linking to the recipe', () => {
    const now = new Date();
    service.list.and.returnValue(
      of({
        items: [card({ id: 'a', name: 'Salmon', lastCookedAt: now.toISOString() }), card({ id: 'b', name: 'Oats', lastCookedAt: null })],
        page: 0,
        totalPages: 1,
        totalElements: 2
      })
    );
    const el = render();
    expect(service.list).toHaveBeenCalledWith({ scope: 'recent', size: 6 });
    expect(el.querySelector('h2')?.textContent).toBe('Cooked recently');
    const items = el.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('strong')?.textContent).toBe('Salmon');
    expect(items[0].querySelector('span')?.textContent).toBe('Cooked today');
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe('/nutrition/recipes/a');
  });

  it('shows nothing while it loads, when the list is empty and when it fails', () => {
    const pending = new Subject<RecipePageOf<RecipeCard>>();
    service.list.and.returnValue(pending);
    expect(render().querySelector('section')).toBeNull();
    service.list.and.returnValue(of({ items: [], page: 0, totalPages: 0, totalElements: 0 }));
    expect(render().querySelector('section')).toBeNull();
    service.list.and.returnValue(throwError(() => new Error('down')));
    expect(render().querySelector('section')).toBeNull();
  });
});
