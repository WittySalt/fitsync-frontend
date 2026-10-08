import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';

import { DetailSectionComponent } from '../../../shared/progress/detail-section.component';
import { formatNumber, signed } from '../../../shared/progress/progress-format';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { SmallTrendComponent } from '../../../shared/progress/small-trend.component';
import { BodyPage } from '../../body/body.page';
import { BodySeries, GoalProgress } from '../progress-api.models';
import { GoalMeasurementsTableComponent } from './goal-measurements-table.component';

interface BodyTile {
  name: string;
  unit: string;
  changeUnit: string;
  series: BodySeries | null;
}

/**
 * Body on the Goal page (board 20c): body fat, waist and BMI, each with its change and a small
 * trend. They replace the old Body tab; recording a measurement opens the same form as before,
 * here, under the tiles.
 */
@Component({
  selector: 'app-goal-body-section',
  imports: [BodyPage, DetailSectionComponent, GoalMeasurementsTableComponent, SmallTrendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-detail-section name="Body" anchor="body" [sentence]="sentence()" [context]="context()" ask="What do my waist, body fat and BMI say about the weight I lost?">
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
              <app-small-trend [points]="points(tile)" [digits]="1" [height]="64" [label]="tile.name" />
            } @else {
              <span class="quiet">Not enough data yet</span>
            }
          </article>
        }
      </div>
      <div class="actions">
        <button type="button" class="link" [attr.aria-expanded]="recording()" (click)="openRecorder()">Record a measurement ›</button>
        <button type="button" class="link" [attr.aria-expanded]="measurementsOpen()" (click)="toggleMeasurements()">
          {{ measurementsOpen() ? 'Fewer ›' : 'All measurements ›' }}
        </button>
      </div>
      @if (recording()) {
        <div #recorder class="recorder">
          <app-body-page [embedded]="true" [formOnly]="true" (closed)="recordingClosed()" />
        </div>
      }
      @if (measurementsOpen()) {
        <app-goal-measurements-table />
      }
    </app-detail-section>
  `,
  styles: `
    :host { display: block; }
    .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
    .tile { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
    .top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; height: 24px; }
    .top strong { font: 500 var(--pg-control) var(--font-sans); color: var(--text-primary); }
    .change { font: 500 var(--pg-control) var(--font-sans); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .value { font: 600 var(--pg-chip-figure) var(--font-display); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .unit { font: 500 var(--pg-control) var(--font-sans); color: var(--text-secondary); }
    .quiet { font: 400 var(--pg-chart) / 1.5 var(--font-sans); color: var(--text-secondary); }
    .actions { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
    .link { padding: 0; border: 0; background: none; font: 600 var(--pg-control) var(--font-sans); color: var(--text-primary); cursor: pointer; }
    .link:hover { text-decoration: underline; text-underline-offset: 4px; }
    .link:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 3px; border-radius: 4px; }
    @media (max-width: 640px) { .tiles { grid-template-columns: minmax(0, 1fr); } }
  `
})
export class GoalBodySectionComponent {
  private readonly injector = inject(Injector);
  private readonly recorderRef = viewChild<ElementRef<HTMLElement>>('recorder');

  readonly body = input.required<GoalProgress['body']>();
  readonly sentence = input('');
  readonly context = input<ProgressCardContext | null>(null);

  readonly measurementsOpen = signal(false);
  readonly recording = signal(false);

  protected readonly tiles = computed<BodyTile[]>(() => {
    const body = this.body();
    return [
      { name: 'Waist', unit: 'cm', changeUnit: 'cm', series: body.waist },
      { name: 'Body fat', unit: '%', changeUnit: 'points', series: body.bodyFat },
      { name: 'BMI', unit: '', changeUnit: '', series: body.bmi }
    ];
  });

  openRecorder(): void {
    this.recording.set(true);
    afterNextRender(() => this.recorderRef()?.nativeElement.scrollIntoView({ block: 'start' }), { injector: this.injector });
  }

  /** The form is done: fold it and read the table again, so a saved measurement is in it. */
  recordingClosed(): void {
    this.recording.set(false);
    if (this.measurementsOpen()) {
      this.measurementsOpen.set(false);
      afterNextRender(() => this.measurementsOpen.set(true), { injector: this.injector });
    }
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
