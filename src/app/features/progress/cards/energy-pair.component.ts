import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatNumber } from '../../../shared/progress/progress-format';
import { BarSegment, energyBars } from '../energy/energy-figures';
import { EnergyWeek } from '../energy/energy.models';
import { hostWidth } from './host-width';

interface DrawnSegment {
  key: string;
  x: number;
  width: number;
  text: string;
}

const GAP = 2;
/** A segment this wide has room for its name and figure inside. */
const LABEL_WIDTH = 96;

function lay(parts: readonly BarSegment[], width: number): DrawnSegment[] {
  let x = 0;
  return parts.map((part) => {
    const full = (part.percent / 100) * width;
    const drawn = { key: part.key, x, width: Math.max(2, full - GAP), text: full >= LABEL_WIDTH ? `${part.label} ${formatNumber(Math.round(part.value))}` : '' };
    x += full;
    return drawn;
  });
}

/** What the gap between the bars is called: "279 kcal short of what you used". */
export function gapText(eaten: number, used: number): string {
  const gap = Math.round(Math.abs(used - eaten));
  return gap === 0 ? 'Eaten matches what you used' : `${formatNumber(gap)} kcal ${used > eaten ? 'short of' : 'over'} what you used`;
}

/**
 * The two energy bars of the Food card on one scale: what was eaten by meal over what was used as
 * resting and workouts. Built at the host's pixel width so the 12 px text is never scaled.
 */
@Component({
  selector: 'app-energy-pair',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img" [attr.aria-label]="v.label">
        <g [attr.transform]="'translate(0 ' + shift() + ')'">
        <text class="t12" x="0" y="64">Eaten a day <tspan class="ink">{{ v.eatenTotal }} kcal</tspan></text>
        @for (seg of v.eaten; track seg.key) {
          <rect [class]="'seg p-' + seg.key" [attr.x]="seg.x" y="74" [attr.width]="seg.width" height="32" rx="4"></rect>
          @if (seg.text) {
            <text [class]="'in p-' + seg.key" [attr.x]="seg.x + 10" y="94">{{ seg.text }}</text>
          }
        }
        <text class="t12" x="0" y="134">Used a day <tspan class="ink">{{ v.usedTotal }} kcal</tspan></text>
        @for (seg of v.used; track seg.key) {
          <rect [class]="'seg p-' + seg.key" [attr.x]="seg.x" y="144" [attr.width]="seg.width" height="32" rx="4"></rect>
          @if (seg.text) {
            <text [class]="'in p-' + seg.key" [attr.x]="seg.x + 10" y="164">{{ seg.text }}</text>
          }
        }
        <text class="t12" text-anchor="end" [attr.x]="width()" y="200">{{ v.gap }}</text>
        </g>
      </svg>
    }
  `,
  styles: `
    :host { display: block; width: 100%; }
    svg { display: block; }
    text { font-family: var(--font-sans); font-variant-numeric: tabular-nums; }
    .t12 { font-size: var(--pg-chart); fill: var(--text-secondary); }
    .ink { fill: var(--text-primary); font-weight: 600; }
    .in { font-size: var(--pg-chart); fill: var(--text-primary); }
    .p-breakfast { fill: var(--accent-text); }
    .p-lunch, .p-eaten { fill: var(--accent); }
    .p-dinner { fill: color-mix(in srgb, var(--accent) 55%, var(--surface)); }
    .p-snack { fill: color-mix(in srgb, var(--accent) 25%, var(--surface)); }
    .p-other { fill: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
    .p-resting { fill: var(--border-strong); }
    .p-workouts { fill: var(--text-secondary); }
    text.p-breakfast, text.p-lunch, text.p-eaten, text.p-workouts { fill: var(--text-on-accent); }
    text.p-dinner, text.p-snack, text.p-other, text.p-resting { fill: var(--text-primary); }
  `
})
export class EnergyPairComponent {
  readonly week = input.required<EnergyWeek>();

  protected readonly width = hostWidth(422);
  /** The bars, their two captions and the shortfall line; laid out from y 52, moved up by 40. */
  protected readonly height = computed(() => 170);
  protected readonly shift = computed(() => -40);
  protected readonly view = computed(() => {
    const bars = energyBars(this.week());
    if (!bars) {
      return null;
    }
    const width = this.width();
    const gap = gapText(bars.eatenTotal, bars.usedTotal);
    return {
      eaten: lay(bars.eaten, width),
      used: lay(bars.used, width),
      eatenTotal: formatNumber(Math.round(bars.eatenTotal)),
      usedTotal: formatNumber(Math.round(bars.usedTotal)),
      gap,
      label: `Eaten ${formatNumber(Math.round(bars.eatenTotal))} kcal a day, used ${formatNumber(Math.round(bars.usedTotal))} kcal a day. ${gap}.`
    };
  });
}
