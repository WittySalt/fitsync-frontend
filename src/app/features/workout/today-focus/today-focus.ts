import {
  DayInsight,
  ExerciseHistoryEntry,
  NextTraining,
  WeeklyTrainingInsight,
  WorkoutPlanExercise,
  WorkoutSession
} from '../../../core/fitsync.models';
import { groupLabel } from '../../../shared/charts/muscle-figure/muscle-figure';
import { numberWord } from '../../dashboard/brief/brief-copy';
import { joinLabels } from '../../dashboard/brief/brief-muscles';
import { formatDuration, formatKm, formatPace } from '../../dashboard/brief/brief-duration';

/** The four kinds of day that have a companion. Mobility, open and finished days have none. */
export type FocusKind = 'strength' | 'cardio' | 'sport' | 'rest';

/** What the companion is built for: today's plan day, read from the Today card's own inputs. */
export interface FocusTarget {
  kind: FocusKind;
  title: string;
  /** The sport's name on a sport day. */
  label: string;
  minutes: number | null;
  moves: WorkoutPlanExercise[];
  /** Today as a date key in the person's zone. */
  today: string;
}

/** The muscle groups of one move and its logged history. */
export interface MoveFacts {
  exerciseId: string;
  primary: string[];
  secondary: string[];
  history: ExerciseHistoryEntry[];
}

/** Everything read from the endpoints the page already uses, as the builder takes it. */
export interface FocusFacts {
  insight: WeeklyTrainingInsight | null;
  next: NextTraining | null;
  moves: MoveFacts[];
  /** Completed sessions over the last weeks, newest first. */
  history: WorkoutSession[];
  /** The last three cardio sessions, newest first. */
  runs: WorkoutSession[];
}

export interface FocusRow {
  /** The small mark before a line: the move's number, or empty. */
  mark: string;
  text: string;
  right?: string;
}

export interface FocusBar {
  name: string;
  seconds: number;
  minutes: string;
}

/** Blocks the Today card itself takes on a short day (sport and rest). */
export interface FocusCardBlock {
  kind: 'sport' | 'rest';
  /** "Usually Saturdays · 60 min · counts as cardio". */
  usual?: string;
  dots?: { label: string; state: 'played' | 'missed' | 'ahead' }[];
  dotsHeading?: string;
  month?: string;
  weekHeading?: string;
  week?: { weekday: string; kind: string; title: string; minutes: string }[];
}

export interface FocusModel {
  kind: FocusKind;
  /** Hard sets by muscle group for the figure; null draws no figure. */
  sets: Record<string, number> | null;
  /** Rest and sport days draw the figure in light green. */
  light: boolean;
  caption: string;
  subcaption: string;
  bar: { parts: FocusBar[]; target: string } | null;
  heading: string;
  rows: FocusRow[];
  coach: string;
  cardBlock: FocusCardBlock | null;
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The groups a sport leans on, by words of its name. A sport with no entry reads as legs and core. */
const SPORT_GROUPS: ReadonlyArray<{ words: string[]; groups: string[] }> = [
  { words: ['badminton', 'tennis', 'squash', 'table tennis'], groups: ['SHOULDERS', 'LEGS'] },
  { words: ['swim'], groups: ['SHOULDERS', 'BACK'] },
  { words: ['climb', 'boulder'], groups: ['BACK', 'ARMS'] },
  { words: ['cycl', 'bike', 'spin'], groups: ['LEGS', 'GLUTES'] },
  { words: ['basketball', 'football', 'soccer', 'futsal', 'volleyball'], groups: ['LEGS', 'CORE'] },
  { words: ['boxing', 'martial', 'judo', 'karate'], groups: ['SHOULDERS', 'CORE'] },
  { words: ['golf', 'row', 'paddle', 'kayak'], groups: ['BACK', 'CORE'] },
  { words: ['yoga', 'pilates'], groups: ['CORE', 'BACK'] }
];

const FALLBACK_SPORT_GROUPS = ['LEGS', 'CORE'];

export function sportGroups(label: string): string[] {
  const name = label.toLowerCase();
  return SPORT_GROUPS.find((entry) => entry.words.some((word) => name.includes(word)))?.groups ?? FALLBACK_SPORT_GROUPS;
}

/** A date key as UTC midnight, so day arithmetic and weekdays never shift with the local zone or daylight saving. */
function utc(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((utc(toKey).getTime() - utc(fromKey).getTime()) / 86_400_000);
}

export function addDays(key: string, days: number): string {
  const date = utc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "Mon 28 Sept", read from a date key so no zone can shift the day. */
export function dayLabel(key: string): string {
  const date = utc(key);
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
  // getUTCDay counts from Sunday; the + 6 shifts it so Monday is 0.
  return `${SHORT_NAMES[(date.getUTCDay() + 6) % 7]} ${day}`;
}

function weekdayName(key: string): string {
  return WEEKDAY_NAMES[(utc(key).getUTCDay() + 6) % 7] ?? '';
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function labelOf(code: string): string {
  return groupLabel(code);
}

// ------------------------------------------------------------------ the figure

/** Hard sets by group in today's moves: a primary group counts every set, a secondary one half. */
export function setsFromMoves(moves: readonly WorkoutPlanExercise[], facts: readonly MoveFacts[]): Record<string, number> {
  const sets: Record<string, number> = {};
  for (const move of moves) {
    const found = facts.find((entry) => entry.exerciseId === move.exerciseId);
    if (!found) {
      continue;
    }
    const count = Math.max(0, move.targetSets ?? move.setTargets?.length ?? 0);
    for (const group of found.primary) {
      sets[group] = (sets[group] ?? 0) + count;
    }
    for (const group of found.secondary) {
      sets[group] = (sets[group] ?? 0) + count * 0.5;
    }
  }
  return sets;
}

/** The groups by sets, most first: "Chest, legs, back" for the first three, then "· core" for the rest. */
export function figureCaption(sets: Record<string, number>): string {
  const groups = Object.entries(sets)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([group]) => labelOf(group));
  if (groups.length === 0) {
    return '';
  }
  const lead = groups.slice(0, 3).map((label, index) => (index === 0 ? label : lowerFirst(label))).join(', ');
  const rest = groups.slice(3).map(lowerFirst).join(', ');
  return rest ? `${lead} · ${rest}` : lead;
}

// ------------------------------------------------------------------ last time with these moves

/** The last session's sets of one move: "3 × 10 at 20 kg", or "3 × 45 s" for a timed move. */
export function lastTimeLine(name: string, history: readonly ExerciseHistoryEntry[]): string {
  const dated = history
    .filter((entry) => entry.exerciseId)
    .map((entry) => ({ entry, at: entry.completedAt || entry.startedAt }))
    .filter((item) => item.at)
    .sort((a, b) => b.at.localeCompare(a.at));
  const last = dated[0];
  if (!last) {
    return `${name} · not logged yet`;
  }
  const sets = dated.filter((item) => item.entry.sessionId === last.entry.sessionId).map((item) => item.entry);
  const best = sets.reduce((top, set) => ((set.weightKg ?? 0) > (top.weightKg ?? 0) ? set : top), sets[0]);
  const date = dayLabel(last.at.slice(0, 10));
  let amount: string;
  if (best.reps && best.reps > 0) {
    amount = best.weightKg && best.weightKg > 0 ? `${sets.length} × ${best.reps} at ${best.weightKg} kg` : `${sets.length} × ${best.reps}`;
  } else if (best.durationSeconds && best.durationSeconds > 0) {
    amount = `${sets.length} × ${best.durationSeconds} s`;
  } else {
    amount = `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
  }
  return `${name} · ${amount} · ${date}`;
}

// ------------------------------------------------------------------ the coach line

export interface StrengthLineInput {
  /** The lead move's name, which "the top of its range" is said about. */
  leadMove: string;
  /** Days since the lead group was last trained; null when never. */
  daysRested: number | null;
  trainedYesterday: boolean;
  leadGroup: string;
  /** The plan's own note for the day, or its title. */
  planNote: string;
}

/**
 * One line for a strength day, made by rule and never by a model: rested a week or more takes the
 * lead move to the top of its range, trained yesterday keeps it easy, otherwise the plan's note.
 */
export function strengthLine(input: StrengthLineInput): string {
  if (input.daysRested !== null && input.daysRested >= 7) {
    return `Rested ${numberWord(input.daysRested)} days, so take the ${lowerFirst(input.leadMove)} to the top of its range today.`;
  }
  if (input.trainedYesterday) {
    return `${capitalize(labelOf(input.leadGroup))} was trained yesterday, so keep it easy today.`;
  }
  return input.planNote;
}

function cardioLine(insight: WeeklyTrainingInsight | null, planNote: string): string {
  const legsYesterday = insight?.muscleGroups.some((group) => group.trainedYesterday && (group.muscleGroup === 'LEGS' || group.muscleGroup === 'GLUTES'));
  return legsYesterday ? 'Legs worked yesterday, keep it easy today.' : planNote;
}

function restLine(next: NextTraining | null, today: string): string {
  if (!next) {
    return 'A rest day counts.';
  }
  const name = lowerFirst(next.kind === 'SPORT' ? next.label : next.title || next.label);
  const when = daysBetween(today, next.date) === 1 ? 'Tomorrow' : weekdayName(next.date);
  if (!when) {
    return 'A rest day counts.';
  }
  return `A rest day counts. ${when} is the ${name}.`;
}

// ------------------------------------------------------------------ the whole model

function dateOf(session: WorkoutSession, zoneKey: (value: string) => string): string {
  return zoneKey(session.completedAt || session.startedAt);
}

function paceOf(session: WorkoutSession): string {
  const minutes = session.durationMinutes;
  const km = session.distanceKm;
  return km && minutes ? formatPace((minutes * 60) / km) : '';
}

/** The three last runs as rows: the date on the left, "5.3 km · 6:05 a km" on the right. */
export function runRows(runs: readonly WorkoutSession[], zoneKey: (value: string) => string): FocusRow[] {
  return runs.slice(0, 3).map((run, index) => {
    const pace = paceOf(run);
    const km = run.distanceKm ? formatKm(run.distanceKm) : '';
    return { mark: '', text: dayLabel(dateOf(run, zoneKey)), right: [km, pace && (index === 0 ? `${pace} a km` : pace)].filter(Boolean).join(' · ') };
  });
}

function planNote(target: FocusTarget): string {
  const note = target.moves.map((move) => move.notes?.trim()).find((text) => !!text);
  return note || `Today is ${lowerFirst(target.title || target.label || 'a training day')}.`;
}

function weekRows(insight: WeeklyTrainingInsight | null, today: string): NonNullable<FocusCardBlock['week']> {
  return (insight?.days ?? [])
    .filter((day: DayInsight) => day.date > today && (day.planned || day.sessions.length > 0))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const planned = day.planned;
      const kind = planned?.kind ?? day.kind;
      const title = planned?.title || day.label;
      return {
        weekday: SHORT_NAMES[(day.dayOfWeek || 1) - 1] ?? '',
        kind: String(kind),
        title: kind === 'SPORT' ? title : capitalize(String(kind).toLowerCase()),
        minutes: planned?.estimatedMinutes ? `${planned.estimatedMinutes} min` : ''
      };
    });
}

function sportBlock(target: FocusTarget, facts: FocusFacts, zoneKey: (value: string) => string): FocusCardBlock {
  const weekday = weekdayName(target.today);
  const name = target.label.toLowerCase();
  const sameSport = facts.history.filter((session) => (session.sportLabel ?? session.name ?? '').toLowerCase().includes(name));
  const playedOn = new Set(sameSport.map((session) => dateOf(session, zoneKey)));
  const dots = [4, 3, 2, 1].map((back) => {
    const date = addDays(target.today, -7 * back);
    return { label: dayLabel(date).replace(/^\w+ /, ''), state: playedOn.has(date) ? ('played' as const) : ('missed' as const) };
  });
  const month = target.today.slice(0, 7);
  const thisMonth = facts.history.filter((session) => dateOf(session, zoneKey).startsWith(month));
  const minutes = thisMonth.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
  const typical = sameSport.find((session) => session.durationMinutes)?.durationMinutes ?? target.minutes;
  return {
    kind: 'sport',
    usual: ['Usually ' + weekday + 's', typical ? formatDuration(typical) : '', 'counts as cardio'].filter(Boolean).join(' · '),
    dotsHeading: `${weekday}s, last four weeks`,
    dots,
    month: `This month · ${thisMonth.length} ${thisMonth.length === 1 ? 'session' : 'sessions'} · ${formatDuration(minutes) || '0 min'}`
  };
}

/** Builds the companion of a day from its target and the facts read for it. */
export function buildFocus(target: FocusTarget, facts: FocusFacts, zoneKey: (value: string) => string): FocusModel {
  const insight = facts.insight;
  const base: FocusModel = { kind: target.kind, sets: null, light: false, caption: '', subcaption: '', bar: null, heading: '', rows: [], coach: '', cardBlock: null };
  if (target.kind === 'strength') {
    const sets = setsFromMoves(target.moves, facts.moves);
    const groups = Object.entries(sets).sort((a, b) => b[1] - a[1]);
    const lead = groups[0]?.[0] ?? '';
    const insightGroup = insight?.muscleGroups.find((group) => group.muscleGroup === lead);
    const rested = insightGroup?.lastTrainedOn ? daysBetween(insightGroup.lastTrainedOn, target.today) : null;
    const rows: FocusRow[] = target.moves.map((move, index) => ({
      mark: String(index + 1),
      text: lastTimeLine(move.exerciseNameSnapshot, facts.moves.find((entry) => entry.exerciseId === move.exerciseId)?.history ?? [])
    }));
    if (insightGroup?.lastTrainedOn && rested !== null) {
      rows.push({
        mark: String(rows.length + 1),
        text: `Last trained ${dayLabel(insightGroup.lastTrainedOn)}, ${rested} ${rested === 1 ? 'day' : 'days'} ago`
      });
    }
    return {
      ...base,
      sets,
      caption: figureCaption(sets),
      subcaption: "from today's moves",
      heading: 'Last time with these moves',
      rows,
      coach: strengthLine({
        leadMove: target.moves[0]?.exerciseNameSnapshot ?? 'first move',
        daysRested: rested,
        trainedYesterday: !!insightGroup?.trainedYesterday,
        leadGroup: lead,
        planNote: planNote(target)
      })
    };
  }
  if (target.kind === 'cardio') {
    const parts = target.moves
      .filter((move) => (move.targetDurationSeconds ?? 0) > 0)
      .map((move) => ({ name: move.exerciseNameSnapshot, seconds: move.targetDurationSeconds ?? 0, minutes: `${Math.round((move.targetDurationSeconds ?? 0) / 60)} min` }));
    const main = [...target.moves].sort((a, b) => (b.targetDurationSeconds ?? 0) - (a.targetDurationSeconds ?? 0))[0];
    const effort = main?.notes?.split(/[,.]/)[0]?.trim() ?? '';
    return {
      ...base,
      bar: parts.length ? { parts, target: [target.minutes ? formatDuration(target.minutes) : '', effort ? capitalize(effort) : ''].filter(Boolean).join(' · ') } : null,
      heading: 'Your last three runs',
      rows: runRows(facts.runs, zoneKey),
      coach: cardioLine(insight, planNote(target))
    };
  }
  if (target.kind === 'sport') {
    const groups = sportGroups(target.label);
    // The same small count for every group: the figure only marks which groups a sport uses, drawn light.
    const sets = Object.fromEntries(groups.map((group) => [group, 4]));
    const name = target.label.toLowerCase();
    const last = facts.history.find((session) => (session.sportLabel ?? session.name ?? '').toLowerCase().includes(name));
    const yesterday = addDays(target.today, -1);
    const yesterdaySession = facts.history.find((session) => dateOf(session, zoneKey) === yesterday);
    const rows: FocusRow[] = [];
    if (last) {
      const when = dayLabel(dateOf(last, zoneKey));
      const effort = last.perceivedExertion ? ` · effort ${last.perceivedExertion} of 10` : '';
      rows.push({ mark: '1', text: `Last time ${when} · ${formatDuration(last.durationMinutes)}${effort}` });
    }
    if (yesterdaySession) {
      rows.push({ mark: String(rows.length + 1), text: `Yesterday: ${yesterdaySession.name}, ${formatDuration(yesterdaySession.durationMinutes)}` });
    }
    return {
      ...base,
      sets,
      light: true,
      caption: `${joinLabels(groups.map(labelOf))} work hardest`,
      rows,
      coach: `${joinLabels(groups.map(labelOf))} do a lot of the work here.`,
      cardBlock: sportBlock(target, facts, zoneKey)
    };
  }
  // A rest day: the groups worked lately, drawn light, and the days that remain this week.
  const recent = (insight?.muscleGroups ?? []).filter((group) => group.lastTrainedOn);
  const newest = recent.map((group) => group.lastTrainedOn as string).sort().pop() ?? null;
  const recovering = newest ? recent.filter((group) => daysBetween(group.lastTrainedOn as string, newest) <= 1 && group.inActivePlan !== false) : [];
  const labels = recovering.map((group) => labelOf(group.muscleGroup));
  const since = newest ? daysBetween(newest, target.today) : null;
  const rows: FocusRow[] = [];
  if (labels.length && since !== null) {
    rows.push({ mark: '1', text: `${joinLabels(labels)}: ${numberWord(since)} ${since === 1 ? 'day' : 'days'} since their last session` });
  }
  if (insight) {
    rows.push({
      mark: String(rows.length + 1),
      text: `This week so far · ${insight.completedSessions} ${insight.completedSessions === 1 ? 'session' : 'sessions'} · ${insight.totalMinutes} min`
    });
  }
  return {
    ...base,
    sets: Object.fromEntries(recovering.map((group) => [group.muscleGroup, 4])),
    light: true,
    caption: labels.length ? `Recovering: ${joinLabels(labels).toLowerCase()}` : 'Nothing worked lately',
    rows,
    coach: restLine(facts.next, target.today),
    cardBlock: { kind: 'rest', weekHeading: 'Rest of the week', week: weekRows(insight, target.today) }
  };
}
