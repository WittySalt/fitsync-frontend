import { TestBed } from '@angular/core/testing';

import { CookAddNowComponent } from './cook-add-now.component';
import { CookAlertComponent, alertAction, alertText } from './cook-alert.component';
import { CookAlsoTimingComponent, TimingChip } from './cook-also-timing.component';
import { CookBannerComponent } from './cook-banner.component';
import { CookCustomTimersComponent, NewTimer } from './cook-custom-timers.component';
import { CookIngredientsComponent } from './cook-ingredients.component';
import { CookAlert } from './cook-session.service';
import { CookSegmentsComponent } from './cook-segments.component';
import { CookStepsComponent } from './cook-steps.component';
import { CookIngredient, CookStep } from './cook.models';

function ingredient(id: string, name: string, grams: number | null, group: CookIngredient['foodGroup'] = 'PROTEIN'): CookIngredient {
  return { id, name, displayText: `${name} as written`, grams, foodGroup: group, categoryCode: null };
}

const turn: CookAlert = { key: 's0', step: 0, kind: 'turn', eachSide: true, name: null };
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

  it('counts the ingredients added, scales the grams and reports a tick', () => {
    const fixture = TestBed.createComponent(CookIngredientsComponent);
    fixture.componentRef.setInput('ingredients', [ingredient('a', 'Salmon', 200), ingredient('b', 'Oil', null)]);
    fixture.componentRef.setInput('others', [ingredient('c', 'Lime', 5)]);
    fixture.componentRef.setInput('added', new Set(['a']));
    fixture.componentRef.setInput('factor', 0.5);
    const ticked: string[] = [];
    fixture.componentInstance.toggled.subscribe((id) => ticked.push(id));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.count')?.textContent).toBe('1 of 3 added');
    expect(Array.from(el.querySelectorAll('.grams')).map((n) => n.textContent)).toEqual(['100 g', '2.5 g']);
    expect(el.querySelectorAll('li.added').length).toBe(1);
    expect(el.querySelector('.rest')?.textContent).toBe('Not in a step');
    el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1].click();
    expect(ticked).toEqual(['b']);
    expect(el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[0].checked).toBeTrue();
  });

  it('leaves out the Not in a step heading when no step names an ingredient', () => {
    const fixture = TestBed.createComponent(CookIngredientsComponent);
    fixture.componentRef.setInput('ingredients', []);
    fixture.componentRef.setInput('others', [ingredient('a', 'Salmon', 200)]);
    fixture.componentRef.setInput('added', new Set<string>());
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.rest')).toBeNull();
    expect(el.querySelectorAll('li').length).toBe(1);
  });

  it('leaves the heading out when bare', () => {
    const fixture = TestBed.createComponent(CookIngredientsComponent);
    fixture.componentRef.setInput('ingredients', [ingredient('a', 'Salmon', 200)]);
    fixture.componentRef.setInput('added', new Set<string>());
    fixture.componentRef.setInput('bare', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.head')).toBeNull();
    expect(el.querySelectorAll('li').length).toBe(1);
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

  it('dims an added ingredient, keeps it and says All added once every box is ticked', () => {
    const fixture = TestBed.createComponent(CookAddNowComponent);
    fixture.componentRef.setInput('ingredients', [ingredient('a', 'Salmon', 200), ingredient('b', 'Oil', 20, 'NUTS')]);
    fixture.componentRef.setInput('stepNumber', 1);
    fixture.componentRef.setInput('stepCount', 2);
    fixture.componentRef.setInput('added', new Set(['a']));
    const ticked: string[] = [];
    fixture.componentInstance.toggled.subscribe((id) => ticked.push(id));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('li').length).toBe(2);
    expect(el.querySelectorAll('li.added').length).toBe(1);
    expect(el.querySelector('.quiet')).toBeNull();
    el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1].click();
    expect(ticked).toEqual(['b']);
    fixture.componentRef.setInput('added', new Set(['a', 'b']));
    fixture.detectChanges();
    expect(el.querySelector('.quiet')?.textContent).toBe('All added');
    expect(el.querySelectorAll('li').length).toBe(2);
  });

  it('says why the block is empty when the step uses nothing, but not when no step names ingredients', () => {
    const fixture = TestBed.createComponent(CookAddNowComponent);
    fixture.componentRef.setInput('ingredients', []);
    fixture.componentRef.setInput('stepNumber', 3);
    fixture.componentRef.setInput('stepCount', 3);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.eyebrow')?.textContent).toContain('Step 3 of 3 · add now');
    expect(el.querySelector('.quiet')?.textContent).toBe('Nothing new to add in this step');
    fixture.componentRef.setInput('assigned', false);
    fixture.detectChanges();
    expect(el.querySelector('.quiet')).toBeNull();
  });

  it('shows a timer the cook added, answers its buttons and starts a new one from the form', () => {
    const fixture = TestBed.createComponent(CookCustomTimersComponent);
    fixture.componentRef.setInput('items', [
      { id: 1, name: 'Oven preheating', clock: '9:58', phase: 'running' },
      { id: 2, name: '', clock: '0:00', phase: 'done' }
    ]);
    const events: string[] = [];
    const created: NewTimer[] = [];
    const c = fixture.componentInstance;
    c.paused.subscribe((id) => events.push(`pause ${id}`));
    c.minuteAdded.subscribe((id) => events.push(`plus ${id}`));
    c.removed.subscribe((id) => events.push(`remove ${id}`));
    c.added.subscribe((timer) => created.push(timer));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.item');
    expect(items[0].textContent).toContain('Oven preheating');
    expect(items[0].textContent).toContain('9:58');
    expect(items[1].textContent).toContain('Timer is done');
    const buttons = items[0].querySelectorAll<HTMLButtonElement>('button');
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();
    items[1].querySelector<HTMLButtonElement>('button')?.click();
    expect(events).toEqual(['plus 1', 'pause 1', 'remove 1', 'remove 2']);
    el.querySelector<HTMLButtonElement>('.add')?.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('button[aria-label="More minutes"]')?.click();
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = ' Oven preheating ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('.value')?.textContent).toBe('6 min');
    el.querySelector<HTMLButtonElement>('.start')?.click();
    fixture.detectChanges();
    expect(created).toEqual([{ name: 'Oven preheating', minutes: 6 }]);
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('.add')).not.toBeNull();
  });

  it('lets the cook tick every ingredient of the step at once, and clear them again', () => {
    const fixture = TestBed.createComponent(CookAddNowComponent);
    fixture.componentRef.setInput('ingredients', [ingredient('a', 'Salmon', 200), ingredient('b', 'Oil', 20, 'NUTS')]);
    fixture.componentRef.setInput('stepNumber', 1);
    fixture.componentRef.setInput('stepCount', 2);
    const seen: boolean[] = [];
    fixture.componentInstance.allMarked.subscribe((on) => seen.push(on));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const all = () => el.querySelector('.all') as HTMLButtonElement;
    expect(all().textContent).toBe('Mark all added');
    all().click();
    fixture.componentRef.setInput('added', new Set(['a', 'b']));
    fixture.detectChanges();
    expect(all().textContent).toBe('Clear all');
    all().click();
    expect(seen).toEqual([true, false]);
  });

  it('shows 0 g as to taste on the second line and never repeats the line as written under the name', () => {
    const fixture = TestBed.createComponent(CookAddNowComponent);
    const salt = { ...ingredient('s', 'Salt', 0, null), displayText: 'To taste Salt' };
    const pepper = { ...ingredient('p', 'Pepper', null, null), displayText: 'pepper' };
    fixture.componentRef.setInput('ingredients', [salt, pepper]);
    fixture.componentRef.setInput('stepNumber', 1);
    fixture.componentRef.setInput('stepCount', 1);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('li strong')).map((n) => n.textContent)).toEqual(['Salt', 'Pepper']);
    expect(Array.from(el.querySelectorAll('.grams')).map((n) => n.textContent)).toEqual(['to taste', '']);
  });

  it('draws a spice on a tile of its own colour with the shaker', () => {
    const fixture = TestBed.createComponent(CookAddNowComponent);
    fixture.componentRef.setInput('ingredients', [{ ...ingredient('s', 'Salt', 3, null), categoryCode: 'SPICES' }]);
    fixture.componentRef.setInput('stepNumber', 1);
    fixture.componentRef.setInput('stepCount', 1);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('li')?.getAttribute('style')).toContain('--food-spice');
    expect(el.querySelector('li .icon svg')).not.toBeNull();
  });

  it('shows the banner with a photo, or a cover without one, and hides the awake text when unsupported', () => {
    const fixture = TestBed.createComponent(CookBannerComponent);
    fixture.componentRef.setInput('name', 'Salmon salad');
    fixture.componentRef.setInput('servings', 2);
    const closed: boolean[] = [];
    fixture.componentInstance.closed.subscribe(() => closed.push(true));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.return')?.textContent).toContain('Exit');
    expect(el.querySelector('.return')?.getAttribute('aria-label')).toBe('Exit cooking');
    el.querySelector<HTMLButtonElement>('.return')?.click();
    expect(closed).toEqual([true]);
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
    const chips: TimingChip[] = [0, 1, 2, 3].map((n) => ({ key: `s${n}`, step: n, label: `Step ${n + 1}`, time: '1:00', share: 0.5 }));
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
    expect(alertText({ ...turn, step: 3 })).toBe('Step 4: the first side is done');
    expect(alertText({ ...turn, step: 3, kind: 'done' })).toBe('Step 4: both sides are done');
    expect(alertText({ ...turn, step: 1, kind: 'done', eachSide: false })).toBe('Step 2: the timer is done');
    expect(alertText({ ...turn, step: 1, kind: 'done', eachSide: false, name: 'Oven preheating' })).toBe('Step 2: Oven preheating is done');
    expect(alertText({ ...turn, step: 1, kind: 'done', eachSide: false, name: '' })).toBe('Step 2: your timer is done');
    expect(alertAction({ ...turn, step: 3 })).toBe('Start the second side');
    expect(alertAction({ ...turn, step: 1, kind: 'done', eachSide: false })).toBe('Go to step 2');
  });

  it('answers the alert with the action or Later', () => {
    const fixture = TestBed.createComponent(CookAlertComponent);
    fixture.componentRef.setInput('alert', { ...turn, step: 3 });
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
