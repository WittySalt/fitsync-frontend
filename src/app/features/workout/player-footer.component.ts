import { Component, ElementRef, HostListener, inject, input, output, signal, viewChild } from '@angular/core';

import { SpotlightDirective } from '../../core/guide/spotlight.directive';

/**
 * Pause and Finish on the left, and a "More" menu on the right for the two things that are not
 * the next step: leaving out the rest of this exercise, and discarding the workout. The menu is a
 * disclosure: a button that says whether it is open, Escape or a tap outside closes it.
 */
@Component({
  selector: 'app-player-footer',
  imports: [SpotlightDirective],
  templateUrl: './player-footer.component.html',
  styleUrl: './player-footer.component.scss'
})
export class PlayerFooterComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly paused = input(false);
  readonly busy = input(false);
  readonly pauseToggle = output<void>();
  readonly finishRequest = output<void>();
  readonly skipExercise = output<void>();
  readonly discard = output<void>();

  protected readonly menuOpen = signal(false);
  private readonly toggle = viewChild<ElementRef<HTMLButtonElement>>('toggle');

  protected pick(action: 'skip' | 'discard'): void {
    this.menuOpen.set(false);
    if (action === 'skip') {
      this.skipExercise.emit();
    } else {
      this.discard.emit();
    }
  }

  @HostListener('document:click', ['$event'])
  protected closeOnOutsideClick(event: Event): void {
    if (this.menuOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('keydown.escape')
  protected closeOnEscape(): void {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
      this.toggle()?.nativeElement.focus();
    }
  }
}
