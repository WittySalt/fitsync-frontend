import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { DraftSegment, SegmentKind } from '../plan-draft';
import {
  addSegment,
  KIND_OPTIONS,
  labelFor,
  MAX_PAIR_ROUNDS,
  MAX_SEGMENT_MINUTES,
  MAX_SEGMENTS,
  moveSegment,
  pairRoles,
  removeSegment,
  repeatRow,
  setPairRounds,
  setSegmentKind,
  setSegmentMinutes,
  stepSegmentMinutes,
  unpair
} from './segment-list-math';

/**
 * The rows of a day's shape, in the same row language as the moves table: a handle to reorder,
 * the kind, the minutes with steppers, Repeat, and a red trash. Any rows in any order are fine.
 * Two neighbouring rows can repeat together, shown with their round count on the first of them.
 */
@Component({
  selector: 'app-segment-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segment-list.component.html',
  styleUrl: './segment-list.component.scss'
})
export class SegmentListComponent {
  readonly segments = input.required<DraftSegment[]>();
  /** A sport day: its steady stretch is called Play. */
  readonly play = input(false);
  readonly segmentsChange = output<DraftSegment[]>();

  protected readonly kinds = KIND_OPTIONS;
  protected readonly maxRounds = MAX_PAIR_ROUNDS;
  protected readonly maxMinutes = MAX_SEGMENT_MINUTES;
  protected readonly roles = computed(() => pairRoles(this.segments()));
  protected readonly full = computed(() => this.segments().length >= MAX_SEGMENTS);
  protected readonly dragging = signal<number | null>(null);
  protected readonly over = signal<number | null>(null);

  protected kindLabel(kind: SegmentKind): string {
    return labelFor(kind, this.play());
  }

  protected emit(next: DraftSegment[]): void {
    this.segmentsChange.emit(next);
  }

  protected setKind(index: number, raw: string): void {
    this.emit(setSegmentKind(this.segments(), index, raw as SegmentKind, this.play()));
  }

  protected setMinutes(index: number, raw: string): void {
    this.emit(setSegmentMinutes(this.segments(), index, raw === '' ? NaN : Number(raw)));
  }

  protected step(index: number, by: number): void {
    this.emit(stepSegmentMinutes(this.segments(), index, by));
  }

  protected add(): void {
    this.emit(addSegment(this.segments(), this.play()));
  }

  protected remove(index: number): void {
    this.emit(removeSegment(this.segments(), index));
  }

  protected repeat(index: number): void {
    this.emit(repeatRow(this.segments(), index, undefined, this.play()));
  }

  protected stopRepeat(index: number): void {
    this.emit(unpair(this.segments(), index));
  }

  protected rounds(index: number, by: number): void {
    const current = this.segments()[index]?.rounds ?? 2;
    this.emit(setPairRounds(this.segments(), index, current + by));
  }

  protected shift(index: number, by: number): void {
    const to = index + by;
    if (to < 0 || to >= this.segments().length) {
      return;
    }
    this.emit(moveSegment(this.segments(), index, index + by));
  }

  protected handleKey(event: KeyboardEvent, index: number): void {
    const by = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!by) {
      return;
    }
    event.preventDefault();
    this.shift(index, by);
  }

  protected dragStart(event: DragEvent, index: number): void {
    this.dragging.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  protected dragOver(event: DragEvent, index: number): void {
    if (this.dragging() === null) {
      return;
    }
    event.preventDefault();
    this.over.set(index);
  }

  protected drop(event: DragEvent, index: number): void {
    event.preventDefault();
    const from = this.dragging();
    this.dragEnd();
    if (from !== null && from !== index) {
      this.emit(moveSegment(this.segments(), from, index));
    }
  }

  protected dragEnd(): void {
    this.dragging.set(null);
    this.over.set(null);
  }
}
