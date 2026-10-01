import { Component, Injector, OnDestroy, OnInit, afterNextRender, computed, inject, input, model, output, signal } from '@angular/core';

import { ExercisePictureComponent } from './exercise-picture.component';
import { PlayerRingComponent } from './player-ring.component';
import { PlayerStageComponent } from './player-stage.component';
import { SetDot } from './player-targets';
import { StageExercise } from './stage-exercise';
import { StepCarouselComponent } from './step-carousel.component';

/** Seconds of "get ready" before a set starts. */
export const COUNTDOWN_SECONDS = 3;
/** How long "Go" stays on screen before the set takes over. */
export const COUNTDOWN_GO_MS = 400;

/**
 * The screens that put a ring beside the picture while a set is under way. "countdown" counts
 * three, two, one and "Go" before the set starts and can be skipped; "timed" is a timed set, a ring
 * that empties; "counting" is a set of reps, a ring that fills at the tempo; "done" draws a check
 * when the set was recorded. Following along, a running set offers "+5 sec" and "Done"; logging by
 * hand, it offers the button that records it.
 */
@Component({
  selector: 'app-player-timer-stage',
  imports: [PlayerStageComponent, ExercisePictureComponent, StepCarouselComponent, PlayerRingComponent],
  templateUrl: './player-timer-stage.component.html',
  styleUrl: './player-timer-stage.component.scss'
})
export class PlayerTimerStageComponent implements OnInit, OnDestroy {
  private readonly injector = inject(Injector);

  readonly mode = input.required<'countdown' | 'timed' | 'counting' | 'done'>();
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
  /** The sets of the exercise as dots, beside the line under the name. */
  readonly dots = input<readonly SetDot[]>([]);
  /** Lines beside the ring: the weight first, then the tempo. */
  readonly sideLines = input<readonly string[]>([]);
  /** Following along: "+5 sec" and "Done" instead of the button that records the set. */
  readonly follow = input(false);
  /** A set of reps reached its count, so "Complete set" draws the eye. */
  readonly reached = input(false);
  readonly busy = input(false);
  /** The set that was just recorded: "Set 2 done", and its values. */
  readonly doneTitle = input('');
  readonly doneLine = input('');

  /** The countdown reached zero, or the person skipped it. */
  readonly started = output<void>();
  /** Each figure of the countdown, once, for the status announcer of the screen. */
  readonly announce = output<string>();
  /** "Done", "Stop and save" or "Complete set": the set is recorded now. */
  readonly finishNow = output<void>();
  readonly addTime = output<void>();
  readonly howTo = output<void>();
  readonly imageFailed = output<void>();

  protected readonly remaining = signal(COUNTDOWN_SECONDS);
  protected readonly going = signal(false);
  protected readonly countdownShare = computed(() => this.remaining() / COUNTDOWN_SECONDS);
  protected readonly countdownLabel = computed(() => (this.going() ? 'Go' : `Starting in ${this.remaining()} seconds`));
  protected readonly urgent = computed(() => {
    if (this.mode() === 'counting') {
      return this.reached();
    }
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
