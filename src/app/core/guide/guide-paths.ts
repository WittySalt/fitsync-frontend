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
  ]
};

/** What `?guide=` can name: the page whose path starts and the Home card step the arrival belongs to, if any. */
export const GUIDE_ARRIVALS: Record<string, { page: TourPage; card: GuideStepId | null }> = {
  me: { page: 'me', card: 'targets' },
  workout: { page: 'workout', card: 'plan' },
  nutrition: { page: 'nutrition', card: 'meal' },
  'workout-session': { page: 'workout', card: 'session' },
  progress: { page: 'progress', card: null }
};
