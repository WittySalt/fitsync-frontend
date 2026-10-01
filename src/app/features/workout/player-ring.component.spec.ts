import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerRingComponent } from './player-ring.component';

/** Every value a ring can show, with the caption that goes under it, widest last. */
const VALUES: [string, string][] = [
  ['3', 'Get ready'],
  ['Go', ''],
  ['0:45', 'Left'],
  ['12:05', 'Rest'],
  ['10 / 10', '0:07'],
  ['12 / 12', '1:05'],
  ['15 / 20', '12:30'],
  ['1:05:30', 'Left'],
  ['100 / 100', '10:00']
];

describe('PlayerRingComponent', () => {
  let fixture: ComponentFixture<PlayerRingComponent>;

  const root = () => fixture.nativeElement as HTMLElement;

  function mount(size: number, centre: string, caption: string): void {
    fixture = TestBed.createComponent(PlayerRingComponent);
    root().style.setProperty('--ring-size', `${size}px`);
    document.body.appendChild(root());
    fixture.componentRef.setInput('share', 0.5);
    fixture.componentRef.setInput('centre', centre);
    fixture.componentRef.setInput('caption', caption);
    fixture.componentRef.setInput('label', 'ring');
    fixture.detectChanges();
  }

  /** The distance from the middle of the ring to the farthest corner of a box. */
  function farthestCorner(box: DOMRect, ring: DOMRect): number {
    const cx = ring.left + ring.width / 2;
    const cy = ring.top + ring.height / 2;
    return Math.max(
      ...[box.left, box.right].flatMap((x) => [box.top, box.bottom].map((y) => Math.hypot(x - cx, y - cy)))
    );
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [PlayerRingComponent] }));

  afterEach(() => root().remove());

  [128, 144, 160, 180, 200, 220].forEach((size) => {
    it(`keeps every figure and caption inside the inner circle of a ${size} px ring`, () => {
      // The arc is 7 of 100 units wide and centred on a radius of 45, so the inner edge is at 41.5.
      const innerRadius = (size * 41.5) / 100;
      for (const [centre, caption] of VALUES) {
        mount(size, centre, caption);
        const ring = root().querySelector('.ring') as HTMLElement;
        const figure = root().querySelector('.figure') as HTMLElement;
        const caps = root().querySelector('.caption') as HTMLElement;

        expect(farthestCorner(figure.getBoundingClientRect(), ring.getBoundingClientRect()))
          .withContext(`figure "${centre}" at ${size} px`)
          .toBeLessThanOrEqual(innerRadius - 4);
        if (caption) {
          expect(farthestCorner(caps.getBoundingClientRect(), ring.getBoundingClientRect()))
            .withContext(`caption "${caption}" under "${centre}" at ${size} px`)
            .toBeLessThanOrEqual(innerRadius - 4);
        }
        root().remove();
      }
    });
  });

  it('shows a count as one figure, the target smaller than the count on the same baseline', () => {
    mount(128, '10 / 10', '0:07');
    const count = root().querySelector('.figure') as HTMLElement;
    const target = root().querySelector('.of') as HTMLElement;

    expect(count.textContent?.replace(/\s+/g, ' ').trim()).toBe('10 / 10');
    expect(parseFloat(getComputedStyle(target).fontSize)).toBeCloseTo(parseFloat(getComputedStyle(count).fontSize) * 0.55, 0);
    expect(getComputedStyle(count).fontVariantNumeric).toContain('tabular-nums');
  });
});
