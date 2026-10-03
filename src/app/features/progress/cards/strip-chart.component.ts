import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ROAD_HEIGHT, stripGeometry } from './goal-road';
import { hostWidth } from './host-width';

export interface StripItem {
  date: string;
  state: 'MET' | 'MISSED' | 'NOT_LOGGED';
}

/** The habit lead's picture: one dot per day in rows of twenty, and the target as a bullseye at the right. */
@Component({
  selector: 'app-strip-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="width()" [attr.height]="height" [attr.viewBox]="'0 0 ' + width() + ' ' + height" role="img" [attr.aria-label]="label()">
      @if (g(); as s) {
        <g [attr.transform]="'translate(0 ' + top() + ')'">
          @for (cell of s.cells; track cell.date) {
            <circle [class]="'dot ' + cell.state" [attr.cx]="cell.x" [attr.cy]="cell.y" [attr.r]="s.dot / 2"></circle>
          }
          <text class="t12" text-anchor="start" x="0" [attr.y]="s.rows * s.pitch + 16">{{ s.firstDate }}</text>
          <text class="t12" text-anchor="end" [attr.x]="s.stripWidth" [attr.y]="s.rows * s.pitch + 16">{{ s.lastDate }}</text>
        </g>
        <circle class="ring" [attr.cx]="bullX()" [attr.cy]="top() + (s.rows * s.pitch) / 2" r="12"></circle>
        <circle class="core" [attr.cx]="bullX()" [attr.cy]="top() + (s.rows * s.pitch) / 2" r="4"></circle>
        <text class="target" text-anchor="middle" [attr.x]="bullX()" [attr.y]="top() + (s.rows * s.pitch) / 2 - 24">{{ target() }}</text>
        <text class="t12" text-anchor="end" [attr.x]="width()" [attr.y]="top() + (s.rows * s.pitch) / 2 + 38">{{ share() }}</text>
      }
    </svg>
  `,
  styles: `
    :host { display: block; width: 100%; }
    svg { display: block; overflow: visible; }
    .dot.MET { fill: var(--accent); }
    .dot.MISSED { fill: none; stroke: var(--border-strong); stroke-width: 2; }
    .dot.NOT_LOGGED { fill: var(--border); }
    .ring { fill: none; stroke: var(--accent); stroke-width: 2; }
    .core { fill: var(--accent); }
    text { font-family: var(--font-sans); font-variant-numeric: tabular-nums; }
    .t12 { font-size: var(--pg-chart); fill: var(--text-secondary); }
    .target { font-family: var(--font-display); font-size: var(--pg-figure-tail); font-weight: 600; fill: var(--text-primary); }
  `
})
export class StripChartComponent {
  readonly items = input.required<readonly StripItem[]>();
  readonly target = input('');
  readonly share = input('');
  readonly label = input('');

  protected readonly width = hostWidth(560);
  protected readonly height = ROAD_HEIGHT;
  protected readonly g = computed(() => stripGeometry([...this.items()], this.width()));
  protected readonly bullX = computed(() => this.width() - 40);
  /** The strip is centred in the 240 px box: its rows and the date line under them. */
  protected readonly top = computed(() => {
    const s = this.g();
    return Math.max(8, Math.round((ROAD_HEIGHT - (s.rows * s.pitch + 20)) / 2));
  });
}
