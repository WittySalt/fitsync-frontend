import { AnalyticsAchievement } from '../../../core/analytics.models';
import { shortDate } from '../../../shared/coach/insight/slope-chart.geometry';
import { DAY_KIND_GLYPHS } from '../brief/day-kind-icons';
import { GlyphShape } from '../brief/muscle-icons';

/** The wall always holds nine badges; the header falls back to this when the list is empty. */
export const BADGE_TOTAL = 9;

/** The circle the progress ring is drawn on, in the 64 by 64 units of the seal. */
export const RING_RADIUS = 29;

const WORKOUT_COUNT_TARGETS: Record<string, number> = {
  WORKOUTS_10: 10,
  WORKOUTS_50: 50,
  WORKOUTS_100: 100
};

const STREAK_DAY_TARGETS: Record<string, number> = {
  STREAK_7: 7,
  STREAK_30: 30
};

const FLAME: GlyphShape[] = [
  {
    tag: 'path',
    d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z'
  }
];

const BOWL: GlyphShape[] = [
  { tag: 'path', d: 'M3 11h18c0 5-4 9-9 9s-9-4-9-9Z' },
  { tag: 'path', d: 'M9 3.5v3' },
  { tag: 'path', d: 'M15 3.5v3' }
];

const SCALE: GlyphShape[] = [
  { tag: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 4 },
  { tag: 'path', d: 'M8 10a4 4 0 0 1 8 0' },
  { tag: 'path', d: 'M12 10l1.8-2.4' }
];

const MEDAL: GlyphShape[] = [
  { tag: 'circle', cx: 12, cy: 15, r: 5.5 },
  { tag: 'path', d: 'M8.3 10.6L5.5 3h4l2.5 5' },
  { tag: 'path', d: 'M15.7 10.6L18.5 3h-4L12 8' }
];

const STAR: GlyphShape[] = [{ tag: 'path', d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z' }];

const GLYPHS: Record<string, GlyphShape[]> = {
  FIRST_WORKOUT: DAY_KIND_GLYPHS.STRENGTH,
  WORKOUTS_10: DAY_KIND_GLYPHS.STRENGTH,
  WORKOUTS_50: DAY_KIND_GLYPHS.STRENGTH,
  WORKOUTS_100: DAY_KIND_GLYPHS.STRENGTH,
  STREAK_7: FLAME,
  STREAK_30: FLAME,
  FIRST_MEAL_LOGGED: BOWL,
  FIRST_WEIGHT_LOGGED: SCALE,
  PR_FIRST: MEDAL
};

export interface RingArc {
  circumference: number;
  /** Length of the green arc along the circle, from 12 o'clock clockwise. */
  length: number;
}

export interface BadgeView {
  code: string;
  title: string;
  earned: boolean;
  dateLabel: string;
  countLabel: string;
  accessibleName: string;
  glyph: GlyphShape[];
  ring: RingArc;
}

export function glyphFor(code: string): GlyphShape[] {
  return GLYPHS[code] ?? STAR;
}

/** The arc of a progress ring on a circle of the given radius. Progress outside 0 to 1, or not a
 *  number, is pulled into range so the ring never draws past a full turn. */
export function ringArc(progress: number, radius: number = RING_RADIUS): RingArc {
  const unit = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  const circumference = 2 * Math.PI * radius;
  return { circumference, length: unit * circumference };
}

/** The count under an unfinished badge: "33 of 50", "2 of 7 days", or "Not yet" for the badges
 *  that flip once (the first-time badges, the record badge, and any code this build does not know). */
export function countLine(code: string, progress: number): string {
  const unit = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  const workouts = WORKOUT_COUNT_TARGETS[code];
  if (workouts !== undefined) {
    return `${Math.round(unit * workouts)} of ${workouts}`;
  }
  const days = STREAK_DAY_TARGETS[code];
  if (days !== undefined) {
    return `${Math.round(unit * days)} of ${days} days`;
  }
  return 'Not yet';
}

/** The day a badge was earned as "20 Aug", read in the person's own timezone so a late-evening
 *  unlock is not moved to the next day. Empty when the instant is missing or unreadable. */
export function earnedDateLabel(unlockedAt: string | null, timezone: string): string {
  if (!unlockedAt) {
    return '';
  }
  const instant = new Date(unlockedAt);
  if (Number.isNaN(instant.getTime())) {
    return '';
  }
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: timezone });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' });
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  return shortDate(`${parts['year']}-${parts['month']}-${parts['day']}`);
}

/** Earned badges first with the newest on top, then the rest by progress with the closest to
 *  unlocking first. Sorting is stable, so equal entries keep the server's order. */
export function orderBadges(list: readonly AnalyticsAchievement[]): AnalyticsAchievement[] {
  const time = (badge: AnalyticsAchievement): number => {
    const value = badge.unlockedAt ? Date.parse(badge.unlockedAt) : Number.NaN;
    return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
  };
  const earned = list.filter((badge) => badge.unlocked).sort((a, b) => time(b) - time(a));
  const open = list.filter((badge) => !badge.unlocked).sort((a, b) => b.progress - a.progress);
  return [...earned, ...open];
}

export function toBadgeViews(list: readonly AnalyticsAchievement[], timezone: string): BadgeView[] {
  return orderBadges(list).map((badge) => {
    const dateLabel = badge.unlocked ? earnedDateLabel(badge.unlockedAt, timezone) : '';
    const countLabel = badge.unlocked ? '' : countLine(badge.code, badge.progress);
    const detail = badge.unlocked
      ? dateLabel
        ? `earned ${dateLabel}`
        : 'earned'
      : countLabel.charAt(0).toLowerCase() + countLabel.slice(1);
    return {
      code: badge.code,
      title: badge.title,
      earned: badge.unlocked,
      dateLabel,
      countLabel,
      accessibleName: `${badge.title}, ${detail}`,
      glyph: glyphFor(badge.code),
      ring: ringArc(badge.unlocked ? 1 : badge.progress)
    };
  });
}

/** How this week's training time compares with last week's, in whole percent. Nothing is said
 *  when either week is empty, because a percentage against zero means nothing. */
export function comparisonLine(thisWeek: number | null | undefined, lastWeek: number | null | undefined): string {
  if (!thisWeek || !lastWeek || thisWeek <= 0 || lastWeek <= 0 || !Number.isFinite(thisWeek) || !Number.isFinite(lastWeek)) {
    return '';
  }
  const percent = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  if (percent === 0) {
    return 'the same as last week';
  }
  return percent > 0 ? `${percent}% more than last week` : `${Math.abs(percent)}% less than last week`;
}
