import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { FOOD_GROUPS, FoodGroup, asFoodGroup, foodGroupInfo, groupForCategory } from '../../../shared/food/food-groups';
import { formatNumber } from '../../../shared/progress/progress-format';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { DetailSectionComponent } from '../../../shared/progress/detail-section.component';
import { FoodProgress, PlateShare } from '../progress-api.models';

interface Segment {
  group: FoodGroup;
  colour: string;
  share: number;
  label: string;
}

/** The plate group a wire value names: a group itself, or a food category folded into its group. */
function plateGroup(value: string): FoodGroup | null {
  return asFoodGroup(value) ?? groupForCategory(value);
}

function segments(shares: readonly PlateShare[]): Segment[] {
  const byGroup = new Map<FoodGroup, number>();
  for (const share of shares) {
    const group = plateGroup(share.group);
    if (group !== null && share.share > 0) {
      byGroup.set(group, (byGroup.get(group) ?? 0) + share.share);
    }
  }
  const known = [...byGroup.entries()].map(([group, share]) => ({ group, share }));
  const total = known.reduce((sum, share) => sum + share.share, 0) || 1;
  const order = FOOD_GROUPS.map((group) => group.key);
  return known
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
    .map((share) => ({
      group: share.group,
      colour: foodGroupInfo(share.group)?.colour ?? 'var(--text-secondary)',
      share: (share.share / total) * 100,
      label: foodGroupInfo(share.group)?.label ?? share.group
    }));
}

/**
 * The plate (board 19b): what the food was made of in this period against the one before, as two
 * bars of shares in the food groups' own colours, and the three biggest changes. Shares are by
 * calories, which is what the server stores.
 */
@Component({
  selector: 'app-food-plate-section',
  imports: [DetailSectionComponent, FoodIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-detail-section name="Plate" anchor="plate" [sentence]="sentence()" [context]="context()" [ask]="ask()">
      @if (now().length) {
        <div class="plates">
          @for (bar of bars(); track bar.title) {
            <div class="plate">
              <span class="title">{{ bar.title }}</span>
              <div class="bar" role="img" [attr.aria-label]="bar.title + ': ' + bar.spoken">
                @for (segment of bar.segments; track segment.group) {
                  <span class="seg" [style.width.%]="segment.share" [style.background]="segment.colour" [attr.title]="segment.label + ' ' + round(segment.share) + '%'"></span>
                }
              </div>
            </div>
          }
        </div>
        @if (changes().length) {
          <div class="changes">
            <strong class="heading">The biggest changes</strong>
            @for (change of changes(); track change.group) {
              <div class="change">
                <app-food-icon [group]="change.group" [size]="32" />
                <span class="name">{{ change.label }}</span>
                <span class="shares">{{ change.before }}% → <strong>{{ change.now }}%</strong></span>
                <span class="word">{{ change.word }}</span>
              </div>
            }
          </div>
        }
        <div class="key">
          @for (segment of now(); track segment.group) {
            <span><i [style.background]="segment.colour"></i>{{ segment.label }}</span>
          }
        </div>
      } @else {
        <p class="empty">Not enough data yet. The plate fills in as foods with a group are logged.</p>
      }
    </app-detail-section>
  `,
  styles: `
    :host { display: block; }
    .plates { display: flex; flex-direction: column; gap: 10px; }
    .plate { display: flex; flex-direction: column; gap: 4px; }
    .title, .key { font: 400 var(--pg-chart) var(--font-sans); color: var(--text-secondary); }
    .bar { display: flex; height: 22px; border-radius: 4px; overflow: hidden; background: var(--surface-sunken); }
    .seg { height: 100%; }
    .seg + .seg { border-left: 2px solid var(--surface); }
    .changes { display: flex; flex-direction: column; gap: 4px; }
    .heading { font: 500 var(--pg-control) var(--font-sans); color: var(--text-primary); }
    .change { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto 44px; align-items: center; gap: 10px; padding: 6px 0; }
    .change + .change { border-top: 1px solid var(--border); }
    .name { font: 400 var(--pg-text) var(--font-sans); color: var(--text-primary); }
    .shares { font: 400 var(--pg-text) var(--font-sans); color: var(--text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .shares strong { color: var(--text-primary); }
    .word { font: 500 var(--pg-control) var(--font-sans); color: var(--text-secondary); text-align: right; }
    .key { display: flex; flex-wrap: wrap; gap: 6px 14px; }
    .key span { display: inline-flex; align-items: center; gap: 6px; }
    .key i { width: 10px; height: 10px; border-radius: 3px; }
    .empty { margin: 0; font: 400 var(--pg-text) var(--font-sans); color: var(--text-secondary); }
  `
})
export class FoodPlateSectionComponent {
  readonly plate = input.required<FoodProgress['plate']>();
  /** What the bar for this period is called, and the one for the period before. */
  readonly nowTitle = input('The last 4 weeks');
  readonly beforeTitle = input('The 4 weeks before');
  readonly context = input<ProgressCardContext | null>(null);

  protected readonly now = computed(() => segments(this.plate().current));
  protected readonly before = computed(() => segments(this.plate().previous));
  private readonly basis = computed(() => (this.plate().basis === 'GRAMS' ? 'weight' : 'calories'));
  protected readonly bars = computed(() => {
    const spoken = (list: Segment[]) => list.map((s) => `${s.label} ${Math.round(s.share)}%`).join(', ');
    const rows = [];
    if (this.before().length) {
      rows.push({ title: this.beforeTitle(), segments: this.before(), spoken: spoken(this.before()) });
    }
    rows.push({ title: this.nowTitle(), segments: this.now(), spoken: spoken(this.now()) });
    return rows;
  });
  protected readonly changes = computed(() => {
    const before = new Map(this.before().map((s) => [s.group, s.share]));
    const now = new Map(this.now().map((s) => [s.group, s.share]));
    if (!before.size) {
      return [];
    }
    // The wire's changes are per category; the plate shows groups, so the deltas are taken between the two bars.
    return [...new Set([...before.keys(), ...now.keys()])]
      .map((group) => ({ group, delta: (now.get(group) ?? 0) - (before.get(group) ?? 0) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3)
      .map((change) => ({
        group: change.group,
        label: foodGroupInfo(change.group)?.label ?? change.group,
        before: formatNumber(before.get(change.group) ?? 0),
        now: formatNumber(now.get(change.group) ?? 0),
        word: Math.abs(change.delta) < 1 ? 'steady' : change.delta > 0 ? 'up' : 'down'
      }));
  });

  /** The one sentence under the name: the biggest move between the two bars, or what the bar is made of. */
  protected readonly sentence = computed(() => {
    const top = this.changes()[0];
    if (!top || top.word === 'steady') {
      return `What your food was made of, by ${this.basis()}.`;
    }
    return `${top.label} went from ${top.before}% to ${top.now}% of your plate, by ${this.basis()}.`;
  });
  protected readonly ask = computed(() => `What changed on my plate? The shares are by ${this.basis()}, so a food group with few calories can look small.`);

  protected round(value: number): number {
    return Math.round(value);
  }
}
