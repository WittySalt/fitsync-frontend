import { TestBed } from '@angular/core/testing';

import { ReorderComponent } from './reorder.component';

describe('ReorderComponent', () => {
  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(ReorderComponent);
    fixture.componentRef.setInput('label', 'Rolled oats');
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
    return fixture;
  }

  it('has a grip to drag and Move up and Move down buttons named after what they move', () => {
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.grip')?.getAttribute('draggable')).toBe('true');
    expect(el.querySelector('.up')?.getAttribute('aria-label')).toBe('Move Rolled oats up');
    expect(el.querySelector('.down')?.getAttribute('aria-label')).toBe('Move Rolled oats down');
  });

  it('keeps only the grip when the arrows are turned off', () => {
    const el = render({ arrows: false }).nativeElement as HTMLElement;
    expect(el.querySelector('.grip')).not.toBeNull();
    expect(el.querySelector('.up')).toBeNull();
    expect(el.querySelector('.down')).toBeNull();
  });

  it('reports the buttons and the drag, and switches off a direction that cannot go further', () => {
    const fixture = render({ canUp: false });
    const el = fixture.nativeElement as HTMLElement;
    const seen: string[] = [];
    fixture.componentInstance.up.subscribe(() => seen.push('up'));
    fixture.componentInstance.down.subscribe(() => seen.push('down'));
    fixture.componentInstance.dragStart.subscribe(() => seen.push('drag'));
    fixture.componentInstance.dragEnd.subscribe(() => seen.push('end'));
    expect((el.querySelector('.up') as HTMLButtonElement).disabled).toBeTrue();
    (el.querySelector('.down') as HTMLButtonElement).click();
    el.querySelector('.grip')?.dispatchEvent(new Event('dragstart'));
    el.querySelector('.grip')?.dispatchEvent(new Event('dragend'));
    expect(seen).toEqual(['down', 'drag', 'end']);
  });
});
