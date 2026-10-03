import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { DAY_KIND_GLYPHS } from '../../../dashboard/brief/day-kind-icons';
import { GlyphShape } from '../../../dashboard/brief/muscle-icons';
import { CalendarDay, TrainingKind } from '../training.models';
import { calendarPage } from './calendar-grid';

/**
 * A faithful copy of the Home month view's calendar for a period, since the Home calendar reads
 * the month view's own state and cannot stand alone. A trained day opens its session when the
 * backend names it, else Workout History; days outside the period are dashed and faded.
 */
@Component({
  selector: 'app-training-calendar',
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './training-calendar.component.html',
  styleUrl: './training-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrainingCalendarComponent {
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  readonly days = input<readonly CalendarDay[]>([]);
  readonly showKey = input(true);
  /** False draws the days as a picture only, for a card that opens a page as a whole. */
  readonly interactive = input(true);

  protected readonly initials = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  protected readonly keyKinds: { kind: TrainingKind; label: string }[] = [
    { kind: 'STRENGTH', label: 'Strength' },
    { kind: 'CARDIO', label: 'Cardio' },
    { kind: 'SPORT', label: 'Sport' }
  ];
  private readonly page = signal<number | undefined>(undefined);
  protected readonly view = computed(() => calendarPage(this.from(), this.to(), this.days(), this.page()));
  protected readonly index = computed(() => this.page() ?? this.view().pages - 1);

  constructor() {
    // A new period starts on its last page again.
    effect(() => {
      this.from();
      this.to();
      this.page.set(undefined);
    });
  }

  protected glyph(kind: TrainingKind | null): GlyphShape[] {
    return kind ? DAY_KIND_GLYPHS[kind] : [];
  }

  protected move(step: number): void {
    this.page.set(Math.min(this.view().pages - 1, Math.max(0, this.index() + step)));
  }
}
