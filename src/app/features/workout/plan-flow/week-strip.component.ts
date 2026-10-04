import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal } from '@angular/core';

import { PlanDayGlyphComponent } from '../plan-day-glyph.component';
import { DraftDay, FLOW_KIND_LABELS, WEEKDAY_LETTER, WEEKDAY_SHORT } from './plan-draft';
import { observeBand } from './width-band';

/**
 * The week as seven day tiles. One arrangement per band of the strip's own width: wide tiles show
 * the weekday, glyph, title and duration; medium ones the weekday, glyph and duration; narrow
 * ones only the weekday letter and glyph, and scroll sideways if the seven do not fit. On a
 * pointer device a tile can be dragged onto another weekday to swap the two days.
 */
@Component({
  selector: 'app-plan-week-strip',
  imports: [PlanDayGlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-strip.component.html',
  styleUrl: './week-strip.component.scss'
})
export class WeekStripComponent {
  readonly days = input.required<DraftDay[]>();
  readonly selected = input.required<number>();
  readonly pick = output<number>();
  readonly move = output<{ from: number; to: number }>();

  protected readonly band = observeBand(inject(ElementRef));
  protected readonly dragging = signal<number | null>(null);
  protected readonly over = signal<number | null>(null);
  protected readonly canDrag = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
  protected readonly short = WEEKDAY_SHORT;
  protected readonly letters = WEEKDAY_LETTER;

  protected title(day: DraftDay): string {
    return day.kind === 'REST' ? 'Rest' : day.title || FLOW_KIND_LABELS[day.kind];
  }

  protected duration(day: DraftDay): string {
    return day.kind === 'REST' || !day.minutes ? '' : `${day.minutes} min`;
  }

  protected label(day: DraftDay): string {
    const name = WEEKDAY_SHORT[day.dayOfWeek - 1];
    return day.kind === 'REST'
      ? `${name}, rest day`
      : `${name}, ${FLOW_KIND_LABELS[day.kind]}, ${this.title(day)}${day.minutes ? `, ${day.minutes} minutes` : ''}`;
  }

  protected dragStart(event: DragEvent, day: DraftDay): void {
    this.dragging.set(day.dayOfWeek);
    event.dataTransfer?.setData('text/plain', String(day.dayOfWeek));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  protected dragOver(event: DragEvent, day: DraftDay): void {
    if (this.dragging() === null) {
      return;
    }
    event.preventDefault();
    this.over.set(day.dayOfWeek);
  }

  protected drop(event: DragEvent, day: DraftDay): void {
    event.preventDefault();
    const from = this.dragging();
    this.dragEnd();
    if (from !== null && from !== day.dayOfWeek) {
      this.move.emit({ from, to: day.dayOfWeek });
    }
  }

  protected dragEnd(): void {
    this.dragging.set(null);
    this.over.set(null);
  }
}
