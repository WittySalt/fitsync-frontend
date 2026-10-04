import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftSegment } from '../plan-draft';
import { SegmentStripComponent } from './segment-strip.component';
import { defaultSegments, segmentTotal, setIntervals } from './segment-math';

describe('SegmentStripComponent', () => {
  let fixture: ComponentFixture<SegmentStripComponent>;
  let emitted: DraftSegment[][];
  const root = () => fixture.nativeElement as HTMLElement;
  const handles = () => Array.from(root().querySelectorAll<HTMLElement>('.handle'));
  const minutes = (segments: DraftSegment[]) => segments.map((segment) => segment.minutes);

  function render(segments: DraftSegment[], editable: boolean, extra: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(SegmentStripComponent);
    fixture.componentRef.setInput('segments', segments);
    fixture.componentRef.setInput('editable', editable);
    Object.entries(extra).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    emitted = [];
    fixture.componentInstance.segmentsChange.subscribe((next) => emitted.push(next));
    fixture.detectChanges();
  }

  it('draws a bar per segment with its minutes in the label, in proportion', () => {
    render(defaultSegments(40), false);
    const bars = Array.from(root().querySelectorAll<HTMLElement>('.bar'));
    expect(bars.map((bar) => bar.textContent?.trim())).toEqual(['Warm-up 5', 'Steady 30', 'Cool-down 5']);
    expect(bars.map((bar) => bar.style.flexGrow)).toEqual(['5', '30', '5']);
  });

  it('is a picture only when it is not editable: no handles, no buttons, no inputs', () => {
    render(defaultSegments(40), false);
    expect(handles().length).toBe(0);
    expect(root().querySelectorAll('button, input').length).toBe(0);
  });

  it('shows one handle between each pair of bars when editable, as sliders', () => {
    render(defaultSegments(40), true);
    expect(handles().length).toBe(2);
    expect(handles()[0].getAttribute('role')).toBe('slider');
    expect(handles()[0].getAttribute('aria-label')).toBe('Move the boundary between Warm-up and Steady');
    expect(handles()[0].getAttribute('aria-valuenow')).toBe('5');
    expect(root().querySelectorAll('input').length).toBe(0);
  });

  it('moves a boundary one minute with the arrow keys and keeps the total', () => {
    render(defaultSegments(40), true);
    handles()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(minutes(emitted[0])).toEqual([6, 29, 5]);
    handles()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(minutes(emitted[1])).toEqual([5, 29, 6]);
    expect(segmentTotal(emitted[1])).toBe(40);
    handles()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(emitted.length).toBe(2);
  });

  it('drags a boundary with the pointer, trading minutes between the two neighbours', () => {
    render(defaultSegments(40), true);
    const track = root().querySelector('.strip') as HTMLElement;
    const usable = track.getBoundingClientRect().width - 16 * 2;
    const perMinute = usable / 40;
    const handle = handles()[0];
    handle.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, pointerId: 1, bubbles: true }));
    handle.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 + perMinute * 4, pointerId: 1, bubbles: true }));
    expect(minutes(emitted[emitted.length - 1])).toEqual([9, 26, 5]);
    handle.dispatchEvent(new PointerEvent('pointerup', { clientX: 100, pointerId: 1, bubbles: true }));
    handle.dispatchEvent(new PointerEvent('pointermove', { clientX: 400, pointerId: 1, bubbles: true }));
    expect(emitted.length).toBe(1);
  });

  it('types the minutes of a bar after a double tap on its label, and takes them from the neighbour', () => {
    render(defaultSegments(40), true);
    const label = () => root().querySelector<HTMLButtonElement>('.bar .label')!;
    label().click();
    expect(root().querySelector('input')).toBeNull();
    label().click();
    fixture.detectChanges();
    const input = root().querySelector<HTMLInputElement>('input')!;
    expect(input).not.toBeNull();
    input.value = '9';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(minutes(emitted[0])).toEqual([9, 26, 5]);
    expect(root().querySelector('input')).toBeNull();
  });

  it('drops a typed value that is not a number, and Escape cancels', () => {
    render(defaultSegments(40), true);
    const label = () => root().querySelector<HTMLButtonElement>('.bar .label')!;
    label().click();
    label().click();
    fixture.detectChanges();
    const input = root().querySelector<HTMLInputElement>('input')!;
    input.value = '';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(emitted.length).toBe(0);
    label().click();
    label().click();
    fixture.detectChanges();
    root().querySelector<HTMLInputElement>('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(root().querySelector('input')).toBeNull();
    expect(emitted.length).toBe(0);
  });

  it('shows an interval block as rounds of work and easy', () => {
    render(setIntervals(defaultSegments(40), true, 5), true);
    const bars = Array.from(root().querySelectorAll<HTMLElement>('.bar'));
    expect(bars.length).toBe(3);
    expect(bars[1].textContent?.trim()).toBe('5 × (3 + 3)');
    expect(handles().length).toBe(2);
  });

  it('lights the current bar and fills the elapsed minutes across the bars', () => {
    render(defaultSegments(40), false, { current: 1, elapsedMinutes: 20 });
    const bars = Array.from(root().querySelectorAll<HTMLElement>('.bar'));
    expect(bars[1].classList).toContain('current');
    expect(bars[0].classList).not.toContain('current');
    const fills = Array.from(root().querySelectorAll<HTMLElement>('.fill')).map((fill) => fill.style.width);
    expect(fills).toEqual(['100%', '50%', '0%']);
  });
});
