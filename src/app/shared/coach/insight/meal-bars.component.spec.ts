import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProteinByMeal } from '../../../core/fitsync.models';
import { MealBarsComponent } from './meal-bars.component';

const meals: ProteinByMeal[] = [
  { mealType: 'BREAKFAST', label: 'Breakfast', gramsPerDay: 27 },
  { mealType: 'LUNCH', label: 'Lunch', gramsPerDay: 54 },
  { mealType: 'DINNER', label: 'Dinner', gramsPerDay: 45 }
];

describe('MealBarsComponent', () => {
  let fixture: ComponentFixture<MealBarsComponent>;
  let element: HTMLElement;

  function render(value: ProteinByMeal[], emphasise = false): void {
    fixture = TestBed.createComponent(MealBarsComponent);
    fixture.componentRef.setInput('meals', value);
    fixture.componentRef.setInput('emphasiseLunchAndDinner', emphasise);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  function column(selector: string): string[] {
    return Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MealBarsComponent] }).compileComponents();
  });

  it('draws one bar for each meal with its value above and its label below', () => {
    render(meals);
    expect(element.querySelectorAll('rect.bar').length).toBe(3);
    expect(column('svg text.value')).toEqual(['27 g', '54 g', '45 g']);
    expect(column('svg text.meal')).toEqual(['Breakfast', 'Lunch', 'Dinner']);
  });

  it('quiets the bars other than lunch and dinner when asked to', () => {
    render(meals, true);
    const quiet = Array.from(element.querySelectorAll('rect.bar')).map((bar) => bar.classList.contains('quiet'));
    expect(quiet).toEqual([true, false, false]);
  });

  it('draws every bar in one green by default', () => {
    render(meals);
    expect(element.querySelectorAll('rect.bar.quiet').length).toBe(0);
  });

  it('lists the values in the text alternative', () => {
    render(meals);
    expect(element.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Protein on an average day, by meal. Breakfast 27 g, Lunch 54 g, Dinner 45 g.'
    );
  });

  it('writes the same meals as a list for narrow panels', () => {
    render(meals);
    expect(column('.meal-list .meal-name')).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    expect(column('.meal-list .meal-grams')).toEqual(['27 g', '54 g', '45 g']);
    const widths = Array.from(element.querySelectorAll<HTMLElement>('.meal-fill')).map((fill) => Math.round(parseFloat(fill.style.width)));
    expect(widths).toEqual([50, 100, 83]);
  });

  it('draws nothing without a meal', () => {
    render([]);
    expect(element.children.length).toBe(0);
  });
});
