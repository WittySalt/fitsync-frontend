import { Signal, effect, signal, untracked } from '@angular/core';

/**
 * A flag that turns over every time the source changes. A CSS animation that is named after the
 * flag ("pop-a", "pop-b") starts again at every change, without taking the element out and putting
 * it back. Call it where an effect may be created: a field of a component.
 */
export function flipOnChange(source: () => unknown): Signal<boolean> {
  const flipped = signal(false);
  let first = true;
  effect(() => {
    source();
    untracked(() => {
      if (first) {
        first = false;
        return;
      }
      flipped.update((value) => !value);
    });
  });
  return flipped.asReadonly();
}
