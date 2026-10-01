import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FrequentDrink, WaterDay } from './diary.models';
import { WaterCardComponent } from './water-card.component';
import { item, waterDay, spoken as text } from './diary-testing.spec';

const latte: FrequentDrink = { name: 'Latte', calories: 110, draft: item().draft };

describe('WaterCardComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function render(day: WaterDay, options: { goal?: number | null; frequent?: FrequentDrink[]; now?: number | null } = {}) {
    const fixture = TestBed.createComponent(WaterCardComponent);
    fixture.componentRef.setInput('day', day);
    fixture.componentRef.setInput('goal', options.goal === undefined ? 2000 : options.goal);
    fixture.componentRef.setInput('frequent', options.frequent ?? []);
    fixture.componentRef.setInput('nowPercent', options.now ?? null);
    fixture.detectChanges();
    return fixture;
  }

  const day = () =>
    waterDay({
      totalMl: 1000,
      fromDrinksMl: 250,
      entries: [{ waterId: 'w1', amountMl: 500, loggedAt: new Date(2026, 9, 2, 11, 45).toISOString() }],
      drinkEntries: [{ mealItemId: 'i1', mealId: 'm1', foodName: 'Latte', waterMl: 250, consumedAt: new Date(2026, 9, 2, 7, 40).toISOString() }]
    });

  it('shows the total against the goal and the two parts of the bar', () => {
    const element = render(day()).nativeElement as HTMLElement;
    expect(text(element.querySelector('.total'))).toBe('1,250 of 2,000 ml');
    expect(parseFloat((element.querySelector('.plain') as HTMLElement).style.width)).toBe(50);
    expect(parseFloat((element.querySelector('.drinks') as HTMLElement).style.width)).toBe(12.5);
    expect(text(element.querySelector('.key'))).toContain('1,000 ml water');
    expect(text(element.querySelector('.key'))).toContain('250 ml from drinks');
    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1250');
  });

  it('draws a dot on the timeline for each drink and each water entry', () => {
    const element = render(day(), { now: 60 }).nativeElement as HTMLElement;
    expect(element.querySelectorAll('.mark').length).toBe(2);
    expect(element.querySelectorAll('.mark.drink').length).toBe(1);
    expect(element.querySelector('.elapsed')).not.toBeNull();
    expect(element.querySelector('.ticks')?.textContent).toContain('22:00');
  });

  it('shows no progress bar without a goal, only the total in ml', () => {
    const element = render(day(), { goal: null }).nativeElement as HTMLElement;
    expect(element.querySelector('[role="progressbar"]')).toBeNull();
    expect(text(element.querySelector('.total'))).toBe('1,250 ml');
  });

  it('offers a quiet link to the settings page to set a goal, only while there is none', () => {
    const link = (render(day(), { goal: null }).nativeElement as HTMLElement).querySelector('a.set');
    expect(link?.textContent?.trim()).toBe('Set a daily goal');
    expect(link?.getAttribute('href')).toBe('/settings');
    expect((render(day()).nativeElement as HTMLElement).querySelector('a.set')).toBeNull();
  });

  it('leaves out the drinks part when the backend does not report it', () => {
    const element = render(waterDay({ totalMl: 500, fromDrinksMl: null })).nativeElement as HTMLElement;
    expect(element.querySelector('.key')?.textContent).not.toContain('from drinks');
    expect(parseFloat((element.querySelector('.drinks') as HTMLElement).style.width)).toBe(0);
  });

  it('has a glass, a bottle and the two most frequent drinks as one-tap buttons', () => {
    const fixture = render(day(), { frequent: [latte, { name: 'Green tea', calories: 0, draft: item().draft }] });
    const element = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('.quick button'));
    expect(buttons.map((button) => button.querySelector('strong')?.textContent)).toEqual(['Glass', 'Bottle', 'Latte', 'Green tea']);
    expect(buttons.map((button) => button.querySelector('.words span')?.textContent)).toEqual(['250 ml', '500 ml', '110 kcal', '0 kcal']);
  });

  it('emits what each button stands for', () => {
    const fixture = render(day(), { frequent: [latte] });
    const element = fixture.nativeElement as HTMLElement;
    const seen: string[] = [];
    fixture.componentInstance.glass.subscribe(() => seen.push('glass'));
    fixture.componentInstance.bottle.subscribe(() => seen.push('bottle'));
    fixture.componentInstance.quickDrink.subscribe((drink) => seen.push(drink.name));
    fixture.componentInstance.another.subscribe(() => seen.push('another'));
    element.querySelectorAll<HTMLButtonElement>('.quick button').forEach((button) => button.click());
    (element.querySelector('.another') as HTMLButtonElement).click();
    expect(seen).toEqual(['glass', 'bottle', 'Latte', 'another']);
  });

  it('disables the buttons while a save is under way', () => {
    const fixture = TestBed.createComponent(WaterCardComponent);
    fixture.componentRef.setInput('day', day());
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    const disabled = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).every((button) => button.disabled);
    expect(disabled).toBeTrue();
  });
});
