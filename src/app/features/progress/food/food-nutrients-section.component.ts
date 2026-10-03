import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { dateRangeLabel } from '../../../shared/date-label';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { SectionCardComponent } from '../../../shared/progress/section-card.component';
import { NutrientPetalsComponent } from '../../nutrition/nutrients/nutrient-petals.component';
import { reachSummary } from '../../nutrition/nutrients/nutrients-figures';
import { NutrientsOverview } from '../../nutrition/nutrients/nutrients.models';
import { FoodNutrition, FoodProgress } from '../progress-api.models';

/**
 * Nutrients and habits on the Food page (board 19b): the petal chart with the lowest three, and the
 * water, fibre and cooking habits. The nutrient table stays on All nutrients.
 */
@Component({
  selector: 'app-food-nutrients-section',
  imports: [NutrientPetalsComponent, RouterLink, SectionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-section-card title="Nutrients" [sub]="'vitamins and minerals, ' + windowText()" [context]="context()">
      <div class="nutrients">
        @if (overview(); as data) {
          <div class="petals">
            <app-nutrient-petals [nutrients]="data.nutrients" [reached]="reach()!.reached" [total]="reach()!.total" [summary]="reachText()" />
          </div>
        }
        <div class="side">
          @if (reachText()) {
            <p><strong>{{ reachText() }}</strong> A petal past the dashed circle is met.</p>
          }
          @if (lowest().length) {
            <span class="eyebrow">The lowest three</span>
            <div class="chips">
              @for (item of lowest(); track item.code) {
                <span class="chip">{{ item.displayName }} <strong>{{ item.pct }}%</strong></span>
              }
            </div>
          } @else if (!overview()) {
            <p class="quiet">Not enough data yet</p>
          }
          <a routerLink="/nutrition/nutrients">All nutrients ›</a>
        </div>
      </div>
    </app-section-card>

    <app-section-card title="Habits" [sub]="'on logged days, ' + windowText()" [context]="context()">
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
          <span>{{ cookLine() }}</span>
        </div>
      </div>
    </app-section-card>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 18px; }
    .nutrients { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 28px; align-items: center; }
    .petals { padding: 8px; }
    .side { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    p { margin: 0; font-size: var(--text-sm); line-height: 1.5; color: var(--text-secondary); }
    p strong { color: var(--text-primary); }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-secondary); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { padding: 6px 10px; border-radius: var(--radius-full); background: var(--surface-sunken); border: 1px solid var(--border); font-size: 13px; color: var(--text-primary); }
    .chip strong { color: var(--text-secondary); }
    a { font-size: 13px; font-weight: 700; color: var(--accent-text); text-decoration: none; width: fit-content; }
    .quiet { font-size: var(--text-xs); }
    .habits { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .habit { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: 14px; background: var(--surface-sunken); border: 1px solid var(--border); font-size: 13px; color: var(--text-secondary); }
    .figure { font: 600 22px var(--font-display); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    @media (max-width: 640px) {
      .nutrients, .habits { grid-template-columns: minmax(0, 1fr); }
      .petals { max-width: 220px; margin: 0 auto; }
    }
  `
})
export class FoodNutrientsSectionComponent {
  readonly overview = input<NutrientsOverview | null>(null);
  readonly nutrition = input<FoodNutrition | null>(null);
  readonly habits = input.required<FoodProgress['habits']>();
  readonly context = input<ProgressCardContext | null>(null);

  /** Nutrients and habits cover nutrition's recent window, the last 31 days of the period at most. */
  protected readonly windowText = computed(() => {
    const window = this.nutrition()?.recentWindow;
    return window ? dateRangeLabel(window.from, window.to) : 'the last 30 days';
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
  protected readonly cookLine = computed(() => {
    const cooks = this.nutrition()?.cooks;
    if (!cooks) {
      return 'Recipes cooked';
    }
    return cooks.last ? `Recipes cooked, the last one ${cooks.last.name}` : 'Recipes cooked';
  });

  protected count(value: number | null): string {
    const logged = this.habits().loggedDays;
    return value === null ? '–' : logged === null ? String(value) : `${value} of ${logged}`;
  }
}
