import { DayPeriod } from './brief-time';
import { usualTimeSentence } from './brief-usual-time';

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

/** The salutation follows the same day period as the time chip (dayPeriodFor in brief-time), so
 *  the chip and the greeting can never disagree. Night runs from 22:00 to 05:00, where "Good
 *  evening" would be wrong after midnight and "Good night" reads as a goodbye, so it is a plain
 *  "Hi". */
function salutationFor(period: DayPeriod): string {
  switch (period) {
    case 'MORNING':
      return 'Good morning';
    case 'AFTERNOON':
      return 'Good afternoon';
    case 'EVENING':
      return 'Good evening';
    default:
      return 'Hi';
  }
}

const FULL_WEEKDAYS: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday'
};

/** "Saturday", "Saturday and Sunday", "Thursday, Saturday and Sunday". */
function joinDays(days: string[]): string {
  const names = days.map((day) => FULL_WEEKDAYS[day] ?? day);
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Closes the night sentence once the goal is met. The week starts on Monday, so only on Sunday
 *  (the last day) does tomorrow start a new one. On other nights the sentence names any planned
 *  day still ahead, as a plain fact, or otherwise leaves the rest of the week to the person. */
function nightClosing(daysLeftInWeek: number, plannedLaterDays: string[]): string {
  if (daysLeftInWeek <= 1) {
    return 'tomorrow starts a fresh page';
  }
  if (plannedLaterDays.length === 1) {
    return `a session is still planned for ${joinDays(plannedLaterDays)}`;
  }
  if (plannedLaterDays.length > 1) {
    return `sessions are still planned for ${joinDays(plannedLaterDays)}`;
  }
  return 'the rest of the week is yours';
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
  /** A session was completed today. Undefined behaves as false. */
  completedToday?: boolean;
  /** Today is a rest day. Undefined behaves as false. */
  restToday?: boolean;
  trainedYesterday?: boolean;
  /** Whole days since the most recent completed session. Null when unknown or when there has
   *  never been one. */
  daysSinceLastSession?: number | null;
  /** Consecutive weeks, ending with the current or the last full week, that met the goal. No caller
   *  sets this yet, so the running-streak sentence is currently never added. */
  weeksAtGoal?: number | null;
  /** The time of day the person usually trains, as "HH:mm". Null or absent when none is known. */
  usualStartTime?: string | null;
  /** Minutes since local midnight, which the usual time is compared with. */
  nowMinutes?: number | null;
  /** Today's session is still ahead: it is not under way and not done. The greeting adds the usual
   *  time only when this is true. */
  todayOpen?: boolean;
  /** Short weekday labels ("Sat") of the days after today, within this Monday-to-Sunday week, that
   *  have a training session planned. Absent behaves as none. */
  plannedLaterDays?: string[];
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

/** Builds the greeting sentence that follows the salutation prefix. Once the goal is met or
 *  exceeded the sentence depends on the time of day; the evening one deliberately hands the
 *  evening back rather than suggesting a bonus session tonight. */
function buildGreeting(args: {
  prefix: string;
  period: DayPeriod;
  completed: number;
  target: number | null;
  daysLeftInWeek: number;
  targetMet: boolean;
  weeksAtGoal: number | null;
  plannedLaterDays: string[];
}): string {
  const { prefix, period, completed, target, daysLeftInWeek, targetMet, weeksAtGoal, plannedLaterDays } = args;

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
      sentence = `Your goal of ${targetWord} ${plural('session', target)} is met, and ${nightClosing(daysLeftInWeek, plannedLaterDays)}.`;
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
  const plannedLaterDays = input.plannedLaterDays ?? [];
  let greeting = buildGreeting({
    prefix, period, completed, target, daysLeftInWeek, targetMet, weeksAtGoal, plannedLaterDays
  });

  // The usual time is mentioned only while there is a session to come and plenty of day before it.
  const sessionOpen = (input.todayOpen ?? false) && !completedToday && !restToday && !targetMet;
  const usual = sessionOpen ? usualTimeSentence(period, input.usualStartTime ?? null, input.nowMinutes ?? null) : null;
  if (usual) {
    greeting = `${greeting} ${usual}`;
  }

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
