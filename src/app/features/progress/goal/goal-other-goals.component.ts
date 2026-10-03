import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { shortDateLabel } from '../../../shared/date-label';
import { DotStripComponent } from '../../../shared/progress/dot-strip.component';
import { formatNumber } from '../../../shared/progress/progress-format';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { SectionCardComponent } from '../../../shared/progress/section-card.component';
import { OtherGoal } from '../progress-api.models';

const NAMES: Record<string, string> = {
  CALORIES: 'Calories a day',
  PROTEIN: 'Protein a day',
  CARBS: 'Carbs a day',
  FAT: 'Fat a day',
  WORKOUT_FREQUENCY: 'Sessions a week'
};

/** Protein and sessions count when reached; calories, carbs and fat count within 10% either way. */
const AT_LEAST = new Set(['PROTEIN', 'WORKOUT_FREQUENCY']);

/**
 * The goals other than weight (board 19a), each with how often it was met: a dot a day for the food
 * goals and a box a week for sessions. Goals are changed on Me, never here.
 */
@Component({
  selector: 'app-goal-other-goals',
  imports: [DotStripComponent, RouterLink, SectionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-section-card title="Other goals" [sub]="sub()" [context]="context()">
      @if (rows().length) {
        <div class="rows">
          @for (row of rows(); track row.type) {
            <div class="row">
              <div class="name">
                <strong>{{ row.name }}</strong>
                <span>{{ row.rule }}</span>
              </div>
              <span class="count">
                @if (row.met !== null) {
                  <strong>{{ row.met }}</strong> of {{ row.of }}
                }
              </span>
              <div class="visual">
                @if (row.weeks.length) {
                  <div class="weeks">
                    @for (week of row.weeks; track week.weekStart) {
                      <span class="week">
                        <span class="box" [class.met]="week.met">{{ week.value }}</span>
                        <span class="label">{{ week.label }}</span>
                      </span>
                    }
                  </div>
                } @else {
                  <app-dot-strip [days]="row.days" />
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <p class="empty">No other goals yet. Calories, protein, carbs, fat and sessions can be set in Me.</p>
      }
      <div class="foot">
        <span class="key">
          <span><i class="met"></i>met</span><span><i class="missed"></i>missed</span><span><i class="none"></i>not logged</span>
        </span>
        <a routerLink="/me" fragment="goal-lifecycle">Change goals in Me ›</a>
      </div>
    </app-section-card>
  `,
  styles: `
    :host { display: block; }
    .rows { display: flex; flex-direction: column; }
    .row { display: grid; grid-template-columns: 200px 90px minmax(0, 1fr); align-items: center; gap: 18px; padding: 12px 0; }
    .row + .row { border-top: 1px solid var(--border); }
    .name { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .name strong { font-size: var(--text-sm); color: var(--text-primary); }
    .name span, .label, .key { font-size: var(--text-xs); color: var(--text-secondary); }
    .count { font-size: 13px; color: var(--text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .count strong { color: var(--text-primary); }
    .weeks { display: flex; gap: 6px; max-width: 260px; }
    .week { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; }
    .label { font-size: 10px; white-space: nowrap; }
    .box { width: 100%; height: 22px; box-sizing: border-box; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; border: 1.5px solid var(--text-secondary); color: var(--text-primary); }
    .box.met { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .key { display: flex; gap: 12px; }
    .key span { display: inline-flex; align-items: center; gap: 5px; }
    .key i { width: 8px; height: 8px; box-sizing: border-box; border-radius: 50%; }
    .key .met { background: var(--accent); }
    .key .missed { border: 1.5px solid var(--text-secondary); }
    .key .none { background: var(--surface-sunken); border: 1px solid var(--text-muted); }
    a { font-size: 13px; font-weight: 700; color: var(--accent-text); text-decoration: none; }
    .empty { margin: 0; font-size: 13px; color: var(--text-secondary); }
    @media (max-width: 640px) {
      .row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
      .visual { grid-column: 1 / -1; }
    }
  `
})
export class GoalOtherGoalsComponent {
  readonly goals = input.required<readonly OtherGoal[]>();
  readonly sub = input('');
  readonly context = input<ProgressCardContext | null>(null);

  protected readonly rows = computed(() =>
    this.goals().map((goal) => {
      const weekly = goal.type === 'WORKOUT_FREQUENCY';
      const target = goal.target === null ? '' : `${formatNumber(goal.target)}${goal.unit && !weekly ? ' ' + goal.unit : ''}`;
      const rule = AT_LEAST.has(goal.type) ? 'at least' : 'within 10%';
      const reference = new Date(Number((goal.weeks[0]?.weekStart ?? '2026').slice(0, 4)), 0, 1);
      const weeks = goal.weeks.map((week) => ({
        weekStart: week.weekStart,
        value: formatNumber(week.value),
        label: shortDateLabel(week.weekStart, reference),
        met: week.value >= (week.target ?? goal.target ?? Infinity)
      }));
      const metWeeks = weeks.filter((week) => week.met).length;
      return {
        type: goal.type,
        name: NAMES[goal.type] ?? goal.type.charAt(0) + goal.type.slice(1).toLowerCase().replace(/_/g, ' '),
        rule: target ? `${target} · ${rule}` : rule,
        met: weekly ? (weeks.length ? metWeeks : goal.metDays) : goal.metDays,
        of: weekly ? `${weeks.length || (goal.loggedDays ?? 0)} weeks` : `${goal.loggedDays ?? 0} logged days`,
        days: goal.days,
        weeks: weekly ? weeks : []
      };
    })
  );
}
