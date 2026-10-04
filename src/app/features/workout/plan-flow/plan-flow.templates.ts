import { DraftDay, DraftMove, emptyDay, emptyWeek, FlowKind, PlanProfile } from './plan-draft';
import { clampDays } from './plan-week-proposal';

/** What a starter template contributes: a name, a kind of day and the moves it was resolved to. */
export interface TemplateDay {
  name: string;
  workoutType: string;
  estimatedDurationMinutes: number;
  moves: DraftMove[];
}

function kindOf(workoutType: string): FlowKind {
  return workoutType.toUpperCase() === 'MOBILITY' ? 'MOBILITY' : 'STRENGTH';
}

/** Weekday numbers for a template repeated N times, with a rest day between lifts. */
export function templateWeekdays(count: number): number[] {
  return [1, 4, 6, 2, 5].slice(0, Math.max(1, Math.min(count, 3)));
}

/**
 * Lays a starter template out as a week: the template's session on two or three days, by the
 * profile's days a week, and a rest day between them. The moves are copied, so editing one day
 * leaves the others as they are.
 */
export function weekFromTemplate(template: TemplateDay, profile: PlanProfile): DraftDay[] {
  const week = emptyWeek();
  const count = Math.min(3, clampDays(profile.weeklyWorkoutDays));
  const kind = kindOf(template.workoutType);
  for (const dayOfWeek of templateWeekdays(count).sort((a, b) => a - b)) {
    week[dayOfWeek - 1] = {
      ...emptyDay(dayOfWeek),
      kind,
      title: template.name,
      minutes: template.estimatedDurationMinutes,
      moves: template.moves.map((move) => ({ ...move }))
    };
  }
  return week;
}
