import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { diaryServiceStub, summary } from '../diary/diary-testing.spec';
import { NutritionDiaryService } from '../diary/nutrition-diary.service';
import { RecipesService } from '../recipes/recipes.service';
import { recipesServiceStub } from '../recipes/recipes-testing.spec';
import { RING_MS } from './cook-log.component';
import { CookFinishedComponent } from './cook-finished.component';

describe('CookFinishedComponent', () => {
  let recipes: jasmine.SpyObj<RecipesService>;
  let diary: jasmine.SpyObj<NutritionDiaryService>;

  beforeEach(() => {
    recipes = recipesServiceStub();
    recipes.logRecipe.and.returnValue(of({ mealId: 'm1' }));
    diary = diaryServiceStub();
    diary.getSummary.and.returnValue(of(summary({ totalCalories: 1210, targetCalories: 2100 })));
    diary.deleteMeal.and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        { provide: RecipesService, useValue: recipes },
        { provide: NutritionDiaryService, useValue: diary }
      ]
    });
  });

  function render(inputs: Record<string, unknown> = {}, reduced = true): ComponentFixture<CookFinishedComponent> {
    const fixture = TestBed.createComponent(CookFinishedComponent);
    const all: Record<string, unknown> = {
      recipeId: 'r1',
      name: 'Salmon Avocado Salad',
      minutes: 42,
      steps: 5,
      servingsCooked: 2,
      kcalPerServing: 590,
      reducedMotion: reduced,
      ...inputs
    };
    Object.entries(all).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<CookFinishedComponent>) => fixture.nativeElement as HTMLElement;
  const text = (fixture: ComponentFixture<CookFinishedComponent>, selector: string) => (el(fixture).querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const primary = (fixture: ComponentFixture<CookFinishedComponent>) => el(fixture).querySelectorAll<HTMLButtonElement>('.primary');

  it('says Cooked with the recipe and three figures: minutes, steps and servings cooked', () => {
    const fixture = render();
    expect(text(fixture, 'h2')).toBe('Cooked');
    expect(text(fixture, '.name')).toBe('Salmon Avocado Salad');
    expect(Array.from(el(fixture).querySelectorAll('.facts div')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['42 min', '5 steps', '2 servings']);
    expect(el(fixture).querySelector('.tick')).not.toBeNull();
  });

  it('uses the singular for one step and one serving', () => {
    const fixture = render({ steps: 1, servingsCooked: 1 });
    expect(Array.from(el(fixture).querySelectorAll('.facts span')).map((cell) => cell.textContent)).toEqual(['min', 'step', 'serving']);
  });

  it('shows Today with the ring and the servings eaten starting at the servings cooked', () => {
    const fixture = render();
    expect(text(fixture, '.today .label')).toBe('Today');
    expect(text(fixture, '.eaten')).toBe('1,210 of 2,100 kcal');
    expect(text(fixture, '.percent')).toBe('58%');
    expect(text(fixture, 'app-stepper')).toContain('2 of 2');
    expect(text(fixture, '.meal')).toMatch(/^(Breakfast|Lunch|Dinner|Snack) · \d\d:\d\d\s*Change$/);
  });

  describe('earned today', () => {
    it('says first time when the recipe had never been cooked before this cook', () => {
      const fixture = render({ firstCook: true });
      expect(text(fixture, '.earned')).toContain('First time cooking this');
      expect(text(fixture, '.earned')).toContain('It now shows under Cooked recently');
    });

    it('is left out when it was cooked before, and by default', () => {
      expect(el(render({ firstCook: false })).querySelector('.earned')).toBeNull();
      expect(el(render()).querySelector('.earned')).toBeNull();
    });

    it('asks the server nothing to find out', () => {
      render({ firstCook: true });
      expect(recipes.list).not.toHaveBeenCalled();
    });
  });

  it('measures the servings eaten against the servings cooked, and cannot go past them', () => {
    const fixture = render({ servingsCooked: 1 });
    expect(text(fixture, 'app-stepper')).toContain('1 of 1');
    const [less, more] = Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('app-stepper button'));
    expect(more.disabled).toBeTrue();
    less.click();
    fixture.detectChanges();
    expect(text(fixture, 'app-stepper')).toContain('0.75 of 1');
    expect(more.disabled).toBeFalse();
    more.click();
    fixture.detectChanges();
    expect(text(fixture, 'app-stepper')).toContain('1 of 1');
  });

  it('shows the log button with the servings and calories, and one filled button before logging', () => {
    const fixture = render();
    expect(primary(fixture).length).toBe(1);
    expect(primary(fixture)[0].textContent?.trim()).toBe('Log 2 servings · 1,180 kcal');
    el(fixture).querySelectorAll<HTMLButtonElement>('app-stepper button')[0].click();
    fixture.detectChanges();
    expect(primary(fixture)[0].textContent?.trim()).toBe('Log 1.75 servings · 1,033 kcal');
    expect(text(fixture, '.quiet')).toBe('Not now');
  });

  it('logs the meal, moves the ring and the number, shows +kcal, Logged to and Done as the only filled button', () => {
    const fixture = render({ servingsCooked: 1 });
    primary(fixture)[0].click();
    fixture.detectChanges();

    expect(recipes.logRecipe).toHaveBeenCalledWith('r1', jasmine.objectContaining({ servings: 1, mealType: jasmine.any(String), consumedAt: jasmine.any(Date) }));
    expect(text(fixture, '.eaten')).toBe('1,800 of 2,100 kcal');
    expect(text(fixture, '.percent')).toBe('86%');
    expect(text(fixture, '.plus')).toBe('+590 kcal');
    expect(text(fixture, '.logged')).toMatch(/^Logged to (breakfast|lunch|dinner|snack)\s*Undo$/);
    expect(el(fixture).querySelector('app-stepper')).toBeNull();
    expect(primary(fixture).length).toBe(1);
    expect(primary(fixture)[0].textContent?.trim()).toBe('Done');
    expect(el(fixture).querySelector('.quiet')).toBeNull();
    expect(el(fixture).querySelector('.today.over')).toBeNull();
  });

  it('says how many servings are left after logging fewer than were cooked, and nothing before or when all were eaten', () => {
    const fixture = render({ servingsCooked: 4 });
    (fixture.componentInstance as unknown as { eaten: { set(value: number): void } }).eaten.set(1);
    fixture.detectChanges();
    expect(el(fixture).querySelector('[data-test="left-line"]')).toBeNull();
    primary(fixture)[0].click();
    fixture.detectChanges();
    expect(text(fixture, '[data-test="left-line"]')).toBe('Cooked 4 servings · 3 left');
  });

  it('has no left line when every cooked serving was logged', () => {
    const fixture = render({ servingsCooked: 1 });
    primary(fixture)[0].click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('[data-test="left-line"]')).toBeNull();
  });

  it('takes the meal off again with Undo, which uses the existing soft delete, and brings the buttons back', () => {
    const fixture = render({ servingsCooked: 1 });
    primary(fixture)[0].click();
    fixture.detectChanges();
    (el(fixture).querySelector('.undo') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(diary.deleteMeal).toHaveBeenCalledWith('m1');
    expect(text(fixture, '.eaten')).toBe('1,210 of 2,100 kcal');
    expect(el(fixture).querySelector('.logged')).toBeNull();
    expect(primary(fixture)[0].textContent?.trim()).toBe('Log 1 serving · 590 kcal');
  });

  it('keeps the meal logged and says so when Undo fails', () => {
    diary.deleteMeal.and.returnValue(throwError(() => new Error('down')));
    const fixture = render({ servingsCooked: 1 });
    primary(fixture)[0].click();
    fixture.detectChanges();
    (el(fixture).querySelector('.undo') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el(fixture).querySelector('.logged')).not.toBeNull();
    expect(text(fixture, '.error')).toBe('That could not be undone. Please try again.');
  });

  it('turns the ring and the +kcal line amber and says how far past the target, never red', () => {
    diary.getSummary.and.returnValue(of(summary({ totalCalories: 1800, targetCalories: 2100 })));
    const fixture = render({ servingsCooked: 1 });
    primary(fixture)[0].click();
    fixture.detectChanges();

    expect(text(fixture, '.eaten')).toBe('2,390 of 2,100 kcal');
    expect(el(fixture).querySelector('.today.over')).not.toBeNull();
    expect(text(fixture, '.past')).toBe("290 kcal past today's target");
    expect(getComputedStyle(el(fixture).querySelector('.arc') as Element).stroke).toBe(getComputedStyle(probe('var(--amber-500)')).color);
  });

  it('brings the button back with a short message when the meal was not logged', () => {
    recipes.logRecipe.and.returnValue(throwError(() => new Error('down')));
    const fixture = render({ servingsCooked: 1 });
    primary(fixture)[0].click();
    fixture.detectChanges();

    expect(text(fixture, '.error')).toBe('That meal was not logged. Please try again.');
    expect(primary(fixture)[0].textContent?.trim()).toBe('Log 1 serving · 590 kcal');
    expect(primary(fixture)[0].disabled).toBeFalse();
    expect(el(fixture).querySelector('.logged')).toBeNull();
  });

  it('shows Logging and blocks a second tap while the call is on its way', () => {
    const pending = new Subject<{ mealId: string }>();
    recipes.logRecipe.and.returnValue(pending);
    const fixture = render({ servingsCooked: 1 });
    primary(fixture)[0].click();
    fixture.detectChanges();
    expect(primary(fixture)[0].textContent?.trim()).toBe('Logging');
    expect(primary(fixture)[0].disabled).toBeTrue();
    primary(fixture)[0].click();
    expect(recipes.logRecipe).toHaveBeenCalledTimes(1);
    pending.next({ mealId: 'm1' });
    fixture.detectChanges();
    expect(primary(fixture)[0].textContent?.trim()).toBe('Done');
  });

  it('leaves with Not now and with Done, and logs nothing for Not now', () => {
    const fixture = render();
    let left = 0;
    fixture.componentInstance.done.subscribe(() => (left += 1));
    (el(fixture).querySelector('.quiet') as HTMLButtonElement).click();
    expect(left).toBe(1);
    expect(recipes.logRecipe).not.toHaveBeenCalled();

    const again = render({ servingsCooked: 1 });
    again.componentInstance.done.subscribe(() => (left += 1));
    primary(again)[0].click();
    again.detectChanges();
    primary(again)[0].click();
    expect(left).toBe(2);
  });

  it('shows a loading state and an error for today, and logging still works', () => {
    const pending = new Subject<ReturnType<typeof summary>>();
    diary.getSummary.and.returnValue(pending);
    const fixture = render();
    expect(el(fixture).querySelector('.today.skeleton')).not.toBeNull();
    pending.error(new Error('down'));
    fixture.detectChanges();
    expect(text(fixture, '.note')).toBe('Today could not load. Logging still works.');
    primary(fixture)[0].click();
    fixture.detectChanges();
    expect(text(fixture, '.logged')).toContain('Logged to');
    expect(primary(fixture)[0].textContent?.trim()).toBe('Done');
  });

  it('works without a calorie figure or a target', () => {
    diary.getSummary.and.returnValue(of(summary({ totalCalories: 900, targetCalories: null })));
    const fixture = render({ kcalPerServing: null, servingsCooked: 1 });
    expect(el(fixture).querySelector('.today svg')).toBeNull();
    expect(text(fixture, '.eaten')).toBe('900 kcal');
    expect(primary(fixture)[0].textContent?.trim()).toBe('Log 1 serving');
    primary(fixture)[0].click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('.plus')).toBeNull();
  });

  it('lets the meal be changed and logs under the one chosen', () => {
    const fixture = render({ servingsCooked: 1 });
    (el(fixture).querySelector('.meal .link') as HTMLButtonElement).click();
    fixture.detectChanges();
    el(fixture).querySelectorAll<HTMLButtonElement>('.slots button')[0].click();
    fixture.detectChanges();
    expect(text(fixture, '.meal')).toContain('Breakfast');
    primary(fixture)[0].click();
    expect(recipes.logRecipe).toHaveBeenCalledWith('r1', jasmine.objectContaining({ mealType: 'BREAKFAST' }));
  });

  describe('motion', () => {
    it('runs the ring and the number to their new value over 0.8 s when motion is allowed', fakeAsync(() => {
      const fixture = render({ servingsCooked: 1 }, false);
      tick();
      primary(fixture)[0].click();
      fixture.detectChanges();
      expect(text(fixture, '.eaten')).not.toBe('1,800 of 2,100 kcal');

      const began = performance.now();
      while (performance.now() - began < RING_MS + 100) {
        tick(50);
      }
      flush();
      fixture.detectChanges();
      expect(text(fixture, '.eaten')).toBe('1,800 of 2,100 kcal');
    }));

    it('jumps straight to the final value and has no rise or pop when reduced motion is on', () => {
      const fixture = render({ servingsCooked: 1 }, true);
      expect(el(fixture).querySelector('.shell.reduced')).not.toBeNull();
      primary(fixture)[0].click();
      fixture.detectChanges();
      expect(text(fixture, '.eaten')).toBe('1,800 of 2,100 kcal');
      expect(getComputedStyle(el(fixture).querySelector('.card') as Element).animationName).toBe('none');
      expect(getComputedStyle(el(fixture).querySelector('.tick') as Element).animationName).toBe('none');
    });

    it('vibrates once on opening, and not with reduced motion', () => {
      const vibrate = jasmine.createSpy('vibrate').and.returnValue(true);
      Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
      render({}, true);
      expect(vibrate).not.toHaveBeenCalled();
      render({}, false);
      expect(vibrate).toHaveBeenCalledOnceWith(35);
      Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    });
  });

  it('leaves on Escape when nothing is on its way', () => {
    const fixture = render();
    let left = 0;
    fixture.componentInstance.done.subscribe(() => (left += 1));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(left).toBe(1);
  });
});

function probe(colour: string): HTMLElement {
  const element = document.createElement('div');
  element.style.color = colour;
  document.body.appendChild(element);
  return element;
}
