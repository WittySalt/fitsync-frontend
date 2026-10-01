import { Component, computed, input, output, signal } from '@angular/core';

export type PictureVariant = 'lead' | 'hero' | 'plain';

/**
 * The picture of an exercise, as a button: a tap opens the full guide. It shows the placeholder
 * when there is no picture or the picture cannot be loaded, and tells its owner so that the next
 * frame can be tried.
 */
@Component({
  selector: 'app-exercise-picture',
  host: { '[class]': 'variant()' },
  template: `
    <button type="button" class="pic" aria-label="How to perform this exercise" (click)="opened.emit()">
      <span class="movement-media">
        @if (showImage()) {
          <img [src]="url()" [alt]="alt()" (error)="broken(url()); failed.emit()" />
        } @else {
          <span class="media-placeholder" aria-hidden="true">
            <span class="initial">{{ initial() }}</span>
            @if (caption()) {
              <small>{{ caption() }}</small>
            }
          </span>
        }
      </span>
      @if (frames() > 1) {
        <span class="dots" aria-hidden="true">
          @for (dot of dotList(); track dot) {
            <span [class.on]="dot === frame()"></span>
          }
        </span>
      }
    </button>
  `,
  styleUrl: './exercise-picture.component.scss'
})
export class ExercisePictureComponent {
  readonly url = input<string | null>(null);
  readonly alt = input('Exercise movement reference');
  readonly initial = input('E');
  readonly caption = input('');
  readonly variant = input<PictureVariant>('plain');
  /** How many frames the exercise has, and which one is showing. */
  readonly frames = input(0);
  readonly frame = input(0);
  readonly opened = output<void>();
  readonly failed = output<void>();

  private readonly brokenUrl = signal<string | null>(null);
  protected readonly showImage = computed(() => !!this.url() && this.url() !== this.brokenUrl());
  protected readonly dotList = computed(() => Array.from({ length: this.frames() }, (_, index) => index));

  protected broken(url: string | null): void {
    this.brokenUrl.set(url);
  }
}
