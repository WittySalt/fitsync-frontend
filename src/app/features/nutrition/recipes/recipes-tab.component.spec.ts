import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NutritionDiaryService } from '../diary/nutrition-diary.service';
import { diaryServiceStub } from '../diary/diary-testing.spec';
import { RecipesTabComponent } from './recipes-tab.component';
import { RecipesService } from './recipes.service';
import { recipesServiceStub } from './recipes-testing.spec';

describe('RecipesTabComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: RecipesService, useValue: recipesServiceStub() }, { provide: NutritionDiaryService, useValue: diaryServiceStub() }]
    })
  );

  function render(inputs: Record<string, unknown> = {}): ComponentFixture<RecipesTabComponent> {
    const fixture = TestBed.createComponent(RecipesTabComponent);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<RecipesTabComponent>) => fixture.nativeElement as HTMLElement;
  const tabs = (fixture: ComponentFixture<RecipesTabComponent>) => Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('[role="tab"]'));

  it('has Library, My recipes and Saved meals, and a New recipe button that opens the editor', () => {
    const fixture = render();

    expect(tabs(fixture).map((tab) => tab.textContent?.trim())).toEqual(['Library', 'My recipes', 'Saved meals']);
    expect(el(fixture).querySelector('.new')?.getAttribute('href')).toBe('/nutrition/recipes/new');
    expect(el(fixture).querySelector('.new')?.textContent).toContain('New recipe');
  });

  it('opens on the library', () => {
    const fixture = render();

    expect(el(fixture).querySelector('app-recipe-list')).not.toBeNull();
    expect(el(fixture).querySelector('app-recipe-list.mine')).toBeNull();
    expect(tabs(fixture)[0].getAttribute('aria-selected')).toBe('true');
    expect(el(fixture).querySelector('app-saved-meals')).toBeNull();
  });

  it('switches between the three sections', () => {
    const fixture = render();

    tabs(fixture)[1].click();
    fixture.detectChanges();
    expect(tabs(fixture)[1].getAttribute('aria-selected')).toBe('true');
    expect(el(fixture).querySelector('app-recipe-list.mine')).not.toBeNull();

    tabs(fixture)[2].click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('app-saved-meals')).not.toBeNull();
    expect(el(fixture).querySelector('app-recipe-list')).toBeNull();
  });

  it('opens on the section it is given', () => {
    const fixture = render({ section: 'saved' });

    expect(el(fixture).querySelector('app-saved-meals')).not.toBeNull();
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
