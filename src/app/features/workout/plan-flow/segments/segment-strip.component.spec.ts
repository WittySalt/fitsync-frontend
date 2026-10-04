import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SegmentStripComponent } from './segment-strip.component';
import { StripBand, stripBand, stripClock } from './segment-math';
import { StripRow } from '../../segments/segment-timer';

describe('SegmentStripComponent', () => {
  let fixture: ComponentFixture<SegmentStripComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  describe('session rows', () => {
    const rows: StripRow[] = [
      { label: 'Warm-up', kind: 'WARMUP', plannedSeconds: 300, actualSeconds: 300, status: 'DONE' },
      { label: 'Steady', kind: 'STEADY', plannedSeconds: 900, actualSeconds: null, status: 'PENDING' },
      { label: 'Cool-down', kind: 'COOLDOWN', plannedSeconds: 300, actualSeconds: 120, status: 'SKIPPED' }
    ];

    async function show(width: number, session: StripRow[] = rows, current: number | null = 1, elapsed = 450): Promise<HTMLElement> {
      fixture = TestBed.createComponent(SegmentStripComponent);
      (fixture.nativeElement as HTMLElement).style.width = `${width}px`;
      fixture.componentRef.setInput('rows', session);
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
