import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

import { EnergyView, EnergyWeek } from './energy.models';
import { observeWidth } from './energy-width';
import { dayColumns, daysSummary, runningChart, runningSummary } from './energy-figures';

/** Used until the card has been measured; the charts then draw at the width they are given. */
const FALLBACK_WIDTH = 600;

/**
 * This week behind one switch. Each day shows a shadow for what the day used with what was eaten
 * inside it and the balance under it; Adding up shows the same days as a running total. A day with
 * no food log is an empty shadow in the first view and a hollow dot in the second.
 */
@Component({
  selector: 'app-energy-days',
  template: `
    <div class="head">
      <strong>This week</strong>
      <div class="segmented" role="group" aria-label="Chart">
        <button type="button" [class.active]="view() === 'days'" [attr.aria-pressed]="view() === 'days'" (click)="view.set('days')">Each day</button>
        <button type="button" [class.active]="view() === 'total'" [attr.aria-pressed]="view() === 'total'" (click)="view.set('total')">Adding up</button>
      </div>
    </div>
    @if (view() === 'days') {
      <svg class="chart" [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img" [attr.aria-label]="daysText()" focusable="false">
        @for (line of columns().grid; track line.kcal) {
          <line class="grid" x1="0" [attr.x2]="width()" [attr.y1]="height() - (height() * line.percent) / 100" [attr.y2]="height() - (height() * line.percent) / 100"></line>
        }
        @for (column of columns().columns; track column.date; let index = $index) {
          <rect class="shadow" [class.empty]="!column.logged" [attr.x]="slot(index) - bar() / 2" [attr.y]="height() - (height() * column.shadow) / 100" [attr.width]="bar()" [attr.height]="(height() * column.shadow) / 100" rx="9"></rect>
          @if (column.eaten !== null) {
            <rect class="eaten" [class.sofar]="column.today" [attr.x]="slot(index) - bar() / 2 + 5" [attr.y]="height() - (height() * column.eaten) / 100" [attr.width]="bar() - 10" [attr.height]="(height() * column.eaten) / 100" rx="6"></rect>
          }
        }
      </svg>
      <div class="labels">
        @for (column of columns().columns; track column.date) {
          <div class="label" [class.off]="!column.logged">
            <span class="day">{{ column.label }}@if (column.estimated) { <span title="Workout calories are estimated"> &asymp;</span> }</span>
            <span class="note">{{ column.note }}</span>
          </div>
        }
      </div>
    } @else {
      <svg class="chart" [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" role="img" [attr.aria-label]="totalText()" focusable="false">
        <path class="area" [attr.d]="running().area"></path>
        <line class="zero" x1="0" [attr.x2]="width()" [attr.y1]="running().zeroY" [attr.y2]="running().zeroY"></line>
        <path class="line" [attr.d]="running().line"></path>
        @for (point of running().points; track $index) {
          @if ($index > 0) {
            <circle class="dot" [class.hollow]="!point.logged" [attr.cx]="point.x" [attr.cy]="point.y" r="4"></circle>
          }
        }
        @if (running().end; as end) {
          <text class="end" [attr.x]="end.x - 6" [attr.y]="end.y + 22" text-anchor="end">{{ end.text }}</text>
        }
      </svg>
      <div class="axis">
        @for (point of running().points; track $index) {
          <span [style.left.%]="(point.x / width()) * 100">{{ point.label }}</span>
        }
      </div>
    }
  `,
  styleUrl: './energy-days.component.scss'
})
export class EnergyDaysComponent {
  readonly week = input.required<EnergyWeek>();

  protected readonly view = signal<EnergyView>('days');
  protected readonly width = signal(FALLBACK_WIDTH);
  protected readonly height = computed(() => (this.width() < 480 ? 140 : 170));
  protected readonly columns = computed(() => dayColumns(this.week()));
  protected readonly running = computed(() => runningChart(this.week(), this.width(), this.height()));
  protected readonly daysText = computed(() => daysSummary(this.columns().columns));
  protected readonly totalText = computed(() => runningSummary(this.running(), this.week()));
  /** The column width of a day, which leaves a gap between neighbours. */
  protected readonly bar = computed(() => Math.min(34, (this.width() / 7) * 0.5));

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.destroyRef.onDestroy(observeWidth(this.host.nativeElement, (width) => this.width.set(width))));
  }

  protected slot(index: number): number {
    const count = Math.max(this.columns().columns.length, 1);
    return (this.width() / count) * index + this.width() / count / 2;
  }
}
