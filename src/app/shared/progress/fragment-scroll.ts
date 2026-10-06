import { Injector, Signal, afterNextRender, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Scrolls to the section the address names (`/progress/training#muscles`) once the page has its
 * data, because the sections only exist after the read comes back. It scrolls once per page visit.
 */
export function useFragmentScroll(ready: Signal<boolean>): void {
  const route = inject(ActivatedRoute);
  const injector = inject(Injector);
  let done = false;
  effect(() => {
    const fragment = route.snapshot.fragment;
    if (!ready() || done || !fragment) {
      return;
    }
    done = true;
    afterNextRender(() => document.getElementById(fragment)?.scrollIntoView({ block: 'start' }), { injector });
  });
}
