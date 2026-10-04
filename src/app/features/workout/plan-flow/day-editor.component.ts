import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { SportActivityOption } from '../../../core/fitsync.models';
import { PlanDayGlyphComponent } from '../plan-day-glyph.component';
import { PlanSetEntry } from '../plan-editor/moves/moves-model';
import { PlanMovesTableComponent } from '../plan-editor/moves/plan-moves-table.component';
import { CardioCardComponent } from './cardio-card.component';
import { KindTilesComponent } from './kind-tiles.component';
import { DraftDay, DraftMove, DraftSegment, FLOW_KIND_LABELS, FlowKind, WEEKDAY_SHORT } from './plan-draft';
import { LastCardio } from './plan-flow.api';
import { movesToSetEntries, setEntriesToMoves } from './plan-move-mapper';
import { HabitActivity } from './plan-week-proposal';
import { SportCardComponent } from './sport-card.component';

/**
 * The editor for the selected day: a head row with the kind and a Change kind button, the name
 * and duration, and a body that depends on the kind. A rest day opens the kind tiles at once.
 */
@Component({
  selector: 'app-plan-day-editor',
  imports: [PlanDayGlyphComponent, KindTilesComponent, CardioCardComponent, SportCardComponent, PlanMovesTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-editor.component.html',
  styleUrl: './day-editor.component.scss'
})
export class DayEditorComponent {
  readonly day = input.required<DraftDay>();
  readonly kindsOpen = input(false);
  readonly sports = input<SportActivityOption[]>([]);
  readonly habits = input<HabitActivity[]>([]);
  readonly lastCardio = input<LastCardio | null>(null);
  readonly problem = input<string | null>(null);

  readonly toggleKinds = output<void>();
  readonly kindChosen = output<FlowKind>();
  readonly patch = output<Partial<DraftDay>>();
  readonly minutesChange = output<number | null>();
  readonly segmentsChange = output<DraftSegment[]>();
  readonly movesChange = output<DraftMove[]>();
  readonly moveTo = output<number>();

  protected readonly weekdays = WEEKDAY_SHORT;
  protected readonly head = computed(() => {
    const day = this.day();
    const parts: string[] = [WEEKDAY_SHORT[day.dayOfWeek - 1]];
    if (day.kind === 'REST') {
      parts.push('Rest');
    } else {
      if (day.title.trim() && day.title.trim() !== FLOW_KIND_LABELS[day.kind]) {
        parts.push(day.title.trim());
      }
      parts.push(FLOW_KIND_LABELS[day.kind]);
      if (day.minutes) {
        parts.push(`${day.minutes} min`);
      }
    }
    return parts.join(' · ');
  });

  /** The table edits rows; the day keeps draft moves, so the mapper sits between them. */
  protected readonly rows = computed(() => movesToSetEntries(this.day().moves));

  protected setRows(rows: PlanSetEntry[]): void {
    this.movesChange.emit(setEntriesToMoves(rows, this.day().moves));
  }

  protected setMinutes(raw: string): void {
    this.minutesChange.emit(raw === '' ? null : Math.round(Number(raw)));
  }

  protected setMoveTo(raw: string): void {
    const target = Number(raw);
    if (target >= 1 && target <= 7 && target !== this.day().dayOfWeek) {
      this.moveTo.emit(target);
    }
  }
}
