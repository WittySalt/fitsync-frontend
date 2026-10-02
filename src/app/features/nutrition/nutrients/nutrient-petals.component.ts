import { Component, computed, input } from '@angular/core';

import { NutrientTileData } from './nutrients.models';
import { groupColour, petalGeometry, petalNutrients } from './nutrients-figures';

const SIZE = 290;

/**
 * The petal chart: a petal for each vitamin and mineral, its length the share of the daily amount
 * (capped at 200%), a dashed ring at 100% and "x/y reached" in the middle. Drawn as plain SVG; the
 * text a screen reader gets is given by the caller, since the petals alone say little.
 */
@Component({
  selector: 'app-nutrient-petals',
  template: `
    <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" role="img" [attr.aria-label]="summary()" focusable="false">
      @for (petal of petals(); track petal.petal.code) {
        @if (petal.petal.path) {
          <path [attr.d]="petal.petal.path" [style.fill]="petal.colour" [attr.fill-opacity]="petal.petal.reached ? 1 : 0.55"></path>
        }
        <text class="sym" [attr.x]="petal.petal.labelX" [attr.y]="petal.petal.labelY" text-anchor="middle" dominant-baseline="central">
          {{ petal.petal.symbol }}
        </text>
      }
      <circle class="ring" [attr.cx]="centre()" [attr.cy]="centre()" [attr.r]="geometry().ringRadius"></circle>
      <circle class="hub" [attr.cx]="centre()" [attr.cy]="centre()" [attr.r]="geometry().innerRadius - 3"></circle>
      <text class="big" [attr.x]="centre()" [attr.y]="centre() - 7" text-anchor="middle">{{ reached() }}/{{ total() }}</text>
      <text class="small" [attr.x]="centre()" [attr.y]="centre() + 12" text-anchor="middle">reached</text>
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      svg {
        display: block;
        width: 100%;
        max-width: 290px;
        height: auto;
        margin: 0 auto;
        overflow: visible;
      }

      .sym {
        font: 700 11px var(--font-sans);
        fill: var(--text-secondary);
      }

      .ring {
        fill: none;
        stroke: var(--text-primary);
        stroke-width: 1;
        stroke-dasharray: 3 4;
      }

      .hub {
        fill: var(--surface);
      }

      .big {
        font: 600 24px var(--font-display);
        fill: var(--text-primary);
      }

      .small {
        font: 400 10px var(--font-sans);
        fill: var(--text-secondary);
      }
    `
  ]
})
export class NutrientPetalsComponent {
  readonly nutrients = input.required<NutrientTileData[]>();
  readonly reached = input.required<number>();
  readonly total = input.required<number>();
  readonly summary = input('');

  protected readonly size = SIZE;
  protected readonly centre = computed(() => SIZE / 2);
  protected readonly geometry = computed(() =>
    petalGeometry(
      petalNutrients(this.nutrients()).map((item) => ({ code: item.code, symbol: item.symbol, share: item.share })),
      SIZE
    )
  );
  protected readonly petals = computed(() => {
    const byCode = new Map(this.nutrients().map((item) => [item.code, item]));
    return this.geometry().petals.map((petal) => {
      const nutrient = byCode.get(petal.code);
      return { petal, colour: nutrient ? groupColour(nutrient.groupCode) : 'var(--text-muted)' };
    });
  });
}
