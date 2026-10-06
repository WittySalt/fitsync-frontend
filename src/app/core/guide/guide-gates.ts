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

/** The counter bumped when a completed session is opened. */
export const SESSION_OPENED = 'session-opened';
/** The counter bumped when an exercise page is opened. */
export const EXERCISE_OPENED = 'exercise-opened';

const visits = (page: TourPage): CountGate => ({ kind: 'count', key: `visit.${page}`, min: 3 });

/**
 * When the path of a surface is left out because the person already uses it (spec 6):
 * - Plans: an active plan exists and one of its days was edited (data, reported by the Workout page).
 * - History: three completed sessions were opened.
 * - Library: an exercise page was opened.
 * - Recipes: a cook record exists (data, reported by the Recipes tab).
 * - All nutrients and the Progress pages: the page was opened twice before (this visit is the third).
 */
export const GUIDE_GATES: Partial<Record<TourPage, CountGate | DataGate>> = {
  'workout-plans': { kind: 'data' },
  'workout-history': { kind: 'count', key: SESSION_OPENED, min: 3 },
  'workout-library': { kind: 'count', key: EXERCISE_OPENED, min: 1 },
  'nutrition-recipes': { kind: 'data' },
  'nutrition-nutrients': visits('nutrition-nutrients'),
  'progress-goal': visits('progress-goal'),
  'progress-training': visits('progress-training'),
  'progress-food': visits('progress-food')
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
