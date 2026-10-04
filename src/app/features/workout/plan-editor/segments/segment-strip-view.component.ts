import { Component, computed, input } from '@angular/core';

import { SegmentKind, SegmentStatus } from '../../../../core/fitsync.models';
import { hostWidth } from '../../../progress/cards/host-width';

export interface StripSegment {
  label: string;
  kind: SegmentKind;
  plannedSeconds: number;
  actualSeconds: number | null;
  status: SegmentStatus;
}

export type StripBand = 'wide' | 'medium' | 'narrow';

/** The strip's own width decides its arrangement: wide from 900, medium from 600, narrow below. */
export function stripBand(width: number): StripBand {
  return width >= 900 ? 'wide' : width >= 600 ? 'medium' : 'narrow';
}

/** More bars than this cannot carry text, so the labels go to a list under the bars. */
export const MAX_LABELLED_BARS = 8;

export function stripClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * A read-only strip of a day's or a session's segments: proportional bars in the cardio greens, the
 * running segment lit with an elapsed fill, and planned time against actual time as the labels.
 * The editable strip of the plan editor is a separate component.
 */
@Component({
  selector: 'app-segment-strip-view',
  template: `
    <div class="strip" [class]="'strip ' + layout()" role="list" [attr.aria-label]="summary()">
      <div class="bars">
        @for (row of rows(); track $index) {
          <div class="bar" role="listitem" [class]="'bar ' + row.kind.toLowerCase() + ' ' + row.status.toLowerCase()"
            [class.current]="row.current" [style.flex-grow]="row.plannedSeconds" [attr.aria-current]="row.current ? 'step' : null">
            <span class="fill" [style.width.%]="row.fill"></span>
            @if (layout() === 'wide') {
              <span class="text"><b>{{ row.label }}</b> {{ row.times }}</span>
            } @else if (layout() === 'medium') {
              <span class="text">{{ row.times }}</span>
            }
          </div>
        }
      </div>
      @if (layout() === 'medium') {
        <div class="labels" aria-hidden="true">
          @for (row of rows(); track $index) {
            <span [style.flex-grow]="row.plannedSeconds">{{ row.label }}</span>
          }
        </div>
      } @else if (layout() !== 'wide') {
        <ul class="list">
          @for (row of rows(); track $index) {
            <li [class.current]="row.current">
              <span class="dot" [class]="'dot ' + row.kind.toLowerCase()"></span>
              <span class="name">{{ row.label }}</span>
              <span class="times">{{ row.times }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styleUrl: './segment-strip-view.component.scss'
})
export class SegmentStripViewComponent {
  readonly segments = input.required<readonly StripSegment[]>();
  /** Index of the segment that is running, or null when none is. */
  readonly current = input<number | null>(null);
  /** Seconds spent in the running segment. */
  readonly elapsedSeconds = input(0);

  private readonly width = hostWidth(700);
  protected readonly band = computed(() => stripBand(this.width()));
  protected readonly layout = computed<StripBand | 'list'>(() => {
    const band = this.band();
    return band !== 'narrow' && this.segments().length > MAX_LABELLED_BARS ? 'list' : band;
  });

  protected readonly rows = computed(() =>
    this.segments().map((segment, index) => {
      const current = index === this.current();
      const planned = Math.max(1, segment.plannedSeconds);
      const fill =
        segment.status === 'DONE' ? 100 : current ? Math.min(100, (this.elapsedSeconds() / planned) * 100) : 0;
      return {
        label: segment.label,
        kind: segment.kind,
        status: segment.status,
        plannedSeconds: planned,
        current,
        fill,
        times: this.times(segment, current)
      };
    })
  );

  protected readonly summary = computed(() =>
    this.rows()
      .map((row) => `${row.label} ${row.times}`)
      .join(', ')
  );

  private times(segment: StripSegment, current: boolean): string {
    const planned = stripClock(segment.plannedSeconds);
    if (segment.status === 'SKIPPED') {
      return `skipped at ${stripClock(segment.actualSeconds ?? 0)} of ${planned}`;
    }
    if (segment.status === 'DONE' && segment.actualSeconds != null) {
      return `${stripClock(segment.actualSeconds)} of ${planned}`;
    }
    return current ? `${stripClock(this.elapsedSeconds())} of ${planned}` : planned;
  }
}
