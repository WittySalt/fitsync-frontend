import { MuscleGroupCode, MuscleGroupInsight, WeeklyTrainingInsight } from '../../../core/fitsync.models';
import { formatDuration } from './brief-duration';
import { numberWord } from './brief-copy';
import { joinLabels, muscleLabel } from './brief-muscles';

export type ObservationIcon = 'rest' | 'streak' | 'volume' | 'week';

export interface BriefObservation {
  id: string;
  icon: ObservationIcon;
  fact: string;
  note: string;
  /** The muscle group this observation is about, so the row can draw that muscle's own icon.
   *  Set for the rested (first group of the chosen set, backend order) and streak (that group)
   *  rules; null for volume and week-so-far, which are not about any one muscle group. */
  muscle: MuscleGroupCode | null;
}

/** Muscle groups whose name is a plural noun, so a sentence about one of them alone still takes
 *  "have" and "they". */
const PLURAL_VERB_GROUPS = new Set<MuscleGroupCode>(['LEGS', 'ARMS', 'SHOULDERS', 'GLUTES']);

function capitalize(text: string): string {
  return text.length ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function plural(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

/** Formats a weight in whole kilograms with thousands separators, matching the coach's copy. */
function formatKg(kg: number): string {
  return Math.round(kg).toLocaleString('en-US');
}

/** Formats a weight ratio to one decimal place, e.g. 2.2. */
function formatRatio(ratio: number): string {
  return ratio.toFixed(1);
}

/** Formats a weight ratio as a whole percent, e.g. 0.62 -> "62". */
function formatPercent(ratio: number): string {
  return String(Math.round(ratio * 100));
}

/** Treats a YYYY-MM-DD key as a UTC calendar date so day arithmetic never shifts across a
 *  timezone boundary. Mirrors the same trick brief-week.ts uses for its date-key math. */
function asUtcDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** Whole calendar days between two YYYY-MM-DD keys (to minus from). */
function daysBetweenKeys(fromKey: string, toKey: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((asUtcDate(toKey).getTime() - asUtcDate(fromKey).getTime()) / msPerDay);
}

/** Full weekday name for a YYYY-MM-DD key, read from the calendar date itself. */
function weekdayFull(key: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(asUtcDate(key));
}

interface RestedGroupsPick {
  labels: string[];
  lastTrainedOn: string;
  plural: boolean;
  firstMuscle: MuscleGroupCode;
}

/** Finds the largest set of in-plan muscle groups that share the same last-trained date, within
 *  the 2-to-14-day "rested" window. Ties between equally-sized sets go to the more recent date. */
function pickRestedGroups(insight: WeeklyTrainingInsight): RestedGroupsPick | null {
  const eligible = insight.muscleGroups.filter((group) => {
    if (!group.inActivePlan || !group.lastTrainedOn) {
      return false;
    }
    const daysOff = daysBetweenKeys(group.lastTrainedOn, insight.referenceDate);
    return daysOff >= 2 && daysOff <= 14;
  });
  if (eligible.length === 0) {
    return null;
  }

  const byDate = new Map<string, MuscleGroupInsight[]>();
  for (const group of eligible) {
    const key = group.lastTrainedOn as string;
    const bucket = byDate.get(key) ?? [];
    bucket.push(group);
    byDate.set(key, bucket);
  }

  let best: { date: string; groups: MuscleGroupInsight[] } | null = null;
  for (const [date, groups] of byDate) {
    if (!best || groups.length > best.groups.length || (groups.length === best.groups.length && date > best.date)) {
      best = { date, groups };
    }
  }
  if (!best) {
    return null;
  }
  return {
    labels: best.groups.map((group) => muscleLabel(group.muscleGroup)),
    lastTrainedOn: best.date,
    plural: best.groups.length > 1 || PLURAL_VERB_GROUPS.has(best.groups[0].muscleGroup),
    firstMuscle: best.groups[0].muscleGroup
  };
}

function restedObservation(insight: WeeklyTrainingInsight): BriefObservation | null {
  const picked = pickRestedGroups(insight);
  if (!picked) {
    return null;
  }
  const daysOff = daysBetweenKeys(picked.lastTrainedOn, insight.referenceDate);
  const labels = joinLabels(picked.labels);
  const fact = `${labels} ${picked.plural ? 'have' : 'has'} had ${numberWord(daysOff)} days off.`;
  const note = picked.plural
    ? `They were last trained on ${weekdayFull(picked.lastTrainedOn)}, so they are ready whenever you are.`
    : `It was last trained on ${weekdayFull(picked.lastTrainedOn)}, so it is ready whenever you are.`;
  return { id: 'rested', icon: 'rest', fact, note, muscle: picked.firstMuscle };
}

function pickStreakGroup(insight: WeeklyTrainingInsight): MuscleGroupInsight | null {
  let best: MuscleGroupInsight | null = null;
  for (const group of insight.muscleGroups) {
    if (group.consecutiveSessions >= 3 && (!best || group.consecutiveSessions > best.consecutiveSessions)) {
      best = group;
    }
  }
  return best;
}

function streakObservation(insight: WeeklyTrainingInsight): BriefObservation | null {
  const group = pickStreakGroup(insight);
  if (!group) {
    return null;
  }
  const verb = PLURAL_VERB_GROUPS.has(group.muscleGroup) ? 'have' : 'has';
  const label = muscleLabel(group.muscleGroup).toLowerCase();
  const fact = `Your ${label} ${verb} worked ${numberWord(group.consecutiveSessions)} sessions running.`;

  let note: string;
  if (group.exerciseNames.length > 0 && group.sessionsThisWeek === insight.completedSessions && insight.completedSessions >= 1) {
    const includingYesterday = group.trainedYesterday ? ', including yesterday' : '';
    note = `${group.exerciseNames[0]} was in every session this week${includingYesterday}.`;
  } else {
    note = `The most recent one was ${mostRecentPhrase(group.lastTrainedOn, insight.referenceDate)}.`;
  }
  return { id: 'streak', icon: 'streak', fact, note, muscle: group.muscleGroup };
}

/** "yesterday", "today", or "on {Weekday}", read from a last-trained date against the reference
 *  date. A missing last-trained date falls back to a neutral phrase rather than throwing. */
function mostRecentPhrase(lastTrainedOn: string | null, referenceDate: string): string {
  if (!lastTrainedOn) {
    return 'not recorded yet';
  }
  if (lastTrainedOn === referenceDate) {
    return 'today';
  }
  if (daysBetweenKeys(lastTrainedOn, referenceDate) === 1) {
    return 'yesterday';
  }
  return `on ${weekdayFull(lastTrainedOn)}`;
}

function volumeObservation(insight: WeeklyTrainingInsight): BriefObservation | null {
  const v = insight.volume;

  if (v.thisWeekKg > 0 && v.previousWeekKg > 0) {
    const ratio = v.thisWeekKg / v.previousWeekKg;
    let fact: string;
    if (ratio >= 1.15) {
      fact = `You lifted ${formatRatio(ratio)} times last week's weight.`;
    } else if (ratio <= 0.85) {
      fact = `You lifted ${formatPercent(ratio)}% of last week's weight.`;
    } else {
      fact = `You lifted about the same weight as last week.`;
    }

    let note: string;
    if (v.thisWeekSessionsWithVolume !== v.previousWeekSessionsWithVolume) {
      note =
        `${formatKg(v.thisWeekKg)} kg over ${numberWord(v.thisWeekSessionsWithVolume)} ` +
        `${plural('session', v.thisWeekSessionsWithVolume)} this week against ${formatKg(v.previousWeekKg)} kg over ` +
        `${numberWord(v.previousWeekSessionsWithVolume)}.`;
    } else {
      note = `${formatKg(v.thisWeekKg)} kg this week against ${formatKg(v.previousWeekKg)} kg.`;
    }
    return { id: 'volume', icon: 'volume', fact, note, muscle: null };
  }

  if (v.thisWeekKg === 0 && v.previousWeekKg > 0) {
    const fact = `Last week you lifted ${formatKg(v.previousWeekKg)} kg.`;
    let note: string;
    if (v.weekBeforePreviousKg > 0) {
      const ratio = v.previousWeekKg / v.weekBeforePreviousKg;
      if (ratio >= 1.15) {
        note = `That is ${formatRatio(ratio)} times the week before.`;
      } else if (ratio <= 0.85) {
        note = `That is ${formatPercent(ratio)}% of the week before.`;
      } else {
        note = `That is about the same as the week before.`;
      }
    } else {
      note = `It is the first full week on record.`;
    }
    return { id: 'volume', icon: 'volume', fact, note, muscle: null };
  }

  return null;
}

function weekSoFarObservation(insight: WeeklyTrainingInsight): BriefObservation | null {
  if (insight.completedSessions + insight.previousWeekCompletedSessions <= 0) {
    return null;
  }

  if (insight.completedSessions > 0) {
    const duration = formatDuration(insight.totalMinutes);
    const fact = `${capitalize(numberWord(insight.completedSessions))} ${plural('session', insight.completedSessions)} this week, ${duration} in all.`;
    const previousDuration = formatDuration(insight.previousWeekTotalMinutes);
    const note = `Last week had ${numberWord(insight.previousWeekCompletedSessions)} ${plural('session', insight.previousWeekCompletedSessions)} and ${previousDuration}.`;
    return { id: 'week', icon: 'week', fact, note, muscle: null };
  }

  const previousDuration = formatDuration(insight.previousWeekTotalMinutes);
  const fact = `Last week had ${numberWord(insight.previousWeekCompletedSessions)} ${plural('session', insight.previousWeekCompletedSessions)}, ${previousDuration} in all.`;
  const note = `This week has not started yet.`;
  return { id: 'week', icon: 'week', fact, note, muscle: null };
}

/** Builds up to three coach observations from the weekly training insight, in fixed rule order
 *  (rested groups, streak, volume, then week-so-far as a filler), skipping any rule whose
 *  condition is not met. The coach never gives advice, so every sentence here is a plain fact
 *  about what happened, not a suggestion about what to do next. */
export function dailyObservations(insight: WeeklyTrainingInsight, _now: Date, _timezone: string): BriefObservation[] {
  // The clock and the timezone are accepted so that every brief function is called the same way.
  // All dates here come from the insight's reference date, which the server worked out in the
  // user's timezone. Nothing is validated or thrown, because this runs inside a computed signal
  // and an exception there would take the whole brief down.
  if (!insight.referenceDate) {
    return [];
  }

  const observations: BriefObservation[] = [];

  const rested = restedObservation(insight);
  if (rested) {
    observations.push(rested);
  }

  const streak = streakObservation(insight);
  if (streak) {
    observations.push(streak);
  }

  const volume = volumeObservation(insight);
  if (volume) {
    observations.push(volume);
  }

  if (observations.length < 3) {
    const weekSoFar = weekSoFarObservation(insight);
    if (weekSoFar) {
      observations.push(weekSoFar);
    }
  }

  return observations.slice(0, 3);
}
