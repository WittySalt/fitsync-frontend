import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { DraftSegment } from '../plan-draft';
import { sumLine } from './segment-list-math';
import { segmentTotal } from './segment-math';
import { SegmentListComponent } from './segment-list.component';
import { SegmentTimelineComponent } from './segment-timeline.component';

/** The Shape block of the cardio and sport cards: the timeline, the rows and the line that says what they add up to. */
@Component({
  selector: 'app-plan-shape',
  imports: [SegmentTimelineComponent, SegmentListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; min-width: 0; }
    .sum { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; color: var(--text-secondary); font-size: var(--pg-chart); }
    .use { padding: 0; border: 0; background: none; color: var(--accent-text); font: inherit; font-size: var(--pg-chart); font-weight: var(--fw-semibold); cursor: pointer; }
    .use:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; }
  `,
  template: `
    <app-segment-timeline [segments]="segments()" (segmentsChange)="segmentsChange.emit($event)" />
    <app-segment-list [segments]="segments()" [play]="play()" (segmentsChange)="segmentsChange.emit($event)" />
    <p class="sum" aria-live="polite">
      <span>{{ line().text }}</span>
      @if (line().useMinutes; as minutes) {
        <button type="button" class="use" (click)="minutesChange.emit(minutes)">Use {{ minutes }} min</button>
      }
    </p>
  `
})
export class PlanShapeComponent {
  readonly segments = input.required<DraftSegment[]>();
  readonly dayMinutes = input<number | null>(null);
  readonly play = input(false);
  readonly segmentsChange = output<DraftSegment[]>();
  /** "Use 40 min": the day takes the length the rows add up to. */
  readonly minutesChange = output<number>();

  protected readonly line = computed(() => sumLine(segmentTotal(this.segments()), this.dayMinutes()));
}
