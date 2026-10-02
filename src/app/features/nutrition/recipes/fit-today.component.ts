import { Component, computed, input } from '@angular/core';

import { Load } from '../diary/diary.models';
import { whole } from '../diary/diary-figures';
import { FitRow, TodayFit } from './recipes-figures';

interface FitView {
  key: string;
  label: string;
  before: string;
  after: string;
  of: string;
  beforePercent: number;
  afterPercent: number;
  color: string;
}

const cap = (share: number): number => Math.round(Math.min(Math.max(share, 0), 1) * 100);

function view(row: FitRow, key: string, color: string): FitView {
  const percent = row.unit === '%';
  return {
    key,
    label: row.label,
    before: percent ? `${whole(row.before)}%` : whole(row.before),
    after: percent ? `${whole(row.after)}%` : whole(row.after),
    of: percent ? 'a day' : row.of !== null ? `${whole(row.of)}${row.unit === 'kcal' ? '' : ' ' + row.unit}` : '',
    beforePercent: cap(row.beforeShare),
    afterPercent: cap(row.afterShare),
    color
  };
}

/**
 * What the chosen servings do to today: calories, protein and the lowest vitamin, each as the day
 * so far and the day after, drawn as a solid bar and a lighter bar that carries on from it.
 * Nothing here is red; going over a target is only a number.
 */
@Component({
  selector: 'app-fit-today',
  template: `
    <div class="head">
      <strong>{{ title() }}</strong>
      @if (left(); as line) {
        <span>{{ line }}</span>
      }
    </div>
    @let s = state();
    @if (s.status === 'loading') {
      <div class="skeleton" aria-busy="true"></div>
    } @else if (s.status === 'error') {
      <p class="note">{{ s.message }}</p>
    } @else {
      @for (row of rows(); track row.key) {
        <div class="row">
          <div class="line">
            <strong>{{ row.label }}</strong>
            <span>
              {{ row.before }} → <strong>{{ row.after }}</strong>
              @if (row.of) {
                of {{ row.of }}
              }
            </span>
          </div>
          <span class="track" aria-hidden="true">
            <i class="after" [style.width.%]="row.afterPercent" [style.background]="row.color"></i>
            <i class="before" [style.width.%]="row.beforePercent" [style.background]="row.color"></i>
          </span>
        </div>
      }
    }
  `,
  styleUrl: './fit-today.component.scss'
})
export class FitTodayComponent {
  readonly state = input.required<Load<TodayFit>>();
  readonly servings = input(1);

  protected readonly title = computed(() => (this.servings() > 1 ? 'With these servings today' : 'With this serving today'));
  protected readonly rows = computed<FitView[]>(() => {
    const state = this.state();
    if (state.status !== 'ready') {
      return [];
    }
    const { calories, protein, vitamin } = state.data;
    return [
      ...(calories ? [view(calories, 'kcal', 'var(--accent)')] : []),
      ...(protein ? [view(protein, 'protein', 'var(--food-protein)')] : []),
      ...(vitamin ? [view(vitamin, 'vitamin', 'var(--food-fruit)')] : [])
    ];
  });
  protected readonly left = computed(() => {
    const state = this.state();
    if (state.status !== 'ready' || state.data.leftKcal === null) {
      return null;
    }
    const kcal = whole(Math.abs(state.data.leftKcal));
    return state.data.leftKcal >= 0 ? `${kcal} kcal left after` : `${kcal} kcal over after`;
  });
}
