import { Component, ElementRef, HostListener, OnDestroy, afterNextRender, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';

import { ExerciseVideoComponent } from './exercise-video.component';
import { SpeechService } from './speech.service';

/**
 * The full guide of an exercise: the large picture, what it works, every original instruction in full, and a way back to the set. On a phone it is a view inside the exercise
 * screen ("inline", with a Back button and the clock), on wider screens the same content sits in a dialog.
 * "Read aloud" reads these steps in order, on its own; the carousel of the set keeps reading its short steps.
 */
@Component({
  selector: 'app-exercise-guide',
  imports: [ExerciseVideoComponent],
  templateUrl: './exercise-guide.component.html',
  styleUrl: './exercise-guide.component.scss'
})
export class ExerciseGuideComponent implements OnDestroy {
  protected readonly speech = inject(SpeechService);

  readonly name = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly alt = input('Exercise movement reference');
  readonly initial = input('E');
  readonly chips = input<string[]>([]);
  readonly steps = input<string[]>([]);
  readonly description = input('');
  readonly videoUrl = input<string | null>(null);
  readonly backLabel = input('Back to the set');
  readonly inline = input(false);
  readonly clock = input('');
  readonly back = output<void>();

  protected readonly imageBroken = signal(false);
  protected readonly reading = signal(false);
  private readonly readIndex = signal(0);
  private readonly backButton = viewChild<ElementRef<HTMLButtonElement>>('backButton');

  constructor() {
    afterNextRender(() => this.backButton()?.nativeElement.focus());
    // Speaks the step at readIndex whenever reading starts or moves on; each step's end advances readIndex.
    effect(() => {
      const reading = this.reading();
      const text = this.steps()[this.readIndex()] ?? '';
      untracked(() => {
        if (reading && text) {
          this.speech.speak(text, { ended: () => this.readNext(), failed: () => this.reading.set(false) });
        }
      });
    });
  }

  ngOnDestroy(): void {
    if (this.reading()) {
      this.speech.cancel();
    }
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
    this.readIndex.set(0);
    this.reading.update((on) => !on);
  }

  private readNext(): void {
    if (this.readIndex() < this.steps().length - 1) {
      this.readIndex.update((value) => value + 1);
      return;
    }
    this.readIndex.set(0);
    this.reading.set(false);
  }
}
