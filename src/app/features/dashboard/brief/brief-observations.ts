import { DayKind, MuscleGroupCode, MuscleGroupInsight, WeeklyTrainingInsight } from '../../../core/fitsync.models';
import { formatDuration, formatKm, formatPace } from './brief-duration';
import { numberWord } from './brief-copy';
import { joinLabels, muscleLabel } from './brief-muscles';

export type ObservationIcon = 'rest' | 'streak' | 'volume' | 'week' | 'day-kind';

export interface BriefObservation {
  id: string;
  icon: ObservationIcon;
  fact: string;
  note: string;
  /** The muscle group this observation is about, so the row can draw that muscle's own icon.
   *  Set for the rested (first group of the chosen set, backend order) and streak (that group)
   *  rules; null for volume and week-so-far, which are not about any one muscle group. */
  muscle: MuscleGroupCode | null;
  /** The day kind this observation illustrates, drawn with the day-kind glyph set instead of a
   *  muscle glyph. Set only for the observation that follows today's kind; null everywhere else. */
  dayKind?: DayKind | null;
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

/** "Tuesday 23 Sep", read from a YYYY-MM-DD key: the weekday and day-month the coach uses when
 *  pointing at a specific past session rather than just naming how long ago it was. */
function weekdayDateLabel(key: string): string {
  const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(asUtcDate(key));
  return `${weekdayFull(key)} ${dayMonth}`;
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

/** This week's weight so far against last week's by the same weekday. Nothing is said when last
 *  week had no weight by this point, because a ratio against nothing means nothing. */
function sameDaysVolumeObservation(insight: WeeklyTrainingInsight): BriefObservation | null {
  const v = insight.volume;
  const sameKg = v.previousWeekSameDaysKg ?? 0;
  const sameSessions = v.previousWeekSameDaysSessionsWithVolume ?? 0;
  if (v.thisWeekKg <= 0 || sameKg <= 0) {
    return null;
  }
  const ratio = v.thisWeekKg / sameKg;
  let fact: string;
  if (ratio >= 1.15) {
    fact = `You have lifted ${formatRatio(ratio)} times as much as by this point last week.`;
  } else if (ratio <= 0.85) {
    fact = `You have lifted ${formatPercent(ratio)}% of what you had by this point last week.`;
  } else {
    fact = `You have lifted about the same as by this point last week.`;
  }
  const sessions = (count: number): string => `${numberWord(count)} ${plural('session', count)}`;
  const note =
    v.thisWeekSessionsWithVolume !== sameSessions
      ? `${formatKg(v.thisWeekKg)} kg over ${sessions(v.thisWeekSessionsWithVolume)} so far, against ${formatKg(sameKg)} kg over ${sessions(sameSessions)} by this point last week.`
      : `${formatKg(v.thisWeekKg)} kg so far, against ${formatKg(sameKg)} kg by this point last week.`;
  return { id: 'volume', icon: 'volume', fact, note, muscle: null };
}

function volumeObservation(insight: WeeklyTrainingInsight): BriefObservation | null {
  const v = insight.volume;

  if (v.thisWeekKg > 0) {
    // Set against last week by the same weekday, and left out when that figure is missing or zero.
    return sameDaysVolumeObservation(insight);
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

/** The observation that follows today's own kind, when the weekly insight carries the day-kinds
 *  fields. It only speaks about a kind whose comparison is meaningful (cardio's distance and
 *  pace, a mobility or sport session's duration) and only when a last-time record exists; a
 *  strength day, an open day, or a rest day (which keeps the existing yesterday-facing
 *  observations instead) contribute nothing here. */
function todayKindObservation(insight: WeeklyTrainingInsight): BriefObservation | null {
  const today = insight.today;
  const last = today?.lastOfKind;
  if (!today || !last || last.minutes == null) {
    return null;
  }

  if (today.kind === 'CARDIO' && last.distanceKm != null && last.paceSecondsPerKm != null) {
    const fact = `Your last run was ${formatKm(last.distanceKm)} in ${formatDuration(last.minutes)}.`;
    const note = `That is ${formatPace(last.paceSecondsPerKm)} per km.`;
    return { id: 'today-kind', icon: 'day-kind', fact, note, muscle: null, dayKind: 'CARDIO' };
  }

  if (today.kind === 'MOBILITY') {
    const fact = `Your last mobility session was ${formatDuration(last.minutes)}.`;
    const note = `It was on ${weekdayDateLabel(last.date)}.`;
    return { id: 'today-kind', icon: 'day-kind', fact, note, muscle: null, dayKind: 'MOBILITY' };
  }

  if (today.kind === 'SPORT') {
    const label = today.label.toLowerCase();
    const fact = `Your last ${label} was ${formatDuration(last.minutes)}.`;
    const note = `It was on ${weekdayDateLabel(last.date)}.`;
    return { id: 'today-kind', icon: 'day-kind', fact, note, muscle: null, dayKind: 'SPORT' };
  }

  return null;
}

/** Builds up to three coach observations from the weekly training insight, in fixed rule order
 *  (today's own kind first when the day-kinds fields are present, then rested groups, streak,
 *  volume, and week-so-far as a filler), skipping any rule whose condition is not met. The coach
 *  never gives advice, so every sentence here is a plain fact about what happened, not a
 *  suggestion about what to do next. */
export function dailyObservations(insight: WeeklyTrainingInsight, _now: Date, _timezone: string): BriefObservation[] {
  // The clock and the timezone are accepted so that every brief function is called the same way.
  // All dates here come from the insight's reference date, which the server worked out in the
  // user's timezone. Nothing is validated or thrown, because this runs inside a computed signal
  // and an exception there would take the whole brief down.
  if (!insight.referenceDate) {
    return [];
  }

  const observations: BriefObservation[] = [];

  const todayKind = todayKindObservation(insight);
  if (todayKind) {
    observations.push(todayKind);
  }

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
