import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftSegment } from '../plan-draft';
import { barMode, SegmentStripComponent } from './segment-strip.component';
import { defaultSegments, segmentTotal, setIntervals, StripBand, stripBand, stripClock } from './segment-math';
import { StripRow } from '../../segments/segment-timer';

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

  it('gives a bar the full label from 72 px, only its minutes from 28 px, and nothing under that', () => {
    expect(barMode(120)).toBe('full');
    expect(barMode(72)).toBe('full');
    expect(barMode(71)).toBe('minutes');
    expect(barMode(28)).toBe('minutes');
    expect(barMode(27)).toBe('none');
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

  describe('read-only session rows', () => {
    const rows: StripRow[] = [
      { label: 'Warm-up', kind: 'WARMUP', plannedSeconds: 300, actualSeconds: 300, status: 'DONE' },
      { label: 'Steady', kind: 'STEADY', plannedSeconds: 900, actualSeconds: null, status: 'PENDING' },
      { label: 'Cool-down', kind: 'COOLDOWN', plannedSeconds: 300, actualSeconds: 120, status: 'SKIPPED' }
    ];

    async function show(width: number, session: StripRow[] = rows, current: number | null = 1, elapsed = 450): Promise<HTMLElement> {
      fixture = TestBed.createComponent(SegmentStripComponent);
      (fixture.nativeElement as HTMLElement).style.width = `${width}px`;
      fixture.componentRef.setInput('rows', session);
      fixture.componentRef.setInput('editable', false);
      fixture.componentRef.setInput('current', current);
      fixture.componentRef.setInput('elapsedSeconds', elapsed);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return root();
    }

    it('names the three bands by the component width', () => {
      const bands: StripBand[] = [stripBand(900), stripBand(899), stripBand(600), stripBand(599)];
      expect(bands).toEqual(['wide', 'medium', 'medium', 'narrow']);
      expect(stripClock(125)).toBe('2:05');
    });

    it('wide: labels and planned against actual sit inside the bars', async () => {
      const el = await show(1000);
      expect(el.querySelector('.session.wide')).not.toBeNull();
      const bars = el.querySelectorAll('.bar');
      expect(bars.length).toBe(3);
      expect(bars[0].textContent).toContain('Warm-up');
      expect(bars[0].textContent).toContain('5:00 of 5:00');
      expect(bars[1].textContent).toContain('7:30 of 15:00');
      expect(bars[2].textContent).toContain('skipped at 2:00 of 5:00');
      expect(el.querySelector('.list')).toBeNull();
      expect(el.querySelectorAll('button, input').length).toBe(0);
    });

    it('medium: times inside the bars and names under them', async () => {
      const el = await show(700);
      expect(el.querySelector('.session.medium')).not.toBeNull();
      expect(el.querySelector('.bar .label b')).toBeNull();
      expect(el.querySelector('.names')?.textContent).toContain('Steady');
    });

    it('narrow: thin bars and a list of names with times', async () => {
      const el = await show(400);
      expect(el.querySelector('.session.narrow')).not.toBeNull();
      expect(el.querySelector('.bar .label')).toBeNull();
      expect(el.querySelectorAll('.list li').length).toBe(3);
      expect(el.querySelector('.list li.current')?.textContent).toContain('Steady');
    });

    it('lights the running bar with the seconds spent in it', async () => {
      const el = await show(1000);
      const bars = el.querySelectorAll<HTMLElement>('.bar');
      expect(bars[1].classList).toContain('current');
      expect(bars[1].querySelector<HTMLElement>('.fill')?.style.width).toBe('50%');
      expect(bars[0].querySelector<HTMLElement>('.fill')?.style.width).toBe('100%');
      expect(bars[2].classList).toContain('skipped');
      expect(bars[2].classList).not.toContain('current');
    });

    it('puts the names of a long interval set in a list even when wide', async () => {
      const many: StripRow[] = Array.from({ length: 12 }, (_, i) => ({
        label: i % 2 ? 'Easy' : 'Work',
        kind: i % 2 ? ('EASY' as const) : ('WORK' as const),
        plannedSeconds: 30,
        actualSeconds: null,
        status: 'PENDING' as const
      }));
      const el = await show(1000, many, null, 0);
      expect(el.querySelector('.session.list')).not.toBeNull();
      expect(el.querySelectorAll('.list li').length).toBe(12);
    });
  });
});
