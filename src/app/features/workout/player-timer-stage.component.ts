import { Component, Injector, OnDestroy, OnInit, afterNextRender, computed, inject, input, model, output, signal } from '@angular/core';

import { ExercisePictureComponent } from './exercise-picture.component';
import { PlayerRingComponent } from './player-ring.component';
import { PlayerStageComponent } from './player-stage.component';
import { StageExercise } from './stage-exercise';
import { StepCarouselComponent } from './step-carousel.component';

/** Seconds of "get ready" before a set starts. */
export const COUNTDOWN_SECONDS = 3;
/** How long "Go" stays on screen before the set takes over. */
export const COUNTDOWN_GO_MS = 400;

/**
 * The two screens that put a ring in the middle of a set. "countdown" counts three, two, one and
 * "Go" before the set starts and can be skipped; "timed" is the set itself, a ring that empties.
 */
@Component({
  selector: 'app-player-timer-stage',
  imports: [PlayerStageComponent, ExercisePictureComponent, StepCarouselComponent, PlayerRingComponent],
  templateUrl: './player-timer-stage.component.html',
  styleUrl: './player-timer-stage.component.scss'
})
export class PlayerTimerStageComponent implements OnInit, OnDestroy {
  private readonly injector = inject(Injector);

  readonly mode = input.required<'countdown' | 'timed'>();
  readonly exercise = input.required<StageExercise>();
  readonly kicker = input('');
  readonly line = input('');
  readonly stepIndex = model(0);
  readonly reading = model(false);
  readonly reducedMotion = input(false);
  readonly holdSteps = input(false);
  /** The timed set: the share left, the figure in the ring, what it counts, and its text equivalent. */
  readonly share = input(1);
  readonly figure = input('');
  readonly caption = input('Left');
  readonly label = input('');
  readonly canStop = input(false);
  /** Whole seconds left in the set, so the ring can warn in the last three. */
  readonly secondsLeft = input<number | null>(null);

  /** The countdown reached zero, or the person skipped it. */
  readonly started = output<void>();
  /** Each figure of the countdown, once, for the status announcer of the screen. */
  readonly announce = output<string>();
  readonly stop = output<void>();
  readonly howTo = output<void>();
  readonly imageFailed = output<void>();

  protected readonly remaining = signal(COUNTDOWN_SECONDS);
  protected readonly going = signal(false);
  protected readonly countdownShare = computed(() => this.remaining() / COUNTDOWN_SECONDS);
  protected readonly countdownLabel = computed(() => (this.going() ? 'Go' : `Starting in ${this.remaining()} seconds`));
  protected readonly urgent = computed(() => {
    const left = this.secondsLeft();
    return left !== null && left > 0 && left <= 3;
  });

  private timerId: ReturnType<typeof setInterval> | null = null;
  private goId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.mode() === 'countdown') {
      this.timerId = setInterval(() => this.tick(), 1000);
      afterNextRender(() => this.announce.emit(String(COUNTDOWN_SECONDS)), { injector: this.injector });
    }
  }

  ngOnDestroy(): void {
    this.clear();
  }

  protected skip(): void {
    this.clear();
    this.started.emit();
  }

  private tick(): void {
    this.remaining.update((value) => Math.max(0, value - 1));
    if (this.remaining() > 0) {
      this.announce.emit(String(this.remaining()));
      return;
    }
    // Zero shows "Go" for a moment, then the set takes over.
    this.clearTick();
    this.going.set(true);
    this.announce.emit('Go');
    this.goId = setTimeout(() => this.skip(), COUNTDOWN_GO_MS);
  }

  private clearTick(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private clear(): void {
    this.clearTick();
    if (this.goId) {
      clearTimeout(this.goId);
      this.goId = null;
    }
  }
}
