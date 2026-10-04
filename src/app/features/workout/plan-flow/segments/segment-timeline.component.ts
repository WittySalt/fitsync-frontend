import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';

import { hostWidth } from '../../../progress/cards/host-width';
import { DraftSegment } from '../plan-draft';
import { dragBoundary, segmentTotal, toBlocks } from './segment-math';

/** The gap between two blocks, which the pointer maths leaves out of the track. */
export const GAP_PX = 2;
/** A block shows its minutes only when it is at least this wide. */
export const MIN_LABEL_PX = 36;

/** The text a block carries: its minutes when there is room for them, otherwise nothing. */
export function blockText(widthPx: number, minutes: number): string {
  return widthPx >= MIN_LABEL_PX ? String(minutes) : '';
}

/**
 * The shape of a cardio or sport day as a draggable timeline, one thin bar like a video editor's
 * track. The boundaries between blocks carry a round grip that shows on hover or keyboard focus;
 * dragging it, or pressing the arrow keys for one minute, trades minutes between the two
 * neighbours so the total never changes. The rows of the segment list below it follow live.
 */
@Component({
  selector: 'app-segment-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segment-timeline.component.html',
  styleUrl: './segment-timeline.component.scss'
})
export class SegmentTimelineComponent {
  readonly segments = input.required<DraftSegment[]>();
  readonly segmentsChange = output<DraftSegment[]>();

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  private readonly width = hostWidth(600);
  protected readonly dragging = signal(false);
  private drag: { index: number; startX: number; start: DraftSegment[] } | null = null;

  protected readonly blocks = computed(() => toBlocks(this.segments()));
  protected readonly total = computed(() => segmentTotal(this.segments()));
  protected readonly texts = computed(() => {
    const blocks = this.blocks();
    const usable = this.width() - GAP_PX * Math.max(0, blocks.length - 1);
    const total = this.total();
    return blocks.map((block) => blockText(total > 0 ? (usable * block.minutes) / total : 0, block.minutes));
  });

  protected start(event: PointerEvent, index: number): void {
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.drag = { index, startX: event.clientX, start: this.segments() };
    this.dragging.set(true);
  }

  protected move(event: PointerEvent): void {
    const drag = this.drag;
    const track = this.track()?.nativeElement;
    if (!drag || !track) {
      return;
    }
    const usable = track.getBoundingClientRect().width - GAP_PX * Math.max(0, this.blocks().length - 1);
    if (usable <= 0 || this.total() <= 0) {
      return;
    }
    const minutes = ((event.clientX - drag.startX) / usable) * this.total();
    const next = dragBoundary(drag.start, drag.index, Math.round(minutes));
    if (JSON.stringify(next) !== JSON.stringify(this.segments())) {
      this.segmentsChange.emit(next);
    }
  }

  protected end(): void {
    this.drag = null;
    this.dragging.set(false);
  }

  protected nudge(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (!step) {
      return;
    }
    event.preventDefault();
    this.segmentsChange.emit(dragBoundary(this.segments(), index, step));
  }

  protected gripLabel(index: number): string {
    const blocks = this.blocks();
    return `Move the boundary between ${blocks[index].label} and ${blocks[index + 1].label}`;
  }
}
