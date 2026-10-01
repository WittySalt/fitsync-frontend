import { Component, computed, input, model, output } from '@angular/core';

import { ExercisePictureComponent } from './exercise-picture.component';
import { PlayerRingComponent } from './player-ring.component';
import { PlayerSetValuesComponent } from './player-set-values.component';
import { PlayerStageComponent } from './player-stage.component';
import { StageExercise } from './stage-exercise';
import { StepCarouselComponent } from './step-carousel.component';

/**
 * The rest between two sets: a large ring counting down, the set that was just done (a tap opens
 * it to correct it), what comes next (with its picture and first step when it is another
 * exercise, with its reps and weight to choose when it is the same one), and one line of fact
 * from the coach.
 */
@Component({
  selector: 'app-player-rest',
  imports: [PlayerStageComponent, ExercisePictureComponent, StepCarouselComponent, PlayerRingComponent, PlayerSetValuesComponent],
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
  /** "Set 2 · 10 × 20 kg", the set that was just done; empty when there is none to show. */
  readonly justDone = input('');
  readonly canEdit = input(false);
  /** The steppers of the next set of the same exercise, or null when the next set is another exercise. */
  readonly nextValues = input<{ timed: boolean; hasReps: boolean; hasWeight: boolean } | null>(null);
  readonly nextReps = model(0);
  readonly nextWeight = model(0);
  readonly nextDuration = model(0);
  /** Following along: the next set starts by itself, said once at the foot of the rest. */
  readonly autoLine = input('');

  protected readonly urgent = computed(() => {
    const left = this.secondsLeft();
    return left !== null && left > 0 && left <= 3;
  });

  readonly addTime = output<void>();
  readonly skip = output<void>();
  readonly editDone = output<void>();
  readonly ask = output<void>();
  readonly howTo = output<void>();
  readonly imageFailed = output<void>();
}
