import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SegmentStripViewComponent, StripSegment, stripBand, stripClock } from './segment-strip-view.component';

const rows: StripSegment[] = [
  { label: 'Warm-up', kind: 'WARMUP', plannedSeconds: 300, actualSeconds: 300, status: 'DONE' },
  { label: 'Steady', kind: 'STEADY', plannedSeconds: 900, actualSeconds: null, status: 'PENDING' },
  { label: 'Cool-down', kind: 'COOLDOWN', plannedSeconds: 300, actualSeconds: 120, status: 'SKIPPED' }
];

describe('SegmentStripViewComponent', () => {
  let fixture: ComponentFixture<SegmentStripViewComponent>;

  async function render(width: number, segments: StripSegment[] = rows, current: number | null = 1, elapsed = 450): Promise<HTMLElement> {
    fixture = TestBed.createComponent(SegmentStripViewComponent);
    (fixture.nativeElement as HTMLElement).style.width = `${width}px`;
    fixture.componentRef.setInput('segments', segments);
    fixture.componentRef.setInput('current', current);
    fixture.componentRef.setInput('elapsedSeconds', elapsed);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('names the three bands by the component width', () => {
    expect(stripBand(900)).toBe('wide');
    expect(stripBand(899)).toBe('medium');
    expect(stripBand(600)).toBe('medium');
    expect(stripBand(599)).toBe('narrow');
    expect(stripClock(125)).toBe('2:05');
  });

  it('wide: labels and planned against actual sit inside the bars', async () => {
    const el = await render(1000);
    expect(el.querySelector('.strip.wide')).not.toBeNull();
    const bars = el.querySelectorAll('.bar');
    expect(bars.length).toBe(3);
    expect(bars[0].textContent).toContain('Warm-up');
    expect(bars[0].textContent).toContain('5:00 of 5:00');
    expect(bars[1].textContent).toContain('7:30 of 15:00');
    expect(bars[2].textContent).toContain('skipped at 2:00 of 5:00');
    expect(el.querySelector('.list')).toBeNull();
  });

  it('medium: times inside the bars and labels under them', async () => {
    const el = await render(700);
    expect(el.querySelector('.strip.medium')).not.toBeNull();
    expect(el.querySelector('.bar .text b')).toBeNull();
    expect(el.querySelector('.labels')?.textContent).toContain('Steady');
  });

  it('narrow: thin bars and a list of labels with times', async () => {
    const el = await render(400);
    expect(el.querySelector('.strip.narrow')).not.toBeNull();
    expect(el.querySelector('.bar .text')).toBeNull();
    expect(el.querySelectorAll('.list li').length).toBe(3);
    expect(el.querySelector('.list li.current')?.textContent).toContain('Steady');
  });

  it('lights the current segment with an elapsed fill', async () => {
    const el = await render(1000);
    const bars = el.querySelectorAll<HTMLElement>('.bar');
    expect(bars[1].classList).toContain('current');
    expect(bars[1].querySelector<HTMLElement>('.fill')?.style.width).toBe('50%');
    expect(bars[0].querySelector<HTMLElement>('.fill')?.style.width).toBe('100%');
    expect(bars[2].classList).not.toContain('current');
  });

  it('puts the labels of a long interval set in a list even when wide', async () => {
    const many: StripSegment[] = Array.from({ length: 12 }, (_, i) => ({
      label: i % 2 ? 'Easy' : 'Work', kind: i % 2 ? 'EASY' : 'WORK', plannedSeconds: 30, actualSeconds: null, status: 'PENDING'
    }));
    const el = await render(1000, many, null, 0);
    expect(el.querySelector('.strip.list')).not.toBeNull();
    expect(el.querySelectorAll('.list li').length).toBe(12);
  });
});
