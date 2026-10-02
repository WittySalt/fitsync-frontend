import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { spoken } from '../diary/diary-testing.spec';
import { RecipeCardComponent } from './recipe-card.component';
import { RecipeCard } from './recipes.models';
import { card } from './recipes-testing.spec';

describe('RecipeCardComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function render(value: RecipeCard, extra: Record<string, unknown> = {}): ComponentFixture<RecipeCardComponent> {
    const fixture = TestBed.createComponent(RecipeCardComponent);
    fixture.componentRef.setInput('card', value);
    Object.entries(extra).forEach(([name, input]) => fixture.componentRef.setInput(name, input));
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<RecipeCardComponent>) => fixture.nativeElement as HTMLElement;

  it('shows the name, category and cuisine, kcal and protein a serving, and the tags', () => {
    const element = el(render(card({ dietFlags: ['VEGETARIAN'] })));

    expect(element.querySelector('.name strong')?.textContent).toBe('Salmon Avocado Salad');
    expect(element.querySelector('.name span')?.textContent).toBe('Seafood · British');
    expect(spoken(element.querySelector('.figures'))).toBe('612 kcal · 27 g protein a serving');
    expect(Array.from(element.querySelectorAll('.tags span')).map((tag) => tag.textContent)).toEqual(['High protein', 'Vegetarian']);
  });

  it('has a Cook button on the cover that reports the card, and can be left out', () => {
    const fixture = render(card({ name: 'Pad Thai' }));
    const emitted: RecipeCard[] = [];
    fixture.componentInstance.cook.subscribe((value) => emitted.push(value));
    const button = el(fixture).querySelector('.cook') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Cook');
    expect(button.getAttribute('aria-label')).toBe('Cook Pad Thai');
    button.click();
    expect(emitted.map((value) => value.name)).toEqual(['Pad Thai']);

    fixture.componentRef.setInput('cookable', false);
    fixture.detectChanges();
    expect(el(fixture).querySelector('.cook')).toBeNull();
  });

  it('draws High sugar and High salt grey', () => {
    const element = el(render(card({ tags: ['High sugar', 'High protein'] })));
    const tags = Array.from(element.querySelectorAll('.tags span'));

    expect(tags[0].classList.contains('grey')).toBeTrue();
    expect(tags[1].classList.contains('grey')).toBeFalse();
  });

  it('links the cover and the name to the recipe, carrying the meal being picked for', () => {
    const element = el(render(card({ id: 'abc' }), { logTo: 'LUNCH' }));
    const links = Array.from(element.querySelectorAll('a')).map((link) => link.getAttribute('href'));

    expect(links).toEqual(['/nutrition/recipes/abc?logTo=LUNCH', '/nutrition/recipes/abc?logTo=LUNCH']);
  });

  it('links without a query when no meal is being picked for', () => {
    const element = el(render(card({ id: 'abc' })));

    expect(element.querySelector('.name')?.getAttribute('href')).toBe('/nutrition/recipes/abc');
  });

  it('has a heart that says whether the recipe is saved and emits when pressed', () => {
    const fixture = render(card({ favorite: true }));
    const seen: string[] = [];
    fixture.componentInstance.favourite.subscribe((value) => seen.push(value.id));
    const heart = el(fixture).querySelector('.heart') as HTMLButtonElement;

    expect(heart.getAttribute('aria-pressed')).toBe('true');
    expect(heart.getAttribute('aria-label')).toContain('Remove');
    heart.click();
    expect(seen).toEqual(['r1']);
  });

  it('offers to save a recipe that is not saved', () => {
    const heart = el(render(card({ favorite: false }))).querySelector('.heart') as HTMLButtonElement;

    expect(heart.getAttribute('aria-pressed')).toBe('false');
    expect(heart.getAttribute('aria-label')).toBe('Save Salmon Avocado Salad');
  });

  it('leaves the heart out for the own recipes', () => {
    expect(el(render(card(), { heart: false })).querySelector('.heart')).toBeNull();
  });

  it('shows no tag row when there are no tags', () => {
    expect(el(render(card({ tags: [], dietFlags: [] }))).querySelector('.tags')).toBeNull();
  });
});
