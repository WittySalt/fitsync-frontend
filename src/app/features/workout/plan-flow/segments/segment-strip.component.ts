import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';

import { StripRow } from '../../segments/segment-timer';
import { hostWidth } from '../../../progress/cards/host-width';
import { DraftSegment } from '../plan-draft';
import { blockCaption, dragBoundary, MAX_LABELLED_BARS, segmentTotal, sessionBars, setBlockMinutes, stripBand, toBlocks } from './segment-math';

/** The width of a drag handle in pixels, which the pointer maths leaves out of the track. */
const HANDLE_PX = 16;
const DOUBLE_TAP_MS = 350;

/**
 * The shape of a cardio or sport session as proportional bars. Editable, the boundaries between
 * bars are drag handles (arrow keys move one minute) and a double tap on a label types its
 * minutes. Read-only it draws a plan day (`segments`, with `elapsedMinutes` filled across the bars)
 * or a session (`rows`: planned against actual, the running bar lit and `elapsedSeconds` filled
 * in it), which the live timer, the completion dialog and the session record reuse.
 */
@Component({
  selector: 'app-segment-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segment-strip.component.html',
  styleUrl: './segment-strip.component.scss'
})
export class SegmentStripComponent {
  readonly segments = input<DraftSegment[]>([]);
  /** A session's segments with their actual times. When given, the strip draws them read-only. */
  readonly rows = input<readonly StripRow[]>([]);
  readonly editable = input(false);
  /** Index of the lit bar, for a session in progress. */
  readonly current = input<number | null>(null);
  /** Minutes already done, drawn as a fill across the bars. */
  readonly elapsedMinutes = input(0);
  /** Seconds spent in the running bar of `rows`. */
  readonly elapsedSeconds = input(0);
  readonly segmentsChange = output<DraftSegment[]>();

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  protected readonly editing = signal<number | null>(null);
  private lastTap: { index: number; at: number } | null = null;
  private drag: { index: number; startX: number; start: DraftSegment[] } | null = null;

  private readonly width = hostWidth(700);
  protected readonly sessionMode = computed(() => this.rows().length > 0);
  protected readonly layout = computed(() => {
    const band = stripBand(this.width());
    return band !== 'narrow' && this.rows().length > MAX_LABELLED_BARS ? 'list' : band;
  });
  protected readonly bars = computed(() => sessionBars(this.rows(), this.current(), this.elapsedSeconds()));
  protected readonly summary = computed(() =>
    this.bars()
      .map((bar) => `${bar.label} ${bar.times}`)
      .join(', ')
  );

  protected readonly blocks = computed(() => toBlocks(this.segments()));
  protected readonly total = computed(() => segmentTotal(this.segments()));
  protected readonly fills = computed(() => {
    let left = Math.max(0, this.elapsedMinutes());
    return this.blocks().map((block) => {
      const used = Math.min(block.minutes, left);
      left -= used;
      return block.minutes ? Math.round((used / block.minutes) * 100) : 0;
    });
  });

  protected caption(index: number): string {
    return blockCaption(this.blocks()[index]);
  }

  protected tap(index: number): void {
    if (!this.editable()) {
      return;
    }
    const now = Date.now();
    if (this.lastTap && this.lastTap.index === index && now - this.lastTap.at < DOUBLE_TAP_MS) {
      this.editing.set(index);
      this.lastTap = null;
      return;
    }
    this.lastTap = { index, at: now };
  }

  protected commit(index: number, raw: string): void {
    this.editing.set(null);
    const minutes = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(minutes)) {
      return;
    }
    const next = setBlockMinutes(this.segments(), index, minutes);
    this.segmentsChange.emit(next);
  }

  protected startDrag(event: PointerEvent, index: number): void {
    if (!this.editable()) {
      return;
    }
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.drag = { index, startX: event.clientX, start: this.segments() };
  }

  protected moveDrag(event: PointerEvent): void {
    const drag = this.drag;
    const track = this.track()?.nativeElement;
    if (!drag || !track) {
      return;
    }
    const usable = track.getBoundingClientRect().width - HANDLE_PX * Math.max(0, this.blocks().length - 1);
    if (usable <= 0 || this.total() <= 0) {
      return;
    }
    const minutes = ((event.clientX - drag.startX) / usable) * this.total();
    const next = dragBoundary(drag.start, drag.index, Math.round(minutes));
    if (JSON.stringify(next) !== JSON.stringify(this.segments())) {
      this.segmentsChange.emit(next);
    }
  }

  protected endDrag(): void {
    this.drag = null;
  }

  protected nudge(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (!step) {
      return;
    }
    event.preventDefault();
    this.segmentsChange.emit(dragBoundary(this.segments(), index, step));
  }

  protected handleLabel(index: number): string {
    const blocks = this.blocks();
    return `Move the boundary between ${blocks[index].label} and ${blocks[index + 1].label}`;
  }
}
