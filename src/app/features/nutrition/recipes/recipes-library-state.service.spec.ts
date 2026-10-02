import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { RecipesLibraryState } from './recipes-library-state.service';

@Component({ selector: 'app-blank', template: '' })
class BlankComponent {}

const snapshot = { scope: 'library' as const, q: 'salmon', category: 'Seafood', diet: null, saved: false, highProtein: true, page: 2 };

describe('RecipesLibraryState', () => {
  let state: RecipesLibraryState;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: BlankComponent }])] });
    state = TestBed.inject(RecipesLibraryState);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/nutrition?tab=recipes');
  });

  it('hands the list back once after a trip into the recipe pages, with the scroll it had', async () => {
    state.keep(snapshot);
    spyOnProperty(window, 'scrollY').and.returnValue(420);
    await router.navigateByUrl('/nutrition/recipes/r1');
    await router.navigateByUrl('/nutrition/recipes/r1/cook');
    expect(state.take('mine')).toBeNull();
    expect(state.take('library')).toEqual({ ...snapshot, scrollY: 420 });
    expect(state.take('library')).toBeNull();
  });

  it('has nothing to give when no list was kept or the person never went into a recipe', async () => {
    expect(state.take('library')).toBeNull();
    state.keep(snapshot);
    expect(state.take('library')).toBeNull();
    await router.navigateByUrl('/nutrition?tab=recipes');
    expect(state.take('library')).toBeNull();
  });

  it('forgets everything when the person leaves the Nutrition pages', async () => {
    state.keep(snapshot);
    await router.navigateByUrl('/nutrition/recipes/r1');
    await router.navigateByUrl('/dashboard');
    expect(state.take('library')).toBeNull();
    await router.navigateByUrl('/nutrition/recipes/r2');
    expect(state.take('library')).toBeNull();
  });
});
