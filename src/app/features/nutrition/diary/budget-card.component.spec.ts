import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BudgetCardComponent } from './budget-card.component';
import { summary } from './diary-testing.spec';
import { DiarySummary } from './diary.models';

/** The text of an element's children joined with a space, the way the pieces read one after another. */
function spoken(element: Element | null | undefined): string {
  return Array.from(element?.children ?? []).map((child) => child.textContent?.trim()).join(' ');
}

describe('BudgetCardComponent', () => {
  function render(value: DiarySummary, label = 'Today') {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(BudgetCardComponent);
    fixture.componentRef.setInput('summary', value);
    fixture.componentRef.setInput('label', label);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the eaten calories as the big number with what is left', () => {
    const element = render(summary({ totalCalories: 1500, targetCalories: 2100 }));
    expect(element.querySelector('.eaten strong')?.textContent).toBe('1,500');
    expect(element.querySelector('.line')?.textContent).toBe('600 kcal left');
    expect(element.querySelector('.percent')?.textContent).toBe('71%');
    expect(element.querySelector('.of')?.textContent).toBe('of 2,100');
    expect(element.querySelector('.beyond')).toBeNull();
  });

  it('says kcal over and draws the part over the target as its own arc, never in red', () => {
    const element = render(summary({ totalCalories: 2400, targetCalories: 2000 }));
    const line = element.querySelector('.line') as HTMLElement;
    expect(line.textContent).toBe('400 kcal over');
    expect(line.classList.contains('over')).toBeTrue();
    expect(element.querySelector('.beyond')).not.toBeNull();
  });

  it('uses the label given for another day', () => {
    expect(render(summary(), 'Thursday 1 Oct').querySelector('.eyebrow')?.textContent).toBe('Thursday 1 Oct');
  });

  it('offers to set a target instead of a ring when there is none', () => {
    const element = render(summary({ targetCalories: null }));
    expect(element.querySelector('.ring')).toBeNull();
    expect(element.querySelector('.set')?.textContent).toContain('Set a daily calorie target');
  });

  it('shows protein, carbs and fat with bars in their own colours', () => {
    const element = render(summary());
    const rows = Array.from(element.querySelectorAll('.macro')).map((row) => spoken(row.querySelector('.macro-head')));
    expect(rows).toEqual(['Protein 87 of 140 g', 'Carbs 158 of 236 g', 'Fat 36 of 70 g']);
    const bars = element.querySelectorAll<HTMLElement>('.bar span');
    expect(bars.length).toBe(3);
    expect(bars[0].style.background).toContain('--food-protein');
  });

  it('shows only the eaten grams, with no bar, for a macro without a goal', () => {
    const element = render(summary({ targetFatGrams: null }));
    const fat = element.querySelectorAll('.macro')[2];
    expect(spoken(fat.querySelector('.macro-head'))).toBe('Fat 36 g');
    expect(fat.querySelector('.bar')).toBeNull();
  });
});
