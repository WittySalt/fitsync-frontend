import { TestBed } from '@angular/core/testing';

import { BalanceCardComponent } from './balance-card.component';
import { BalanceEntry, ProteinByMealView, RangeDay } from './diary.models';
import { balanceEntry, rangeDay, spoken as text } from './diary-testing.spec';
import { weekOf } from './diary-time';

const TODAY = '2026-10-02';
const DATES = weekOf(TODAY);
const sources = (...names: string[]) => names.map((foodName) => ({ foodName, amount: 1 }));

const entries: BalanceEntry[] = [
  balanceEntry({ topSources: sources('Apple', 'Granola', 'Banana') }),
  balanceEntry({ code: 'POTASSIUM', displayName: 'Potassium', amount: 1860, unit: 'mg', reference: 3400, share: 0.55, topSources: sources('Banana') }),
  balanceEntry({ code: 'SUGAR', displayName: 'Sugar', kind: 'LIMIT', amount: 54, reference: 50, share: 1.08, over: true, topSources: sources('Fruit', 'Granola') }),
  balanceEntry({ code: 'SAT_FAT', displayName: 'Saturated fat', kind: 'LIMIT', amount: 11, reference: 22, share: 0.5 }),
  balanceEntry({ code: 'SODIUM', displayName: 'Sodium', kind: 'LIMIT', amount: 1240, unit: 'mg', reference: 2300, share: 0.54 })
];
const protein: ProteinByMealView = { weightKg: 72, lowGrams: 22, highGrams: 29, meals: [{ mealType: 'BREAKFAST', grams: 25 }, { mealType: 'LUNCH', grams: 51 }] };
const week: RangeDay[] = [
  rangeDay('2026-09-28', { fiberMet: true, sugarWithin: true }),
  rangeDay('2026-09-29', { fiberMet: false, sugarWithin: false })
];

describe('BalanceCardComponent', () => {
  function render(options: { entries?: BalanceEntry[]; protein?: ProteinByMealView | null; days?: RangeDay[] } = {}) {
    const fixture = TestBed.createComponent(BalanceCardComponent);
    fixture.componentRef.setInput('entries', options.entries ?? entries);
    fixture.componentRef.setInput('proteinByMeal', options.protein === undefined ? protein : options.protein);
    fixture.componentRef.setInput('days', options.days ?? week);
    fixture.componentRef.setInput('dates', DATES);
    fixture.componentRef.setInput('today', TODAY);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('has three parts: aim for, keep under, and through the day', () => {
    const element = render();
    const heads = Array.from(element.querySelectorAll('.section-head strong')).map((node) => node.textContent);
    expect(heads).toEqual(['Aim for', 'Keep under']);
    expect(text(element.querySelector('.eyebrow.muted'))).toBe('Through the day');
    expect(element.querySelector('app-protein-chart')).not.toBeNull();
  });

  it('puts fibre and potassium under aim for and sugar, saturated fat and sodium under keep under', () => {
    const sections = Array.from(render().querySelectorAll('section'));
    const names = (section: Element) => Array.from(section.querySelectorAll('app-balance-row .label strong:first-child')).map((node) => node.textContent);
    expect(names(sections[0])).toEqual(['Fibre', 'Potassium']);
    expect(names(sections[1])).toEqual(['Sugar', 'Saturated fat', 'Sodium']);
  });

  it('says there is no data for a nutrient with no amount, with no bar and the week dots not yet', () => {
    const unknown = balanceEntry({ amount: null, share: null });
    const element = render({ entries: [unknown], days: [rangeDay('2026-09-28', { fiberMet: null }), rangeDay('2026-09-29', { fiberMet: null })] });
    const row = element.querySelector('app-balance-row') as HTMLElement;
    expect(text(row.querySelector('.unknown'))).toBe('No data for these foods yet.');
    expect(row.querySelector('.bar')).toBeNull();
    expect(text(row.querySelector('.label'))).toBe('Fibre');
    const dots = Array.from(row.querySelectorAll('.dots i'));
    expect(dots.length).toBe(7);
    expect(dots.every((dot) => !dot.classList.contains('on') && !dot.classList.contains('missed'))).toBeTrue();
  });

  it('reads the dot legend and says the dots are this week', () => {
    const element = render();
    expect(text(element.querySelector('.key'))).toBe('on target missed not yet');
    expect(text(element.querySelector('.aside'))).toBe('dots are this week');
  });

  it('shows a source line, the reference and the potassium kidney sentence', () => {
    const element = render();
    const rows = element.querySelectorAll('app-balance-row');
    expect(text(rows[0].querySelector('.foot'))).toBe('Mostly from apple, granola and banana. 28 g a day');
    expect(text(element.querySelector('.note'))).toContain('safe for healthy kidneys');
  });

  it('marks a limit that was passed with over in words and a line at the limit', () => {
    const rows = render().querySelectorAll('app-balance-row');
    const sugar = rows[2];
    expect(text(sugar.querySelector('.label'))).toBe('Sugar 54 g · over');
    expect(sugar.querySelector('.marker')).not.toBeNull();
    expect(sugar.querySelector('.bar')?.classList.contains('limit')).toBeTrue();
    expect(rows[3].querySelector('.marker')).toBeNull();
  });

  it('ticks a target that was reached and says the share', () => {
    const reached = [balanceEntry({ amount: 31, share: 31 / 28, met: true })];
    const element = render({ entries: reached });
    expect(text(element.querySelector('.met'))).toBe('met · 111%');
  });

  it('draws the week dots from the range, leaving today and the days ahead not yet', () => {
    const rows = render().querySelectorAll('app-balance-row');
    const fibre = Array.from(rows[0].querySelectorAll('.dots i')).map((dot) => (dot.classList.contains('on') ? 'on' : dot.classList.contains('missed') ? 'missed' : 'none'));
    expect(fibre).toEqual(['on', 'missed', 'none', 'none', 'none', 'none', 'none']);
    expect(rows[0].querySelector('.dots')?.getAttribute('aria-label')).toContain('on target, missed, not yet');
  });

  it('shows protein at each meal with the personal band', () => {
    const element = render();
    expect(text(element.querySelector('app-protein-chart .head'))).toBe('Protein at each meal 22 to 29 g a meal');
    const values = Array.from(element.querySelectorAll('app-protein-chart .value')).map((node) => node.textContent);
    expect(values).toEqual(['25 g', '51 g', 'None', 'None']);
    expect(element.querySelectorAll('app-protein-chart .bar').length).toBe(2);
  });

  it('leaves out the parts the backend sent nothing for', () => {
    const element = render({ entries: [entries[0]], protein: null });
    expect(element.querySelector('.eyebrow.muted')).toBeNull();
    expect(element.querySelectorAll('.section-head').length).toBe(1);
    expect(element.querySelector('.note')).toBeNull();
  });
});
