import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { dateRangeLabel } from '../../../shared/date-label';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { SectionCardComponent } from '../../../shared/progress/section-card.component';
import { SummaryLinesComponent } from '../../../shared/progress/summary-lines.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { NutrientPetalsComponent } from '../../nutrition/nutrients/nutrient-petals.component';
import { reachSummary } from '../../nutrition/nutrients/nutrients-figures';
import { NutrientsOverview } from '../../nutrition/nutrients/nutrients.models';
import { NutrientsService } from '../../nutrition/nutrients/nutrients.service';
import { EnergyBarsComponent } from '../energy/energy-bars.component';
import { balanceHeadline, foodSummaryContext, foodSummaryLines, hasFood } from '../food/food-figures';
import { FoodProgress } from '../progress-api.models';
import { ProgressApiService } from '../progress-api.service';

/**
 * The Food card on Progress (board 19c): this week's balance with the energy card's two bars, the
 * nutrients reached, and three lines over the last 30 days. The whole card opens the Food page.
 */
@Component({
  selector: 'app-food-card',
  imports: [EnergyBarsComponent, NutrientPetalsComponent, SectionCardComponent, StatePanelComponent, SummaryLinesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-section-card title="Food" [sub]="sub()" link="/progress/food" [context]="context()" [factNumber]="factNumber()" [ringed]="ringed()">
      @if (loading()) {
        <div class="skeleton" aria-busy="true" aria-label="Loading your food"></div>
      } @else if (failed()) {
        <app-state-panel title="Your food could not be loaded" message="Nothing is lost. Try again in a moment." actionLabel="Try again" [error]="true" (action)="load()" />
      } @else if (data(); as food) {
        @if (hasFood(food)) {
          @if (headline(); as h) {
            <div class="headline">
              <div class="row"><strong class="big">{{ h.value }}</strong><span class="words">{{ h.words }}</span></div>
              @if (weekLabel()) {
                <span class="quiet">this week, {{ weekLabel() }}, logged days</span>
              }
            </div>
          }
          @if (food.energy.thisWeek; as week) {
            @if (week.status === 'OK') {
              <app-energy-bars [week]="week" />
            }
          }
          @if (nutrients(); as overview) {
            <div class="petal-box">
              <div class="petal">
                <app-nutrient-petals [nutrients]="overview.nutrients" [reached]="reach()!.reached" [total]="reach()!.total" [summary]="reachText()" />
              </div>
              <div class="petal-text">
                <strong>{{ reachText() }}</strong>
                <span>on average over the last 30 days</span>
              </div>
            </div>
          }
          <app-summary-lines [lines]="lines()" [context]="summaryContext()" />
        } @else {
          <p class="empty">Not enough data yet. Log what you eat for a few days and this card fills in.</p>
        }
      }
    </app-section-card>
  `,
  styles: `
    :host { display: block; }
    .skeleton { height: 240px; border-radius: 16px; }
    .headline { display: flex; flex-direction: column; gap: 2px; }
    .row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .big { font: 600 34px/1.05 var(--font-display); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .words { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
    .quiet, .empty { margin: 0; font-size: var(--text-xs); color: var(--text-secondary); }
    .empty { font-size: 13px; }
    .petal-box { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 16px; background: var(--surface-sunken); border: 1px solid var(--border); }
    .petal { flex: none; width: 120px; }
    .petal-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; font-size: 13px; color: var(--text-secondary); }
    .petal-text strong { font-size: var(--text-sm); color: var(--text-primary); }
  `
})
export class FoodCardComponent implements OnInit {
  private readonly api = inject(ProgressApiService);
  private readonly nutrientsApi = inject(NutrientsService);
  private readonly destroyRef = inject(DestroyRef);

  /** The last 30 days. */
  readonly period = input.required<{ from: string; to: string }>();
  readonly factNumber = input<number | null>(null);
  readonly ringed = input(false);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly data = signal<FoodProgress | null>(null);
  readonly nutrients = signal<NutrientsOverview | null>(null);

  protected readonly days = 30;
  protected readonly hasFood = hasFood;
  protected readonly context = computed<ProgressCardContext>(() => ({ kind: 'FOOD', ...this.period() }));
  protected readonly headline = computed(() => balanceHeadline(this.data()?.hero.balancePerDay.value ?? null));
  protected readonly weekLabel = computed(() => {
    const week = this.data()?.energy.thisWeek;
    return week ? dateRangeLabel(week.weekStart, week.weekEnd) : '';
  });
  protected readonly lines = computed(() => {
    const data = this.data();
    return data ? foodSummaryLines(data, this.days) : [];
  });
  protected readonly summaryContext = computed(() => {
    const data = this.data();
    return data ? foodSummaryContext(data, this.days) : '';
  });
  protected readonly sub = computed(() => {
    const logged = this.data()?.hero.daysLogged.value;
    return logged === null || logged === undefined ? '' : `Logged on ${logged} of the last ${this.days} days`;
  });
  protected readonly reach = computed(() => {
    const overview = this.nutrients();
    return overview ? reachSummary(overview.nutrients) : null;
  });
  protected readonly reachText = computed(() => {
    const reach = this.reach();
    return reach ? `${reach.reached} of ${reach.total} nutrients reached` : '';
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const { from, to } = this.period();
    this.loading.set(true);
    this.failed.set(false);
    this.api
      .getFood(from, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (food) => {
          this.data.set(food);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        }
      });
    // The petals are an addition: without them the card still reads.
    this.nutrientsApi
      .getAll(from, to)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((overview) => this.nutrients.set(overview && overview.daysLogged > 0 && reachSummary(overview.nutrients).total > 0 ? overview : null));
  }
}
