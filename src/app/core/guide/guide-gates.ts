import type { TourPage } from './guide.service';

/** A skip condition read from what the browser has counted: the surface is in use once `key` reaches `min`. */
export interface CountGate {
  kind: 'count';
  key: string;
  min: number;
}

/** A skip condition read from data the page already loads; the page reports it with `GuideService.reportUsed`. */
export interface DataGate {
  kind: 'data';
}

/** History counts as in use from this many completed sessions (the count the Workout page already loads). */
export const HISTORY_IN_USE_SESSIONS = 3;
/** The counter bumped when an exercise page is opened. */
export const EXERCISE_OPENED = 'exercise-opened';

const visits = (page: TourPage): CountGate => ({ kind: 'count', key: `visit.${page}`, min: 3 });

/**
 * When the path of a surface is left out because the person already uses it (spec 6):
 * - Plans: an active plan exists and one of its days was edited (data, reported by the Workout page).
 * - History: three completed sessions exist (data, reported by the Workout page).
 * - Library: an exercise page was opened (a counter in the server state).
 * - Recipes: a cook record exists (data, reported by the Recipes tab).
 * - All nutrients and the Progress pages: the page was opened twice before (this visit is the third; a counter in the server state).
 * - Session player: no completed session exists yet (data, reported by the player), so only the very first session starts it.
 *
 * Only the session player and the four first-tour pages start on their own (see GuideService.spotlightDue); the other
 * conditions decide nothing there but stay as the record of when a surface counts as in use.
 */
export const GUIDE_GATES: Partial<Record<TourPage, CountGate | DataGate>> = {
  'workout-plans': { kind: 'data' },
  'workout-history': { kind: 'data' },
  'workout-library': { kind: 'count', key: EXERCISE_OPENED, min: 1 },
  'nutrition-recipes': { kind: 'data' },
  'nutrition-nutrients': visits('nutrition-nutrients'),
  'progress-goal': visits('progress-goal'),
  'progress-training': visits('progress-training'),
  'progress-food': visits('progress-food'),
  'workout-session-player': { kind: 'data' }
};

/** An edit of a plan more than this long after it was made counts as the person changing a day. */
const EDIT_AFTER_MS = 60_000;

/** Whether the Plans surface is in use: an active plan exists and has been edited since it was made. */
export function plansInUse(plan: { createdAt?: string | null; updatedAt?: string | null } | null): boolean {
  if (!plan?.createdAt || !plan.updatedAt) {
    return false;
  }
  const made = Date.parse(plan.createdAt);
  const changed = Date.parse(plan.updatedAt);
  return Number.isFinite(made) && Number.isFinite(changed) && changed - made > EDIT_AFTER_MS;
}
