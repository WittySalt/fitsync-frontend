import { Component, input } from '@angular/core';

import { ProteinChart } from './diary-figures';

/** Protein eaten at each meal as bars, with the person's own band behind them. */
@Component({
  selector: 'app-protein-chart',
  template: `
    <div class="head">
      <strong>Protein at each meal</strong>
      <span>{{ chart().rangeText }}</span>
    </div>
    <div class="cols">
      @for (bar of chart().bars; track bar.label) {
        <div class="col">
          <span class="value" [class.none]="bar.grams === 0">{{ bar.grams ? bar.grams + ' g' : 'None' }}</span>
          <span class="track">
            <span class="band" [style.bottom.%]="chart().bandBottom" [style.height.%]="chart().bandHeight"></span>
            @if (bar.grams) {
              <span class="bar" [style.height.%]="bar.height"></span>
            }
          </span>
          <span class="label">{{ bar.label }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;

        strong {
          font-size: 14px;
          color: var(--text-primary);
        }

        span {
          font-size: 12px;
          color: var(--text-secondary);
        }
      }

      .cols {
        display: flex;
        gap: 8px;
      }

      .col {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .value {
        font-size: 12px;
        font-weight: var(--fw-bold);
        color: var(--text-primary);
        font-variant-numeric: tabular-nums;
      }

      .value.none {
        color: var(--text-muted);
      }

      .track {
        position: relative;
        width: 100%;
        height: 72px;
      }

      .band {
        position: absolute;
        left: -4px;
        right: -4px;
        background: color-mix(in srgb, var(--food-protein) 10%, transparent);
        border-top: 1px dashed color-mix(in srgb, var(--food-protein) 60%, transparent);
        border-bottom: 1px dashed color-mix(in srgb, var(--food-protein) 60%, transparent);
      }

      .bar {
        position: absolute;
        left: 22%;
        right: 22%;
        bottom: 0;
        border-radius: 6px 6px 2px 2px;
        background: var(--food-protein);
      }

      .label {
        font-size: 11px;
        color: var(--text-secondary);
      }
    `
  ]
})
export class ProteinChartComponent {
  readonly chart = input.required<ProteinChart>();
}
