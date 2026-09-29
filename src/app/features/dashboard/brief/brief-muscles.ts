import { MuscleGroupCode, WeeklyTrainingInsight } from '../../../core/fitsync.models';

export interface WheelSector {
  code: MuscleGroupCode;
  label: string;
  sessions: number;
  trainedYesterday: boolean;
  inPlan: boolean;
}

const MUSCLE_LABELS: Record<MuscleGroupCode, string> = {
  FULL_BODY: 'Whole body',
  CHEST: 'Chest',
  BACK: 'Back',
  SHOULDERS: 'Shoulders',
  ARMS: 'Arms',
  CORE: 'Core',
  GLUTES: 'Glutes',
  LEGS: 'Legs',
  CARDIO: 'Cardio'
};

/** The maximum number of sectors the muscle wheel can render without crowding. */
const MAX_SECTORS = 7;

export function muscleLabel(code: MuscleGroupCode): string {
  return MUSCLE_LABELS[code];
}

/** Picks the muscle groups that get a wheel sector: every group in the active plan and every group
 *  trained this week. A group that is neither is left out, because an empty sector for something
 *  the user never chose would read as a demand. */
export function wheelSectors(insight: WeeklyTrainingInsight): WheelSector[] {
  const candidates = insight.muscleGroups.filter((group) => group.inActivePlan || group.sessionsThisWeek > 0);

  const selected = candidates.length <= MAX_SECTORS
    ? candidates
    : rankForOverflow(candidates).slice(0, MAX_SECTORS);

  // Overflow ranking reorders the candidates, so once the cap is applied the sectors are put back
  // into the backend's original order for a stable, predictable wheel.
  const selectedCodes = new Set(selected.map((group) => group.muscleGroup));
  return candidates
    .filter((group) => selectedCodes.has(group.muscleGroup))
    .map((group) => ({
      code: group.muscleGroup,
      label: muscleLabel(group.muscleGroup),
      sessions: group.sessionsThisWeek,
      trainedYesterday: group.trainedYesterday,
      inPlan: group.inActivePlan
    }));
}

/** In-plan groups first (backend order preserved within that set), then the remaining groups by
 *  how much they were trained, most sessions first. */
function rankForOverflow(candidates: WeeklyTrainingInsight['muscleGroups']): WeeklyTrainingInsight['muscleGroups'] {
  const inPlan = candidates.filter((group) => group.inActivePlan);
  const rest = candidates
    .filter((group) => !group.inActivePlan)
    .slice()
    .sort((a, b) => b.sessionsThisWeek - a.sessionsThisWeek);
  return [...inPlan, ...rest];
}

/** Joins labels the way the coach reads a list aloud: "Chest", "Chest and back", or "Chest, back
 *  and legs". Only the first label keeps its given capitalisation. */
export function joinLabels(labels: string[]): string {
  if (labels.length === 0) {
    return '';
  }
  if (labels.length === 1) {
    return labels[0];
  }

  const [first, ...rest] = labels;
  const parts = [first, ...rest.map((label) => lowerFirst(label))];
  const allButLast = parts.slice(0, -1);
  const last = parts[parts.length - 1];
  return `${allButLast.join(', ')} and ${last}`;
}

function lowerFirst(text: string): string {
  return text.length ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}
