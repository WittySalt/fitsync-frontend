import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DayMarkComponent } from './day-mark.component';

describe('DayMarkComponent', () => {
  function render(inputs: Record<string, unknown> = {}): ComponentFixture<DayMarkComponent> {
    const fixture = TestBed.createComponent(DayMarkComponent);
    fixture.componentRef.setInput('date', '2026-09-29');
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<DayMarkComponent>) => fixture.nativeElement as HTMLElement;
  const pills = (fixture: ComponentFixture<DayMarkComponent>) => Array.from(el(fixture).querySelectorAll('.pill')).map((pill) => pill.textContent?.trim());

  it('says the weekday and offers the two pills and the usual link', () => {
    const fixture = render({ offered: true, hasUsual: true });

    expect(el(fixture).querySelector('.line')?.textContent).toBe('Tuesday, nothing logged');
    expect(pills(fixture)).toEqual(['I fasted', "I ate, didn't log"]);
    expect(el(fixture).querySelector('.link')?.textContent?.trim()).toBe('Log my usual');
  });

  it('leaves out Log my usual when there is no usual meal to log', () => {
    expect(el(render({ offered: true })).querySelector('.link')).toBeNull();
  });

  it('shows nothing when the line is not offered and the day is not fasted', () => {
    expect(el(render()).children.length).toBe(0);
  });

  it('reports each choice', () => {
    const fixture = render({ offered: true, hasUsual: true });
    const seen: string[] = [];
    fixture.componentInstance.fast.subscribe(() => seen.push('fast'));
    fixture.componentInstance.ate.subscribe(() => seen.push('ate'));
    fixture.componentInstance.usual.subscribe(() => seen.push('usual'));

    el(fixture).querySelectorAll<HTMLButtonElement>('.pill')[0].click();
    el(fixture).querySelectorAll<HTMLButtonElement>('.pill')[1].click();
    (el(fixture).querySelector('.link') as HTMLButtonElement).click();

    expect(seen).toEqual(['fast', 'ate', 'usual']);
  });

  it('switches the choices off while a call is running', () => {
    const fixture = render({ offered: true, hasUsual: true, busy: true });
    expect(Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('button')).every((button) => button.disabled)).toBeTrue();
  });

  it('shows Fasted with a menu that holds Delete only, in the danger colour family of the other delete items', () => {
    const fixture = render({ fasted: true, offered: true });
    let deleted = 0;
    fixture.componentInstance.deleteFast.subscribe(() => (deleted += 1));

    expect(el(fixture).querySelector('.fasted strong')?.textContent).toBe('Fasted');
    expect(el(fixture).querySelector('.pill')).toBeNull();
    (el(fixture).querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Delete']);
    items[0].click();
    expect(deleted).toBe(1);
  });
});
