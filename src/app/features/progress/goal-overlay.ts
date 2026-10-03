import { Goal } from '../../core/fitsync.models';

/** The statuses the Goals tab lists. A cancelled or archived goal is gone from the page. */
const LISTED = new Set(['ACTIVE', 'PAUSED', 'COMPLETED']);

export interface GoalOverlay {
  /** Goals just saved, shown as saved until the progress service has caught up. */
  saved: readonly Goal[];
  /** Goal types just deleted, hidden until the progress service no longer lists them. */
  removed: ReadonlySet<string>;
}

export const NO_OVERLAY: GoalOverlay = { saved: [], removed: new Set() };

/** True when the progress service already shows what was saved. */
export function reflects(server: readonly Goal[], saved: Goal): boolean {
  return server.some(
    (goal) =>
      goal.goalType === saved.goalType &&
      goal.status === saved.status &&
      goal.targetValue === saved.targetValue &&
      (goal.targetUnit ?? '') === (saved.targetUnit ?? '') &&
      (goal.targetDate ?? '') === (saved.targetDate ?? '')
  );
}

/** What is left of the overlay once the server list has caught up with it. */
export function settle(server: readonly Goal[], overlay: GoalOverlay): GoalOverlay {
  const stillListed = (type: string): boolean => server.some((goal) => goal.goalType === type && LISTED.has(goal.status));
  return {
    saved: overlay.saved.filter((saved) => !reflects(server, saved)),
    removed: new Set([...overlay.removed].filter(stillListed))
  };
}

/** The goals to list: the server's, with saved values laid over them and deleted ones taken out. */
export function applyOverlay(server: readonly Goal[], overlay: GoalOverlay): Goal[] {
  const savedTypes = new Set(overlay.saved.map((goal) => goal.goalType));
  const merged = [...server.filter((goal) => !savedTypes.has(goal.goalType)), ...overlay.saved];
  return merged
    .filter((goal) => !overlay.removed.has(goal.goalType) && LISTED.has(goal.status))
    .sort((left, right) => left.goalType.localeCompare(right.goalType));
}

export function isPending(overlay: GoalOverlay): boolean {
  return overlay.saved.length > 0 || overlay.removed.size > 0;
}
