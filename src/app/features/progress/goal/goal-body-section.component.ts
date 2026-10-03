import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';

import { formatNumber, signed } from '../../../shared/progress/progress-format';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { SectionCardComponent } from '../../../shared/progress/section-card.component';
import { SmallTrendComponent } from '../../../shared/progress/small-trend.component';
import { BodyPage } from '../../body/body.page';
import { BodySeries, GoalProgress } from '../progress-api.models';

interface BodyTile {
  name: string;
  unit: string;
  changeUnit: string;
  series: BodySeries | null;
}

/**
 * Body on the Goal page (board 19a): body fat, waist and BMI, each with its change and a small
 * trend. They replace the old Body tab; recording a measurement opens the same form as before,
 * here, under the tiles.
 */
@Component({
  selector: 'app-goal-body-section',
  imports: [BodyPage, SectionCardComponent, SmallTrendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-section-card title="Body" sub="measured over the same weeks" [context]="context()">
      <div class="tiles">
        @for (tile of tiles(); track tile.name) {
          <article class="tile">
            <div class="top">
              <strong>{{ tile.name }}</strong>
              @if (change(tile); as c) {
                <span class="change">{{ c }}</span>
              }
            </div>
            @if (tile.series && tile.series.series.length >= 2) {
              <span class="value">{{ end(tile) }}@if (tile.unit) {<span class="unit"> {{ tile.unit }}</span>}</span>
              <app-small-trend [points]="points(tile)" [digits]="1" [height]="44" [label]="tile.name" />
              @if (tile.series.context) {
                <span class="quiet">{{ tile.series.context }}</span>
              }
            } @else {
              <span class="quiet">Not enough data yet</span>
            }
          </article>
        }
      </div>
      <div class="actions">
        <button type="button" class="record" (click)="openMeasurements()">+ Record a measurement</button>
        <button type="button" class="all" [attr.aria-expanded]="measurementsOpen()" (click)="toggleMeasurements()">
          {{ measurementsOpen() ? 'Hide measurements' : 'All measurements ›' }}
        </button>
      </div>
      @if (measurementsOpen()) {
        <div #measurements class="measurements">
          <app-body-page [embedded]="true" />
        </div>
      }
    </app-section-card>
  `,
  styles: `
    :host { display: block; }
    .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .tile { box-sizing: border-box; min-width: 0; padding: 16px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
    .top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    .top strong { font-size: 15px; color: var(--text-primary); }
    .change { font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .value { font: 600 24px var(--font-display); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .unit { font: 500 13px var(--font-sans); color: var(--text-secondary); }
    .quiet { font-size: var(--text-xs); line-height: 1.5; color: var(--text-secondary); }
    .actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .record { min-height: 36px; padding: 0 14px; border-radius: 11px; border: 1px solid var(--accent-subtle); background: var(--surface-tint); color: var(--accent-text); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
    .all { border: 0; background: none; padding: 0; font: inherit; font-size: 13px; font-weight: 700; color: var(--accent-text); cursor: pointer; }
    .record:focus-visible, .all:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; }
    @media (max-width: 640px) { .tiles { grid-template-columns: minmax(0, 1fr); } }
  `
})
export class GoalBodySectionComponent {
  private readonly injector = inject(Injector);
  private readonly measurementsRef = viewChild<ElementRef<HTMLElement>>('measurements');

  readonly body = input.required<GoalProgress['body']>();
  readonly context = input<ProgressCardContext | null>(null);

  readonly measurementsOpen = signal(false);

  protected readonly tiles = computed<BodyTile[]>(() => {
    const body = this.body();
    return [
      { name: 'Body fat', unit: '%', changeUnit: 'points', series: body.bodyFat },
      { name: 'Waist', unit: 'cm', changeUnit: 'cm', series: body.waist },
      { name: 'BMI', unit: '', changeUnit: '', series: body.bmi }
    ];
  });

  openMeasurements(): void {
    this.measurementsOpen.set(true);
    afterNextRender(() => this.measurementsRef()?.nativeElement.scrollIntoView({ block: 'start' }), { injector: this.injector });
  }

  toggleMeasurements(): void {
    this.measurementsOpen.update((open) => !open);
  }

  protected points(tile: BodyTile) {
    return (tile.series?.series ?? []).map((point) => ({ label: point.date, value: point.value }));
  }

  protected end(tile: BodyTile): string {
    const value = tile.series?.end ?? tile.series?.series.at(-1)?.value ?? null;
    return value === null ? '–' : formatNumber(value, 1);
  }

  protected change(tile: BodyTile): string {
    const series = tile.series;
    const start = series?.start ?? series?.series[0]?.value ?? null;
    const end = series?.end ?? series?.series.at(-1)?.value ?? null;
    if (start === null || end === null || (series?.series.length ?? 0) < 2) {
      return '';
    }
    return `${signed(end - start)}${tile.changeUnit ? ' ' + tile.changeUnit : ''}`;
  }
}
