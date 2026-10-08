import { Component, OnDestroy, computed, effect, input, output, signal, untracked } from '@angular/core';

import { flipOnChange } from './flip-on-change';

export type PictureVariant = 'lead' | 'hero' | 'plain';

/** How long the picture of the exercise before stays under the new one. */
const CROSS_FADE_MS = 300;

/**
 * The picture of an exercise, as a button: a tap opens the full guide. It shows the placeholder
 * when there is no picture or the picture cannot be loaded, and tells its owner so that the next
 * frame can be tried. When the exercise changes, the new picture fades in over the old one; the
 * frames of one exercise follow each other without a fade.
 */
@Component({
  selector: 'app-exercise-picture',
  host: { '[class]': 'variant()' },
  template: `
    <button type="button" class="pic" aria-label="How to perform this exercise" (click)="opened.emit()">
      <span class="movement-media">
        @if (showImage()) {
          @if (before(); as old) {
            <img class="before" [src]="old" alt="" aria-hidden="true" />
          }
          <img
            [class.fade]="!!before()"
            [class.a]="!flipped()"
            [class.b]="flipped()"
            [src]="url()"
            [alt]="alt()"
            (error)="broken(url()); failed.emit()"
          />
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
export class ExercisePictureComponent implements OnDestroy {
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
  /** The picture of the exercise that was on screen before, while the new one fades in over it. */
  protected readonly before = signal<string | null>(null);

  /** Turns over with every new picture, so the fade starts again. */
  protected readonly flipped = flipOnChange(() => this.url());

  private shownUrl: string | null = null;
  private shownAlt = '';
  private clearId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const url = this.url();
      const alt = this.alt();
      untracked(() => {
        // The frames of one exercise share its alt text, so a new alt is what marks a new exercise.
        if (this.shownUrl && url && url !== this.shownUrl && alt !== this.shownAlt) {
          this.before.set(this.shownUrl);
          this.clearTimer();
          this.clearId = setTimeout(() => this.before.set(null), CROSS_FADE_MS);
        }
        if (url) {
          this.shownUrl = url;
          this.shownAlt = alt;
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  protected broken(url: string | null): void {
    this.brokenUrl.set(url);
  }

  private clearTimer(): void {
    if (this.clearId) {
      clearTimeout(this.clearId);
      this.clearId = null;
    }
  }
}
