import { TestBed } from '@angular/core/testing';

import { LOADING, Load, NutrientDay, NutrientRow, NutrientSummary } from './diary.models';
import { VitaminsCardComponent } from './vitamins-card.component';
import { nutrientRow, spoken as text } from './diary-testing.spec';
import { weekRange } from './vitamins-week';

const TODAY = '2026-10-02';
const WEEK = weekRange(TODAY).dates;

const row = (code: string, name: string, share: number | null, overrides: Partial<NutrientRow> = {}) =>
  nutrientRow({ code, displayName: name, share, averageAmount: share === null ? null : share * 10, reference: 10, unit: 'mg', kind: 'MINERAL', met: (share ?? 0) >= 1, ...overrides });

const days = (shares: (number | null)[]): NutrientDay[] => shares.map((share, index) => ({ date: WEEK[index], logged: share !== null, amount: share, share }));

function summary(overrides: Partial<NutrientSummary> = {}): NutrientSummary {
  return {
    daysLogged: 5,
    referenceLabel: 'for a man aged 19 to 30',
    focusCodes: [],
    itemsLogged: null,
    itemsWithoutNutrients: null,
    nutrients: [
      row('VIT_D', 'Vitamin D', 0.34, { kind: 'VITAMIN', richestUsualFood: 'Salmon', unit: 'µg', reference: 15, averageAmount: 5.1 }),
      row('VIT_A', 'Vitamin A', 1.13, { kind: 'VITAMIN', unit: 'µg', reference: 900, averageAmount: 1017 }),
      row('VIT_E', 'Vitamin E', 0.61, { kind: 'VITAMIN' }),
      row('CALCIUM', 'Calcium', 0.71),
      row('IRON', 'Iron', 0.88),
      row('VIT_C', 'Vitamin C', 1.04, { kind: 'VITAMIN' })
    ],
    ...overrides
  };
}

const weekSummary = (): NutrientSummary =>
  summary({
    nutrients: [
      row('IRON', 'Iron', 1.5, { days: days([1.6, 1.9, 1.7, 2, 1.1]) }),
      row('VIT_D', 'Vitamin D', 0.3, { kind: 'VITAMIN', richestUsualFood: 'Salmon', days: days([0.3, 0.25, 0.48, 0.37, 0.2]) }),
      row('ZINC', 'Zinc', 0.8, { days: days([0.9, null, 0.8, 1, null]) })
    ]
  });

describe('VitaminsCardComponent', () => {
  const ready = (data: NutrientSummary): Load<NutrientSummary> => ({ status: 'ready', data });

  function render(today: Load<NutrientSummary>, week: Load<NutrientSummary> = ready(weekSummary()), date = TODAY) {
    const fixture = TestBed.createComponent(VitaminsCardComponent);
    fixture.componentRef.setInput('state', today);
    fixture.componentRef.setInput('week', week);
    fixture.componentRef.setInput('date', date);
    fixture.componentRef.setInput('today', TODAY);
    fixture.detectChanges();
    return fixture;
  }
  const el = (fixture: { nativeElement: unknown }): HTMLElement => fixture.nativeElement as HTMLElement;

  describe('the switch', () => {
    it('has Today and This week, starts on Today, and keeps both views in one stack', () => {
      const fixture = render(ready(summary()));
      const buttons = Array.from<HTMLButtonElement>(el(fixture).querySelectorAll('.switch button'));
      expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Today', 'This week']);
      expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
      expect(el(fixture).querySelector('.view.today.shown')).not.toBeNull();
      expect(el(fixture).querySelector('.view.week.shown')).toBeNull();
      expect(el(fixture).querySelector('.view.week app-vitamins-week')).not.toBeNull();
    });

    it('moves to the week without loading anything', () => {
      const fixture = render(ready(summary()));
      (el(fixture).querySelectorAll('.switch button')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el(fixture).querySelector('.view.week.shown')).not.toBeNull();
      expect(el(fixture).querySelector('.view.today.shown')).toBeNull();
      expect(el(fixture).querySelectorAll('.switch button')[1].getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('Today', () => {
    it('shows the three lowest that are not met large, with the amount so far and the richest usual food', () => {
      const lows = el(render(ready(summary()))).querySelectorAll('.low');
      expect(lows.length).toBe(3);
      expect(text(lows[0].querySelector('.low-head'))).toBe('Vitamin D 5.1 of 15 µg so far');
      expect(text(lows[0].querySelector('.words'))).toBe('Among foods you often eat, salmon has the most.');
      expect(text(lows[0].querySelector('.ring text'))).toBe('34%');
      expect((lows[0].querySelector('.arc') as SVGElement).style.stroke).toContain('--food-fruit');
    });

    it('leaves out so far for a past day', () => {
      const element = el(render(ready(summary()), ready(weekSummary()), '2026-10-01'));
      expect(text(element.querySelector('.low-head'))).toBe('Vitamin D 5.1 of 15 µg');
      expect(text(element.querySelector('.view.today .note'))).toContain('Lowest first among those not yet reached.');
    });

    it('puts met nutrients and the fourth short one in The rest, with a tick on the met ones', () => {
      const chips = Array.from(el(render(ready(summary()))).querySelectorAll('.chip'));
      expect(chips.map((chip) => text(chip.querySelector('.chip-head')))).toEqual(['Vitamin A 113%', 'Iron 88%', 'Vitamin C 104%']);
      expect(chips[0].querySelector('.met')).not.toBeNull();
      expect(chips[1].querySelector('.met')).toBeNull();
    });

    it('says one sentence instead of the rings when nothing is short', () => {
      const element = el(render(ready(summary({ nutrients: [row('IRON', 'Iron', 1.2), row('VIT_C', 'Vitamin C', 1)] }))));
      expect(text(element.querySelector('.reached'))).toBe('Every vitamin and mineral here is reached today.');
      expect(element.querySelector('.low')).toBeNull();
      expect(element.querySelectorAll('.chip').length).toBe(2);
    });

    it('leaves an unknown nutrient out and keeps the coverage sentence', () => {
      const partial = summary({ itemsLogged: 8, itemsWithoutNutrients: 3, nutrients: [...summary().nutrients, row('ZINC', 'Zinc', null)] });
      const element = el(render(ready(partial)));
      expect(text(element.querySelector('.view.today .coverage'))).toContain('3 of 8 logged foods');
      expect(text(element.querySelector('.view.today'))).not.toContain('Zinc');
    });

    it('names the nutrients watched first and whose amounts these are', () => {
      const element = el(render(ready(summary({ focusCodes: ['VIT_D', 'IRON'] }))));
      expect(text(element.querySelector('.focus'))).toBe('Vitamin D and iron are watched first.');
      expect(text(element.querySelector('.view.today .note'))).toBe(
        'Today so far, lowest first among those not yet reached. Daily amounts for a man aged 19 to 30, from the US National Institutes of Health.'
      );
    });

    it('says no vitamin data when no logged food has any, and asks to log food when nothing was logged', () => {
      const none = el(render(ready(summary({ itemsLogged: 8, itemsWithoutNutrients: 8 }))));
      expect(text(none.querySelector('.view.today .empty'))).toBe('None of the foods logged today have vitamin data yet.');
      expect(none.querySelector('.view.today .low')).toBeNull();
      const nulls = el(render(ready(summary({ nutrients: [row('IRON', 'Iron', null)] }))));
      expect(text(nulls.querySelector('.view.today .empty'))).toContain('have vitamin data yet');
      const nothing = el(render(ready(summary({ daysLogged: 0, nutrients: [] }))));
      expect(text(nothing.querySelector('.view.today .empty'))).toBe('Log some food to see your vitamins and minerals.');
    });
  });

  describe('This week', () => {
    const week = (fixture = render(ready(summary()))) => el(fixture).querySelector('.view.week') as HTMLElement;

    it('draws one row per nutrient, lowest average first, with seven squares and the average', () => {
      const rows = Array.from(week().querySelectorAll('.grid .line')).slice(1);
      expect(rows.map((line) => text(line.querySelector('.name')))).toEqual(['Vitamin D', 'Zinc', 'Iron']);
      expect(rows[0].querySelectorAll('.sq').length).toBe(7);
      expect(text(rows[0].querySelector('.value'))).toBe('35%');
      expect(text(rows[2].querySelector('.value'))).toBe('180%');
      expect(rows[2].querySelector('.value.met')).not.toBeNull();
      expect(text(week().querySelector('.grid .line .avg'))).toBe('Avg');
    });

    it('colours vitamins and minerals differently, ticks a reached day, outlines today and dashes the empty days', () => {
      const lines = Array.from(week().querySelectorAll('.grid .line')).slice(1);
      const vitamin = lines[0].querySelectorAll('.sq');
      const mineral = lines[2].querySelectorAll('.sq');
      expect((vitamin[0] as HTMLElement).style.background).toContain('--food-fruit');
      expect((mineral[0] as HTMLElement).style.background).toContain('--food-dairy');
      expect(mineral[0].querySelector('app-food-glyph')).not.toBeNull();
      expect(vitamin[0].querySelector('app-food-glyph')).toBeNull();
      expect(vitamin[4].classList).toContain('today');
      expect(vitamin[5].classList).toContain('empty');
      expect(vitamin[6].classList).toContain('empty');
      expect(lines[1].querySelectorAll('.sq')[1].classList).toContain('empty');
      expect(vitamin[0].getAttribute('aria-label')).toBe('Vitamin D, Monday: 30% of the daily amount');
    });

    it('has the legend, the pattern sentence for the lowest nutrient and the note', () => {
      const element = week();
      expect(text(element.querySelector('.legend'))).toBe('none full day reached today');
      expect(text(element.querySelector('.pattern'))).toBe('Vitamin D was short on every day this week. Among foods you often eat, salmon has the most.');
      expect(text(element.querySelector('.note'))).toBe(
        '28 Sept to 4 Oct. The average counts Monday to Thursday; today joins it tomorrow. Daily amounts for a man aged 19 to 30, from the US National Institutes of Health.'
      );
    });

    it('shows the week of the selected day even when another day of it is selected', () => {
      const element = week(render(ready(summary()), ready(weekSummary()), '2026-09-29'));
      expect(text(element.querySelector('.note'))).toContain('28 Sept to 4 Oct. The average counts Monday to Thursday;');
    });

    it('says when the week has no logged food or no vitamin data', () => {
      const nothing = week(render(ready(summary()), ready(summary({ daysLogged: 0, nutrients: [] }))));
      expect(text(nothing.querySelector('.empty'))).toBe('Log some food to see your vitamins and minerals.');
      const none = week(render(ready(summary()), ready(summary({ itemsLogged: 4, itemsWithoutNutrients: 4 }))));
      expect(text(none.querySelector('.empty'))).toBe('None of the foods logged this week have vitamin data yet.');
      expect(none.querySelector('.grid')).toBeNull();
    });

    it('shows a dash for the average of a nutrient with no counted day', () => {
      const early = summary({ nutrients: [row('IRON', 'Iron', 0.5, { days: [{ date: TODAY, logged: true, amount: 5, share: 0.5 }] })] });
      const element = week(render(ready(summary()), ready(early)));
      expect(text(element.querySelectorAll('.grid .line')[1].querySelector('.value'))).toBe('–');
      expect(element.querySelector('.pattern')).toBeNull();
    });
  });

  describe('loading and failing', () => {
    it('shows a skeleton in a view that is loading and keeps the switch', () => {
      const element = el(render(LOADING, LOADING));
      expect(element.querySelectorAll('.skeleton').length).toBe(2);
      expect(element.querySelector('.switch')).not.toBeNull();
    });

    it('shows an error with Retry in the view that failed, and Retry asks the page to reload', () => {
      const fixture = render({ status: 'error', message: 'Vitamins and minerals could not load. Please retry.' }, ready(weekSummary()));
      let retried = 0;
      fixture.componentInstance.retry.subscribe(() => (retried += 1));
      const panel = el(fixture).querySelector('.view.today app-state-panel') as HTMLElement;
      expect(text(panel)).toContain('could not load');
      expect(el(fixture).querySelector('.view.week app-state-panel')).toBeNull();
      (panel.querySelector('button') as HTMLButtonElement).click();
      expect(retried).toBe(1);
    });
  });
});
