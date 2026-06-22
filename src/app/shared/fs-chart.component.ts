import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
  inject
} from '@angular/core';
import { ChartConfiguration, ChartType } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';

export interface FsChartSeries {
  label: string;
  values: Array<number | null>;
  colorToken: string;
  fillToken?: string;
}

@Component({
  selector: 'fs-chart',
  imports: [BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  template: `
    <canvas
      baseChart
      [type]="type"
      [data]="chartData"
      [options]="chartOptions"
      role="img"
      [attr.aria-label]="ariaLabel"
    ></canvas>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 280px;
      }

      canvas {
        width: 100% !important;
        min-height: 280px;
      }
    `
  ]
})
export class FsChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() type: ChartType = 'line';
  @Input() labels: string[] = [];
  @Input() series: FsChartSeries[] = [];
  @Input() ariaLabel = 'FitSync chart';
  @Input() yAxisLabel = '';

  @ViewChild(BaseChartDirective) private readonly chart?: BaseChartDirective;

  private readonly host = inject(ElementRef<HTMLElement>);
  private themeObserver?: MutationObserver;

  chartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false
  };

  ngOnChanges(): void {
    this.refreshChart();
  }

  ngAfterViewInit(): void {
    this.refreshChart();
    this.themeObserver = new MutationObserver(() => this.refreshChart());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  ngOnDestroy(): void {
    this.themeObserver?.disconnect();
  }

  private refreshChart(): void {
    const textColor = this.resolveTokenColor('--text-secondary');
    const gridColor = this.resolveTokenColor('--text-secondary');

    this.chartData = {
      labels: this.labels,
      datasets: this.series.map((entry) => {
        const stroke = this.resolveTokenColor(entry.colorToken);
        return {
          label: entry.label,
          data: entry.values,
          borderColor: stroke,
          backgroundColor: this.resolveTokenColor(entry.fillToken ?? entry.colorToken),
          pointBackgroundColor: stroke,
          pointBorderColor: this.resolveTokenColor('--surface'),
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.32,
          fill: false
        };
      })
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: this.series.length > 1,
          labels: {
            color: textColor,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: this.resolveTokenColor('--surface-raised'),
          borderColor: gridColor,
          borderWidth: 1,
          bodyColor: this.resolveTokenColor('--text-primary'),
          titleColor: this.resolveTokenColor('--text-primary')
        }
      },
      scales: {
        x: {
          ticks: {
            color: textColor,
            maxRotation: 0,
            autoSkip: true
          },
          grid: {
            color: gridColor
          }
        },
        y: {
          title: {
            display: Boolean(this.yAxisLabel),
            text: this.yAxisLabel,
            color: textColor
          },
          ticks: {
            color: textColor
          },
          grid: {
            color: gridColor
          }
        }
      }
    };

    this.chart?.update();
  }

  private resolveTokenColor(token: string): string {
    const probe = document.createElement('span');
    probe.style.color = token.startsWith('--') ? `var(${token})` : token;
    probe.style.display = 'none';
    this.host.nativeElement.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color || 'CanvasText';
  }
}
