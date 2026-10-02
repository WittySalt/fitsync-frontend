import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CookDurationComponent } from './cook-duration.component';

describe('CookDurationComponent', () => {
  let fixture: ComponentFixture<CookDurationComponent>;

  function render(minutes = 5, reset: number | null = null): void {
    fixture = TestBed.createComponent(CookDurationComponent);
    fixture.componentRef.setInput('minutes', minutes);
    fixture.componentRef.setInput('reset', reset);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const boxes = () => Array.from(el().querySelectorAll<HTMLInputElement>('input'));
  const type = (box: HTMLInputElement, text: string) => {
    box.value = text;
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const chip = (label: string) => Array.from(el().querySelectorAll<HTMLButtonElement>('.chips button')).find((b) => b.textContent?.trim() === label);
  const value = () => fixture.componentInstance.minutes();
  const valid = () => fixture.componentInstance.valid();

  it('shows the time as hours and minutes in two numeric boxes with h and min', () => {
    render(90);
    expect(boxes().map((box) => box.value)).toEqual(['1', '30']);
    expect(boxes().every((box) => box.getAttribute('inputmode') === 'numeric')).toBeTrue();
    expect(el().textContent).toContain('min');
  });

  it('reads what is typed, rolls minutes over 59 into hours on leaving the box, and keeps the total', () => {
    render(5);
    type(boxes()[1], '90');
    expect(value()).toBe(90);
    boxes()[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(boxes().map((box) => box.value)).toEqual(['1', '30']);
  });

  it('shows a short note and marks the time invalid when the boxes are not a time, then recovers', () => {
    render(5);
    type(boxes()[0], '13');
    expect(valid()).toBeFalse();
    expect(el().querySelector('.note')?.textContent).toBe('A timer can be 12 h at most.');
    type(boxes()[0], '2');
    expect(valid()).toBeTrue();
    expect(el().querySelector('.note')).toBeNull();
    type(boxes()[1], 'ab');
    expect(el().querySelector('.note')?.textContent).toBe('Use whole numbers only.');
    type(boxes()[0], '0');
    type(boxes()[1], '0');
    expect(el().querySelector('.note')?.textContent).toBe('Choose at least 1 min.');
  });

  it('adds with the chips and stops at 12 h', () => {
    render(5);
    chip('+15 min')?.click();
    chip('+1 h')?.click();
    fixture.detectChanges();
    expect(value()).toBe(80);
    expect(boxes().map((box) => box.value)).toEqual(['1', '20']);
    chip('+1 min')?.click();
    chip('+5 min')?.click();
    expect(value()).toBe(86);
    for (let i = 0; i < 14; i++) {
      chip('+1 h')?.click();
    }
    expect(value()).toBe(720);
  });

  it('offers Reset only when there is a recipe time that differs, and goes back to it', () => {
    render(5, 20);
    expect(chip('Reset')).toBeDefined();
    chip('+1 h')?.click();
    chip('Reset')?.click();
    fixture.detectChanges();
    expect(value()).toBe(20);
    expect(chip('Reset')).toBeUndefined();
    render(5, null);
    expect(chip('Reset')).toBeUndefined();
  });

  it('nudges with the round buttons by 1 min, 5 min and 15 min', () => {
    render(9);
    const more = el().querySelector('button[aria-label="Longer"]') as HTMLButtonElement;
    const less = el().querySelector('button[aria-label="Shorter"]') as HTMLButtonElement;
    more.click();
    expect(value()).toBe(10);
    more.click();
    expect(value()).toBe(15);
    for (let i = 0; i < 9; i++) {
      more.click();
    }
    expect(value()).toBe(60);
    more.click();
    expect(value()).toBe(75);
    less.click();
    expect(value()).toBe(60);
  });

  it('selects the text of a box on focus, and Enter submits a good time but not a bad one', () => {
    render(5);
    let submitted = 0;
    fixture.componentInstance.submitted.subscribe(() => submitted++);
    const select = spyOn(boxes()[1], 'select');
    boxes()[1].dispatchEvent(new Event('focus'));
    expect(select).toHaveBeenCalled();
    boxes()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(submitted).toBe(1);
    type(boxes()[1], 'zz');
    boxes()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(submitted).toBe(1);
  });
});
