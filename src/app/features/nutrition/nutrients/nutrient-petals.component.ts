import { Component, ElementRef, computed, inject, input, signal } from '@angular/core';

import { NutrientTileData } from './nutrients.models';
import { groupColour, petalGeometry, petalNutrients } from './nutrients-figures';

const SIZE = 290;

function amount(value: number): string {
  return value.toLocaleString('en-GB', { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 1 });
}

/** The three lines of a petal's tooltip, and the sentence a screen reader gets for the same petal. */
export function petalTip(item: Pick<NutrientTileData, 'displayName' | 'unit' | 'averageAmount' | 'reference' | 'share'>): { name: string; amounts: string; share: string; under: boolean; spoken: string } {
  const name = item.displayName;
  const amounts = `${amount(item.averageAmount ?? 0)} ${item.unit} a day of ${amount(item.reference)} ${item.unit}`;
  const percent = Math.round((item.share ?? 0) * 100);
  const share = `${percent}% of the daily amount`;
  return { name, amounts, share, under: (item.share ?? 0) < 1, spoken: `${name}, ${amounts}, ${share}` };
}

/**
 * The petal chart: a petal for each vitamin and mineral, its length the share of the daily amount
 * (capped at 200%), a dashed ring at 100% and "x/y reached" in the middle. Drawn as plain SVG; the
 * text a screen reader gets is given by the caller, since the petals alone say little.
 */
@Component({
  selector: 'app-nutrient-petals',
  host: { '(document:keydown.escape)': 'close()', '(document:click)': 'outside($event)' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" role="img" [attr.aria-label]="summary()" focusable="false">
      @for (petal of petals(); track petal.petal.code) {
        @if (petal.petal.path) {
          @if (tooltip() && petal.tip) {
            <path
              class="live"
              tabindex="0"
              role="img"
              [attr.aria-label]="petal.tip.spoken"
              [attr.d]="petal.petal.path"
              [style.fill]="petal.colour"
              [attr.fill-opacity]="opacity(petal.petal.code, petal.petal.reached)"
              (mouseenter)="active.set(petal.petal.code)"
              (mouseleave)="close()"
              (focus)="active.set(petal.petal.code)"
              (blur)="close()"
              (click)="active.set(petal.petal.code)"
            ></path>
          } @else {
            <path [attr.d]="petal.petal.path" [style.fill]="petal.colour" [attr.fill-opacity]="petal.petal.reached ? 1 : 0.55"></path>
          }
        }
        <text class="sym" [attr.x]="petal.petal.labelX" [attr.y]="petal.petal.labelY" text-anchor="middle" dominant-baseline="central">
          {{ petal.petal.symbol }}
        </text>
      }
      <circle class="ring" [attr.cx]="centre()" [attr.cy]="centre()" [attr.r]="geometry().ringRadius"></circle>
      <circle class="hub" [attr.cx]="centre()" [attr.cy]="centre()" [attr.r]="geometry().innerRadius - 3"></circle>
      <text class="big" [attr.x]="centre()" [attr.y]="centre() - 7" text-anchor="middle">{{ reached() }}/{{ total() }}</text>
      <text class="small" [attr.x]="centre()" [attr.y]="centre() + 12" text-anchor="middle">reached</text>
      @if (ringLabel()) {
        <text class="ring-label" [attr.x]="centre()" [attr.y]="centre() - geometry().ringRadius - 4" text-anchor="middle">{{ ringLabel() }}</text>
      }
    </svg>
    @if (tip(); as shown) {
      <div class="tip" role="tooltip" [class.left]="shown.left" [class.above]="shown.above" [style.left.%]="shown.x" [style.top.%]="shown.y">
        <strong>{{ shown.text.name }}</strong>
        <span>{{ shown.text.amounts }}</span>
        <span [class.amber]="shown.text.under">{{ shown.text.share }}</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }

      .live {
        cursor: default;
        outline: none;
      }

      .live:focus-visible {
        stroke: var(--text-primary);
        stroke-width: 2;
      }

      .tip {
        position: absolute;
        z-index: 3;
        width: max-content;
        max-width: 190px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14);
        pointer-events: none;
        transform: translate(8px, 10px);
      }

      .tip.left {
        transform: translate(calc(-100% - 8px), 10px);
      }

      .tip.above {
        transform: translate(8px, calc(-100% - 10px));
      }

      .tip.left.above {
        transform: translate(calc(-100% - 8px), calc(-100% - 10px));
      }

      .tip strong {
        font: 600 13px var(--font-sans);
        color: var(--text-primary);
      }

      .tip span {
        font: 400 12px var(--font-sans);
        color: var(--text-secondary);
      }

      .tip span.amber {
        color: var(--amber-700, #b45309);
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

      .ring-label {
        font: 400 10px var(--font-sans);
        fill: var(--text-secondary);
        stroke: var(--surface);
        stroke-width: 3px;
        paint-order: stroke;
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
  /** A label just outside the dashed ring at 12 o'clock, for a chart that explains its own ring. */
  readonly ringLabel = input('');
  /** Off by default: on hover or focus a petal shows its name, amounts and share, and the others dim. */
  readonly tooltip = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly active = signal<string | null>(null);

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
      return { petal, colour: nutrient ? groupColour(nutrient.groupCode) : 'var(--text-muted)', tip: nutrient && petal.path ? petalTip(nutrient) : null };
    });
  });

  /** The open tooltip, anchored at the petal's label and turned to stay inside the chart. */
  protected readonly tip = computed(() => {
    const code = this.active();
    const found = code ? this.petals().find((item) => item.petal.code === code) : undefined;
    if (!found || !found.tip) {
      return null;
    }
    return { text: found.tip, x: (found.petal.labelX / SIZE) * 100, y: (found.petal.labelY / SIZE) * 100, left: found.petal.labelX > SIZE / 2, above: found.petal.labelY > SIZE / 2 };
  });

  protected opacity(code: string, reached: boolean): number {
    const active = this.active();
    return active === null ? (reached ? 1 : 0.55) : active === code ? 1 : 0.6;
  }

  protected close(): void {
    this.active.set(null);
  }

  /** A tap anywhere else closes a tooltip a tap opened. */
  protected outside(event: Event): void {
    if (this.active() !== null && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
