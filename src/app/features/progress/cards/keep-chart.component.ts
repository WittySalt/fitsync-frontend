import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { formatNumber } from '../../../shared/progress/progress-format';
import { GoalRoad } from '../progress-api.models';
import { keepGeometry, keepShare } from './goal-road';
import { hostWidth } from './host-width';

/** The KEEP picture: the lane around the target, the weekly means as a line and a bullseye at the right. */
@Component({
  selector: 'app-keep-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img" [attr.aria-label]="label()">
      @if (geometry(); as k) {
        <rect class="lane" x="0" [attr.y]="k.laneTop" [attr.width]="width()" [attr.height]="k.laneBottom - k.laneTop" rx="8"></rect>
        <rect class="road" [attr.x]="k.x0" [attr.y]="k.targetY - 5" [attr.width]="k.x1 - k.x0" height="10" rx="5"></rect>
        <polyline class="line" [attr.points]="k.line"></polyline>
        @for (point of k.points; track point.weekStart) {
          <circle [class]="point.inside ? 'pt in' : 'pt out'" [attr.cx]="point.x" [attr.cy]="point.y" r="3"></circle>
          @if (point.label) {
            <text class="t12 ink" text-anchor="middle" [attr.x]="point.x" [attr.y]="point.y - 12">{{ point.label }}</text>
          }
        }
        <circle class="ring" [attr.cx]="k.x1" [attr.cy]="k.targetY" r="12"></circle>
        <circle class="core" [attr.cx]="k.x1" [attr.cy]="k.targetY" r="4"></circle>
        <text class="target" text-anchor="middle" [attr.x]="k.x1" [attr.y]="k.targetY - 24">{{ target() }}</text>
        <text class="t12" text-anchor="end" [attr.x]="width()" [attr.y]="k.targetY + 38">{{ share() }}</text>
        <text class="t12" text-anchor="start" x="0" [attr.y]="height() - 18">{{ k.firstDate }}</text>
        <text class="t12" text-anchor="end" [attr.x]="width()" [attr.y]="height() - 18">{{ k.lastDate }}</text>
      }
    </svg>
  `,
  styles: `
    :host { display: block; width: 100%; }
    svg { display: block; overflow: visible; }
    .lane { fill: var(--success-soft, var(--accent-subtle)); }
    .road { fill: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
    .line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; }
    .pt { stroke: var(--accent); stroke-width: 2; }
    .pt.in { fill: var(--accent); }
    .pt.out { fill: var(--surface); }
    .ring { fill: none; stroke: var(--accent); stroke-width: 2; }
    .core { fill: var(--accent); }
    text { font-family: var(--font-sans); font-variant-numeric: tabular-nums; }
    .t12 { font-size: var(--pg-chart); fill: var(--text-secondary); }
    .ink { fill: var(--text-primary); font-weight: 600; }
    .target { font-family: var(--font-display); font-size: var(--pg-figure-tail); font-weight: 600; fill: var(--text-primary); }
  `
})
export class KeepChartComponent {
  readonly road = input.required<GoalRoad>();
  readonly label = input('');

  protected readonly width = hostWidth(560);
  /** The lane, the line and the date row need about this much; the box is the drawing's own height. */
  protected readonly height = signal(190).asReadonly();
  protected readonly geometry = computed(() => (this.road().keep ? keepGeometry(this.road(), this.width(), this.height()) : null));
  protected readonly share = computed(() => keepShare(this.road()));
  protected readonly target = computed(() => `${formatNumber(this.road().targetKg, this.road().targetKg % 1 ? 1 : 0)} kg`);
}
