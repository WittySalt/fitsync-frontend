import { DestroyRef, ElementRef, Signal, afterNextRender, inject, signal } from '@angular/core';

/**
 * The pixel width of the host element, kept up to date with a ResizeObserver. A chart builds its
 * viewBox from it, so one drawing unit is one pixel and text is never scaled with the drawing.
 * Until the first measurement, and when nothing can be measured (a hidden host, no ResizeObserver),
 * the signal holds `fallback`. Call it in an injection context, as a field initialiser.
 */
export function measureWidth(fallback = 320, host: ElementRef<HTMLElement> = inject(ElementRef<HTMLElement>)): Signal<number> {
  const width = signal(fallback);
  const element = host.nativeElement;
  const read = (value: number): void => {
    const next = Math.round(value);
    if (next > 0 && next !== width()) {
      width.set(next);
    }
  };
  const destroyRef = inject(DestroyRef);
  afterNextRender(() => {
    read(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      read(entry ? entry.contentRect.width : element.clientWidth);
    });
    observer.observe(element);
    destroyRef.onDestroy(() => observer.disconnect());
  });
  return width.asReadonly();
}
