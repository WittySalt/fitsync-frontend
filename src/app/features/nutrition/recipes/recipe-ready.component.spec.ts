import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { RecipeReadyComponent } from './recipe-ready.component';
import { RecipeDetail } from './recipes.models';
import { RecipesService } from './recipes.service';
import { detail, recipesServiceStub } from './recipes-testing.spec';

describe('RecipeReadyComponent', () => {
  let service: jasmine.SpyObj<RecipesService>;

  beforeEach(() => {
    service = recipesServiceStub();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: RecipesService, useValue: service }] });
  });

  function render(initialServings = 1): ComponentFixture<RecipeReadyComponent> {
    const fixture = TestBed.createComponent(RecipeReadyComponent);
    fixture.componentRef.setInput('recipeId', 'r1');
    fixture.componentRef.setInput('initialServings', initialServings);
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<RecipeReadyComponent>) => fixture.nativeElement as HTMLElement;
  const text = (fixture: ComponentFixture<RecipeReadyComponent>, selector: string) => (el(fixture).querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  const figures = (fixture: ComponentFixture<RecipeReadyComponent>) =>
    Array.from(el(fixture).querySelectorAll('.figures div')).map((cell) => `${cell.querySelector('dd')?.textContent} ${cell.querySelector('dt')?.textContent}`);

  it('shows a loading state, then the name, the servings and the three figures', () => {
    const pending = new Subject<RecipeDetail>();
    service.get.and.returnValue(pending);
    const fixture = render();
    expect(el(fixture).querySelector('[aria-busy=true]')).not.toBeNull();

    pending.next(detail());
    fixture.detectChanges();

    expect(text(fixture, 'h2')).toBe('Salmon Avocado Salad');
    expect(text(fixture, '.eyebrow')).toBe('Ready to cook');
    expect(text(fixture, '.row')).toContain('1 of 4');
    expect(figures(fixture)).toEqual(['2 steps', 'about 6 min of timers', '1 timer']);
    expect(text(fixture, '.note')).toBe('You can start without ticking everything.');
  });

  it('counts the ticks, keeps them to itself and scales the grams to the servings', () => {
    const fixture = render(2);
    expect(Array.from(el(fixture).querySelectorAll('.grams')).map((cell) => cell.textContent)).toEqual(['200 g', '227 g']);
    expect(text(fixture, '.count')).toBe('0 of 2 ticked');

    el(fixture).querySelectorAll<HTMLInputElement>('input[type=checkbox]')[0].click();
    fixture.detectChanges();
    expect(text(fixture, '.count')).toBe('1 of 2 ticked');
    expect(el(fixture).querySelectorAll('li.on').length).toBe(1);

    el(fixture).querySelectorAll<HTMLInputElement>('input[type=checkbox]')[0].click();
    fixture.detectChanges();
    expect(text(fixture, '.count')).toBe('0 of 2 ticked');
  });

  it('changes the servings with the stepper, within 0.25 and 20', () => {
    const fixture = render(0.25);
    const buttons = () => el(fixture).querySelectorAll<HTMLButtonElement>('app-stepper button');
    expect(buttons()[0].disabled).toBeTrue();
    buttons()[1].click();
    fixture.detectChanges();
    expect(text(fixture, '.row')).toContain('0.5 of 4');
  });

  it('starts cooking with the servings and without waiting for the ticks', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = render(1);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    el(fixture).querySelectorAll<HTMLButtonElement>('app-stepper button')[1].click();
    fixture.detectChanges();
    (el(fixture).querySelector('.start') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/nutrition/recipes', 'r1', 'cook'], { queryParams: { servings: 1.25 } });
    expect(closed).toBe(1);
  });

  it('shows no ticks list for a recipe without ingredients and says none for no timers', () => {
    service.get.and.returnValue(of(detail({ ingredients: [], steps: [{ stepNumber: 1, text: 'Mix.', title: null, ingredientIds: [], timers: [] }] })));
    const fixture = render();
    expect(el(fixture).querySelector('ul')).toBeNull();
    expect(figures(fixture)).toEqual(['1 steps', 'none of timers', '0 timers']);
  });

  it('shows an error with a retry and a way out', () => {
    service.get.and.returnValue(throwError(() => new Error('down')));
    const fixture = render();
    expect(text(fixture, 'app-state-panel')).toContain('Recipe unavailable');
    service.get.and.returnValue(of(detail()));
    (el(fixture).querySelector('app-state-panel button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(fixture, 'h2')).toBe('Salmon Avocado Salad');
  });

  it('closes on Escape and on the backdrop', () => {
    const fixture = render();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    (el(fixture).querySelector('.backdrop') as HTMLElement).click();
    expect(closed).toBe(2);
  });
});
