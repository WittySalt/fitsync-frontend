import { DestroyRef, ElementRef, Signal, afterNextRender, computed, inject, signal } from '@angular/core';

/**
 * The pixel width of the component's host, kept current with a ResizeObserver, so a chart can build
 * its SVG at the size it is shown at and its text is never scaled. Until the first measure, and where
 * there is no layout, it reads `fallback`.
 */
export function hostWidth(fallback = 480): Signal<number> {
  const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const destroyRef = inject(DestroyRef);
  const measured = signal(0);
  afterNextRender(() => {
    measured.set(Math.floor(element.clientWidth));
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => measured.set(Math.floor(element.clientWidth)));
    observer.observe(element);
    destroyRef.onDestroy(() => observer.disconnect());
  });
  return computed(() => (measured() > 0 ? measured() : fallback));
}
