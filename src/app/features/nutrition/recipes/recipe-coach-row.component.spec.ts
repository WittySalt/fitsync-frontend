import { TestBed } from '@angular/core/testing';

import { CoachStore } from '../../../core/coach/coach.store';
import { RecipeCoachRowComponent } from './recipe-coach-row.component';

describe('RecipeCoachRowComponent', () => {
  let coach: jasmine.SpyObj<CoachStore>;

  beforeEach(() => {
    coach = jasmine.createSpyObj<CoachStore>('CoachStore', ['open', 'ask']);
    TestBed.configureTestingModule({ providers: [{ provide: CoachStore, useValue: coach }] });
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(RecipeCoachRowComponent);
    fixture.componentRef.setInput('recipeId', 'r7');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers the three questions under the heading', () => {
    const el = render();
    expect(el.querySelector('h3')?.textContent?.trim()).toBe('Ask your coach about this recipe');
    expect(Array.from(el.querySelectorAll('button')).map((button) => button.textContent?.trim())).toEqual([
      'Does this fit today?',
      'Could this be higher in protein?',
      'Is there something with less fat?'
    ]);
  });

  it('opens the dock and sends the question with the recipe attached', () => {
    const el = render();
    el.querySelectorAll('button')[1].click();
    expect(coach.open).toHaveBeenCalledTimes(1);
    expect(coach.ask).toHaveBeenCalledWith('Could this be higher in protein?', { recipeId: 'r7' });
  });
});
