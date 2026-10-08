import { DayKind, MuscleGroupCode, MuscleGroupInsight, WeeklyLiftChange, WeeklyTrainingInsight } from '../../../core/fitsync.models';
import { formatDuration, formatKm, formatPace } from './brief-duration';
import { numberWord } from './brief-copy';
import { joinLabels, muscleLabel } from './brief-muscles';
import { shortDateLabel } from '../../../shared/date-label';

/** Where an observation leads: the page that holds the figures it was read from. */
export interface ObservationDoor {
  label: string;
  path: string;
  fragment?: string;
}

export type ObservationIcon = 'rest' | 'streak' | 'strength' | 'week' | 'day-kind';

export interface BriefObservation {
  id: string;
  icon: ObservationIcon;
  fact: string;
  note: string;
  /** The muscle group this observation is about, so the row can draw that muscle's own icon.
   *  Set for the rested (first group of the chosen set, backend order) and streak (that group)
   *  rules; null for today's kind, the best single and week-so-far, which are not about any one
   *  muscle group. */
  muscle: MuscleGroupCode | null;
  /** The day kind this observation illustrates, drawn with the day-kind glyph set instead of a
   *  muscle glyph. Set only for the observation that follows today's kind; null everywhere else. */
  dayKind?: DayKind | null;
  /** A quiet door to the page the fact came from: the label, the route and the section of it. */
  door?: ObservationDoor;
}

/** Muscle groups whose name is a plural noun, so a sentence about one of them alone still takes
 *  "have" and "they". */
const PLURAL_VERB_GROUPS = new Set<MuscleGroupCode>(['LEGS', 'ARMS', 'SHOULDERS', 'GLUTES']);

const MUSCLES_DOOR: ObservationDoor = { label: 'Muscles ›', path: '/progress/training', fragment: 'muscles' };
const ACTIVITIES_DOOR: ObservationDoor = { label: 'Activities ›', path: '/progress/training', fragment: 'activities' };

function capitalize(text: string): string {
  return text.length ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function plural(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

/** Formats an estimated best single in kilograms, with one decimal only when it has one: 81.7, 30. */
function formatE1rm(kg: number): string {
  return String(Math.round(kg * 10) / 10);
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

/** A weekday for a past day: the bare name inside the last week, and the date too from seven days
 *  back, when the name alone could mean this week's day: "Friday", then "Monday, 28 Sept". */
function pastWeekday(key: string, referenceDate: string): string {
  const name = weekdayFull(key);
  return daysBetweenKeys(key, referenceDate) >= 7 ? `${name}, ${shortDateLabel(key, asUtcDate(referenceDate))}` : name;
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
    ? `They were last trained on ${pastWeekday(picked.lastTrainedOn, insight.referenceDate)}, so they are ready whenever you are.`
    : `It was last trained on ${pastWeekday(picked.lastTrainedOn, insight.referenceDate)}, so it is ready whenever you are.`;
  return { id: 'rested', icon: 'rest', fact, note, muscle: picked.firstMuscle, door: MUSCLES_DOOR };
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
  return { id: 'streak', icon: 'streak', fact, note, muscle: group.muscleGroup, door: MUSCLES_DOOR };
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
  return `on ${pastWeekday(lastTrainedOn, referenceDate)}`;
}

/** The change of a lift's estimated best single, as a whole percent. The server sends it; when it is
 *  missing it is worked out from the start and the current figure. */
function liftChangePct(lift: WeeklyLiftChange): number {
  if (Number.isFinite(lift.changePct)) {
    return Math.round(lift.changePct as number);
  }
  return lift.e1rmStart > 0 ? Math.round(((lift.e1rmNow - lift.e1rmStart) / lift.e1rmStart) * 100) : 0;
}

/** Strength is read as the estimated best single of a lift, never as the weight moved. The lift
 *  that changed most (in either direction) leads; a lift with no start or no current figure says
 *  nothing, and so does a week with no lifts. */
function bestSingleObservation(insight: WeeklyTrainingInsight): BriefObservation | null {
  const usable = (insight.lifts ?? []).filter((lift) => lift.name && lift.e1rmNow > 0 && lift.e1rmStart > 0);
  if (!usable.length) {
    return null;
  }
  const lead = usable.reduce((best, lift) => (Math.abs(liftChangePct(lift)) > Math.abs(liftChangePct(best)) ? lift : best));
  const pct = liftChangePct(lead);
  const now = formatE1rm(lead.e1rmNow);
  let fact: string;
  if (pct >= 1) {
    fact = `Your ${lead.name} best single rose ${pct}% to ${now} kg.`;
  } else if (pct <= -1) {
    fact = `Your ${lead.name} best single is ${Math.abs(pct)}% lower, at ${now} kg.`;
  } else {
    fact = `Your ${lead.name} best single is steady at ${now} kg.`;
  }
  const note = `It was ${formatE1rm(lead.e1rmStart)} kg before. A best single is the most you could lift once, worked out from your sets.`;
  return { id: 'best-single', icon: 'strength', fact, note, muscle: null, door: { label: 'Over time ›', path: `/progress/training/exercises/${lead.exerciseId}` } };
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
    return { id: 'week', icon: 'week', fact, note, muscle: null, door: { label: '4 weeks ›', path: '/progress/training' } };
  }

  const previousDuration = formatDuration(insight.previousWeekTotalMinutes);
  const fact = `Last week had ${numberWord(insight.previousWeekCompletedSessions)} ${plural('session', insight.previousWeekCompletedSessions)}, ${previousDuration} in all.`;
  const note = `This week has not started yet.`;
  return { id: 'week', icon: 'week', fact, note, muscle: null, door: { label: '4 weeks ›', path: '/progress/training' } };
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
    return { id: 'today-kind', icon: 'day-kind', fact, note, muscle: null, dayKind: 'CARDIO', door: ACTIVITIES_DOOR };
  }

  if (today.kind === 'MOBILITY') {
    const fact = `Your last mobility session was ${formatDuration(last.minutes)}.`;
    const note = `It was on ${weekdayDateLabel(last.date)}.`;
    return { id: 'today-kind', icon: 'day-kind', fact, note, muscle: null, dayKind: 'MOBILITY', door: ACTIVITIES_DOOR };
  }

  if (today.kind === 'SPORT') {
    const label = today.label.toLowerCase();
    const fact = `Your last ${label} was ${formatDuration(last.minutes)}.`;
    const note = `It was on ${weekdayDateLabel(last.date)}.`;
    return { id: 'today-kind', icon: 'day-kind', fact, note, muscle: null, dayKind: 'SPORT', door: ACTIVITIES_DOOR };
  }

  return null;
}

/** Builds up to three coach observations from the weekly training insight, in fixed rule order
 *  (today's own kind first when the day-kinds fields are present, then rested groups, streak,
 *  best single, and week-so-far as a filler), skipping any rule whose condition is not met. The coach
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

  const bestSingle = bestSingleObservation(insight);
  if (bestSingle) {
    observations.push(bestSingle);
  }

  if (observations.length < 3) {
    const weekSoFar = weekSoFarObservation(insight);
    if (weekSoFar) {
      observations.push(weekSoFar);
    }
  }

  return observations.slice(0, 3);
}
