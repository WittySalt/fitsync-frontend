import { afterNextRender, DestroyRef, ElementRef, inject, Signal, signal } from '@angular/core';

/** The three width bands every plan-flow layout is specified in. */
export type WidthBand = 'wide' | 'medium' | 'narrow';

export const WIDE_MIN = 900;
export const MEDIUM_MIN = 600;

/** The band of a component's own width in pixels, never of the viewport. */
export function widthBand(width: number): WidthBand {
  if (width >= WIDE_MIN) {
    return 'wide';
  }
  return width >= MEDIUM_MIN ? 'medium' : 'narrow';
}

/**
 * Follows the width of the host element and gives its band as a signal. Call it in an injection
 * context. Until the element has been measured the band is wide.
 */
export function observeBand(host: ElementRef<HTMLElement>): Signal<WidthBand> {
  const band = signal<WidthBand>('wide');
  const destroyRef = inject(DestroyRef);
  afterNextRender(() => {
    const element = host.nativeElement;
    const measured = element.getBoundingClientRect().width;
    if (measured) {
      band.set(widthBand(measured));
    }
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        band.set(widthBand(width));
      }
    });
    observer.observe(element);
    destroyRef.onDestroy(() => observer.disconnect());
  });
  return band;
}
