import { Component, OnDestroy, OnInit, computed, input, model, output, signal } from '@angular/core';

import { ExercisePictureComponent } from './exercise-picture.component';
import { PlayerRingComponent } from './player-ring.component';
import { PlayerStageComponent } from './player-stage.component';
import { StageExercise } from './stage-exercise';
import { StepCarouselComponent } from './step-carousel.component';

/** Seconds of "get ready" before a timed set starts. */
export const COUNTDOWN_SECONDS = 3;

/**
 * The two screens that put a ring in the middle of a timed set. "countdown" counts three, two, one
 * before the set starts and can be skipped; "timed" is the set itself, a ring that empties.
 */
@Component({
  selector: 'app-player-timer-stage',
  imports: [PlayerStageComponent, ExercisePictureComponent, StepCarouselComponent, PlayerRingComponent],
  templateUrl: './player-timer-stage.component.html',
  styleUrl: './player-timer-stage.component.scss'
})
export class PlayerTimerStageComponent implements OnInit, OnDestroy {
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
  readonly paused = input(false);
  readonly canStop = input(false);

  /** The countdown reached zero, or the person skipped it. */
  readonly started = output<void>();
  readonly pauseToggle = output<void>();
  readonly stop = output<void>();
  readonly howTo = output<void>();
  readonly imageFailed = output<void>();

  protected readonly remaining = signal(COUNTDOWN_SECONDS);
  protected readonly countdownShare = computed(() => this.remaining() / COUNTDOWN_SECONDS);
  protected readonly countdownLabel = computed(() => `Starting in ${this.remaining()} seconds`);

  private timerId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (this.mode() === 'countdown') {
      this.timerId = setInterval(() => this.tick(), 1000);
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
    if (this.remaining() === 0) {
      this.skip();
    }
  }

  private clear(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
