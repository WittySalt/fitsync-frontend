import { Component, computed, input, model, output } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { Load, NutrientSummary } from './diary.models';
import { NutrientView, barPercent, splitNutrients } from './diary-figures';

export type NutrientPeriod = 'week' | 'today';

const RING_SIZE = 54;
const RING_RADIUS = RING_SIZE / 2 - 5;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** The names of the watched nutrients in a sentence, such as "Vitamin B12, iron and zinc are watched first." */
export function focusLine(summary: NutrientSummary): string {
  const names = summary.nutrients.filter((row) => summary.focusCodes.includes(row.code)).map((row) => row.displayName);
  if (names.length === 0) {
    return '';
  }
  const lower = names.map((name, index) => (index === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1)));
  const list = lower.length === 1 ? lower[0] : `${lower.slice(0, -1).join(', ')} and ${lower[lower.length - 1]}`;
  return `${list} ${lower.length === 1 ? 'is' : 'are'} watched first.`;
}

/** How much of the logged food has no vitamin data, or an empty string when all of it has. */
export function coverageLine(summary: NutrientSummary): string {
  const missing = summary.itemsWithoutNutrients;
  const logged = summary.itemsLogged;
  if (missing === null || missing <= 0) {
    return '';
  }
  return logged !== null && logged > 0
    ? `${missing} of ${logged} logged foods have no vitamin data, so these amounts may be low.`
    : `${missing} logged foods have no vitamin data, so these amounts may be low.`;
}

/** True when no food logged in the period has vitamin data, so every amount is unknown rather than low. */
export function noVitaminData(summary: NutrientSummary): boolean {
  const logged = summary.itemsLogged;
  if (logged !== null && logged > 0 && summary.itemsWithoutNutrients === logged) {
    return true;
  }
  return summary.nutrients.length > 0 && summary.nutrients.every((row) => row.averageAmount === null);
}

/**
 * Vitamins and minerals as an average over the last seven days or for today: the three lowest are
 * large with a ring and the richest food the person often eats, the rest are chips with a tick when
 * the daily amount is met. A nutrient above its upper limit has a dark grey ring and says so.
 */
@Component({
  selector: 'app-vitamins-card',
  imports: [FoodGlyphComponent, StatePanelComponent],
  template: `
    <div class="head">
      <span class="eyebrow">Vitamins and minerals</span>
      <div class="toggle" role="group" aria-label="Period">
        <button type="button" [class.active]="period() === 'week'" [attr.aria-pressed]="period() === 'week'" (click)="period.set('week')">7 days</button>
        <button type="button" [class.active]="period() === 'today'" [attr.aria-pressed]="period() === 'today'" (click)="period.set('today')">Today</button>
      </div>
    </div>
    @switch (state().status) {
      @case ('loading') {
        <div class="skeleton" aria-busy="true"></div>
      }
      @case ('error') {
        <app-state-panel title="Vitamins and minerals unavailable" [message]="message()" actionLabel="Retry" [error]="true" (action)="retry.emit()" />
      }
      @default {
        @if (summary(); as data) {
          @if (data.daysLogged === 0) {
            <p class="empty">Log some food to see your vitamins and minerals.</p>
          } @else if (noData()) {
            <p class="empty">None of the foods logged {{ period() === 'today' ? 'today' : 'in these 7 days' }} have vitamin data yet.</p>
          } @else if (data.nutrients.length === 0) {
            <p class="empty">Log some food to see your vitamins and minerals.</p>
          } @else {
            @if (focus()) {
              <p class="focus">{{ focus() }}</p>
            }
            <div class="lows">
              @for (view of parts().low; track view.row.code) {
                <div class="low">
                  <svg class="ring" [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size" aria-hidden="true">
                    <circle class="track" [style.stroke]="colour(view)" [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius" fill="none" stroke-width="6"></circle>
                    <circle
                      class="arc"
                      [style.stroke]="ringColour(view)"
                      [attr.cx]="size / 2"
                      [attr.cy]="size / 2"
                      [attr.r]="radius"
                      fill="none"
                      stroke-width="6"
                      stroke-linecap="round"
                      [attr.stroke-dasharray]="length * fraction(view) + ' ' + length"
                      [attr.transform]="'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'"
                    ></circle>
                    <text [attr.x]="size / 2" [attr.y]="size / 2" dominant-baseline="central" text-anchor="middle">{{ view.percent }}%</text>
                  </svg>
                  <div class="low-text">
                    <div class="low-head">
                      <strong>{{ view.row.displayName }}</strong>
                      <span>{{ view.amount }} a day</span>
                    </div>
                    @if (view.words) {
                      <span class="words" [class.limit]="view.row.aboveUpperLimit">{{ view.words }}</span>
                    }
                  </div>
                </div>
              }
            </div>
            @if (parts().rest.length) {
              <div class="rest">
                <strong>The rest</strong>
                <div class="chips">
                  @for (view of parts().rest; track view.row.code) {
                    <span class="chip">
                      <span class="chip-head">
                        <strong>{{ view.row.displayName }}</strong>
                        @if (view.row.met) {
                          <span class="met"><app-food-glyph name="CHECK" [size]="12" [strokeWidth]="3" />{{ view.percent }}%</span>
                        } @else {
                          <span>{{ view.percent }}%</span>
                        }
                      </span>
                      <span class="mini" [style.background]="tint(view)"><span [style.width.%]="percentOf(view)" [style.background]="ringColour(view)"></span></span>
                    </span>
                  }
                </div>
              </div>
            }
            @if (coverage()) {
              <p class="coverage">{{ coverage() }}</p>
            }
            <p class="note">
              Lowest first. Daily amounts {{ data.referenceLabel ? data.referenceLabel + ', from' : 'are from' }} the US National Institutes of Health.
            </p>
          }
        }
      }
    }
  `,
  styleUrl: './vitamins-card.component.scss'
})
export class VitaminsCardComponent {
  readonly state = input.required<Load<NutrientSummary>>();
  readonly period = model<NutrientPeriod>('week');
  readonly retry = output<void>();

  protected readonly size = RING_SIZE;
  protected readonly radius = RING_RADIUS;
  protected readonly length = RING_LENGTH;

  protected readonly summary = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly message = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.message : '';
  });
  protected readonly noData = computed(() => {
    const data = this.summary();
    return data ? noVitaminData(data) : false;
  });
  protected readonly parts = computed(() => splitNutrients(this.summary()?.nutrients ?? []));
  protected readonly focus = computed(() => {
    const data = this.summary();
    return data ? focusLine(data) : '';
  });
  protected readonly coverage = computed(() => {
    const data = this.summary();
    return data ? coverageLine(data) : '';
  });

  /** Vitamins in the fruit colour and minerals in the dairy colour, as the design boards have them. */
  protected colour(view: NutrientView): string {
    return view.row.kind === 'MINERAL' ? 'var(--food-dairy)' : 'var(--food-fruit)';
  }

  /** The ring of a nutrient above its upper limit is dark grey, never red. */
  protected ringColour(view: NutrientView): string {
    return view.row.aboveUpperLimit ? 'var(--text-secondary)' : this.colour(view);
  }

  protected tint(view: NutrientView): string {
    return `color-mix(in srgb, ${this.colour(view)} 16%, transparent)`;
  }

  protected fraction(view: NutrientView): number {
    return Math.min(Math.max(view.row.share ?? 0, 0), 1);
  }

  protected percentOf(view: NutrientView): number {
    return barPercent(view.row.share ?? 0);
  }
}
