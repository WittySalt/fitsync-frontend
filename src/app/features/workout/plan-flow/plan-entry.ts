/** The three ways into a new plan: a starter template, the coach's draft, or a week built by hand. */
export type PlanEntryChoice = 'template' | 'coach' | 'own';

export interface EntryTarget {
  commands: string[];
  queryParams?: Record<string, string>;
}

export const NEW_PLAN_PATH = '/workout/plans/new';
export const PLAN_STUDIO_PATH = '/coach/plan';

/** Where each entry row goes. The new-plan sheet and the onboarding hand-off both use this, so they cannot drift apart. */
export function entryTarget(choice: PlanEntryChoice, templateId: string | null = null): EntryTarget {
  if (choice === 'coach') {
    return { commands: [PLAN_STUDIO_PATH] };
  }
  if (choice === 'template' && templateId) {
    return { commands: [NEW_PLAN_PATH], queryParams: { template: templateId } };
  }
  return { commands: [NEW_PLAN_PATH] };
}

export function editPlanTarget(planId: string): EntryTarget {
  return { commands: ['/workout/plans', planId, 'edit'] };
}
