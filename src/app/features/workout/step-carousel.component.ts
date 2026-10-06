import { Component, OnDestroy, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';

import { flipOnChange } from './flip-on-change';
import { SpeechService } from './speech.service';
import { stepDwellMs } from './step-timing';

/**
 * The steps of an exercise, one at a time. While a set runs it turns by itself at reading pace (or
 * the set length shared evenly) and the last step stays until the set ends. The next set starts
 * from the first step again. A tap on a dot or on the caption stops the turn for the rest of that
 * set, and a tap on a held caption moves to the next step. The speaker reads the current step
 * aloud with the voice of the browser and holds the turn until the reading ends.
 */
@Component({
  selector: 'app-step-carousel',
  templateUrl: './step-carousel.component.html',
  styleUrl: './step-carousel.component.scss'
})
export class StepCarouselComponent implements OnDestroy {
  protected readonly speech = inject(SpeechService);

  readonly steps = input.required<string[]>();
  readonly index = model(0);
  readonly reading = model(false);
  /** Reduced motion only drops the slide of a new step; the steps still turn. */
  readonly reducedMotion = input(false);
  /** The workout is paused, or the guide is open over this carousel: nothing moves by itself. */
  readonly paused = input(false);
  /** A set is running: only then do the steps turn by themselves. */
  readonly running = input(false);
  /** The planned length of the running set in seconds, 0 when it is not known. */
  readonly setSeconds = input(0);
  readonly howTo = output<void>();

  protected readonly held = signal(false);

  private timerId: ReturnType<typeof setTimeout> | null = null;
  private stepsKey = '';

  protected readonly autoMoving = computed(
    () => this.running() && !this.held() && !this.paused() && this.steps().length > 1
  );
  protected readonly speaking = computed(() => this.reading() && this.speech.available);
  /** The step is announced when a person changes it, never while it turns by itself or is read aloud. */
  protected readonly liveMode = computed(() => (this.autoMoving() || this.speaking() ? 'off' : 'polite'));
  protected readonly current = computed(() => this.steps()[this.index()] ?? '');
  /** Turns over with every new step, so the slide starts again. */
  protected readonly flipped = flipOnChange(() => this.current());

  constructor() {
    effect(() => {
      const key = this.steps().join('\u0001');
      if (key === this.stepsKey) {
        return;
      }
      this.stepsKey = key;
      untracked(() => {
        this.held.set(false);
        if (this.index() >= this.steps().length) {
          this.index.set(0);
        }
      });
    });

    // Every set starts again from the first step, and a tap only holds for the set it was made in.
    effect(() => {
      const running = this.running();
      untracked(() => {
        this.held.set(false);
        if (running) {
          this.index.set(0);
        }
      });
    });

    effect(() => {
      const steps = this.steps();
      const index = this.index();
      const setSeconds = this.setSeconds();
      const auto = this.autoMoving();
      const speaking = this.speaking();
      this.clearTimer();
      if (!auto || speaking || !steps[index] || index >= steps.length - 1) {
        return;
      }
      this.timerId = setTimeout(() => this.advanceByTimer(), stepDwellMs(steps[index], setSeconds, steps.length));
    });

    effect(() => {
      const speaking = this.speaking();
      const text = this.current();
      untracked(() => {
        if (speaking && text) {
          this.speech.speak(text, { ended: () => this.readingEnded(), failed: () => this.reading.set(false) });
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
    if (this.speaking()) {
      this.speech.cancel();
    }
  }

  protected tap(): void {
    if (this.steps().length < 2) {
      return;
    }
    if (this.held() || !this.running()) {
      this.next();
      return;
    }
    this.held.set(true);
  }

  protected go(index: number): void {
    this.held.set(true);
    this.index.set(index);
  }

  protected toggleReading(): void {
    if (this.reading()) {
      this.speech.cancel();
    }
    this.reading.update((on) => !on);
  }

  private next(): void {
    this.index.set((this.index() + 1) % this.steps().length);
  }

  private advanceByTimer(): void {
    this.timerId = null;
    if (this.index() < this.steps().length - 1) {
      this.index.update((value) => value + 1);
    }
  }

  private readingEnded(): void {
    this.reading.set(false);
  }

  private clearTimer(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
