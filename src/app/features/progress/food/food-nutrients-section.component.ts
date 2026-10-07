import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { dateRangeLabel } from '../../../shared/date-label';
import { monthName } from '../../../shared/progress/chart-axis';
import { WeekBarsComponent } from '../../../shared/progress/week-bars.component';
import { ProgressCardContext, WeekBar } from '../../../shared/progress/progress.models';
import { DetailSectionComponent } from '../../../shared/progress/detail-section.component';
import { NutrientPetalsComponent } from '../../nutrition/nutrients/nutrient-petals.component';
import { reachSummary } from '../../nutrition/nutrients/nutrients-figures';
import { NutrientsOverview } from '../../nutrition/nutrients/nutrients.models';
import { FoodNutrition, FoodProgress } from '../progress-api.models';
import { NutrientsRange } from './food-nutrients-range';

/**
 * Nutrients and habits on the Food page (board 19b): the petal chart with the lowest three, and the
 * water, fibre and cooking habits. The nutrient table stays on All nutrients.
 */
@Component({
  selector: 'app-food-nutrients-section',
  imports: [DetailSectionComponent, NutrientPetalsComponent, RouterLink, WeekBarsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-detail-section name="Nutrients" anchor="nutrients" [sentence]="nutrientLine()" [context]="context()" [ask]="nutrientAsk()">
      <div class="nutrients">
        @if (overview(); as data) {
          <div class="petals">
            <app-nutrient-petals [tooltip]="true" [nutrients]="data.nutrients" [reached]="reach()!.reached" [total]="reach()!.total" [summary]="reachText()" ringLabel="100%" />
            <p class="key">Petal length is the share of the daily amount. Past the dashed ring is met.</p>
            <p class="key swatches">
              <span><i class="vitamin fat"></i><i class="vitamin water"></i>Vitamins</span>
              <span><i class="mineral major"></i><i class="mineral trace"></i>Minerals</span>
            </p>
          </div>
        }
        <div class="side">
          @if (range().caption) {
            <span class="caption">{{ range().caption }}</span>
          }
          @if (focused(); as one) {
            <p class="focus"><strong>{{ one.name }}</strong> {{ one.pct }}% of the daily amount over {{ range().days }} days. <a [routerLink]="['/nutrition/nutrients', one.code]" [queryParams]="{ range: range().days }">Open ›</a></p>
          }
          @if (lowest().length) {
            <span class="heading">The lowest three</span>
            <div class="chips">
              @for (item of lowest(); track item.code) {
                <span class="chip">{{ item.displayName }} <strong>{{ item.pct }}%</strong></span>
              }
            </div>
          } @else if (!overview()) {
            <p class="quiet">Not enough data yet</p>
          }
          <a routerLink="/nutrition/nutrients" [queryParams]="{ range: range().days }">All nutrients ›</a>
        </div>
      </div>
    </app-detail-section>

    <app-detail-section name="Habits" anchor="habits" [sentence]="habitLine()" [context]="context()" [ask]="habitAsk()">
      @if (monthly() && months().length) {
        <div class="months">
          <strong class="heading">Days logged each month</strong>
          <app-week-bars [bars]="months()" [monthly]="true" label="Days logged each month" [height]="150" />
        </div>
      }
      <div class="habits">
        @if (habits().waterMetDays !== null) {
          <div class="habit">
            <span class="figure">{{ count(habits().waterMetDays) }}</span>
            <span>Water met on these logged days</span>
          </div>
        }
        <div class="habit">
          <span class="figure">{{ count(habits().fibreMetDays) }}</span>
          <span>Fibre met on these logged days</span>
        </div>
        <div class="habit">
          <span class="figure">{{ nutrition()?.cooks?.count ?? '–' }}</span>
          <span>Recipes cooked</span>
          @if (lastCooked()) {
            <span class="last" [attr.title]="lastCooked()">The last one, {{ lastCooked() }}</span>
          }
        </div>
      </div>
    </app-detail-section>
  `,
  styles: `
    :host { display: flex; flex-direction: column; }
    .nutrients { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 32px; align-items: center; }
    .petals { display: flex; flex-direction: column; gap: 8px; width: 300px; max-width: 100%; }
    app-nutrient-petals { width: 260px; max-width: 100%; margin: 14px auto 6px; }
    .side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    p { margin: 0; font: 400 var(--pg-text) / 1.5 var(--font-sans); color: var(--text-secondary); }
    .key { font: 400 var(--pg-chart) / 1.4 var(--font-sans); color: var(--text-secondary); }
    .swatches { display: flex; gap: 16px; }
    .swatches span { display: inline-flex; align-items: center; gap: 4px; }
    .swatches i { width: 10px; height: 10px; border-radius: 50%; }
    .swatches span i:last-of-type { margin-right: 2px; }
    .fat { background: var(--nutrient-fat-soluble); }
    .water { background: var(--nutrient-water-soluble); }
    .major { background: var(--nutrient-major-mineral); }
    .trace { background: var(--nutrient-trace-mineral); }
    .heading { font: 500 var(--pg-control) var(--font-sans); color: var(--text-primary); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { padding: 6px 10px; border-radius: var(--radius-full); background: var(--surface-sunken); border: 1px solid var(--border); font: 400 var(--pg-control) var(--font-sans); color: var(--text-primary); }
    .chip strong { color: var(--text-secondary); }
    a { font: 600 var(--pg-control) var(--font-sans); color: var(--text-primary); text-decoration: none; width: fit-content; }
    a:hover { text-decoration: underline; text-underline-offset: 4px; }
    .quiet { font-size: var(--pg-chart); }
    .months { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .caption, .focus { margin: 0; font: 400 var(--pg-chart) var(--font-sans); color: var(--text-secondary); }
    .focus strong { color: var(--text-primary); }
    .habits { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .habit { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 12px 14px; border-radius: 12px; background: var(--surface-sunken); border: 1px solid var(--border); font: 400 var(--pg-chart) var(--font-sans); color: var(--text-secondary); }
    .last { color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .figure { font: 600 var(--pg-chip-figure) var(--font-display); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    @media (max-width: 700px) {
      .nutrients { grid-template-columns: minmax(0, 1fr); }
      .petals { margin: 0 auto; }
    }
  `
})
export class FoodNutrientsSectionComponent {
  readonly overview = input<NutrientsOverview | null>(null);
  readonly nutrition = input<FoodNutrition | null>(null);
  readonly habits = input.required<FoodProgress['habits']>();
  readonly context = input<ProgressCardContext | null>(null);
  /** The days the petals cover and the caption when that is shorter than the page's period. */
  readonly range = input<NutrientsRange>({ days: 30, caption: null });
  /** A nutrient code a door asked for; its share over the range is said above the lowest three. */
  readonly focus = input<string | null>(null);
  /** Three months or a year: Habits adds the days logged each month. */
  readonly monthly = input(false);

  protected readonly months = computed<WeekBar[]>(() =>
    this.habits().loggedDaysPerMonth.map((item) => ({ label: monthName(item.month), weekStart: item.month, value: item.days, valueLabel: String(item.days) }))
  );
  protected readonly focused = computed(() => {
    const code = this.focus();
    const item = code ? this.overview()?.nutrients.find((nutrient) => nutrient.code === code) : null;
    return item && item.share !== null ? { code: item.code, name: item.displayName, pct: Math.round(item.share * 100) } : null;
  });

  /** Nutrients and habits cover nutrition's recent window, the last 31 days of the period at most. */
  protected readonly windowText = computed(() => {
    const window = this.nutrition()?.recentWindow;
    return window ? dateRangeLabel(window.from, window.to) : `the last ${this.range().days} days`;
  });
  protected readonly reach = computed(() => {
    const overview = this.overview();
    return overview ? reachSummary(overview.nutrients) : null;
  });
  protected readonly reachText = computed(() => {
    const reach = this.reach();
    return reach && reach.total ? `${reach.reached} of ${reach.total} reached the daily amount on average.` : '';
  });
  /** Nutrition's own lowest three, or the petal data's when that read failed. */
  protected readonly lowest = computed(() => {
    const fromNutrition = this.nutrition()?.lowestNutrients ?? [];
    const items = fromNutrition.length
      ? fromNutrition.map((item) => ({ code: item.code, displayName: item.displayName, share: item.share }))
      : (this.reach()?.lowest ?? []).map((item) => ({ code: item.code, displayName: item.displayName, share: item.share ?? 0 }));
    return items.map((item) => ({ ...item, pct: Math.round(item.share * 100) }));
  });
  /** The one sentence under Nutrients: how many reached the daily amount and the furthest short. */
  protected readonly nutrientLine = computed(() => {
    const parts = [this.reachText(), this.lowest()[0] ? `${this.lowest()[0].displayName} is the furthest short at ${this.lowest()[0].pct}%.` : ''];
    return parts.filter((part) => part).join(' ') || 'Vitamins and minerals once enough days are logged.';
  });
  protected readonly nutrientAsk = computed(
    () => `Which nutrients am I short of? These cover ${this.windowText()}, and a petal past the dashed circle is met.`
  );
  /** The one sentence under Habits: fibre and water on the logged days. */
  protected readonly habitLine = computed(() => {
    const habits = this.habits();
    const parts: string[] = [];
    if (habits.fibreMetDays !== null) {
      parts.push(`Fibre was met on ${this.count(habits.fibreMetDays)} logged days.`);
    }
    if (habits.waterMetDays !== null) {
      parts.push(`Water was met on ${this.count(habits.waterMetDays)}.`);
    }
    return parts.join(' ') || 'Water, fibre and cooking, once days are logged.';
  });
  protected readonly habitAsk = computed(() => `How are my water and fibre habits? These are counted on logged days, ${this.windowText()}.`);

  protected readonly lastCooked = computed(() => this.nutrition()?.cooks?.last?.name ?? '');

  protected count(value: number | null): string {
    const logged = this.habits().loggedDays;
    return value === null ? '–' : logged === null ? String(value) : `${value} of ${logged}`;
  }
}
