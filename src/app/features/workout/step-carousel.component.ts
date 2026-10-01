import { Component, OnDestroy, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';

import { SpeechService } from './speech.service';
import { stepDwellMs } from './step-timing';

/**
 * The steps of an exercise, one at a time. On its own it moves on at reading pace, goes round once
 * and settles on the first step. A tap holds it, and a tap on a held carousel moves to the next
 * step. With reduced motion it never moves by itself. The speaker reads the current step aloud
 * with the voice of the browser; while it reads, the end of a step replaces the timer.
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
  readonly reducedMotion = input(false);
  /** The workout is paused, or the guide is open over this carousel: nothing moves by itself. */
  readonly paused = input(false);
  readonly howTo = output<void>();

  protected readonly held = signal(false);
  protected readonly settled = signal(false);

  private timerId: ReturnType<typeof setTimeout> | null = null;
  private stepsKey = '';

  protected readonly autoMoving = computed(
    () => !this.held() && !this.settled() && !this.reducedMotion() && !this.paused() && this.steps().length > 1
  );
  protected readonly speaking = computed(() => this.reading() && this.speech.available);
  /** The step is announced when a person changes it, never while it turns by itself or is read aloud. */
  protected readonly liveMode = computed(() => (this.autoMoving() || this.speaking() ? 'off' : 'polite'));
  protected readonly current = computed(() => this.steps()[this.index()] ?? '');

  constructor() {
    effect(() => {
      const key = this.steps().join('\u0001');
      if (key === this.stepsKey) {
        return;
      }
      this.stepsKey = key;
      untracked(() => {
        this.held.set(false);
        this.settled.set(false);
        if (this.index() >= this.steps().length) {
          this.index.set(0);
        }
      });
    });

    effect(() => {
      const steps = this.steps();
      const index = this.index();
      const auto = this.autoMoving();
      const speaking = this.speaking();
      this.clearTimer();
      if (!auto || speaking || !steps[index]) {
        return;
      }
      this.timerId = setTimeout(() => this.advanceByTimer(), stepDwellMs(steps[index]));
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
    if (this.reducedMotion() || this.held()) {
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
      return;
    }
    this.index.set(0);
    this.settled.set(true);
  }

  private readingEnded(): void {
    if (this.held()) {
      return;
    }
    if (this.index() < this.steps().length - 1) {
      this.index.update((value) => value + 1);
      return;
    }
    this.index.set(0);
    this.settled.set(true);
    this.reading.set(false);
  }

  private clearTimer(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
