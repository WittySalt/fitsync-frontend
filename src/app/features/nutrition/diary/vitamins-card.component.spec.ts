import { TestBed } from '@angular/core/testing';

import { LOADING, Load, NutrientRow, NutrientSummary } from './diary.models';
import { NutrientPeriod, VitaminsCardComponent, coverageLine, focusLine, noVitaminData } from './vitamins-card.component';
import { nutrientRow, spoken as text } from './diary-testing.spec';

const row = (code: string, name: string, share: number, overrides: Partial<NutrientRow> = {}) =>
  nutrientRow({ code, displayName: name, share, averageAmount: share * 10, reference: 10, unit: 'mg', kind: 'MINERAL', met: share >= 1, ...overrides });

function summary(overrides: Partial<NutrientSummary> = {}): NutrientSummary {
  return {
    daysLogged: 5,
    referenceLabel: 'for a man aged 19 to 30',
    focusCodes: [],
    itemsLogged: null,
    itemsWithoutNutrients: null,
    nutrients: [
      row('VIT_D', 'Vitamin D', 0.34, { kind: 'VITAMIN', richestUsualFood: 'Salmon', unit: 'µg', reference: 15, averageAmount: 5.1 }),
      row('VIT_A', 'Vitamin A', 1.13, { kind: 'VITAMIN', aboveUpperLimit: true, upperLimit: 3000, unit: 'µg', reference: 900, averageAmount: 1017 }),
      row('VIT_E', 'Vitamin E', 0.61, { kind: 'VITAMIN' }),
      row('CALCIUM', 'Calcium', 0.71),
      row('IRON', 'Iron', 0.88),
      row('VIT_C', 'Vitamin C', 1.04, { kind: 'VITAMIN' })
    ],
    ...overrides
  };
}

describe('VitaminsCardComponent', () => {
  function render(state: Load<NutrientSummary>, period: NutrientPeriod = 'week') {
    const fixture = TestBed.createComponent(VitaminsCardComponent);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('period', period);
    fixture.detectChanges();
    return fixture;
  }
  const ready = (data: NutrientSummary): Load<NutrientSummary> => ({ status: 'ready', data });

  it('shows the three lowest large with a ring, the amount and the richest usual food', () => {
    const element = render(ready(summary())).nativeElement as HTMLElement;
    const lows = element.querySelectorAll('.low');
    expect(lows.length).toBe(3);
    expect(text(lows[0].querySelector('.low-head'))).toBe('Vitamin D 5.1 of 15 µg a day');
    expect(text(lows[0].querySelector('.words'))).toBe('The richest of the foods you often eat is salmon.');
    expect(text(lows[0].querySelector('.ring text'))).toBe('34%');
  });

  it('draws a nutrient above its upper limit with a dark grey ring and says so in words', () => {
    const element = render(ready(summary())).nativeElement as HTMLElement;
    const above = element.querySelectorAll('.low')[1];
    expect(text(above.querySelector('.words'))).toBe('Above the upper limit of 3,000 µg.');
    expect((above.querySelector('.arc') as SVGElement).style.stroke).toContain('--text-secondary');
    const vitamin = element.querySelectorAll('.low')[0].querySelector('.arc') as SVGElement;
    expect(vitamin.style.stroke).toContain('--food-fruit');
  });

  it('shows the rest as chips, with a tick on the ones that are met', () => {
    const element = render(ready(summary())).nativeElement as HTMLElement;
    const chips = Array.from(element.querySelectorAll('.chip'));
    expect(chips.map((chip) => text(chip.querySelector('.chip-head')))).toEqual(['Calcium 71%', 'Iron 88%', 'Vitamin C 104%']);
    expect(chips[2].querySelector('.met')).not.toBeNull();
    expect(chips[0].querySelector('.met')).toBeNull();
  });

  it('says whose daily amounts these are', () => {
    const element = render(ready(summary())).nativeElement as HTMLElement;
    expect(text(element.querySelector('.note'))).toBe('Lowest first. Daily amounts for a man aged 19 to 30, from the US National Institutes of Health.');
    const unknown = render(ready(summary({ referenceLabel: null }))).nativeElement as HTMLElement;
    expect(text(unknown.querySelector('.note'))).toBe('Lowest first. Daily amounts are from the US National Institutes of Health.');
  });

  it('switches between 7 days and Today', () => {
    const fixture = render(ready(summary()));
    const buttons = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.toggle button'));
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['7 days', 'Today']);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    buttons[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.period()).toBe('today');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('says which nutrients are watched first for a vegetarian', () => {
    const watched = summary({
      focusCodes: ['VIT_B12', 'IRON', 'ZINC'],
      nutrients: [row('VIT_B12', 'Vitamin B12', 0.4, { kind: 'VITAMIN' }), row('IRON', 'Iron', 0.6), row('ZINC', 'Zinc', 0.7), row('VIT_C', 'Vitamin C', 1.2)]
    });
    const element = render(ready(watched)).nativeElement as HTMLElement;
    expect(text(element.querySelector('.focus'))).toBe('Vitamin B12, iron and zinc are watched first.');
  });

  it('says how much logged food has no vitamin data', () => {
    const element = render(ready(summary({ itemsLogged: 20, itemsWithoutNutrients: 4 }))).nativeElement as HTMLElement;
    expect(text(element.querySelector('.coverage'))).toBe('4 of 20 logged foods have no vitamin data, so these amounts may be low.');
    expect((render(ready(summary({ itemsLogged: 20, itemsWithoutNutrients: 0 }))).nativeElement as HTMLElement).querySelector('.coverage')).toBeNull();
    expect((render(ready(summary())).nativeElement as HTMLElement).querySelector('.coverage')).toBeNull();
  });

  it('replaces the rings and chips with one sentence when no logged food has vitamin data', () => {
    const element = render(ready(summary({ itemsLogged: 8, itemsWithoutNutrients: 8 }))).nativeElement as HTMLElement;
    expect(text(element.querySelector('.empty'))).toBe('None of the foods logged in these 7 days have vitamin data yet.');
    expect(element.querySelector('.low')).toBeNull();
    expect(element.querySelector('.chip')).toBeNull();
    expect(element.querySelector('.coverage')).toBeNull();
    expect(element.textContent).not.toContain('0%');
  });

  it('says today for the Today toggle, and also when every amount is null', () => {
    const nulls = summary({ nutrients: [row('IRON', 'Iron', 0, { averageAmount: null, share: null })] });
    const element = render(ready(nulls), 'today').nativeElement as HTMLElement;
    expect(text(element.querySelector('.empty'))).toBe('None of the foods logged today have vitamin data yet.');
  });

  it('keeps the rings with the coverage sentence when only some foods have no data, leaving out an unknown nutrient', () => {
    const partial = summary({
      itemsLogged: 8,
      itemsWithoutNutrients: 3,
      nutrients: [...summary().nutrients, row('ZINC', 'Zinc', 0, { averageAmount: null, share: null })]
    });
    const element = render(ready(partial)).nativeElement as HTMLElement;
    expect(element.querySelectorAll('.low').length).toBe(3);
    expect(text(element.querySelector('.coverage'))).toContain('3 of 8 logged foods');
    expect(element.textContent).not.toContain('Zinc');
  });

  it('asks the person to log food when nothing was logged', () => {
    const element = render(ready(summary({ daysLogged: 0, nutrients: [] }))).nativeElement as HTMLElement;
    expect(text(element.querySelector('.empty'))).toBe('Log some food to see your vitamins and minerals.');
    expect(element.querySelector('.lows')).toBeNull();
  });

  it('shows a skeleton while loading, and keeps the toggle', () => {
    const element = render(LOADING).nativeElement as HTMLElement;
    expect(element.querySelector('.skeleton')).not.toBeNull();
    expect(element.querySelector('.toggle')).not.toBeNull();
  });

  it('shows an error with Retry when it fails', () => {
    const fixture = render({ status: 'error', message: 'Vitamins and minerals could not load. Please retry.' });
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => (retried += 1));
    expect(text(fixture.nativeElement.querySelector('app-state-panel'))).toContain('could not load');
    (fixture.nativeElement.querySelector('app-state-panel button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });
});

describe('noVitaminData', () => {
  it('is true when every logged food lacks data or every amount is null, and false otherwise', () => {
    expect(noVitaminData(summary({ itemsLogged: 5, itemsWithoutNutrients: 5 }))).toBeTrue();
    expect(noVitaminData(summary({ itemsLogged: 5, itemsWithoutNutrients: 2 }))).toBeFalse();
    expect(noVitaminData(summary({ itemsLogged: 0, itemsWithoutNutrients: 0 }))).toBeFalse();
    expect(noVitaminData(summary({ nutrients: [row('IRON', 'Iron', 0, { averageAmount: null, share: null })] }))).toBeTrue();
    expect(noVitaminData(summary())).toBeFalse();
  });
});

describe('focusLine and coverageLine', () => {
  it('says is for one nutrient and are for several', () => {
    const one = summary({ focusCodes: ['IRON'], nutrients: [row('IRON', 'Iron', 0.5)] });
    expect(focusLine(one)).toBe('Iron is watched first.');
    expect(focusLine(summary())).toBe('');
  });

  it('writes the coverage without a total when the total is not known', () => {
    expect(coverageLine(summary({ itemsLogged: null, itemsWithoutNutrients: 3 }))).toBe('3 logged foods have no vitamin data, so these amounts may be low.');
  });
});
