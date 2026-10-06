import { GuideStepId, TourPage } from './guide.service';

/** The words of one spotlight step. */
export interface PathCopy {
  title: string;
  text: string;
}

/** One step of a page's path: the anchor it points at, and its words, which can differ by the state of the account. */
export interface PathStep {
  /** Matches the `spotlightStep` of the anchor on the page. */
  id: string;
  copy: (variant: string) => PathCopy;
}

/** The state an anchor can report so its words fit the account: "empty" for no plan or no meals yet. */
export const VARIANT_EMPTY = 'empty';

const fixed = (title: string, text: string) => (): PathCopy => ({ title, text });

/**
 * The spotlight path of each page, in the order the steps are shown. A step whose anchor is not on the page
 * at that moment (no Plans tab yet, no Today's focus) is skipped.
 */
export const GUIDE_PATHS: Record<TourPage, readonly PathStep[]> = {
  me: [
    { id: 'targets', copy: fixed('Your targets', 'Your targets live here. Weight, calories, protein and sessions a week.') },
    { id: 'about', copy: fixed('What your coach reads', 'Everything here is what the coach knows about you. Tap anything to change it.') },
    { id: 'achievements', copy: fixed('Your badges', 'Badges come from what you log. Nothing is lost when a week is missed.') }
  ],
  workout: [
    {
      id: 'today',
      copy: (variant) =>
        variant === VARIANT_EMPTY
          ? { title: 'Start with a plan', text: 'Pick a plan first. The coach fills the week for you.' }
          : { title: 'Today starts here', text: 'Today starts here. Start the session when you are ready.' }
    },
    { id: 'focus', copy: fixed('Today’s focus', 'What today works, and why.') },
    { id: 'tabs', copy: fixed('Plans and History', 'Plans holds the week. History holds every session.') }
  ],
  nutrition: [
    { id: 'log', copy: fixed('Log a food', 'Search a food, pick the serving, log it.') },
    {
      id: 'week',
      copy: (variant) => ({
        title: 'This week',
        text:
          variant === VARIANT_EMPTY
            ? 'The days you log fill in here, with today so far. Longer goes to Progress.'
            : 'Which days you logged, and today so far. Longer goes to Progress.'
      })
    },
    { id: 'recipes', copy: fixed('Recipes', 'Cook for tonight picks recipes that fit what is left today.') }
  ],
  progress: [
    { id: 'period', copy: fixed('Pick a period', 'Four weeks, three months or a year.') },
    { id: 'ask', copy: fixed('Ask about a card', 'Every card can be asked about.') },
    { id: 'open', copy: fixed('Open a card', 'Open a card for the full picture.') }
  ],
  'workout-plans': [
    { id: 'card', copy: fixed('Your week', 'This is your week. Each day says what it is for.') },
    { id: 'new', copy: fixed('A new plan', 'The coach fills a week from your profile. Change any day.') },
    { id: 'week', copy: fixed('Change a day', 'Tap a day to change its kind, drag a segment to change its length.') }
  ],
  'workout-history': [
    { id: 'filters', copy: fixed('Find a session', 'Filter by kind or date.') },
    { id: 'row', copy: fixed('Open a session', 'Open a session for every set and segment.') },
    { id: 'trends', copy: fixed('Longer changes', 'Longer changes live in Progress.') }
  ],
  'workout-library': [
    { id: 'search', copy: fixed('Search', 'Search any exercise.') },
    { id: 'filters', copy: fixed('Narrow it down', 'Narrow by muscle or by what you own.') },
    { id: 'progress', copy: fixed('Your progress', 'Every exercise has its own history.') }
  ],
  'nutrition-recipes': [
    { id: 'tonight', copy: fixed('Cook for tonight', 'Picks that fit what is left today.') },
    { id: 'sort', copy: fixed('Sort the library', 'Fits today puts the closest fit first.') },
    { id: 'cook', copy: fixed('Cook a recipe', 'Cook opens the Ready sheet, then cook mode with timers.') }
  ],
  'nutrition-nutrients': [
    { id: 'period', copy: fixed('Pick a period', 'Switch between today, 7 days and 30 days.') },
    { id: 'tile', copy: fixed('A nutrient', 'Tap a nutrient for its page and guide.') },
    { id: 'door', copy: fixed('Longer stretches', 'Longer stretches live in Progress.') }
  ],
  'progress-goal': progressSurface(),
  'progress-training': progressSurface(),
  'progress-food': progressSurface(),
  'coach-dock': [
    { id: 'reading', copy: fixed('The reading', 'The coach has read this page.') },
    { id: 'questions', copy: fixed('Questions to start from', 'Start from one of these, or type.') },
    { id: 'composer', copy: fixed('Ask the coach', 'Ask, or ask it to build something.') }
  ]
};

/** The path of one Progress detail page; the three pages share their words. */
function progressSurface(): readonly PathStep[] {
  return [
    { id: 'nav', copy: fixed('Sections', 'Jump to a section.') },
    { id: 'ask', copy: fixed('Ask about it', 'Ask about this section.') },
    { id: 'back', copy: fixed('Back to Progress', 'Back to the overview.') }
  ];
}

/** What the "How this works" link and sheet call each surface. */
export const SURFACE_LABELS: Record<TourPage, string> = {
  workout: 'Workout',
  nutrition: 'Nutrition',
  progress: 'Progress',
  me: 'Me',
  'workout-plans': 'Workout plans',
  'workout-history': 'Workout history',
  'workout-library': 'Exercise library',
  'nutrition-recipes': 'Recipes',
  'nutrition-nutrients': 'All nutrients',
  'progress-goal': 'Goal',
  'progress-training': 'Training',
  'progress-food': 'Food',
  'coach-dock': 'The coach'
};

/**
 * The surfaces of v3 start only when at least this many of their steps have an anchor on screen, so a stray anchor
 * (the week strip of the plan flow, say) never opens a path of one step.
 */
export const SURFACE_MIN_STEPS = 2;

/** What `?guide=` can name: the page whose path starts and the Home card step the arrival belongs to, if any. */
export const GUIDE_ARRIVALS: Record<string, { page: TourPage; card: GuideStepId | null }> = {
  me: { page: 'me', card: 'targets' },
  workout: { page: 'workout', card: 'plan' },
  nutrition: { page: 'nutrition', card: 'meal' },
  'workout-session': { page: 'workout', card: 'session' },
  progress: { page: 'progress', card: null }
};
