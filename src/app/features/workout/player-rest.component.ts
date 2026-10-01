import { Component, computed, input, model, output } from '@angular/core';

import { ExercisePictureComponent } from './exercise-picture.component';
import { PlayerRingComponent } from './player-ring.component';
import { PlayerStageComponent } from './player-stage.component';
import { StageExercise } from './stage-exercise';
import { StepCarouselComponent } from './step-carousel.component';

/**
 * The rest between two sets: a large ring counting down, what comes next (with its picture and
 * first step when it is another exercise), and one line of fact from the coach.
 */
@Component({
  selector: 'app-player-rest',
  imports: [PlayerStageComponent, ExercisePictureComponent, StepCarouselComponent, PlayerRingComponent],
  templateUrl: './player-rest.component.html',
  styleUrl: './player-rest.component.scss'
})
export class PlayerRestComponent {
  readonly exercise = input.required<StageExercise>();
  readonly clock = input.required<string>();
  readonly share = input(1);
  readonly kicker = input('Next');
  /** The name of the next exercise; left empty when the next set is of the same exercise. */
  readonly nextName = input('');
  readonly line = input('');
  readonly coachLine = input('');
  readonly stepIndex = model(0);
  readonly reading = model(false);
  readonly reducedMotion = input(false);
  readonly holdSteps = input(false);
  /** Whole seconds of rest left, so the figure can pulse in the last three. */
  readonly secondsLeft = input<number | null>(null);

  protected readonly urgent = computed(() => {
    const left = this.secondsLeft();
    return left !== null && left > 0 && left <= 3;
  });

  readonly addTime = output<void>();
  readonly skip = output<void>();
  readonly ask = output<void>();
  readonly howTo = output<void>();
  readonly imageFailed = output<void>();
}
