import { FOOD_GROUPS, FoodGroup, foodGroupInfo } from '../../../shared/food/food-groups';
import { DiaryItem } from './diary.models';

/**
 * The order the wedges go round the plate, clockwise from the top: fruit and veg fill the right
 * half, protein sits bottom left and grains top left, the same layout as the balanced plate.
 */
export const PLATE_ORDER: readonly FoodGroup[] = ['VEG', 'FRUIT', 'DAIRY', 'PROTEIN', 'NUTS', 'LEGUMES', 'GRAINS', 'SWEETS'];

/** The seven groups the badges count. Drinks and sweets are not among them. */
export const BADGE_GROUPS: readonly FoodGroup[] = ['VEG', 'FRUIT', 'GRAINS', 'PROTEIN', 'DAIRY', 'NUTS', 'LEGUMES'];

/** A wedge is given an icon only when it is wide enough to hold one. */
export const MIN_ICON_SWEEP = 30;

export interface PlateTotals {
  grams: Partial<Record<FoodGroup, number>>;
  totalGrams: number;
  /** Foods left off the plate: those with no weight, or with no food group to place them in. Drinks are not counted. */
  leftOut: number;
}

/** Grams of food by group. Drinks count in water, not on the plate. */
export function plateTotals(items: readonly DiaryItem[]): PlateTotals {
  const grams: Partial<Record<FoodGroup, number>> = {};
  let totalGrams = 0;
  let leftOut = 0;
  for (const item of items) {
    if (item.foodGroup === 'DRINKS') {
      continue;
    }
    if (item.foodGroup === null || item.gramsConsumed === null || item.gramsConsumed <= 0) {
      leftOut += 1;
      continue;
    }
    grams[item.foodGroup] = (grams[item.foodGroup] ?? 0) + item.gramsConsumed;
    totalGrams += item.gramsConsumed;
  }
  return { grams, totalGrams, leftOut };
}

export interface PlateWedge {
  group: FoodGroup;
  grams: number;
  /** Share of the plate, 0 to 1. */
  share: number;
  sweep: number;
  /** The path of the wedge from the centre, or null when one group fills the whole plate and a circle is drawn. */
  path: string | null;
  iconX: number;
  iconY: number;
  showIcon: boolean;
}

/** The wedges of a plate drawn in a square of `size`, going round from the top. */
export function plateWedges(totals: PlateTotals, size: number): PlateWedge[] {
  if (totals.totalGrams <= 0) {
    return [];
  }
  const centre = size / 2;
  const radius = centre * 0.74;
  const point = (angle: number, distance: number): [number, number] => [
    centre + distance * Math.cos((angle * Math.PI) / 180),
    centre + distance * Math.sin((angle * Math.PI) / 180)
  ];
  const wedges: PlateWedge[] = [];
  let angle = -90;
  for (const group of PLATE_ORDER) {
    const grams = totals.grams[group] ?? 0;
    if (grams <= 0) {
      continue;
    }
    const share = grams / totals.totalGrams;
    const sweep = share * 360;
    const [x0, y0] = point(angle, radius);
    const [x1, y1] = point(angle + sweep, radius);
    const [iconX, iconY] = point(angle + sweep / 2, radius * 0.6);
    const full = sweep >= 359.99;
    wedges.push({
      group,
      grams,
      share,
      sweep,
      path: full
        ? null
        : `M${centre},${centre} L${x0.toFixed(2)},${y0.toFixed(2)} A${radius},${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`,
      iconX,
      iconY,
      showIcon: sweep >= MIN_ICON_SWEEP
    });
    angle += sweep;
  }
  return wedges;
}

/** One legend line per group on the plate, in the order the groups are listed everywhere else. */
export function plateLegend(wedges: readonly PlateWedge[]): { group: FoodGroup; label: string; percent: number }[] {
  return FOOD_GROUPS.map((info) => {
    const wedge = wedges.find((entry) => entry.group === info.key);
    return wedge ? { group: info.key, label: info.label, percent: Math.round(wedge.share * 100) } : null;
  }).filter((entry): entry is { group: FoodGroup; label: string; percent: number } => entry !== null);
}

/** The one sentence that sets fruit and veg against the half of a balanced plate. */
export function fruitVegSentence(totals: PlateTotals): string {
  if (totals.totalGrams <= 0) {
    return '';
  }
  const grams = (totals.grams.VEG ?? 0) + (totals.grams.FRUIT ?? 0);
  const percent = Math.round((grams / totals.totalGrams) * 100);
  if (grams <= 0) {
    return 'There was no fruit or veg by weight, against the half on a balanced plate.';
  }
  if (percent >= 50) {
    return `Fruit and veg were about ${percent}% of what you ate, which matches the half on a balanced plate.`;
  }
  return `Fruit and veg were about ${percent}% of what you ate, against the half on a balanced plate.`;
}

export interface GroupBadge {
  group: FoodGroup;
  name: string;
  eaten: boolean;
}

/** The seven badges, in order, with whether the day's food had that group. */
export function groupBadges(items: readonly DiaryItem[]): GroupBadge[] {
  const eaten = new Set(items.map((item) => item.foodGroup));
  return BADGE_GROUPS.map((group) => ({ group, name: foodGroupInfo(group)?.shortName ?? group, eaten: eaten.has(group) }));
}

/** "No beans yet" when exactly one group is missing, otherwise how many are still to come. */
export function badgeNote(badges: readonly GroupBadge[]): string {
  const missing = badges.filter((badge) => !badge.eaten);
  if (missing.length === 0) {
    return 'All seven';
  }
  return missing.length === 1 ? `No ${missing[0].name.toLowerCase()} yet` : '';
}
