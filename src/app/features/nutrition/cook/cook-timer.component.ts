import { Component, OnDestroy, computed, effect, input, output, signal, untracked } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { unlockSound } from './cook-alert-sound';
import { clockText, durationText, rangeText } from './cook-format';
import { turnHeading } from './cook-recipe';
import { CookRetimeComponent } from './cook-retime.component';
import { CookSegmentsComponent } from './cook-segments.component';
import { TimerPhase, TimerState, remainingSeconds, segmentFills } from './cook-timer';

/** How long the completion animation runs before the wide button can be pressed. */
export const CELEBRATE_LOCK_MS = 1200;

/**
 * The timer area of a step. One wide button slot is always present, so the area never changes
 * height: it starts the timer, pauses it, starts the second side, or moves to the next step. The
 * timer never starts a side or turns the page by itself.
 */
@Component({
  selector: 'app-cook-timer',
  imports: [CookRetimeComponent, CookSegmentsComponent, FoodGlyphComponent],
  templateUrl: './cook-timer.component.html',
  styleUrl: './cook-timer.component.scss'
})
export class CookTimerComponent implements OnDestroy {
  readonly state = input.required<TimerState>();
  /** The clock, in epoch milliseconds, which the page ticks. */
  readonly now = input.required<number>();
  /** Tells a new step apart from a timer that ended, so a step change never plays the animation. */
  readonly stepKey = input<number>(0);
  /** What to turn, or null for "Turn it". */
  readonly subject = input<string | null>(null);
  readonly lastStep = input(false);

  readonly started = output<void>();
  readonly paused = output<void>();
  readonly resumed = output<void>();
  readonly minuteAdded = output<void>();
  readonly adjusted = output<1 | -1>();
  /** The cook typed a new time left, in seconds. */
  readonly retimed = output<number>();
  readonly next = output<void>();

  protected readonly editing = signal(false);
  protected readonly celebrating = signal(false);
  protected readonly locked = signal(false);
  private previous: TimerPhase | null = null;
  private lastKey: number | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly reducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected readonly phase = computed(() => this.state().phase);
  protected readonly minutesLeft = computed(() => Math.max(1, Math.ceil(remainingSeconds(this.state(), this.now()) / 60)));
  protected readonly clock = computed(() => clockText(remainingSeconds(this.state(), this.now())));
  protected readonly fills = computed(() => segmentFills(this.state(), this.now()));
  protected readonly range = computed(() => {
    const state = this.state();
    const text = rangeText(state.recipeSeconds, state.recipeMaxSeconds);
    return text ? `The recipe says ${text}` : '';
  });
  protected readonly stageLength = computed(() => durationText(this.state().stageSeconds));
  protected readonly intro = computed(() => {
    const state = this.state();
    return state.eachSide ? `First side, then the second · ${this.stageLength()} each` : this.stageLength();
  });
  protected readonly labels = computed(() => {
    const state = this.state();
    if (!state.eachSide) {
      return [''];
    }
    if (state.phase === 'turn') {
      return ['First side done', `Second side, ${this.stageLength()}`];
    }
    return ['First side', 'Second side'];
  });
  protected readonly activeIndex = computed(() => {
    const state = this.state();
    if (!state.eachSide) {
      return 0;
    }
    return state.phase === 'turn' ? 1 : state.phase === 'done' ? -1 : state.stage;
  });
  protected readonly heading = computed(() =>
    this.state().phase === 'turn' ? turnHeading(this.subject()) : this.state().eachSide ? 'Both sides done' : 'Done'
  );
  protected readonly sweepIndex = computed(() => (this.state().phase === 'turn' ? 0 : this.state().stage));
  protected readonly startLabel = computed(() =>
    this.state().phase === 'turn' ? 'Start the second side' : this.state().eachSide ? 'Start the first side' : 'Start timer'
  );
  protected readonly nextLabel = computed(() => (this.lastStep() ? 'Finish cooking' : 'Next step \u2192'));

  constructor() {
    effect(() => {
      const key = this.stepKey();
      const phase = this.phase();
      untracked(() => {
        if (key !== this.lastKey) {
          this.lastKey = key;
          this.stopCelebrating();
        } else if (this.previous === 'running' && (phase === 'turn' || phase === 'done')) {
          this.celebrate();
        } else if (phase === 'running' || phase === 'paused' || phase === 'idle') {
          this.stopCelebrating();
        }
        this.previous = phase;
      });
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  protected press(action: 'start' | 'pause' | 'resume' | 'next'): void {
    if (this.locked()) {
      return;
    }
    if (action === 'start') {
      unlockSound();
      this.started.emit();
    } else if (action === 'pause') {
      this.paused.emit();
    } else if (action === 'resume') {
      this.resumed.emit();
    } else {
      this.next.emit();
    }
  }

  protected retime(minutes: number): void {
    this.editing.set(false);
    this.retimed.emit(minutes * 60);
  }

  private celebrate(): void {
    if (this.reducedMotion) {
      return;
    }
    this.clearTimer();
    this.celebrating.set(true);
    this.locked.set(true);
    this.timeoutId = setTimeout(() => this.locked.set(false), CELEBRATE_LOCK_MS);
  }

  private stopCelebrating(): void {
    this.clearTimer();
    this.celebrating.set(false);
    this.locked.set(false);
  }

  private clearTimer(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
