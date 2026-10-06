import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { shortDateLabel } from '../../../shared/date-label';
import { DetailSectionComponent } from '../../../shared/progress/detail-section.component';
import { DotStripComponent } from '../../../shared/progress/dot-strip.component';
import { daysBetween, formatNumber, shiftDay } from '../../../shared/progress/progress-format';
import { mondayOf } from '../training/training-format';
import { DotDay, ProgressCardContext } from '../../../shared/progress/progress.models';
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

/** True for the week that holds `today`: it has not ended, so its box is neither met nor missed. */
export function isCurrentWeek(weekStart: string, today: string): boolean {
  return weekStart === mondayOf(today);
}

/**
 * One dot for each day from `from` to `to`, the days the server did not report as not logged, so a
 * strip covers exactly the window its section names whatever the server sent.
 */
export function windowDays(days: readonly DotDay[], from: string, to: string): DotDay[] {
  const known = new Map(days.map((day) => [day.date, day.state]));
  const count = Math.max(daysBetween(from, to), 0) + 1;
  return Array.from({ length: count }, (_, k) => {
    const date = shiftDay(from, k);
    return { date, state: known.get(date) ?? 'NOT_LOGGED' };
  });
}

/**
 * The goals other than weight (board 20c): each one a row of three columns, its name and target,
 * how often it was met in a fixed column, and the dots of the window the section names (a box a
 * week for sessions), with dates at the two ends only. Goals are changed on Me, never here.
 */
@Component({
  selector: 'app-goal-other-goals',
  imports: [DetailSectionComponent, DotStripComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-detail-section name="Other goals" anchor="other-goals" [sentence]="sentence()" [context]="context()" ask="Which of my other goals am I missing most, and what would help?">
      @if (rows().length) {
        <div class="rows">
          @for (row of rows(); track row.type) {
            <div class="row">
              <div class="name">
                <span class="goal">{{ row.name }}</span>
                <span class="rule">{{ row.rule }}</span>
              </div>
              <span class="count">
                @if (row.met !== null) {
                  {{ row.met }} of {{ row.of }}
                }
              </span>
              <div class="visual">
                @if (row.weeks.length) {
                  <div class="weeks">
                    @for (week of row.weeks; track week.weekStart) {
                      <span class="box" [class.met]="week.met" [class.current]="week.current" [attr.title]="week.current ? 'this week, in progress' : null">{{ week.value }}</span>
                    }
                  </div>
                  <div class="ends"><span>{{ row.weeks[0].label }}</span><span>{{ row.weeks[row.weeks.length - 1].label }}</span></div>
                } @else {
                  <app-dot-strip [days]="row.days" />
                }
              </div>
            </div>
          }
        </div>
        <div class="foot">
          <span class="key">
            <span><i class="met"></i>met</span><span><i class="missed"></i>missed</span><span><i class="none"></i>not logged</span>
          </span>
          <a routerLink="/me" fragment="goal-lifecycle">Change goals in Me ›</a>
        </div>
      } @else {
        <p class="empty">No other goals yet. Calories, protein, carbs, fat and sessions can be set in Me.</p>
      }
    </app-detail-section>
  `,
  styles: `
    :host { display: block; }
    .rows { display: flex; flex-direction: column; }
    .row { display: grid; grid-template-columns: 220px 160px minmax(0, 1fr); align-items: center; gap: 24px; padding: 16px 0; }
    .row + .row { border-top: 1px solid var(--border); }
    .name { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .goal { font: 400 var(--pg-text) var(--font-sans); color: var(--text-primary); }
    .rule { font: 400 var(--pg-chart) var(--font-sans); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .count { font: 400 var(--pg-text) var(--font-sans); color: var(--text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .visual { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .weeks { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 6px; }
    .box { height: 24px; box-sizing: border-box; border-radius: 4px; display: flex; align-items: center; justify-content: center; font: 600 var(--pg-chart) var(--font-sans); border: 1px solid var(--text-secondary); color: var(--text-primary); }
    .box.current { border-style: dashed; border-color: var(--text-muted); color: var(--text-secondary); background: none; }
    .box.met { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }
    .ends { display: flex; justify-content: space-between; font: 400 var(--pg-chart) var(--font-sans); color: var(--text-secondary); }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .key { display: flex; gap: 12px; font: 400 var(--pg-chart) var(--font-sans); color: var(--text-secondary); }
    .key span { display: inline-flex; align-items: center; gap: 5px; }
    .key i { width: 8px; height: 8px; box-sizing: border-box; border-radius: 50%; }
    .key .met { background: var(--accent); }
    .key .missed { border: 1.5px solid var(--text-secondary); }
    .key .none { background: var(--surface-sunken); border: 1px solid var(--text-muted); }
    a { font: 600 var(--pg-control) var(--font-sans); color: var(--text-primary); text-decoration: none; }
    a:hover { text-decoration: underline; text-underline-offset: 4px; }
    .empty { margin: 0; font: 400 var(--pg-text) var(--font-sans); color: var(--text-secondary); }
    @media (max-width: 760px) {
      .row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 16px; }
      .visual { grid-column: 1 / -1; }
    }
  `
})
export class GoalOtherGoalsComponent {
  readonly goals = input.required<readonly OtherGoal[]>();
  /** The first and last day of the window the section names, which every strip covers exactly. */
  readonly from = input.required<string>();
  readonly to = input.required<string>();
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
        current: isCurrentWeek(week.weekStart, this.to()),
        met: !isCurrentWeek(week.weekStart, this.to()) && week.value >= (week.target ?? goal.target ?? Infinity)
      }));
      // The week under way is not a miss yet, so it is in neither count.
      const full = weeks.filter((week) => !week.current);
      const metWeeks = full.filter((week) => week.met).length;
      const name = NAMES[goal.type] ?? goal.type.charAt(0) + goal.type.slice(1).toLowerCase().replace(/_/g, ' ');
      return {
        type: goal.type,
        name,
        rule: target ? `${target} · ${rule}` : rule,
        met: weekly ? (full.length ? metWeeks : goal.metDays) : goal.metDays,
        of: weekly ? `${full.length || (goal.loggedDays ?? 0)} weeks` : `${goal.loggedDays ?? 0} logged days`,
        days: windowDays(goal.days, this.from(), this.to()),
        weeks: weekly ? weeks : []
      };
    })
  );

  /** The one sentence under the name: the goal met least often, and how the sessions went. */
  protected readonly sentence = computed(() => {
    const goals = this.goals();
    if (!goals.length) {
      return '';
    }
    const daily = goals
      .filter((goal) => goal.type !== 'WORKOUT_FREQUENCY' && (goal.loggedDays ?? 0) > 0 && goal.metDays !== null)
      .sort((a, b) => (a.metDays! / a.loggedDays!) - (b.metDays! / b.loggedDays!))[0];
    const sessions = goals.find((goal) => goal.type === 'WORKOUT_FREQUENCY' && goal.weeks.length > 0);
    const parts: string[] = [];
    if (daily) {
      parts.push(`${NAMES[daily.type] ?? daily.type} was met on ${daily.metDays} of ${daily.loggedDays} logged days.`);
    }
    if (sessions) {
      const full = sessions.weeks.filter((week) => !isCurrentWeek(week.weekStart, this.to()));
      const met = full.filter((week) => week.value >= (week.target ?? sessions.target ?? Infinity)).length;
      if (full.length) {
        parts.push(`Sessions reached the target in ${met} of ${full.length} weeks.`);
      }
    }
    return parts.join(' ') || 'Nothing is logged against these goals yet.';
  });
}
