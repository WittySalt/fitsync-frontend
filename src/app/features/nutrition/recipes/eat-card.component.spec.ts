import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LOADING, Load } from '../diary/diary.models';
import { spoken } from '../diary/diary-testing.spec';
import { EatCardComponent } from './eat-card.component';
import { TodayFit } from './recipes-figures';
import { RecipeDetail } from './recipes.models';
import { detail } from './recipes-testing.spec';

describe('EatCardComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const fit: Load<TodayFit> = {
    status: 'ready',
    data: { calories: { label: 'Calories', before: 1268, after: 1880, of: 2100, unit: 'kcal', beforeShare: 0.6, afterShare: 0.9 }, protein: null, vitamin: null, leftKcal: 220 }
  };

  function render(recipe: RecipeDetail = detail(), inputs: Record<string, unknown> = {}): ComponentFixture<EatCardComponent> {
    const fixture = TestBed.createComponent(EatCardComponent);
    fixture.componentRef.setInput('recipe', recipe);
    fixture.componentRef.setInput('fit', fit);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<EatCardComponent>) => fixture.nativeElement as HTMLElement;
  const press = (fixture: ComponentFixture<EatCardComponent>, label: string) => {
    (el(fixture).querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  it('shows what the servings do to today above the controls', () => {
    const fixture = render();

    expect(el(fixture).querySelector('h3')?.textContent).toBe('Eat this');
    expect(el(fixture).querySelector('app-fit-today')).not.toBeNull();
    expect(spoken(el(fixture).querySelector('.stepper strong'))).toBe('1 of 4');
  });

  it('steps the servings in quarters and rescales the log button', () => {
    const fixture = render();

    press(fixture, 'More servings');
    expect(fixture.componentInstance.servings()).toBe(1.25);
    expect(el(fixture).querySelector('.log')?.textContent?.trim()).toBe('Log 1.25 servings · 765 kcal');

    press(fixture, 'Fewer servings');
    press(fixture, 'Fewer servings');
    expect(fixture.componentInstance.servings()).toBe(0.75);
    expect(el(fixture).querySelector('.log')?.textContent?.trim()).toBe('Log 0.75 serving · 459 kcal');
  });

  it('says one serving in the singular', () => {
    expect(el(render()).querySelector('.log')?.textContent?.trim()).toBe('Log 1 serving · 612 kcal');
  });

  it('stops at 0.25 and at 20 servings', () => {
    const low = render(detail(), { servings: 0.25 });
    expect((el(low).querySelector('[aria-label="Fewer servings"]') as HTMLButtonElement).disabled).toBeTrue();

    const high = render(detail(), { servings: 20 });
    expect((el(high).querySelector('[aria-label="More servings"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('names the meal by the clock and lets the person change it', () => {
    const fixture = render(detail(), { mealType: 'LUNCH' });
    expect(el(fixture).querySelector('.meal span')?.textContent).toBe('Lunch, now');
    expect(el(fixture).querySelector('.slots')).toBeNull();

    (el(fixture).querySelector('.meal .link') as HTMLButtonElement).click();
    fixture.detectChanges();
    const chips = Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('.slots button'));
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack']);

    chips[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.mealType()).toBe('DINNER');
    expect(el(fixture).querySelector('.meal span')?.textContent).toBe('Dinner, now');
    expect(el(fixture).querySelector('.slots')).toBeNull();
  });

  it('emits log, and disables the button while it is busy', () => {
    const fixture = render();
    let logged = 0;
    fixture.componentInstance.log.subscribe(() => (logged += 1));

    (el(fixture).querySelector('.log') as HTMLButtonElement).click();
    expect(logged).toBe(1);

    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect((el(fixture).querySelector('.log') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('links Start cooking to cook mode', () => {
    expect(el(render()).querySelector('.cook')?.getAttribute('href')).toBe('/nutrition/recipes/r1/cook');
  });

  it('offers Save and Make it mine for a library recipe, and tells a saved one', () => {
    const fixture = render(detail({ favorite: true }));
    const seen: string[] = [];
    fixture.componentInstance.favourite.subscribe(() => seen.push('favourite'));
    fixture.componentInstance.makeMine.subscribe(() => seen.push('mine'));
    const small = Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('.small'));

    expect(small.map((button) => spoken(button))).toEqual(['Saved', 'Make it mine']);
    expect(small[0].getAttribute('aria-pressed')).toBe('true');
    small.forEach((button) => button.click());
    expect(seen).toEqual(['favourite', 'mine']);
  });

  it('says Save for a recipe that is not saved', () => {
    expect(spoken(el(render(detail({ favorite: false }))).querySelector('.small'))).toBe('Save');
  });

  it('offers Edit instead for a recipe of the own, with no heart and no copy', () => {
    const fixture = render(detail({ scope: 'USER', editable: true }));
    const small = Array.from(el(fixture).querySelectorAll('.small'));

    expect(small.length).toBe(1);
    expect(small[0].textContent?.trim()).toBe('Edit');
    expect(small[0].getAttribute('href')).toBe('/nutrition/recipes/r1/edit');
  });

  it('emits when Add to a saved meal is pressed', () => {
    const fixture = render();
    let opened = 0;
    fixture.componentInstance.addToSaved.subscribe(() => (opened += 1));

    (el(fixture).querySelector('.save-meal') as HTMLButtonElement).click();

    expect(opened).toBe(1);
  });

  it('shows the fit while it loads', () => {
    const fixture = render(detail(), { fit: LOADING });

    expect(el(fixture).querySelector('app-fit-today .skeleton')).not.toBeNull();
  });
});
