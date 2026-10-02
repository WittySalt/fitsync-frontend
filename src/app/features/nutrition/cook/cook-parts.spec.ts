import { TestBed } from '@angular/core/testing';

import { CookAddNowComponent } from './cook-add-now.component';
import { CookAlertComponent, alertAction, alertText } from './cook-alert.component';
import { CookAlsoTimingComponent, TimingChip } from './cook-also-timing.component';
import { CookBannerComponent } from './cook-banner.component';
import { CookIngredientsComponent } from './cook-ingredients.component';
import { CookSegmentsComponent } from './cook-segments.component';
import { CookStepsComponent } from './cook-steps.component';
import { CookIngredient, CookStep } from './cook.models';

function ingredient(id: string, name: string, grams: number | null, group: CookIngredient['foodGroup'] = 'PROTEIN'): CookIngredient {
  return { id, name, displayText: `${name} as written`, grams, foodGroup: group, categoryCode: null };
}

const steps: CookStep[] = [1, 2, 3].map((n) => ({ number: n, text: `Text ${n}.`, title: `Title ${n}.`, ingredientIds: [], timer: null }));

describe('cook mode parts', () => {
  it('lists the steps as done, now and next, and jumps on click', () => {
    const fixture = TestBed.createComponent(CookStepsComponent);
    fixture.componentRef.setInput('steps', steps);
    fixture.componentRef.setInput('current', 1);
    const jumped: number[] = [];
    fixture.componentInstance.jumped.subscribe((i) => jumped.push(i));
    fixture.detectChanges();
    const items = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li'));
    expect(items.map((li) => li.className)).toEqual(['done', 'now', 'next']);
    expect(items[0].querySelector('app-food-glyph')).not.toBeNull();
    expect(items[1].querySelector('button')?.getAttribute('aria-current')).toBe('step');
    expect(items[2].textContent).toContain('Title 3.');
    items[2].querySelector('button')?.click();
    expect(jumped).toEqual([2]);
  });

  it('counts used ingredients and scales the grams', () => {
    const fixture = TestBed.createComponent(CookIngredientsComponent);
    fixture.componentRef.setInput('ingredients', [ingredient('a', 'Salmon', 200), ingredient('b', 'Oil', null), ingredient('c', 'Lime', 5)]);
    fixture.componentRef.setInput('used', new Set(['a']));
    fixture.componentRef.setInput('factor', 0.5);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.count')?.textContent).toBe('1 of 3 used');
    expect(Array.from(el.querySelectorAll('.grams')).map((n) => n.textContent)).toEqual(['100 g', '2.5 g']);
    expect(el.querySelectorAll('li.used').length).toBe(1);
  });

  it('leaves the heading out when bare', () => {
    const fixture = TestBed.createComponent(CookIngredientsComponent);
    fixture.componentRef.setInput('ingredients', [ingredient('a', 'Salmon', 200)]);
    fixture.componentRef.setInput('used', new Set<string>());
    fixture.componentRef.setInput('bare', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.head')).toBeNull();
    expect(el.querySelectorAll('li').length).toBe(1);
  });

  it('shows a plain list without a count when no step has ingredients', () => {
    const fixture = TestBed.createComponent(CookIngredientsComponent);
    fixture.componentRef.setInput('ingredients', [ingredient('a', 'Salmon', 200)]);
    fixture.componentRef.setInput('used', new Set<string>());
    fixture.componentRef.setInput('assigned', false);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.count')?.textContent).toBe('1 ingredient');
    expect(el.querySelectorAll('li.used').length).toBe(0);
  });

  it('shows what to add now with scaled grams, falling back to the written line', () => {
    const fixture = TestBed.createComponent(CookAddNowComponent);
    fixture.componentRef.setInput('ingredients', [ingredient('a', 'Salmon', 200), ingredient('b', 'Oil', null, 'NUTS')]);
    fixture.componentRef.setInput('stepNumber', 4);
    fixture.componentRef.setInput('stepCount', 5);
    fixture.componentRef.setInput('factor', 1.5);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.eyebrow')?.textContent).toContain('Step 4 of 5 · add now');
    expect(Array.from(el.querySelectorAll('.grams')).map((n) => n.textContent)).toEqual(['300 g', 'Oil as written']);
  });

  it('shows the banner with a photo, or a cover without one, and hides the awake text when unsupported', () => {
    const fixture = TestBed.createComponent(CookBannerComponent);
    fixture.componentRef.setInput('name', 'Salmon salad');
    fixture.componentRef.setInput('servings', 2);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cover')).not.toBeNull();
    expect(el.querySelector('.kicker')?.textContent).toBe('Cooking');
    expect(el.querySelector('.meta')?.textContent).toBe('2 servings · the screen stays on');
    fixture.componentRef.setInput('imageUrl', 'https://img/x.jpg');
    fixture.componentRef.setInput('screenStaysOn', false);
    fixture.detectChanges();
    expect(el.querySelector('img.photo')).not.toBeNull();
    expect(el.querySelector('.meta')?.textContent).toBe('2 servings');
  });

  it('shows two chips and "+N", and jumps to the step of a chip', () => {
    const fixture = TestBed.createComponent(CookAlsoTimingComponent);
    const chips: TimingChip[] = [0, 1, 2, 3].map((n) => ({ step: n, label: `Step ${n + 1}`, time: '1:00', share: 0.5 }));
    fixture.componentRef.setInput('chips', chips);
    const jumped: number[] = [];
    fixture.componentInstance.jumped.subscribe((s) => jumped.push(s));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.chip').length).toBe(2);
    expect(el.querySelector('.more')?.textContent).toBe('+2');
    el.querySelectorAll<HTMLButtonElement>('.chip')[1].click();
    expect(jumped).toEqual([1]);
  });

  it('words the alert and its action', () => {
    expect(alertText({ step: 3, kind: 'turn', eachSide: true })).toBe('Step 4: the first side is done');
    expect(alertText({ step: 3, kind: 'done', eachSide: true })).toBe('Step 4: both sides are done');
    expect(alertText({ step: 1, kind: 'done', eachSide: false })).toBe('Step 2: the timer is done');
    expect(alertAction({ step: 3, kind: 'turn', eachSide: true })).toBe('Start the second side');
    expect(alertAction({ step: 1, kind: 'done', eachSide: false })).toBe('Go to step 2');
  });

  it('answers the alert with the action or Later', () => {
    const fixture = TestBed.createComponent(CookAlertComponent);
    fixture.componentRef.setInput('alert', { step: 3, kind: 'turn', eachSide: true });
    const events: string[] = [];
    fixture.componentInstance.acted.subscribe(() => events.push('act'));
    fixture.componentInstance.later.subscribe(() => events.push('later'));
    fixture.detectChanges();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    expect(buttons[0].textContent).toContain('Start the second side');
    buttons[0].click();
    buttons[1].click();
    expect(events).toEqual(['act', 'later']);
  });

  it('draws the segments with ticks on the finished ones', () => {
    const fixture = TestBed.createComponent(CookSegmentsComponent);
    fixture.componentRef.setInput('fills', [1, 0.25]);
    fixture.componentRef.setInput('labels', ['First side', 'Second side']);
    fixture.componentRef.setInput('celebrating', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.seg').length).toBe(2);
    expect(el.querySelectorAll('.label app-food-glyph').length).toBe(1);
    expect(el.querySelector('.dot.lit')).not.toBeNull();
    expect(el.querySelector('.sweep')).not.toBeNull();
    expect(el.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')).toBe('63');
  });
});
