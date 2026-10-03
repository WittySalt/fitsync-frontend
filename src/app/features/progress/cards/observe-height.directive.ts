import { DestroyRef, Directive, ElementRef, afterNextRender, inject, output } from '@angular/core';

/** Reports the element's own height, now and whenever it changes, so a neighbour can match it. */
@Directive({ selector: '[appObserveHeight]' })
export class ObserveHeightDirective {
  readonly appObserveHeight = output<number>();

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.appObserveHeight.emit(Math.round(element.getBoundingClientRect().height));
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.appObserveHeight.emit(Math.round(element.getBoundingClientRect().height)));
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}

/** Reports the element's own width, now and whenever it changes. */
@Directive({ selector: '[appObserveWidth]' })
export class ObserveWidthDirective {
  readonly appObserveWidth = output<number>();

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.appObserveWidth.emit(Math.floor(element.clientWidth));
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.appObserveWidth.emit(Math.floor(element.clientWidth)));
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
