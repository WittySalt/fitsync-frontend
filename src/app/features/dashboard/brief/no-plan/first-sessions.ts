import { InjectionToken } from '@angular/core';

import { DayKind, OnboardingFormValue } from '../../../../core/fitsync.models';
import { WORKOUT_PLAN_TEMPLATES } from '../../../workout/plan-templates.component';

/** A starter plan as the Workout page lists it. */
export type StarterTemplate = (typeof WORKOUT_PLAN_TEMPLATES)[number];

/** The starter plans the brief may offer. A token, so the empty case can be tested and so the
 *  list could later come from somewhere other than the Workout page's constant. */
export const FIRST_SESSION_TEMPLATES = new InjectionToken<readonly StarterTemplate[]>('FIRST_SESSION_TEMPLATES', {
  providedIn: 'root',
  factory: () => WORKOUT_PLAN_TEMPLATES
});

/** What the person said at setup that bears on the choice. Every field may be missing. */
export interface FirstSessionAnswers {
  primaryGoal: string | null;
  experienceLevel: string | null;
  preferredMinutes: number | null;
}

export const FIRST_SESSION_COUNT = 3;

type FitShape = Pick<StarterTemplate, 'goalFocus' | 'workoutType' | 'difficulty' | 'estimatedDurationMinutes'>;

/** How well a template suits a goal, 0 being best. Losing fat favours conditioning and then the
 *  general full-body plan, building muscle favours the strength plans, a general or maintenance
 *  aim favours the full-body plan, and a mobility aim favours the mobility plan. */
function goalRank(goal: string, template: FitShape): number {
  switch (goal) {
    case 'LOSE_FAT':
      if (template.workoutType === 'HIIT') {
        return 0;
      }
      return template.goalFocus === 'GENERAL_FITNESS' ? 1 : 2;
    case 'BUILD_MUSCLE':
      return template.workoutType === 'STRENGTH' ? 0 : 1;
    case 'MAINTAIN':
    case 'IMPROVE_FITNESS':
    case 'GENERAL_FITNESS':
      return template.goalFocus === 'GENERAL_FITNESS' ? 0 : 1;
    case 'MOBILITY':
      return template.workoutType === 'MOBILITY' ? 0 : 1;
    default:
      return 0;
  }
}

export function hasAnswers(answers: FirstSessionAnswers | null): boolean {
  return answers !== null && (answers.primaryGoal !== null || answers.experienceLevel !== null || answers.preferredMinutes !== null);
}

/**
 * Picks the three starter plans that suit the person best, best first. A matching difficulty
 * outranks everything, then the fit with the primary goal, then how close the length is to the
 * preferred minutes, and the templates' own order settles what is still tied. An answer that is
 * missing leaves its rule out, so with no answers at all the first three come back as listed.
 */
export function pickFirstSessions<T extends FitShape>(templates: readonly T[], answers: FirstSessionAnswers | null): T[] {
  const indexed = templates.map((template, index) => ({ template, index }));
  if (answers && hasAnswers(answers)) {
    indexed.sort((a, b) => compare(a, b, answers));
  }
  return indexed.slice(0, FIRST_SESSION_COUNT).map((entry) => entry.template);
}

function compare<T extends FitShape>(a: { template: T; index: number }, b: { template: T; index: number }, answers: FirstSessionAnswers): number {
  if (answers.experienceLevel !== null) {
    const byLevel = Number(b.template.difficulty === answers.experienceLevel) - Number(a.template.difficulty === answers.experienceLevel);
    if (byLevel !== 0) {
      return byLevel;
    }
  }
  if (answers.primaryGoal !== null) {
    const byGoal = goalRank(answers.primaryGoal, a.template) - goalRank(answers.primaryGoal, b.template);
    if (byGoal !== 0) {
      return byGoal;
    }
  }
  if (answers.preferredMinutes !== null) {
    const byLength =
      Math.abs(a.template.estimatedDurationMinutes - answers.preferredMinutes) - Math.abs(b.template.estimatedDurationMinutes - answers.preferredMinutes);
    if (byLength !== 0) {
      return byLength;
    }
  }
  return a.index - b.index;
}

/** Reads the answers out of the onboarding seed. The seed carries no primary goal, so the goal is
 *  inferred from the weight target, which onboarding sets equal to the current weight for every
 *  goal that does not ask for a change: a lower target means losing fat, a higher one building
 *  muscle, and no change leaves the goal unknown. */
export function answersFromSeed(value: Partial<OnboardingFormValue>): FirstSessionAnswers {
  const current = value.currentWeightKg ?? null;
  const target = value.targetWeightKg ?? null;
  let primaryGoal: string | null = null;
  if (current !== null && target !== null && target !== current) {
    primaryGoal = target < current ? 'LOSE_FAT' : 'BUILD_MUSCLE';
  }
  return {
    primaryGoal,
    experienceLevel: value.fitnessLevel || null,
    preferredMinutes: value.preferredDurationMinutes ?? null
  };
}

/** The day kind whose glyph stands for a template: HIIT reads as cardio, the rest by name. */
export function templateKind(template: Pick<StarterTemplate, 'workoutType'>): DayKind {
  switch (template.workoutType) {
    case 'HIIT':
    case 'CARDIO':
      return 'CARDIO';
    case 'MOBILITY':
      return 'MOBILITY';
    default:
      return 'STRENGTH';
  }
}

export function movesLabel(template: Pick<StarterTemplate, 'exercises' | 'estimatedDurationMinutes'>): string {
  const count = template.exercises.length;
  return `${count} ${count === 1 ? 'move' : 'moves'} · ${template.estimatedDurationMinutes} min`;
}

export function difficultyLabel(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
}
