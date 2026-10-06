import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Footprint } from '../../../core/me.models';
import { buildFootprintGrid, footprintSummary } from './footprint-grid';

export const CELL = 8;
export const GAP = 2;
const LABEL_BAND = 14;

/**
 * The footprint: one cell per day of the membership on the dark identity card, a column a week.
 * A longer membership scrolls inside the card with today in view; the whole grid opens the Training log.
 */
@Component({
  selector: 'app-footprint-grid',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="scroll" #scroller routerLink="/progress/training" fragment="log" [attr.aria-label]="summary()">
      <svg [attr.width]="width()" [attr.height]="height" [attr.viewBox]="'0 0 ' + width() + ' ' + height" aria-hidden="true">
        @for (month of grid().months; track month.column) {
          <text class="month" [attr.x]="month.column * pitch" y="9">{{ month.label }}</text>
        }
        @for (column of grid().columns; track column.monday; let c = $index) {
          @for (cell of column.cells; track cell.date; let r = $index) {
            <rect
              [attr.class]="'cell ' + cell.state"
              [attr.x]="c * pitch"
              [attr.y]="labelBand + r * pitch"
              [attr.width]="size"
              [attr.height]="size"
              rx="2.5"
              [attr.data-date]="cell.date"
            ></rect>
            @if (cell.state === 'both') {
              <circle class="dot" [attr.cx]="c * pitch + size / 2" [attr.cy]="labelBand + r * pitch + size / 2" r="1.3"></circle>
            }
            @if (cell.today) {
              <rect class="today" [attr.x]="c * pitch - 1" [attr.y]="labelBand + r * pitch - 1" [attr.width]="size + 2" [attr.height]="size + 2" rx="3.5"></rect>
            }
          }
        }
      </svg>
    </a>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .scroll { display: block; overflow-x: auto; padding-bottom: 6px; color: inherit; }
    svg { display: block; }
    .month { font-size: 10px; font-weight: 500; fill: rgba(255, 255, 255, 0.72); }
    .cell.empty { fill: rgba(255, 255, 255, 0.09); }
    .cell.future { fill: rgba(255, 255, 255, 0.045); }
    .cell.logged { fill: rgba(255, 255, 255, 0.34); }
    .cell.trained, .cell.both { fill: #4ade80; }
    .dot { fill: #0f2a1d; }
    .today { fill: none; stroke: #ffffff; stroke-width: 1.5; }
  `
})
export class FootprintGridComponent {
  readonly footprint = input.required<Footprint>();
  /** Today as a date key in the person's zone. */
  readonly today = input.required<string>();

  protected readonly size = CELL;
  protected readonly pitch = CELL + GAP;
  protected readonly labelBand = LABEL_BAND;
  protected readonly height = LABEL_BAND + 7 * (CELL + GAP) - GAP;

  protected readonly grid = computed(() => buildFootprintGrid(this.footprint(), this.today()));
  protected readonly width = computed(() => this.grid().columns.length * (CELL + GAP) - GAP);
  protected readonly summary = computed(() => footprintSummary(this.footprint()));
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // A membership longer than the card is wide opens with the present in view, the newest weeks at the right.
    afterNextRender(() => {
      const element = this.scroller()?.nativeElement;
      const column = this.grid().todayColumn;
      if (element && column >= 0 && element.scrollWidth > element.clientWidth) {
        element.scrollLeft = Math.max(0, (column + 1) * (CELL + GAP) - element.clientWidth);
      }
    });
  }
}
