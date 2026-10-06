import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { weekdayName } from './diary-time';

/**
 * The line a past day with nothing logged carries in the meals card: "Tuesday, nothing logged", two
 * pills to say what the day was ("I fasted" or "I ate, didn't log") and a link to log the usual
 * meals. Once a fast is marked the line becomes a "Fasted" row with the card menu, which holds
 * Delete only. Never shown for today.
 */
@Component({
  selector: 'app-day-mark',
  imports: [FoodGlyphComponent],
  template: `
    @if (fasted()) {
      <div class="row fasted">
        <strong>Fasted</strong>
        <span class="more-wrap">
          <button
            class="more"
            type="button"
            aria-haspopup="menu"
            aria-label="More for Fasted"
            [attr.aria-expanded]="menuOpen()"
            [disabled]="busy()"
            (click)="toggleMenu($event)"
          >
            <app-food-glyph name="MORE" [size]="18" [strokeWidth]="2.4" />
          </button>
          @if (menuOpen()) {
            <div class="menu" role="menu">
              <button class="delete" type="button" role="menuitem" (click)="remove()">Delete</button>
            </div>
          }
        </span>
      </div>
    } @else if (offered()) {
      <div class="row ask" role="group" [attr.aria-label]="weekday() + ', nothing logged'">
        <span class="line">{{ weekday() }}, nothing logged</span>
        <span class="pills">
          <button type="button" class="pill" [disabled]="busy()" (click)="fast.emit()">I fasted</button>
          <button type="button" class="pill" [disabled]="busy()" (click)="ate.emit()">I ate, didn't log</button>
        </span>
        @if (hasUsual()) {
          <button type="button" class="link" [disabled]="busy()" (click)="usual.emit()">Log my usual</button>
        }
      </div>
    }
  `,
  styleUrl: './day-mark.component.scss'
})
export class DayMarkComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The day shown, "YYYY-MM-DD". */
  readonly date = input.required<string>();
  /** Set when the day holds a fasted mark. */
  readonly fasted = input(false);
  /** True for a past day with no meal at all and no answer given yet this session. */
  readonly offered = input(false);
  readonly hasUsual = input(false);
  readonly busy = input(false);
  readonly fast = output<void>();
  readonly ate = output<void>();
  readonly usual = output<void>();
  readonly deleteFast = output<void>();

  protected readonly menuOpen = signal(false);
  protected readonly weekday = computed(() => weekdayName(this.date()));

  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  protected remove(): void {
    this.menuOpen.set(false);
    this.deleteFast.emit();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    if (this.menuOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.menuOpen.set(false);
  }
}
