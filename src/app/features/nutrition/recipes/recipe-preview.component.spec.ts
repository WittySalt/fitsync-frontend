import { TestBed } from '@angular/core/testing';

import { RecipePreviewComponent } from './recipe-preview.component';

describe('RecipePreviewComponent', () => {
  const totals = { kcal: 498, proteinGrams: 19, carbsGrams: 68, fatGrams: 17, counted: 4, left: 0 };

  function render(inputs: Record<string, unknown> = {}): HTMLElement {
    const fixture = TestBed.createComponent(RecipePreviewComponent);
    fixture.componentRef.setInput('totals', totals);
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws the recipe as people will see it: cover, name, tags, facts and a serving', () => {
    const el = render({ name: ' Peanut banana oats ', servings: 4, groups: ['GRAINS', 'DAIRY'], tags: ['High fibre', 'Vegetarian'], ingredients: 4, steps: 2, timers: 1 });
    expect(el.querySelector('.eyebrow')?.textContent).toBe('Preview, as people will see it');
    expect(el.querySelector('app-recipe-cover .fallback')).not.toBeNull();
    expect(el.querySelector('.title')?.textContent).toBe('Peanut banana oats');
    expect(Array.from(el.querySelectorAll('.tags span')).map((tag) => tag.textContent)).toEqual(['High fibre', 'Vegetarian']);
    expect(Array.from(el.querySelectorAll('.facts div')).map((cell) => `${cell.querySelector('strong')?.textContent} ${cell.querySelector('span')?.textContent}`)).toEqual([
      '4 servings',
      '4 ingredients',
      '2 steps',
      '1 timer'
    ]);
    expect(Array.from(el.querySelectorAll('.live .macros strong')).map((cell) => cell.textContent)).toEqual(['498', '19 g', '68 g', '17 g']);
  });

  it('has no photo control, a stand-in name and singular words for one of each', () => {
    const el = render({ servings: 1, ingredients: 1, steps: 1, timers: 0 });
    expect(el.querySelector('input[type=file]')).toBeNull();
    expect(el.textContent).not.toContain('Add a photo');
    expect(el.querySelector('.title')?.textContent).toBe('Your recipe');
    expect(el.querySelector('.tags')).toBeNull();
    expect(Array.from(el.querySelectorAll('.facts span')).map((cell) => cell.textContent)).toEqual(['servings', 'ingredient', 'step', 'timers']);
  });

  it('shows a dash for servings that are not a number and draws High sugar grey', () => {
    const el = render({ servings: null, tags: ['High sugar'] });
    expect(el.querySelector('.facts strong')?.textContent).toBe('-');
    expect(el.querySelector('.tags span')?.classList.contains('grey')).toBeTrue();
  });

  it('says how many ingredients are not counted yet', () => {
    expect(render({ totals: { ...totals, left: 1 } }).querySelector('.hint')?.textContent).toContain('1 ingredient is not counted yet');
    expect(render({ totals: { ...totals, left: 2 } }).querySelector('.hint')?.textContent).toContain('2 ingredients are not counted yet');
    expect(render().querySelector('.hint')).toBeNull();
  });
});
