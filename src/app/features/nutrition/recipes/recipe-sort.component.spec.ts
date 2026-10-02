import { TestBed } from '@angular/core/testing';

import { RecipeSortComponent } from './recipe-sort.component';

describe('RecipeSortComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(RecipeSortComponent);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('offers the three sorts, marks the one in use and reports a choice', () => {
    const fixture = render({ value: 'fit' });
    const chosen: string[] = [];
    fixture.componentInstance.chosen.subscribe((key) => chosen.push(key));
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Fits today', 'A to Z', 'Most protein']);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    buttons[2].click();
    expect(chosen).toEqual(['protein']);
  });

  it('leaves Fits today out while the server cannot sort that way', () => {
    const fixture = render({ value: 'name', fitOffered: false });
    const labels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map((button) => button.textContent?.trim());
    expect(labels).toEqual(['A to Z', 'Most protein']);
  });

  it('shows the line under the sort only when there is one', () => {
    const fixture = render({ value: 'fit' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.why')).toBeNull();
    fixture.componentRef.setInput('line', { lead: '950 kcal left today', rest: ', protein 41 g short. Recipes that fit come first.' });
    fixture.detectChanges();
    expect(el.querySelector('.why')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('950 kcal left today, protein 41 g short. Recipes that fit come first.');
    expect(el.querySelector('.why strong')?.textContent).toBe('950 kcal left today');
  });
});
