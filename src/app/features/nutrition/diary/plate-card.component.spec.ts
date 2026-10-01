import { TestBed } from '@angular/core/testing';

import { DiaryItem } from './diary.models';
import { PlateCardComponent } from './plate-card.component';
import { item, spoken as text } from './diary-testing.spec';

const food = (group: DiaryItem['foodGroup'], grams: number | null, id = group ?? 'none'): DiaryItem =>
  item({ mealItemId: id + grams, foodGroup: group, gramsConsumed: grams });

describe('PlateCardComponent', () => {
  function render(items: DiaryItem[], isToday = true) {
    const fixture = TestBed.createComponent(PlateCardComponent);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('isToday', isToday);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const day = () => [food('VEG', 50), food('FRUIT', 300), food('DAIRY', 200), food('PROTEIN', 150), food('NUTS', 20), food('GRAINS', 240)];

  it('draws a wedge for each food group, with white icons in the wide ones, and the dashed balanced plate', () => {
    const element = render(day());
    expect(element.querySelectorAll('.wedge').length).toBe(6);
    expect(element.querySelectorAll('.icon').length).toBe(4);
    expect((element.querySelector('.icon') as SVGElement).getAttribute('stroke')).toBe('#ffffff');
    expect(element.querySelectorAll('.balanced line').length).toBe(2);
    expect(element.querySelectorAll('.cutlery').length).toBe(2);
  });

  it('says how heavy the food was and lists each group with its percentage', () => {
    const element = render(day());
    expect(text(element.querySelector('.grams'))).toBe('960 g of food, by weight');
    const legend = Array.from(element.querySelectorAll('.legend li')).map((row) => text(row));
    expect(legend).toEqual(['Vegetables 5%', 'Fruit 31%', 'Grains 25%', 'Protein 16%', 'Dairy 21%', 'Nuts and oils 2%']);
  });

  it('sets fruit and veg against half a plate in one sentence', () => {
    expect(text(render(day()).querySelector('.sentence'))).toBe('Fruit and veg were about 36% of what you ate, against the half on a balanced plate.');
  });

  it('counts the food groups eaten, names the one missing, and marks each badge', () => {
    const element = render(day());
    expect(text(element.querySelector('.badges-head strong'))).toBe('6 of 7 food groups today');
    expect(text(element.querySelector('.badges-head span'))).toBe('No beans yet');
    const badges = Array.from(element.querySelectorAll('.badges li'));
    expect(badges.map((badge) => text(badge.querySelector('.short')))).toEqual(['Veg', 'Fruit', 'Grains', 'Protein', 'Dairy', 'Nuts', 'Beans']);
    expect(badges.filter((badge) => badge.classList.contains('eaten')).length).toBe(6);
  });

  it('writes that day instead of today for another day', () => {
    const element = render(day(), false);
    expect(text(element.querySelector('.eyebrow'))).toBe("The day's plate");
    expect(text(element.querySelector('.badges-head strong'))).toBe('6 of 7 food groups that day');
  });

  it('leaves drinks off the plate', () => {
    const element = render([food('GRAINS', 100), food('DRINKS', 250)]);
    expect(element.querySelectorAll('.wedge').length).toBe(1);
    expect(element.querySelector('.left-out')).toBeNull();
  });

  it('says how many foods it could not weigh and leaves them off', () => {
    const element = render([food('GRAINS', 100), food('VEG', null), food('FRUIT', null)]);
    expect(element.querySelectorAll('.wedge').length).toBe(1);
    expect(text(element.querySelector('.left-out'))).toBe('2 foods are left off the plate because they have no weight or food group.');
  });

  it('says one food in the singular', () => {
    const element = render([food('GRAINS', 100), food('VEG', null)]);
    expect(text(element.querySelector('.left-out'))).toBe('1 food is left off the plate because it has no weight or food group.');
  });

  it('explains an empty day without drawing a plate or fake data', () => {
    const element = render([]);
    expect(text(element.querySelector('.empty'))).toBe('Nothing is logged yet, so there is no plate to draw.');
    expect(element.querySelector('app-plate-chart')).toBeNull();
    expect(element.querySelector('.badges')).toBeNull();
  });

  it('explains food that has no weight at all', () => {
    const element = render([food('VEG', null)]);
    expect(text(element.querySelector('.empty'))).toContain('has a weight and a food group');
    expect(element.querySelector('app-plate-chart')).toBeNull();
    expect(element.querySelector('.badges')).not.toBeNull();
  });

  it('draws a single group as a full circle', () => {
    const element = render([food('GRAINS', 100)]);
    expect(element.querySelectorAll('circle.wedge').length).toBe(1);
    expect(element.querySelector('.wedge')?.tagName.toLowerCase()).toBe('circle');
  });
});
