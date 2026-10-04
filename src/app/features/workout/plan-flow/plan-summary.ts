import { weekMinutes } from './plan-coverage';
import { DraftDay, DraftPlan, formatMinutes, PlanProfile, PlanType } from './plan-draft';

export interface WeekFigures {
  trainingDays: number;
  strengthDays: number;
  cardioDays: number;
  sportDays: number;
  mobilityDays: number;
  minutes: number;
  moves: number;
  setsPerWeek: number;
}

export function weekFigures(days: readonly DraftDay[]): WeekFigures {
  const count = (kind: DraftDay['kind']) => days.filter((day) => day.kind === kind).length;
  const withMoves = days.filter((day) => day.kind === 'STRENGTH' || day.kind === 'MOBILITY');
  return {
    trainingDays: days.filter((day) => day.kind !== 'REST').length,
    strengthDays: count('STRENGTH'),
    cardioDays: count('CARDIO'),
    sportDays: count('SPORT'),
    mobilityDays: count('MOBILITY'),
    minutes: weekMinutes(days),
    moves: withMoves.reduce((sum, day) => sum + day.moves.length, 0),
    setsPerWeek: withMoves.reduce(
      (sum, day) => sum + day.moves.reduce((inner, move) => inner + (move.sets ?? (move.timed ? 1 : 0)), 0),
      0
    )
  };
}

function pluralDays(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}

/** "2 strength · 1 cardio · 1 sport · 180 min": the one line the narrow panel folds to. */
export function shortWeekLine(figures: WeekFigures): string {
  const parts: string[] = [];
  if (figures.strengthDays) {
    parts.push(`${figures.strengthDays} strength`);
  }
  if (figures.cardioDays) {
    parts.push(`${figures.cardioDays} cardio`);
  }
  if (figures.sportDays) {
    parts.push(`${figures.sportDays} sport`);
  }
  if (figures.mobilityDays) {
    parts.push(`${figures.mobilityDays} mobility`);
  }
  parts.push(`${figures.minutes} min`);
  return parts.join(' · ');
}

/** The line above Continue: the week against the profile. */
export function weekSummaryLine(figures: WeekFigures, profile: PlanProfile): string {
  const kinds = shortWeekLine(figures);
  const week = `${pluralDays(figures.trainingDays)} · ${kinds} a week.`;
  return `${week} Your profile says ${profile.weeklyWorkoutDays} days and ${profile.preferredDurationMinutes} min.`;
}

/** The plan type the week implies. Sport counts as cardio when nothing else is trained. */
export function derivePlanType(days: readonly DraftDay[]): PlanType {
  const kinds = new Set(days.filter((day) => day.kind !== 'REST').map((day) => day.kind));
  if (kinds.size === 1) {
    const only = [...kinds][0];
    if (only === 'STRENGTH') {
      return 'STRENGTH';
    }
    if (only === 'MOBILITY') {
      return 'MOBILITY';
    }
    return 'CARDIO';
  }
  if (kinds.size === 2 && kinds.has('CARDIO') && kinds.has('SPORT')) {
    return 'CARDIO';
  }
  return 'MIXED';
}

function lower(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function joinParts(parts: string[]): string {
  if (parts.length <= 1) {
    return parts[0] ?? 'Training week';
  }
  const rest = parts.slice(1).map(lower);
  const all = [parts[0], ...rest];
  return `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`;
}

/** "Strength and cardio, 4 days", "Full body, 3 days", "Running and badminton, 3 days". */
export function suggestPlanName(days: readonly DraftDay[]): string {
  const training = days.filter((day) => day.kind !== 'REST');
  if (training.length === 0) {
    return '';
  }
  const strength = training.filter((day) => day.kind === 'STRENGTH');
  const cardio = training.filter((day) => day.kind === 'CARDIO');
  const sport = training.filter((day) => day.kind === 'SPORT');
  const mobility = training.filter((day) => day.kind === 'MOBILITY');
  const parts: string[] = [];
  if (strength.length) {
    parts.push(strength.every((day) => day.title.toLowerCase().startsWith('full body')) && strength.length === training.length ? 'Full body' : 'Strength');
  }
  if (cardio.length) {
    parts.push(cardio.every((day) => /run/i.test(day.title)) ? 'Running' : 'Cardio');
  }
  const sportNames = [...new Set(sport.map((day) => day.title.trim() || 'Sport'))];
  parts.push(...sportNames);
  if (mobility.length) {
    parts.push('Mobility');
  }
  return `${joinParts(parts)}, ${pluralDays(training.length)}`;
}

export interface ReviewRow {
  dayOfWeek: number;
  kind: DraftDay['kind'];
  title: string;
  /** "Strength · 45 min". */
  meta: string;
  /** The lines under the title: moves, or the cardio and sport summary. */
  lines: string[];
}

function cardioLine(day: DraftDay): string {
  const where = day.location ? day.location.charAt(0) + day.location.slice(1).toLowerCase() : '';
  const minutes = `${day.minutes ?? 0} min`;
  return where ? `${minutes} · ${where.toLowerCase()}` : minutes;
}

function effortWord(day: DraftDay): string {
  return day.effort ? day.effort.toLowerCase() : '';
}

export function moveLine(move: DraftDay['moves'][number]): string {
  if (move.timed) {
    return `${move.name} ${move.sets ?? 1} × ${move.durationSeconds ?? move.reps ?? 0} s`;
  }
  return `${move.name} ${move.sets ?? 0} × ${move.reps ?? 0}`;
}

/** What a training day shows in the review step, as plain text. */
export function reviewRow(day: DraftDay): ReviewRow {
  const kindLabel = day.kind.charAt(0) + day.kind.slice(1).toLowerCase();
  const meta = `${kindLabel} · ${formatMinutes(day.minutes ?? 0)}`;
  let lines: string[] = [];
  if (day.kind === 'STRENGTH' || day.kind === 'MOBILITY') {
    lines = day.moves.map(moveLine);
  } else if (day.kind === 'CARDIO') {
    lines = [cardioLine(day)];
  } else if (day.kind === 'SPORT') {
    lines = [[day.title || 'Sport', `${day.minutes ?? 0} min`, effortWord(day)].filter(Boolean).join(' · ')];
  }
  return { dayOfWeek: day.dayOfWeek, kind: day.kind, title: day.title || kindLabel, meta, lines };
}

export function reviewRows(days: readonly DraftDay[]): ReviewRow[] {
  return days.filter((day) => day.kind !== 'REST').map(reviewRow);
}

/** The line shown when another plan is current. */
export function currentPlanNote(currentName: string | null): string {
  return currentName ? `Your current plan is ${currentName}; switching archives nothing.` : '';
}

export function planHasName(plan: DraftPlan): boolean {
  return plan.name.trim().length > 0;
}
