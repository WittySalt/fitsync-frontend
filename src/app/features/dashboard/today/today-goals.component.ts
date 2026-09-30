import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Goal } from '../../../core/fitsync.models';
import { goalDueLabel, goalFigure, goalName, goalPercent } from './today-format';

const DAILY_GOAL_TYPES = new Set(['CALORIES', 'PROTEIN', 'CARBS', 'FAT']);

interface GoalRow {
  key: string;
  name: string;
  figure: string;
  due: string;
  percent: number;
}

@Component({
  selector: 'app-today-goals',
  imports: [RouterLink],
  templateUrl: './today-goals.component.html',
  styleUrl: './today-goals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayGoalsComponent {
  readonly goals = input.required<Goal[]>();

  readonly rows = computed<GoalRow[]>(() =>
    this.goals().map((goal) => ({
      key: goal.goalId ?? goal.goalType,
      name: goalName(goal),
      figure: goalFigure(goal),
      // A daily amount has no date to reach it by, whatever date the goal happens to carry.
      due: DAILY_GOAL_TYPES.has(goal.goalType) ? '' : goalDueLabel(goal),
      percent: goalPercent(goal)
    }))
  );
}
