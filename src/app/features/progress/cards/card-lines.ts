import { BriefObservation } from '../../dashboard/brief/brief-observations';
import { daysBetween, formatNumber } from '../../../shared/progress/progress-format';
import { FoodProgress, GoalProgress } from '../progress-api.models';
import { macroWhen } from './card-readings';
import { BarsWeek, barsBalance } from './energy-fallback';
import { day, figureOf, habitCounts, leadOf, monthName, movingAway, plural, reachedOn, roadOf, stalledSince } from './goal-road';

/**
 * The coach line inside each card. Every sentence is built by rule from the card's own data, so it
 * reads like the Home brief and never waits for the model. A card with nothing to say gets ''.
 */

function sentence(text: string): string {
  const clean = text.trim();
  return !clean || /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

/** Training: the first observation of the Home brief, its fact and its note as one or two sentences. */
export function trainingCoachLine(observations: readonly BriefObservation[]): string {
  const first = observations[0];
  return first ? [sentence(first.fact), sentence(first.note)].filter(Boolean).join(' ') : '';
}

const SET_ASIDE = 'Set a goal in Me and this card turns into a road to it.';

/** Goal: by the state of the road, the KEEP lane or the habit that leads. */
export function goalCoachLine(goal: GoalProgress, today: string): string {
  const lead = leadOf(goal);
  if (lead.kind === 'HABIT') {
    const item = lead.goal;
    const { logged, met } = habitCounts(item);
    if (logged === 0) {
      // The goal is set but nothing is logged; the card's own empty state says what fills it.
      return '';
    }
    const unit = item.type === 'WORKOUT_FREQUENCY' ? 'week' : 'day';
    return item.target !== null ? `${met} of ${logged} logged ${logged === 1 ? unit : `${unit}s`} reached ${figureOf(item) || item.target}.` : SET_ASIDE;
  }
  const road = lead.kind === 'WEIGHT' ? roadOf(goal, today) : null;
  if (!road) {
    return SET_ASIDE;
  }
  if (road.direction === 'KEEP' && road.keep) {
    const weeks = road.keep.weeks;
    const inside = weeks.filter((week) => week.inside).length;
    return `${inside} of the last ${weeks.length} weeks stayed within ${formatNumber(road.keep.bandKg, road.keep.bandKg % 1 ? 1 : 0)} kg of ${formatNumber(road.targetKg, road.targetKg % 1 ? 1 : 0)} kg.`;
  }
  switch (road.state) {
    case 'AHEAD':
    case 'ON_COURSE': {
      // A derived road has no crossing dates, so the whole kilos moved stand in for the crossed ticks.
      const crossed = road.ticks.filter((tick) => tick.crossedOn !== null).length || Math.floor(Math.abs(road.nowKg - road.startKg));
      const next = road.ticks.find((tick) => tick.crossedOn === null && tick.projectedOn !== null);
      const done = crossed > 0 ? `${crossed} ${crossed === 1 ? 'kilo' : 'kilos'} ${road.direction === 'GAIN' ? 'up' : 'down'}${road.startDate ? ` since ${monthName(road.startDate)}` : ''}.` : '';
      const ahead = next ? `The next one falls around ${day(next.projectedOn)} at this pace.` : '';
      return [done, ahead].filter(Boolean).join(' ');
    }
    case 'BEHIND': {
      const left = road.targetDate ? daysBetween(today, road.targetDate) : 0;
      // A trend moving away from the target is not "slower"; it is said as it is.
      const past = movingAway(road, goal.hero.weeklyRate.value)
        ? `Over the last 28 days the weight moved away from ${formatNumber(road.targetKg, road.targetKg % 1 ? 1 : 0)} kg`
        : 'The last 28 days were slower than the plan needs';
      if (!road.targetDate || left <= 0) {
        return `${past}.`;
      }
      // The kilos still to go spread over the weeks left: kg a week.
      const needed = road.distanceKg / (left / 7);
      return `${past}; ${day(road.targetDate)} needs ${formatNumber(needed, 2)} kg a week from here.`;
    }
    case 'STALLED': {
      const since = stalledSince(goal, road);
      return since ? `The weekly average has not moved since ${day(since)}.` : 'The weekly average has not moved lately.';
    }
    case 'REACHED': {
      const on = reachedOn(road);
      const early = on && road.targetDate ? daysBetween(on, road.targetDate) : null;
      return early !== null && early > 0 ? `You got there ${plural(early, 'day')} before your date.` : on ? `You got there on ${day(on)}.` : 'You got there.';
    }
    case 'DATE_PASSED':
      return `Your date has passed with ${formatNumber(road.distanceKg, 1)} kg to go${road.projectedDate ? `; at this pace it is ${day(road.projectedDate)}` : ''}.`;
    default:
      return 'Log a few more weigh-ins and a date appears.';
  }
}

function mealName(type: string): string {
  const lower = type.toLowerCase();
  return lower === 'snack' ? 'Snacks' : lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Food: protein under its target first, then the energy balance, then the first highlight. The
 * balance is read from the week the card's bars draw, so the line, the headline and the bars all
 * give one figure and name the same week. Without that week there is no balance sentence.
 */
export function foodCoachLine(food: FoodProgress, bars: BarsWeek | null, today?: string): string {
  const protein = food.macros.protein;
  if (protein && protein.target !== null && protein.thisWeek !== null) {
    const gap = Math.round(protein.target - protein.thisWeek);
    if (gap > 0) {
      const largest = [...food.meals.share].sort((a, b) => b.sharePct - a.sharePct)[0];
      return `Protein is ${formatNumber(gap)} g a day under the target ${macroWhen(protein, food, today)}.${largest ? ` ${mealName(largest.mealType)} carries most of it.` : ''}`;
    }
  }
  const balance = barsBalance(bars);
  if (bars && balance !== null && Math.round(balance) !== 0) {
    const kcal = formatNumber(Math.abs(Math.round(balance)));
    if (balance < 0) {
      const days = bars.week.daysLogged;
      return `You ate ${kcal} kcal a day under what you used ${bars.when}${days ? `, on ${plural(days, 'logged day')}` : ''}.`;
    }
    return `You ate ${kcal} kcal a day over what you used ${bars.when}.`;
  }
  return food.highlights[0]?.title ?? '';
}
