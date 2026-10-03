import { SummaryLine } from '../../../shared/progress/progress.models';
import { formatNumber } from '../../../shared/progress/progress-format';
import { NutrientTileData } from '../../nutrition/nutrients/nutrients.models';
import { FoodProgress, GoalProgress, GoalRoad } from '../progress-api.models';
import { FOUR_WEEKS, Span } from './goal-road';

/**
 * The three summary lines of the Goal and Food cards (spec 1.4). Each reads "figure, its relation to
 * the target or the earlier period, what it means", and the right-hand word is a judgement, never a
 * bare direction. Pure functions of the data the cards already hold.
 */

/** A summary line whose right-hand word is a judgement; `amber` marks the few that call for attention. */
export type ReadingLine = SummaryLine & { amber?: boolean };

function reading(text: string, word: string, amber = false): ReadingLine {
  return { text, trend: word, ...(amber ? { amber: true } : {}) };
}

const whole = (value: number): string => formatNumber(Math.round(value));

export interface FoodReadingInput {
  food: FoodProgress;
  /** The nutrients summary of the last 30 days, when it could be read. */
  nutrients: readonly NutrientTileData[] | null;
  /** The calorie target of the person's calorie goal, when there is one. */
  calorieTarget: number | null;
  /** The days the period covers, for "logged 26 of 30 days". */
  days: number;
  /** How long ago the earlier protein figure is: "a month ago", "3 months ago". */
  earlierWords: string;
}

function calorieLine({ food, calorieTarget, days }: FoodReadingInput): ReadingLine | null {
  const eaten = food.hero.eatenPerDay.value;
  if (eaten === null) {
    return null;
  }
  const logged = food.hero.daysLogged.value;
  const tail = logged === null ? '' : `, logged ${logged} of ${days} days`;
  if (calorieTarget === null || calorieTarget <= 0) {
    return reading(`${whole(eaten)} kcal a day${tail}`, 'logged');
  }
  const ratio = eaten / calorieTarget;
  const word = Math.abs(ratio - 1) <= 0.05 ? 'on target' : ratio > 1 ? 'over' : 'under';
  return reading(`${whole(eaten)} kcal a day on a ${whole(calorieTarget)} target${tail}`, word, word === 'under');
}

function proteinLine({ food, earlierWords }: FoodReadingInput): ReadingLine | null {
  const protein = food.macros.protein;
  const now = protein?.thisWeek ?? null;
  if (!protein || now === null) {
    return null;
  }
  const head = `Protein ${whole(now)} g a day this week`;
  const target = protein.target;
  if (target === null) {
    return reading(head, 'no target');
  }
  const diff = Math.round(now - target);
  const earlier = protein.firstWeek;
  const drift = earlier === null || Math.round(earlier) === Math.round(now) ? '' : ` and ${earlier > now ? 'down' : 'up'} from ${whole(earlier)} g ${earlierWords}`;
  if (diff < 0) {
    return reading(`${head}, ${whole(-diff)} g under the ${whole(target)} g target${drift}`, 'under', true);
  }
  return reading(diff === 0 ? `${head}, on the ${whole(target)} g target` : `${head}, ${whole(diff)} g over the ${whole(target)} g target`, 'met');
}

const SHORT_BELOW = 0.8;

function nutrientLine({ food, nutrients }: FoodReadingInput): ReadingLine | null {
  const counted = (nutrients ?? []).filter((item) => item.groupCode !== 'LIMIT' && item.share !== null);
  if (counted.length) {
    const met = counted.filter((item) => (item.share ?? 0) >= 1).length;
    const total = counted.length;
    if (met === total) {
      return reading(`All ${total} nutrients met over the last 30 days`, 'met');
    }
    const lowest = [...counted].sort((a, b) => (a.share ?? 0) - (b.share ?? 0));
    const short = lowest.filter((item) => (item.share ?? 0) < SHORT_BELOW);
    const percent = (item: NutrientTileData): number => Math.round((item.share ?? 0) * 100);
    if (short.length >= 2) {
      return reading(`${met} of ${total} nutrients met; ${short[0].displayName} and ${short[1].displayName} are short`, `${short.length} short`, true);
    }
    if (short.length === 1) {
      return reading(`${met} of ${total} nutrients met; ${short[0].displayName} at ${percent(short[0])}% is the one clearly short`, '1 short', true);
    }
    return reading(`${met} of ${total} nutrients met; ${lowest[0].displayName} at ${percent(lowest[0])}% is the lowest`, 'close');
  }
  const lowest = food.nutrition?.lowestNutrients[0];
  return lowest ? reading(`${lowest.displayName} at ${Math.round(lowest.share * 100)}% of the daily amount is the furthest short`, '1 short', true) : null;
}

/** The Food card's three lines: energy, protein and the nutrients, each against its target. */
export function foodReadingLines(input: FoodReadingInput): ReadingLine[] {
  return [calorieLine(input), proteinLine(input), nutrientLine(input)].filter((line): line is ReadingLine => line !== null);
}

const TRACK_WORDS: Partial<Record<GoalRoad['state'], { word: string; amber?: boolean }>> = {
  AHEAD: { word: 'on track' },
  ON_COURSE: { word: 'on track' },
  NO_PROJECTION: { word: 'on track' },
  BEHIND: { word: 'behind', amber: true },
  STALLED: { word: 'no change' },
  REACHED: { word: 'reached' },
  DATE_PASSED: { word: 'past date' }
};

function weightLine(goal: GoalProgress, road: GoalRoad, span: Span): ReadingLine {
  const period = goal.hero.changeKg;
  const sinceStart = road.nowKg - road.startKg;
  const now = formatNumber(road.nowKg, 1);
  const since = Math.abs(sinceStart) < 0.05 ? '' : `${formatNumber(Math.abs(sinceStart), 1)} kg since the start`;
  let text: string;
  if (period === null) {
    text = since ? `${now} kg, ${sinceStart < 0 ? 'down' : 'up'} ${since}` : `${now} kg`;
  } else {
    const moved = Math.abs(period) < 0.05 ? `unchanged in ${span.words}` : `${period < 0 ? 'down' : 'up'} ${formatNumber(Math.abs(period), 1)} kg in ${span.words}`;
    text = `${now} kg, ${moved}${since ? ` and ${since}` : ''}`;
  }
  const word = TRACK_WORDS[road.state] ?? { word: 'on track' };
  return reading(text, word.word, word.amber ?? false);
}

/** The pace line: the weekly rate against the range that keeps muscle (loss) or most plans aim for (gain). */
function paceLine(goal: GoalProgress, road: GoalRoad): ReadingLine | null {
  const rate = goal.hero.weeklyRate.value;
  if (rate === null || road.direction === 'KEEP') {
    return null;
  }
  const size = Math.abs(rate);
  const gain = road.direction === 'GAIN';
  const low = gain ? 0.2 : 0.25;
  const wrong = gain ? rate < -0.05 : rate > 0.05;
  const figure = `${formatNumber(size, 2)} kg a week`;
  if (wrong) {
    return reading(`${figure} the wrong way, away from the target`, 'reversing');
  }
  if (size > 0.5) {
    return reading(`${figure}, above the 0.5 kg range that ${gain ? 'builds muscle with little fat' : 'keeps muscle'}`, 'fast', true);
  }
  if (size < low) {
    return reading(`${figure}, under the ${formatNumber(low, 2)} kg a week most plans aim for`, 'slow');
  }
  return reading(`${figure}, inside the ${formatNumber(low, 2)} to 0.5 kg range ${gain ? 'most plans aim for' : 'that keeps muscle'}`, 'healthy pace');
}

function bodyChange(series: { start: number | null; end: number | null; series: { value: number }[] } | null): number | null {
  const start = series?.start ?? series?.series[0]?.value ?? null;
  const end = series?.end ?? series?.series.at(-1)?.value ?? null;
  return start === null || end === null ? null : end - start;
}

function bodyLine(goal: GoalProgress, road: GoalRoad, weighIns: { logged: number; days: number } | null): ReadingLine | null {
  const weight = goal.hero.changeKg ?? road.nowKg - road.startKg;
  const falling = weight < -0.05;
  const fell = formatNumber(Math.abs(weight), 1);
  const candidates = [
    { name: 'Waist', unit: 'cm', change: bodyChange(goal.body.waist), flat: 0.3 },
    { name: 'Body fat', unit: 'points', change: bodyChange(goal.body.bodyFat), flat: 0.2 }
  ];
  const known = candidates.find((item) => item.change !== null);
  if (known && known.change !== null) {
    const size = formatNumber(Math.abs(known.change), 1);
    const flat = Math.abs(known.change) < known.flat;
    if (falling && known.change < 0 && !flat) {
      return reading(`${known.name} down ${size} ${known.unit} with the weight, which points to fat rather than muscle`, 'good sign');
    }
    if (falling) {
      return reading(flat ? `${known.name} unchanged while the weight fell ${fell} kg` : `${known.name} up ${size} ${known.unit} while the weight fell ${fell} kg`, 'watch', true);
    }
    return reading(`${known.name} ${flat ? 'unchanged' : known.change < 0 ? `down ${size} ${known.unit}` : `up ${size} ${known.unit}`} over the same period`, 'logged');
  }
  return weighIns ? reading(`Logged ${weighIns.logged} of ${weighIns.days} weigh-ins`, 'logged') : null;
}

/** The Goal card's three lines for a weight lead: where the weight is, how fast it moves and what the body says. */
export function goalReadingLines(goal: GoalProgress, road: GoalRoad | null, span: Span = FOUR_WEEKS, weighIns: { logged: number; days: number } | null = null): ReadingLine[] {
  if (!road) {
    return [];
  }
  return [weightLine(goal, road, span), paceLine(goal, road), bodyLine(goal, road, weighIns)].filter((line): line is ReadingLine => line !== null);
}
