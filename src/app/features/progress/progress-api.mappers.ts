import { withoutCitations } from '../../shared/coach/insight/reading-text';
import { arr, bool, compared, list, mapDotDays, mapHighlights, mapSummaryLines, num, obj, str } from '../../shared/progress/progress-mappers';
import { mapEnergyWeek } from './energy/energy-mappers';
import { mondayOf } from './training/training-format';
import {
  BodySeries,
  CurrentWeek,
  FoodGranularity,
  FoodNutrition,
  FoodProgress,
  GoalProgress,
  GoalRoad,
  RoadDirection,
  RoadState,
  MacroTrend,
  MealShare,
  OtherGoal,
  PlateShare,
  ReviewFact,
  ReviewStatus,
  WeeklyReview
} from './progress-api.models';

/**
 * Readers for the Progress endpoints (contract sections 2.1, 2.2, 3.1, 4.2). Every field is read
 * on its own, so a server that sends part of a response still fills what it sent; nothing is made
 * up for what it did not.
 */

function range(value: unknown): { from: string; to: string } | null {
  const wire = obj(value);
  const from = str(wire?.['from']);
  const to = str(wire?.['to']);
  return from && to ? { from, to } : null;
}

/** The `currentWeek` note of a response; null when the server sends none, which keeps the old behaviour. */
export function mapCurrentWeek(value: unknown): CurrentWeek | null {
  const wire = obj(value);
  return wire && typeof wire['included'] === 'boolean' ? { included: wire['included'], daysLogged: num(wire['daysLogged']) ?? 0 } : null;
}

/**
 * Today is never a week: when the server says the current week is not in, a weekly series ends at
 * the last full week, whatever the server put in it. Anything else leaves the series as it came.
 */
export function endAtLastFullWeek<T>(points: T[], weekOf: (point: T) => string, currentWeek: CurrentWeek | null, to: string | null): T[] {
  if (currentWeek?.included !== false || !to) {
    return points;
  }
  const monday = mondayOf(to);
  return points.filter((point) => weekOf(point) < monday);
}

function bodySeries(value: unknown): BodySeries | null {
  const wire = obj(value);
  if (!wire) {
    return null;
  }
  const series = list(wire['series'], (item) => {
    const date = str(item['date']);
    const point = num(item['value']);
    return date && point !== null ? { date, value: point } : null;
  });
  return { series, start: num(wire['start']), end: num(wire['end']), context: str(wire['context']) ?? '' };
}

function otherGoal(item: Record<string, unknown>): OtherGoal | null {
  const type = str(item['type']);
  if (!type) {
    return null;
  }
  return {
    type,
    target: num(item['target']),
    unit: str(item['unit']) ?? '',
    metDays: num(item['metDays']),
    loggedDays: num(item['loggedDays']),
    days: mapDotDays(item['days']),
    weeks: list(item['weeks'], (week) => {
      const weekStart = str(week['weekStart']);
      const value = num(week['value']);
      return weekStart && value !== null ? { weekStart, value, target: num(week['target']) } : null;
    })
  };
}

const ROAD_DIRECTIONS: readonly RoadDirection[] = ['LOSE', 'GAIN', 'KEEP'];
const ROAD_STATES: readonly RoadState[] = ['AHEAD', 'ON_COURSE', 'BEHIND', 'REACHED', 'DATE_PASSED', 'STALLED', 'NO_PROJECTION'];

function fraction(value: unknown): number {
  return Math.min(1, Math.max(0, num(value) ?? 0));
}

/** The `road` of the Goal response (spec 4). Null when the server sent none or too little to draw it. */
export function mapRoad(value: unknown): GoalRoad | null {
  const wire = obj(value);
  const direction = ROAD_DIRECTIONS.find((item) => item === wire?.['direction']);
  const state = ROAD_STATES.find((item) => item === wire?.['state']);
  const startKg = num(wire?.['startKg']);
  const nowKg = num(wire?.['nowKg']);
  const targetKg = num(wire?.['targetKg']);
  if (!wire || !direction || !state || startKg === null || nowKg === null || targetKg === null) {
    return null;
  }
  const keep = obj(wire['keep']);
  return {
    direction,
    state,
    startKg,
    startDate: str(wire['startDate']),
    nowKg,
    nowDate: str(wire['nowDate']),
    targetKg,
    targetDate: str(wire['targetDate']),
    distanceKg: num(wire['distanceKg']) ?? Math.round(Math.abs(targetKg - nowKg) * 10) / 10,
    fractionWeight: fraction(wire['fractionWeight']),
    fractionTime: fraction(wire['fractionTime']),
    projectedDate: str(wire['projectedDate']),
    ticks: list(wire['ticks'], (item) => {
      const kg = num(item['kg']);
      return kg === null ? null : { kg, crossedOn: str(item['crossedOn']), projectedOn: str(item['projectedOn']) };
    }),
    keep: keep
      ? {
          bandKg: num(keep['bandKg']) ?? 1,
          weeks: list(keep['weeks'], (week) => {
            const weekStart = str(week['weekStart']);
            const avgKg = num(week['avgKg']);
            return weekStart && avgKg !== null ? { weekStart, avgKg, inside: bool(week['inside']) } : null;
          })
        }
      : null,
    derived: false
  };
}

export function mapGoalProgress(response: unknown): GoalProgress {
  const wire = obj(response) ?? {};
  const goal = obj(wire['goal']);
  const hero = obj(wire['hero']) ?? {};
  const weight = obj(wire['weight']) ?? {};
  const body = obj(wire['body']) ?? {};
  const mark = obj(weight['rateChangeMark']);
  return {
    period: range(wire['period']),
    previous: range(wire['previous']),
    currentWeek: mapCurrentWeek(wire['currentWeek']),
    road: mapRoad(wire['road']),
    leadType: str(wire['leadType']),
    goal: goal ? { type: str(goal['type']) ?? 'WEIGHT', targetKg: num(goal['targetKg']), byDate: str(goal['byDate']) } : null,
    hero: {
      nowKg: num(hero['nowKg']),
      changeKg: num(hero['changeKg']),
      weeklyRate: compared(hero['weeklyRate'], num),
      projectedDate: compared(hero['projectedDate'], str),
      daysLeft: num(hero['daysLeft'])
    },
    highlights: mapHighlights(wire['highlights']),
    weight: {
      daily: list(weight['daily'], (item) => {
        const date = str(item['date']);
        const kg = num(item['kg']);
        return date && kg !== null ? { date, kg } : null;
      }),
      weekly: list(weight['weekly'], (item) => {
        const weekStart = str(item['weekStart']);
        const avgKg = num(item['avgKg']);
        return weekStart && avgKg !== null ? { weekStart, avgKg, weighIns: num(item['weighIns']) ?? 0 } : null;
      }),
      projection: list(weight['projection'], (item) => {
        const date = str(item['date']);
        const kg = num(item['kg']);
        return date && kg !== null ? { date, kg } : null;
      }),
      rateChangeMark: mark && str(mark['date']) ? { date: str(mark['date']) as string, text: str(mark['text']) ?? '' } : null,
      method: str(weight['method']) ?? ''
    },
    body: { bodyFat: bodySeries(body['bodyFat']), waist: bodySeries(body['waist']), bmi: bodySeries(body['bmi']) },
    pace: {
      weeks: list(obj(wire['pace'])?.['weeks'], (item) => {
        const weekStart = str(item['weekStart']);
        return weekStart ? { weekStart, expectedKg: num(item['expectedKg']), actualKg: num(item['actualKg']) } : null;
      })
    },
    otherGoals: list(wire['otherGoals'], otherGoal)
  };
}

/** A month as "YYYY-MM" or "YYYY-MM-DD" becomes the key of its first day; anything else is null. */
export function monthKey(value: string | null): string | null {
  const match = /^(\d{4}-\d{2})(-\d{2})?$/.exec(value ?? '');
  return match ? `${match[1]}-01` : null;
}

function macro(value: unknown, currentWeek: CurrentWeek | null, to: string | null, month = false): MacroTrend | null {
  const wire = obj(value);
  if (!wire) {
    return null;
  }
  const all = list(wire['series'], (item) => {
    const weekStart = month ? monthKey(str(item['month']) ?? str(item['weekStart'])) : str(item['weekStart']);
    const point = num(item['value']);
    return weekStart && point !== null ? { weekStart, value: point, ...(month ? { partial: bool(item['partial']) } : {}) } : null;
  });
  const series = month ? all : endAtLastFullWeek(all, (point) => point.weekStart, currentWeek, to);
  // A week taken off the end also takes the figure that stood for "this week".
  const cut = series.length < all.length;
  return { firstWeek: num(wire['firstWeek']), thisWeek: cut ? (series.at(-1)?.value ?? null) : num(wire['thisWeek']), target: num(wire['target']), series };
}

function plateShares(value: unknown): PlateShare[] {
  return list(value, (item) => {
    const group = str(item['group']);
    const share = num(item['share']);
    return group && share !== null ? { group, kcal: num(item['kcal']), share } : null;
  });
}

function mealShares(value: unknown): MealShare[] {
  return list(value, (item) => {
    const mealType = str(item['mealType']);
    const sharePct = num(item['sharePct']);
    return mealType && sharePct !== null ? { mealType, sharePct, deltaPoints: num(item['deltaPoints']), kcalPerDay: num(item['kcalPerDay']) } : null;
  });
}

/** Meals: this period's shares and, when the server sends them, the period before (null when absent or empty). */
function mapMeals(wire: Record<string, unknown> | null): FoodProgress['meals'] {
  const share = mealShares(wire?.['share'] ?? wire?.['current']);
  const before = wire?.['previous'] === undefined || wire['previous'] === null ? [] : mealShares(wire['previous']);
  return { share, previous: before.length ? before : null };
}

/** A month series is whole as it comes; a weekly one ends at the last full week when the server says so. */
function monthOrWeek<T>(month: boolean, points: T[], weekOf: (point: T) => string, currentWeek: CurrentWeek | null, to: string | null): T[] {
  return month ? points : endAtLastFullWeek(points, weekOf, currentWeek, to);
}

/** The analytics half of the Food page (contract 2.2), without nutrition's part. */
export function mapFoodProgress(response: unknown, granularity: FoodGranularity = 'week'): Omit<FoodProgress, 'nutrition'> {
  const month = granularity === 'month';
  const wire = obj(response) ?? {};
  const hero = obj(wire['hero']) ?? {};
  const balance = obj(hero['balancePerDay']) ?? {};
  const days = obj(hero['daysLogged']) ?? {};
  const energy = obj(wire['energy']) ?? {};
  const macros = obj(wire['macros']) ?? {};
  const plate = obj(wire['plate']) ?? {};
  const habits = obj(wire['habits']) ?? {};
  const thisWeek = obj(energy['thisWeek']);
  const period = range(wire['period']);
  const currentWeek = mapCurrentWeek(wire['currentWeek']);
  const to = period?.to ?? null;
  return {
    granularity,
    period,
    previous: range(wire['previous']),
    currentWeek,
    hero: {
      eatenPerDay: compared(hero['eatenPerDay'], num),
      proteinPerDay: compared(hero['proteinPerDay'], num),
      balancePerDay: { value: num(balance['value']), daysLogged: num(balance['daysLogged']) },
      daysLogged: { value: num(days['value']), previous: num(days['previous']), days: num(days['days']) }
    },
    highlights: mapHighlights(wire['highlights']),
    energy: {
      thisWeek: thisWeek ? mapEnergyWeek(thisWeek) : null,
      weeklyBalance: monthOrWeek(
        month,
        list(energy['weeklyBalance'], (item) => {
          const weekStart = month ? monthKey(str(item['month']) ?? str(item['weekStart'])) : str(item['weekStart']);
          const current = bool(item['current']) || (month && bool(item['partial']));
          return weekStart ? { weekStart, balance: num(item['balance']), daysLogged: num(item['daysLogged']) ?? 0, current } : null;
        }),
        (week) => week.weekStart,
        currentWeek,
        to
      )
    },
    macros: { protein: macro(macros['protein'], currentWeek, to, month), carbs: macro(macros['carbs'], currentWeek, to, month), fat: macro(macros['fat'], currentWeek, to, month), summary: mapSummaryLines(macros['summary']) },
    plate: {
      basis: str(plate['basis']) ?? 'CALORIES',
      current: plateShares(plate['current']),
      previous: plateShares(plate['previous']),
      changes: list(plate['changes'], (item) => {
        const group = str(item['group']);
        const delta = num(item['deltaPoints']);
        return group && delta !== null ? { group, deltaPoints: delta } : null;
      })
    },
    meals: mapMeals(obj(wire['meals'])),
    habits: {
      waterMetDays: num(habits['waterMetDays']),
      fibreMetDays: num(habits['fibreMetDays']),
      loggedDays: num(habits['loggedDays']),
      loggedDaysPerMonth: list(habits['loggedDaysPerMonth'], (item) => {
        const key = monthKey(str(item['month']));
        const days = num(item['days']);
        return key && days !== null ? { month: key, days } : null;
      })
    }
  };
}

/** Nutrition's half of the Food page (contract 3.1). */
export function mapFoodNutrition(response: unknown): FoodNutrition {
  const wire = obj(response) ?? {};
  const cooks = obj(wire['cooks']);
  const last = obj(cooks?.['last']);
  const habits = obj(wire['habits']) ?? {};
  return {
    recentWindow: range(wire['recentWindow']),
    // Water met days only mean something once a goal is set; without one the wire sends 0 of 0.
    habits: { loggedDays: num(habits['loggedDays']), fibreMetDays: num(habits['fibreMetDays']), waterMetDays: num(habits['waterGoalMl']) === null ? null : num(habits['waterMetDays']) },
    mealTimes: list(wire['mealTimes'], (item) => {
      const mealType = str(item['mealType']);
      const median = num(item['medianMinuteOfDay']);
      return mealType && median !== null
        ? { mealType, medianMinuteOfDay: median, p25: num(item['p25']), p75: num(item['p75']), count: num(item['count']) ?? 0 }
        : null;
    }),
    topFoods: list(wire['topFoods'], (item) => {
      const name = str(item['name']);
      return name
        ? {
            foodCatalogItemId: str(item['foodCatalogItemId']),
            name,
            foodGroup: str(item['foodGroup']),
            categoryCode: str(item['categoryCode']),
            times: num(item['times']) ?? 0
          }
        : null;
    }).slice(0, 5),
    cooks: cooks
      ? {
          count: num(cooks['count']) ?? 0,
          last: last && str(last['name']) ? { recipeId: str(last['recipeId']), name: str(last['name']) as string, finishedAt: str(last['finishedAt']) } : null
        }
      : null,
    lowestNutrients: list(wire['lowestNutrients'], (item) => {
      const code = str(item['code']);
      const share = num(item['share']);
      return code && share !== null ? { code, displayName: str(item['displayName']) ?? code, share } : null;
    }).slice(0, 3)
  };
}

function reviewFact(item: Record<string, unknown>): ReviewFact | null {
  const key = str(item['key']);
  const value = str(item['value']);
  if (!key || value === null) {
    return null;
  }
  return { key, label: str(item['label']) ?? key, value, unit: str(item['unit']) ?? '', note: str(item['note']) ?? '', detail: str(item['detail']) ?? '' };
}

function optionalNumber<K extends string>(key: K, value: unknown): Partial<Record<K, number>> {
  const figure = num(value);
  return figure === null ? {} : ({ [key]: figure } as Record<K, number>);
}

const REVIEW_STATUSES: readonly ReviewStatus[] = ['READY', 'WRITING', 'NONE'];

/** The weekly reviews, newest first whatever order they came in. */
export function mapReviews(response: unknown): WeeklyReview[] {
  const items = Array.isArray(response) ? response : arr(obj(response)?.['reviews'] ?? obj(response)?.['items']);
  return list(items, (item) => {
    const weekStart = str(item['weekStart']);
    if (!weekStart) {
      return null;
    }
    return {
      weekStart,
      weekEnd: str(item['weekEnd']) ?? weekStart,
      current: bool(item['current']),
      status: REVIEW_STATUSES.find((status) => status === item['status']) ?? 'NONE',
      headline: str(item['headline']) ?? '',
      // The chips carry the facts, so the body's citation markers are left out rather than shown as "[1]".
      body: withoutCitations(str(item['body']) ?? '').trim(),
      facts: list(item['facts'], reviewFact),
      ...optionalNumber('eatenTodaySoFarKcal', item['eatenTodaySoFarKcal']),
      ...optionalNumber('proteinTodaySoFarGrams', item['proteinTodaySoFarGrams'])
    };
  }).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}
