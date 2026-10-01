import { MuscleGroupCode } from '../../../core/fitsync.models';
import { numberWord } from './brief-copy';
import { joinLabels, muscleLabel } from './brief-muscles';

/** The muscle groups each focus area chosen at setup stands for, in the order the wheel lists
 *  them. Full body and mobility name no single muscle group, and a plan of separate groups already
 *  trains the whole body, so they expand to nothing and are never reported as absent. An area that
 *  is not listed here is ignored for the same reason. */
const FOCUS_AREA_GROUPS: Record<string, MuscleGroupCode[]> = {
  UPPER: ['CHEST', 'BACK', 'SHOULDERS', 'ARMS'],
  LOWER: ['LEGS', 'GLUTES'],
  CORE: ['CORE'],
  CARDIO: ['CARDIO']
};

/** How the sentence names the area a group came from ("your upper-body focus"). */
const FOCUS_AREA_NAMES: Record<string, string> = {
  UPPER: 'upper-body',
  LOWER: 'lower-body',
  CORE: 'core',
  CARDIO: 'cardio'
};

/** At most this many groups are named; more than that is counted instead. */
const MAX_NAMED_GROUPS = 3;

export interface FocusGroup {
  code: MuscleGroupCode;
  /** The focus area the group was expanded from. */
  area: string;
}

export interface FocusLine {
  /** The sentence, without the link. */
  sentence: string;
  /** "Add them", or "Add it" for a single group. */
  linkText: string;
  /** The groups the line is about, in wheel order, for the small badges beside it. */
  groups: MuscleGroupCode[];
}

/** The router target of the link: the Workout page on its plans tab, where the active plan is
 *  edited. The page opens a plan for editing only from its own Edit button, so there is no deeper
 *  address to link to. */
export const FOCUS_LINK = { path: ['/workout'], queryParams: { tab: 'plans', edit: 'active' } } as const;

/** The groups a focus area stands for. An area that cannot be mapped gives none. */
export function focusAreaGroups(area: string): MuscleGroupCode[] {
  return FOCUS_AREA_GROUPS[area] ?? [];
}

/** Expands the focus areas into muscle groups, each once, in wheel order, remembering the first
 *  area that asked for it. */
export function expandFocusAreas(focusAreas: readonly string[]): FocusGroup[] {
  const groups = new Map<MuscleGroupCode, string>();
  for (const area of focusAreas) {
    for (const code of focusAreaGroups(area)) {
      if (!groups.has(code)) {
        groups.set(code, area);
      }
    }
  }
  return [...groups.entries()].map(([code, area]) => ({ code, area }));
}

/** The groups chosen as a focus that have no sector on the wheel. */
export function absentFocusGroups(focusAreas: readonly string[], sectorCodes: readonly MuscleGroupCode[]): FocusGroup[] {
  const present = new Set(sectorCodes);
  return expandFocusAreas(focusAreas).filter((group) => !present.has(group.code));
}

/** The one quiet line under the wheel, or null when every group of the focus areas is on the
 *  wheel. It states what is so and leaves the choice to the person. */
export function focusLine(focusAreas: readonly string[], sectorCodes: readonly MuscleGroupCode[]): FocusLine | null {
  const absent = absentFocusGroups(focusAreas, sectorCodes);
  if (!absent.length) {
    return null;
  }

  const groups = absent.map((group) => group.code);
  const linkText = absent.length === 1 ? 'Add it' : 'Add them';

  if (absent.length > MAX_NAMED_GROUPS) {
    const count = numberWord(absent.length);
    return { sentence: `${count.charAt(0).toUpperCase()}${count.slice(1)} of your focus areas are not in your plan.`, linkText, groups };
  }

  const names = joinLabels(groups.map((code) => muscleLabel(code)));
  const single = absent.length === 1;
  const areas = new Set(absent.map((group) => group.area));
  const areaName = areas.size === 1 ? FOCUS_AREA_NAMES[absent[0].area] : undefined;

  const sentence = areaName
    ? `${names} ${single ? 'belongs' : 'belong'} to your ${areaName} focus and ${single ? 'is' : 'are'} not in your plan.`
    : `${names} ${single ? 'is' : 'are'} among your focus areas and ${single ? 'is' : 'are'} not in your plan.`;
  return { sentence, linkText, groups };
}
