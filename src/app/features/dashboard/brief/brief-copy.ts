import { DayPeriod } from './brief-time';

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'
];

/** Spells out small counts the way the coach's copy does ("Four of four."); larger counts fall
 *  back to digits since the coach never counts past a dozen sessions in one week. */
export function numberWord(n: number): string {
  if (Number.isInteger(n) && n >= 0 && n < NUMBER_WORDS.length) {
    return NUMBER_WORDS[n];
  }
  return String(n);
}

function capitalize(text: string): string {
  return text.length ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function plural(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

function salutationFor(period: DayPeriod): string {
  switch (period) {
    case 'MORNING':
      return 'Good morning';
    case 'AFTERNOON':
      return 'Good afternoon';
    default:
      return 'Good evening';
  }
}

/** "Good morning, Alice." or, with no name, "Good morning." — never a dangling comma. */
function salutationPrefix(period: DayPeriod, firstName: string): string {
  const salutation = salutationFor(period);
  return firstName.trim() ? `${salutation}, ${firstName.trim()}.` : `${salutation}.`;
}

export interface BriefHeadlineInput {
  period: DayPeriod;
  firstName: string;
  completed: number;
  target: number | null;
  daysLeftInWeek: number;
  /** A session was completed today. Undefined behaves as false, so every existing caller still
   *  compiles and gets the pre-existing copy. */
  completedToday?: boolean;
  /** Today is a rest day. Nothing sets this yet; a later change wires it up from the day-kind data. */
  restToday?: boolean;
  trainedYesterday?: boolean;
  /** Whole days since the most recent completed session. Null when unknown or when there has
   *  never been one. */
  daysSinceLastSession?: number | null;
  /** Consecutive weeks, ending with the current or the last full week, that met the goal. Nothing
   *  sets this yet; a later change wires it up from streak data. */
  weeksAtGoal?: number | null;
}

export interface BriefHeadline {
  lines: [string, string];
  greeting: string;
}

/** Picks the two headline lines. The coach cheers what is done and never presses about what is
 *  left, so the rules are checked in a fixed order and the first match wins; only the "exactly
 *  met" rule below ever prints an exclamation mark. */
function headlineLines(args: {
  completed: number;
  target: number | null;
  completedToday: boolean;
  restToday: boolean;
  trainedYesterday: boolean;
  daysSinceLastSession: number | null;
}): [string, string] {
  const { completed, target, completedToday, restToday, trainedYesterday, daysSinceLastSession } = args;

  if (target != null) {
    if (daysSinceLastSession != null && daysSinceLastSession >= 14 && completed === 0) {
      // A long absence outranks every other rule: the coach welcomes the return rather than
      // naming the empty week.
      return ['Good to see you.', 'One session restarts the week.'];
    }
    if (completed === target) {
      return [`${capitalize(numberWord(completed))} for ${numberWord(target)}!`, 'The week is yours.'];
    }
    if (completed > target) {
      return [`${capitalize(numberWord(completed))} this week.`, "That's a bonus round."];
    }
    if (completedToday) {
      return ['Done for today.', `That makes ${numberWord(completed)}.`];
    }
    if (restToday) {
      return ['Rest day.', trainedYesterday ? "Yesterday's work is settling in." : 'The week is still open.'];
    }
    if (completed === 0) {
      return ['Fresh week.', 'A clean slate.'];
    }
    if (completed === 1 && target > 1) {
      return ['One down.', "You're on the board."];
    }
    if (target - completed === 1) {
      return [`${capitalize(numberWord(completed))} down.`, 'One more makes the week.'];
    }
    if (completed * 2 === target) {
      return ['Halfway there.', `${capitalize(numberWord(completed))} in the bag.`];
    }
    const remaining = target - completed;
    return [`${capitalize(numberWord(completed))} down.`, `${capitalize(numberWord(remaining))} to play.`];
  }

  if (completed === 0) {
    return ['Fresh week.', 'Nothing logged yet.'];
  }
  return [`${capitalize(numberWord(completed))} ${plural('session', completed)}`, 'this week.'];
}

/** Builds the greeting sentence that follows the salutation prefix. A met-or-exceeded goal keeps
 *  the time-of-day sentence the coach already used, except the evening one, which used to suggest
 *  a bonus session tonight and has been softened to simply hand the evening back. */
function buildGreeting(args: {
  prefix: string;
  period: DayPeriod;
  completed: number;
  target: number | null;
  daysLeftInWeek: number;
  targetMet: boolean;
  weeksAtGoal: number | null;
}): string {
  const { prefix, period, completed, target, daysLeftInWeek, targetMet, weeksAtGoal } = args;

  if (target == null) {
    return `${prefix} Here is your week so far.`;
  }

  const targetWord = numberWord(target);

  if (targetMet) {
    let sentence: string;
    if (period === 'MORNING' || period === 'AFTERNOON') {
      sentence = `Your goal of ${targetWord} ${plural('session', target)} is met, so today is free for rest or a bonus.`;
    } else if (period === 'EVENING') {
      sentence = `Your goal of ${targetWord} ${plural('session', target)} is met, and the evening is yours.`;
    } else {
      sentence = `Your goal of ${targetWord} ${plural('session', target)} is met, and tomorrow starts a fresh page.`;
    }
    let greeting = `${prefix} ${sentence}`;
    if (weeksAtGoal != null && weeksAtGoal >= 2) {
      // A running streak is worth naming, but only once the goal itself has been said.
      greeting += ` That is ${numberWord(weeksAtGoal)} ${plural('week', weeksAtGoal)} running at ${targetWord}.`;
    }
    return greeting;
  }

  if (completed === 0) {
    return `${prefix} The week is open, and your goal is ${targetWord} ${plural('session', target)}.`;
  }

  const completedWord = capitalize(numberWord(completed));
  if (daysLeftInWeek <= 1) {
    return `${prefix} ${completedWord} ${plural('session', completed)} in, and today is the last day of the week.`;
  }
  return (
    `${prefix} ${completedWord} ${plural('session', completed)} in, and the week still has ` +
    `${numberWord(daysLeftInWeek)} ${plural('day', daysLeftInWeek)} for the rest.`
  );
}

export function briefHeadline(input: BriefHeadlineInput): BriefHeadline {
  const { period, firstName, completed, daysLeftInWeek } = input;
  const completedToday = input.completedToday ?? false;
  const restToday = input.restToday ?? false;
  const trainedYesterday = input.trainedYesterday ?? false;
  const daysSinceLastSession = input.daysSinceLastSession ?? null;
  const weeksAtGoal = input.weeksAtGoal ?? null;
  const target = input.target != null && input.target > 0 ? input.target : null;
  const targetMet = target != null && completed >= target;
  const prefix = salutationPrefix(period, firstName);

  const lines = headlineLines({ completed, target, completedToday, restToday, trainedYesterday, daysSinceLastSession });
  const greeting = buildGreeting({ prefix, period, completed, target, daysLeftInWeek, targetMet, weeksAtGoal });

  return { lines, greeting };
}

export function quickQuestions(period: DayPeriod, caloriesTarget: number | null): string[] {
  switch (period) {
    case 'MORNING':
      return [
        'What should I eat before training?',
        caloriesTarget != null
          ? `Plan my meals for ${caloriesTarget.toLocaleString('en-US')} kcal`
          : 'Plan my meals for today',
        'How is my week going?'
      ];
    case 'AFTERNOON':
      return ['What should I eat before training?', 'How is my week going?', 'What is a good snack now?'];
    case 'EVENING':
      return ['What fits in the calories I have left?', 'Is it too late to train tonight?', 'How is my week going?'];
    default:
      return ['How did today go?', 'What should tomorrow start with?', 'How is my week going?'];
  }
}
