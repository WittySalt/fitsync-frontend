import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, combineLatest, map } from 'rxjs';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { LOADING, Load } from '../diary/diary.models';
import { toIsoDate } from '../diary/diary-time';
import { NutrientDetail, NutrientTileData, PeriodKey } from './nutrients.models';
import { NutrientsService } from './nutrients.service';
import { neighbours, parsePeriod, periodRange, tableOrder } from './nutrients-figures';
import { armScrollRestore } from './nutrients-scroll';
import { NutrientGuideComponent } from './nutrient-guide.component';
import { NutrientYoursComponent } from './nutrient-yours.component';

const FAILURE = 'This nutrient could not load. Please retry.';
/** A swipe is a mostly horizontal drag at least this far. */
const SWIPE_MIN = 60;

/**
 * One nutrient: the person's own figures beside what the guide says. The arrows (and a swipe on a
 * touch screen) step through the table in its order, replacing the history entry so "All nutrients"
 * stays one step back.
 */
@Component({
  selector: 'app-nutrient-page',
  imports: [FoodGlyphComponent, NutrientGuideComponent, NutrientYoursComponent, RouterLink, StatePanelComponent],
  template: `
    <div class="page-grid nutrient-page" (touchstart)="swipeStart($event)" (touchend)="swipeEnd($event)">
      <div class="nav">
        <a class="back" routerLink="/nutrition/nutrients" [queryParams]="{ period: period() }" (click)="armBack()" aria-label="Back to All nutrients">
          &larr; All nutrients
        </a>
        <span class="steps">
          @if (next(); as following) {
            <span class="next-name">{{ following.displayName }} next</span>
          }
          @if (previous(); as before) {
            <a class="step" [routerLink]="['/nutrition/nutrients', before.code]" [queryParams]="{ period: period() }" replaceUrl [attr.aria-label]="'Previous nutrient, ' + before.displayName">
              <app-food-glyph name="ARROW_LEFT" [size]="15" [strokeWidth]="2.4" />
            </a>
          } @else {
            <span class="step off" aria-hidden="true"><app-food-glyph name="ARROW_LEFT" [size]="15" [strokeWidth]="2.4" /></span>
          }
          @if (next(); as following) {
            <a class="step flip" [routerLink]="['/nutrition/nutrients', following.code]" [queryParams]="{ period: period() }" replaceUrl [attr.aria-label]="'Next nutrient, ' + following.displayName">
              <app-food-glyph name="ARROW_LEFT" [size]="15" [strokeWidth]="2.4" />
            </a>
          } @else {
            <span class="step flip off" aria-hidden="true"><app-food-glyph name="ARROW_LEFT" [size]="15" [strokeWidth]="2.4" /></span>
          }
        </span>
      </div>

      @switch (state().status) {
        @case ('loading') {
          <div class="cols">
            <div class="skeleton" aria-busy="true" aria-label="Loading this nutrient"></div>
            <div class="skeleton"></div>
          </div>
        }
        @case ('error') {
          <app-state-panel title="Nutrient unavailable" [message]="errorMessage()" actionLabel="Retry" [error]="true" (action)="retry()" />
        }
        @default {
          @if (detail(); as data) {
            <div class="cols">
              <div class="card yours"><app-nutrient-yours [detail]="data" [period]="period()" /></div>
              @if (hasGuide()) {
                <div class="card"><app-nutrient-guide [detail]="data" /></div>
              }
            </div>
          }
        }
      }
    </div>
  `,
  styleUrl: './nutrient.page.scss'
})
export class NutrientPage {
  private readonly service = inject(NutrientsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly target = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      map(([params, query]) => ({ code: params.get('code') ?? '', period: parsePeriod(query.get('period')) }))
    ),
    { initialValue: { code: this.route.snapshot.paramMap.get('code') ?? '', period: parsePeriod(this.route.snapshot.queryParamMap.get('period')) } }
  );

  protected readonly code = computed(() => this.target().code);
  protected readonly period = computed<PeriodKey>(() => this.target().period);

  protected readonly state = signal<Load<NutrientDetail>>(LOADING);
  protected readonly detail = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.message : FAILURE;
  });
  /** The table order for the arrows. Empty when it could not load, which leaves the arrows off. */
  private readonly order = signal<NutrientTileData[]>([]);
  protected readonly previous = computed(() => neighbours(this.order(), this.code()).previous);
  protected readonly next = computed(() => neighbours(this.order(), this.code()).next);
  protected readonly hasGuide = computed(() => {
    const data = this.detail();
    return !!data && (data.guide !== null || data.amounts.length > 0 || data.richest.length > 0);
  });

  private loading: Subscription | null = null;
  private ordering: Subscription | null = null;
  private orderPeriod: PeriodKey | null = null;
  private touchStart: { x: number; y: number } | null = null;

  constructor() {
    effect(() => {
      const { code, period } = this.target();
      untracked(() => this.load(code, period));
    });
    this.destroyRef.onDestroy(() => {
      this.loading?.unsubscribe();
      this.ordering?.unsubscribe();
    });
  }

  protected retry(): void {
    this.load(this.code(), this.period());
  }

  protected armBack(): void {
    armScrollRestore();
  }

  protected swipeStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    this.touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  protected swipeEnd(event: TouchEvent): void {
    const start = this.touchStart;
    const touch = event.changedTouches[0];
    this.touchStart = null;
    if (!start || !touch) {
      return;
    }
    const target = swipeTarget(touch.clientX - start.x, touch.clientY - start.y, this.previous(), this.next());
    if (target) {
      this.go(target);
    }
  }

  private go(item: NutrientTileData): void {
    void this.router.navigate(['/nutrition/nutrients', item.code], { queryParams: { period: this.period() }, replaceUrl: true });
  }

  private load(code: string, period: PeriodKey): void {
    this.loading?.unsubscribe();
    this.state.set(LOADING);
    window.scrollTo({ top: 0 });
    const { from, to } = periodRange(period, toIsoDate(new Date()));
    this.loading = this.service.getOne(code, from, to).subscribe({
      next: (data) => this.state.set({ status: 'ready', data }),
      error: () => this.state.set({ status: 'error', message: FAILURE })
    });
    this.loadOrder(period, from, to);
  }

  private loadOrder(period: PeriodKey, from: string, to: string): void {
    if (this.orderPeriod === period && this.order().length > 0) {
      return;
    }
    this.ordering?.unsubscribe();
    this.orderPeriod = period;
    this.ordering = this.service.getAll(from, to).subscribe({
      next: (overview) => this.order.set(tableOrder(overview.nutrients)),
      error: () => this.order.set([])
    });
  }
}

/**
 * Which neighbour a drag leads to. A drag to the right goes back to the previous nutrient and a drag
 * to the left goes on to the next; a short or mostly vertical drag is a scroll and goes nowhere.
 */
export function swipeTarget<T>(dx: number, dy: number, previous: T | null, next: T | null): T | null {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) {
    return null;
  }
  return dx > 0 ? previous : next;
}
