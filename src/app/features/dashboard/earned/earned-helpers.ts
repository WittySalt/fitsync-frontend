import { BadgeNode, BadgesModel } from '../../../core/me.models';
import { mondayOf } from '../../profile/footprint/footprint-grid';

/**
 * How this week's training time so far compares with last week's up to the same weekday, in whole
 * percent, since the figures are week to date. Nothing is said when either week is empty, because
 * a percentage against zero means nothing, and nothing is said when this week is behind: the
 * section cheers what is done and never presses about what is not.
 */
export function comparisonLine(thisWeek: number | null | undefined, lastWeek: number | null | undefined): string {
  if (!thisWeek || !lastWeek || thisWeek <= 0 || lastWeek <= 0 || !Number.isFinite(thisWeek) || !Number.isFinite(lastWeek)) {
    return '';
  }
  const percent = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  if (percent === 0) {
    return 'the same as by this day last week';
  }
  return percent > 0 ? `${percent}% more than by this day last week` : '';
}

/** Every badge in the catalogue, in the order the themes list them. */
export function allBadges(model: BadgesModel): BadgeNode[] {
  return model.themes.flatMap((theme) => theme.paths.flatMap((path) => path.nodes));
}

/** The badges earned from the Monday of the week of `today` onward, newest first. */
export function earnedThisWeek(model: BadgesModel, today: string): BadgeNode[] {
  const monday = mondayOf(today);
  return allBadges(model)
    .filter((node) => node.earnedOn !== null && node.earnedOn >= monday && node.earnedOn <= today)
    .sort((a, b) => (b.earnedOn ?? '').localeCompare(a.earnedOn ?? ''));
}

export interface StripView {
  /** The newest badge earned this week, or null when nothing new. */
  badge: BadgeNode | null;
  /** "A full week", "A full week and 1 more", or "No new badges this week". */
  title: string;
  /** The second line when there is nothing new: "7 of 17 earned". */
  note: string;
}

/** What the one-row strip at the bottom of Earned says. */
export function stripView(model: BadgesModel, today: string): StripView {
  const week = earnedThisWeek(model, today);
  if (week.length === 0) {
    return { badge: null, title: 'No new badges this week', note: `${model.earned} of ${model.total} earned` };
  }
  const more = week.length - 1;
  return { badge: week[0], title: more > 0 ? `${week[0].name} and ${more} more` : week[0].name, note: '' };
}
