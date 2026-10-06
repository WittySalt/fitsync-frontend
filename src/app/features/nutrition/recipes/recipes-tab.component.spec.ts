import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CoachStore } from '../../../core/coach/coach.store';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { NutritionDiaryService } from '../diary/nutrition-diary.service';
import { diaryServiceStub } from '../diary/diary-testing.spec';
import { RecipesTabComponent } from './recipes-tab.component';
import { RecipesService } from './recipes.service';
import { card, recipesServiceStub, suggestionsOf } from './recipes-testing.spec';

describe('RecipesTabComponent', () => {
  let service: jasmine.SpyObj<RecipesService>;

  beforeEach(() => {
    service = recipesServiceStub();
    const data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getRecipeSuggestions']);
    data.getRecipeSuggestions.and.returnValue(of(suggestionsOf()));
    TestBed.configureTestingModule({
      providers: [
        { provide: CoachStore, useValue: { open: () => undefined, ask: () => undefined } },
        provideRouter([]),
        { provide: RecipesService, useValue: service },
        { provide: NutritionDiaryService, useValue: diaryServiceStub() },
        { provide: FitSyncDataService, useValue: data }
      ]
    });
  });

  function render(inputs: Record<string, unknown> = {}): ComponentFixture<RecipesTabComponent> {
    const fixture = TestBed.createComponent(RecipesTabComponent);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<RecipesTabComponent>) => fixture.nativeElement as HTMLElement;

  it('is one scroll in order: Continue cooking, Cook for tonight, Cooked recently, My recipes, then the Library', () => {
    const fixture = render();
    const order = ['app-cook-continue', 'app-cook-tonight', 'app-cooked-recently', 'app-my-recipes', 'section.library'];
    const positions = order.map((selector) => Array.from(el(fixture).children).findIndex((child) => child.matches(selector)));

    expect(positions.every((position) => position >= 0)).toBeTrue();
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(el(fixture).querySelector('.library h2')?.textContent).toBe('Library');
    expect(el(fixture).querySelector('.library app-recipe-list')).not.toBeNull();
  });

  it('has no Library, My recipes or Saved meals switch any more', () => {
    const fixture = render();

    expect(el(fixture).querySelector('[role="tablist"]')).toBeNull();
    expect(el(fixture).querySelector('app-saved-meals')).toBeNull();
    expect(el(fixture).querySelector('app-recipe-list.mine')).toBeNull();
  });

  it('opens the whole list of the person\'s own recipes from See all, and goes back', () => {
    service.list.and.returnValue(of({ items: [card()], page: 0, totalPages: 3, totalElements: 12 }));
    const fixture = render();

    (el(fixture).querySelector('.see-all') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('app-recipe-list.mine')).not.toBeNull();
    expect(el(fixture).querySelector('app-cook-tonight')).toBeNull();

    (el(fixture).querySelector('.back') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('app-cook-tonight')).not.toBeNull();
    expect(el(fixture).querySelector('app-recipe-list.mine')).toBeNull();
  });

  it('opens on the list of own recipes, or on the saved meals, when a link asks for them', () => {
    expect(el(render({ section: 'mine' })).querySelector('app-recipe-list.mine')).not.toBeNull();
    const saved = render({ section: 'saved' });
    expect(el(saved).querySelector('app-saved-meals')).not.toBeNull();
    expect(el(saved).querySelector('app-cook-tonight')).toBeNull();
  });

  it('says which meal the pick is for and lets the person cancel', () => {
    const fixture = render({ logTo: 'LUNCH' });
    let cancelled = 0;
    fixture.componentInstance.cancelLog.subscribe(() => (cancelled += 1));

    expect(el(fixture).querySelector('.context')?.textContent).toContain('Lunch');
    (el(fixture).querySelector('.context button') as HTMLButtonElement).click();
    expect(cancelled).toBe(1);
  });

  it('shows no pick line without a meal, or for one it does not know', () => {
    expect(el(render()).querySelector('.context')).toBeNull();
    expect(el(render({ logTo: 'FASTING' })).querySelector('.context')).toBeNull();
  });
});
