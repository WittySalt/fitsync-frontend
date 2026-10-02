import { AfterViewInit, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';

import { RouterLink } from '@angular/router';

import { StatePanelComponent } from '../../../shared/state-panel.component';
import { Load, NutrientSummary } from './diary.models';
import { VitaminsTodayComponent } from './vitamins-today.component';
import { VitaminsWeekComponent } from './vitamins-week.component';

export type VitaminsView = 'today' | 'week';

const FAILURE = 'Vitamins and minerals could not load. Please retry.';

/**
 * Vitamins and minerals in two views behind a segmented control. Today shows rings for what is
 * still short on the selected day, This week shows the week of the page head as a grid. Both views
 * are loaded by the page and drawn together, so switching only crossfades.
 */
@Component({
  selector: 'app-vitamins-card',
  imports: [RouterLink, StatePanelComponent, VitaminsTodayComponent, VitaminsWeekComponent],
  template: `
    <div class="head">
      <span class="eyebrow">Vitamins and minerals</span>
      <div class="switch" role="group" aria-label="View">
        <button type="button" [class.active]="view() === 'today'" [attr.aria-pressed]="view() === 'today'" (click)="view.set('today')">Today</button>
        <button type="button" [class.active]="view() === 'week'" [attr.aria-pressed]="view() === 'week'" (click)="view.set('week')">This week</button>
      </div>
    </div>
    <div class="stack" [style.height.px]="stackHeight()">
      <div #todayView class="view today" [class.shown]="view() === 'today'" [attr.aria-hidden]="view() !== 'today'">
        @if (todayData(); as data) {
          <app-vitamins-today [summary]="data" [isToday]="date() === today()" />
        } @else if (todayError()) {
          <app-state-panel title="Vitamins and minerals unavailable" [message]="todayError()" actionLabel="Retry" [error]="true" (action)="retry.emit()" />
        } @else {
          <div class="skeleton" aria-busy="true"></div>
        }
      </div>
      <div #weekView class="view week" [class.shown]="view() === 'week'" [attr.aria-hidden]="view() !== 'week'">
        @if (weekData(); as data) {
          <app-vitamins-week [summary]="data" [date]="date()" [today]="today()" />
        } @else if (weekError()) {
          <app-state-panel title="Vitamins and minerals unavailable" [message]="weekError()" actionLabel="Retry" [error]="true" (action)="retry.emit()" />
        } @else {
          <div class="skeleton" aria-busy="true"></div>
        }
      </div>
    </div>
    <a class="all" routerLink="/nutrition/nutrients">See all nutrients &rsaquo;</a>
  `,
  styleUrl: './vitamins-card.component.scss'
})
export class VitaminsCardComponent implements AfterViewInit {
  /** The selected day alone. */
  readonly state = input.required<Load<NutrientSummary>>();
  /** The Monday to Sunday week that holds the selected day. */
  readonly week = input.required<Load<NutrientSummary>>();
  readonly date = input.required<string>();
  readonly today = input.required<string>();
  readonly retry = output<void>();

  protected readonly view = signal<VitaminsView>('today');

  protected readonly todayData = computed(() => ready(this.state()));
  protected readonly weekData = computed(() => ready(this.week()));
  protected readonly todayError = computed(() => failure(this.state()));
  protected readonly weekError = computed(() => failure(this.week()));

  /** The height of the shown view, so the card follows it and the change can be animated. */
  protected readonly stackHeight = signal<number | null>(null);
  private readonly todayView = viewChild<ElementRef<HTMLElement>>('todayView');
  private readonly weekView = viewChild<ElementRef<HTMLElement>>('weekView');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      this.view();
      this.measure();
    });
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => this.measure());
    for (const ref of [this.todayView(), this.weekView()]) {
      if (ref) {
        observer.observe(ref.nativeElement);
      }
    }
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private measure(): void {
    const shown = this.view() === 'today' ? this.todayView() : this.weekView();
    if (shown) {
      this.stackHeight.set(shown.nativeElement.offsetHeight);
    }
  }
}

function ready(state: Load<NutrientSummary>): NutrientSummary | null {
  return state.status === 'ready' ? state.data : null;
}

function failure(state: Load<NutrientSummary>): string {
  return state.status === 'error' ? state.message || FAILURE : '';
}
