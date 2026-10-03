import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { FOOD_GROUPS, FoodGroup, asFoodGroup, foodGroupInfo } from '../../../shared/food/food-groups';
import { formatNumber } from '../../../shared/progress/progress-format';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { SectionCardComponent } from '../../../shared/progress/section-card.component';
import { FoodProgress, PlateShare } from '../progress-api.models';

interface Segment {
  group: FoodGroup;
  colour: string;
  share: number;
  label: string;
}

function segments(shares: readonly PlateShare[]): Segment[] {
  const known = shares
    .map((share) => ({ group: asFoodGroup(share.group), share: share.share }))
    .filter((share): share is { group: FoodGroup; share: number } => share.group !== null && share.share > 0);
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
  imports: [FoodIconComponent, SectionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-section-card title="Plate" [sub]="sub()" [context]="context()">
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
            <strong>The biggest changes</strong>
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
    </app-section-card>
  `,
  styles: `
    :host { display: block; }
    .plates { display: flex; flex-direction: column; gap: 10px; }
    .plate { display: flex; flex-direction: column; gap: 4px; }
    .title, .key { font-size: var(--text-xs); color: var(--text-secondary); }
    .bar { display: flex; height: 22px; border-radius: 8px; overflow: hidden; background: var(--surface-sunken); }
    .seg { height: 100%; }
    .seg + .seg { border-left: 2px solid var(--surface); }
    .changes { display: flex; flex-direction: column; gap: 4px; }
    .changes > strong { font-size: var(--text-sm); color: var(--text-primary); }
    .change { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto 44px; align-items: center; gap: 10px; padding: 6px 0; }
    .change + .change { border-top: 1px solid var(--border); }
    .name { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
    .shares { font-size: 13px; color: var(--text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .shares strong { color: var(--text-primary); }
    .word { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-align: right; }
    .key { display: flex; flex-wrap: wrap; gap: 6px 14px; }
    .key span { display: inline-flex; align-items: center; gap: 6px; }
    .key i { width: 10px; height: 10px; border-radius: 3px; }
    .empty { margin: 0; font-size: 13px; color: var(--text-secondary); }
  `
})
export class FoodPlateSectionComponent {
  readonly plate = input.required<FoodProgress['plate']>();
  readonly days = input(30);
  readonly context = input<ProgressCardContext | null>(null);

  protected readonly now = computed(() => segments(this.plate().current));
  protected readonly before = computed(() => segments(this.plate().previous));
  protected readonly sub = computed(() => `what your food was made of, by ${this.plate().basis === 'GRAMS' ? 'weight' : 'calories'}`);
  protected readonly bars = computed(() => {
    const spoken = (list: Segment[]) => list.map((s) => `${s.label} ${Math.round(s.share)}%`).join(', ');
    const rows = [];
    if (this.before().length) {
      rows.push({ title: `The ${this.days()} days before`, segments: this.before(), spoken: spoken(this.before()) });
    }
    rows.push({ title: `The last ${this.days()} days`, segments: this.now(), spoken: spoken(this.now()) });
    return rows;
  });
  protected readonly changes = computed(() => {
    const before = new Map(this.before().map((s) => [s.group, s.share]));
    const now = new Map(this.now().map((s) => [s.group, s.share]));
    return this.plate()
      .changes.map((change) => ({ group: asFoodGroup(change.group), delta: change.deltaPoints }))
      .filter((change): change is { group: FoodGroup; delta: number } => change.group !== null)
      .slice(0, 3)
      .map((change) => ({
        group: change.group,
        label: foodGroupInfo(change.group)?.label ?? change.group,
        before: formatNumber(before.get(change.group) ?? Math.max((now.get(change.group) ?? 0) - change.delta, 0)),
        now: formatNumber(now.get(change.group) ?? 0),
        word: Math.abs(change.delta) < 1 ? 'steady' : change.delta > 0 ? 'up' : 'down'
      }));
  });

  protected round(value: number): number {
    return Math.round(value);
  }
}
