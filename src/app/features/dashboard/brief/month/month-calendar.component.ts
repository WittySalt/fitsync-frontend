import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, output, signal, untracked } from '@angular/core';

import { DayKind } from '../../../../core/fitsync.models';
import { DAY_KIND_GLYPHS, isTrainingDayKind } from '../day-kind-icons';
import { GlyphShape } from '../muscle-icons';
import { MonthLegendComponent } from './month-legend.component';
import { WEEKDAY_INITIALS, buildMonthGrid, daysInMonth, monthTitle, weekdayIndex } from './month-grid';
import { MonthViewState } from './month-view.state';

/**
 * The month's calendar: a header of weekday initials, one button for each date, and the legend.
 * It reads the month from the shared view state and only reports which date was chosen (to that
 * state, and through daySelected), so the panel beside it can react without the calendar knowing.
 */
@Component({
  selector: 'app-month-calendar',
  standalone: true,
  imports: [MonthLegendComponent],
  templateUrl: './month-calendar.component.html',
  styleUrl: './month-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthCalendarComponent {
  protected readonly state = inject(MonthViewState);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly daySelected = output<string>();

  protected readonly initials = WEEKDAY_INITIALS;

  protected readonly grid = computed(() =>
    buildMonthGrid({
      month: this.state.month(),
      days: this.state.insight()?.days ?? [],
      weighIns: this.state.weighIns(),
      referenceDate: this.state.referenceDate(),
      firstSessionDate: this.state.firstSessionDate()
    })
  );
  // While a muscle group is picked, the trained days that did not train it are drawn pale.
  protected readonly faded = computed<ReadonlySet<string>>(() => {
    const group = this.state.selectedMuscle();
    const days = this.state.insight()?.days ?? [];
    return new Set(group ? days.filter((day) => isTrainingDayKind(day.kind) && !day.muscles.includes(group)).map((day) => day.date) : []);
  });
  protected readonly groupLabel = computed(() => {
    const group = this.state.selectedMuscle();
    return this.state.insight()?.muscles.find((muscle) => muscle.group === group)?.label ?? '';
  });
  protected readonly loading = computed(() => this.state.status() === 'loading');
  protected readonly gridLabel = computed(() => monthTitle(this.state.month()));

  // Only one date is in the tab order (the one last focused, else today, else the first of the
  // month), and the arrow keys move between the rest.
  private readonly focusedDate = signal<string | null>(null);
  protected readonly tabbableDate = computed(() => {
    const month = this.state.month();
    const focused = this.focusedDate();
    if (focused?.startsWith(month)) {
      return focused;
    }
    const reference = this.state.referenceDate();
    return reference.startsWith(month) ? reference : `${month}-01`;
  });

  constructor() {
    // The button that lets go of a date goes away with the lower part of the panel, so the focus
    // returns to the date that was picked.
    effect(() => {
      const target = this.state.focusTarget();
      if (target?.kind === 'day') {
        untracked(() => {
          this.host.nativeElement.querySelector<HTMLButtonElement>(`[data-date="${target.key}"]`)?.focus();
          this.state.focusTarget.set(null);
        });
      }
    });
  }

  protected glyphFor(kind: DayKind): GlyphShape[] {
    return DAY_KIND_GLYPHS[kind];
  }

  protected select(dateKey: string): void {
    this.focusedDate.set(dateKey);
    this.state.selectDay(dateKey);
    this.daySelected.emit(dateKey);
  }

  protected onFocus(dateKey: string): void {
    this.focusedDate.set(dateKey);
  }

  protected onKeydown(event: KeyboardEvent, dateKey: string): void {
    const month = this.state.month();
    const day = Number(dateKey.slice(8));
    const last = daysInMonth(month);
    const weekday = weekdayIndex(dateKey);
    let target: number;
    switch (event.key) {
      case 'ArrowLeft':
        target = day - 1;
        break;
      case 'ArrowRight':
        target = day + 1;
        break;
      case 'ArrowUp':
        target = day - 7;
        break;
      case 'ArrowDown':
        target = day + 7;
        break;
      case 'Home':
        target = Math.max(1, day - weekday);
        break;
      case 'End':
        target = Math.min(last, day + 6 - weekday);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (target < 1 || target > last || target === day) {
      return;
    }
    const targetKey = `${month}-${String(target).padStart(2, '0')}`;
    this.focusedDate.set(targetKey);
    this.host.nativeElement.querySelector<HTMLButtonElement>(`[data-date="${targetKey}"]`)?.focus();
  }
}
