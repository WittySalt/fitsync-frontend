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
}

export interface BriefHeadline {
  lines: [string, string];
  greeting: string;
}

export function briefHeadline(input: BriefHeadlineInput): BriefHeadline {
  const { period, firstName, completed, target, daysLeftInWeek } = input;
  const prefix = salutationPrefix(period, firstName);

  if (target != null && target > 0) {
    const targetWord = numberWord(target);
    const targetMet = completed >= target;

    if (targetMet) {
      const line1 = `${capitalize(numberWord(completed))} of ${targetWord}.`;
      const line2 = period === 'MORNING' || period === 'AFTERNOON' ? 'The week is yours.' : 'The week is closed.';

      let greeting: string;
      if (period === 'MORNING' || period === 'AFTERNOON') {
        greeting = `${prefix} Your goal of ${targetWord} ${plural('session', target)} is met, so today is free for rest or a bonus.`;
      } else if (period === 'EVENING') {
        greeting = `${prefix} Your goal of ${targetWord} ${plural('session', target)} is met, and a bonus session still fits into tonight.`;
      } else {
        greeting = `${prefix} Your goal of ${targetWord} ${plural('session', target)} is met, and tomorrow starts a fresh page.`;
      }

      return { lines: [line1, line2], greeting };
    }

    if (completed === 0) {
      // Counting from zero reads as a debt. The week is named and the goal is stated once.
      return {
        lines: ['A new week.', `${capitalize(targetWord)} ${plural('session', target)} ahead.`],
        greeting: `${prefix} Nothing is logged yet this week, and your goal is ${targetWord} ${plural('session', target)}.`
      };
    }

    const remaining = target - completed;
    const line1 = `${capitalize(numberWord(completed))} of ${targetWord}.`;
    const line2 = `${capitalize(numberWord(remaining))} to go.`;
    const greeting =
      `${prefix} ${capitalize(numberWord(remaining))} more ${plural('session', remaining)} would reach your goal of ` +
      `${targetWord} ${plural('session', target)}, with ${daysLeftInWeek} ${plural('day', daysLeftInWeek)} left in the week.`;

    return { lines: [line1, line2], greeting };
  }

  if (completed === 0) {
    return {
      lines: ['A new week.', 'Nothing logged yet.'],
      greeting: `${prefix} Here is your week so far.`
    };
  }

  return {
    lines: [`${capitalize(numberWord(completed))} ${plural('session', completed)}`, 'this week.'],
    greeting: `${prefix} Here is your week so far.`
  };
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
