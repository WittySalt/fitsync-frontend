import { Component, ElementRef, HostListener, afterNextRender, inject, input, model, output, signal, viewChild } from '@angular/core';

import { ExerciseVideoComponent } from './exercise-video.component';
import { SpeechService } from './speech.service';

/**
 * The full guide of an exercise: the large picture, what it works, every step with the one on the
 * carousel marked, and a way back to the set. On a phone it is a view inside the exercise screen
 * ("inline", with a Back button and the clock), on wider screens the same content sits in a dialog.
 */
@Component({
  selector: 'app-exercise-guide',
  imports: [ExerciseVideoComponent],
  templateUrl: './exercise-guide.component.html',
  styleUrl: './exercise-guide.component.scss'
})
export class ExerciseGuideComponent {
  protected readonly speech = inject(SpeechService);

  readonly name = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly alt = input('Exercise movement reference');
  readonly initial = input('E');
  readonly chips = input<string[]>([]);
  readonly steps = input<string[]>([]);
  readonly description = input('');
  readonly videoUrl = input<string | null>(null);
  /** The step the carousel is on. */
  readonly currentStep = input(0);
  readonly reading = model(false);
  readonly backLabel = input('Back to the set');
  readonly inline = input(false);
  readonly clock = input('');
  readonly back = output<void>();

  protected readonly imageBroken = signal(false);
  private readonly backButton = viewChild<ElementRef<HTMLButtonElement>>('backButton');

  constructor() {
    afterNextRender(() => this.backButton()?.nativeElement.focus());
  }

  /** Escape closes the full view; the dialog has its own Escape. */
  @HostListener('keydown.escape')
  protected closeOnEscape(): void {
    if (this.inline()) {
      this.back.emit();
    }
  }

  protected toggleReading(): void {
    if (this.reading()) {
      this.speech.cancel();
    }
    this.reading.update((on) => !on);
  }
}
