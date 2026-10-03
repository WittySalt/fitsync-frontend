import { DotDay, Highlight, SummaryLine } from '../../shared/progress/progress.models';
import { EnergyWeek } from './energy/energy.models';

/** A figure and the same figure for the period before; either side is null when not known. */
export interface Compared<T> {
  value: T | null;
  previous: T | null;
}

/** The days a response describes and the days before it that every comparison uses. */
export interface PeriodPair {
  period: { from: string; to: string } | null;
  previous: { from: string; to: string } | null;
}

export interface DatedValue {
  date: string;
  value: number;
}

// ---------------------------------------------------------------- goal (contract 2.1)
export interface WeightGoal {
  type: string;
  targetKg: number | null;
  byDate: string | null;
}

export interface BodySeries {
  series: DatedValue[];
  start: number | null;
  end: number | null;
  context: string;
}

export interface OtherGoal {
  type: string;
  target: number | null;
  unit: string;
  metDays: number | null;
  loggedDays: number | null;
  days: DotDay[];
  weeks: { weekStart: string; value: number; target: number | null }[];
}

export interface GoalProgress extends PeriodPair {
  goal: WeightGoal | null;
  hero: {
    nowKg: number | null;
    changeKg: number | null;
    weeklyRate: Compared<number>;
    projectedDate: Compared<string>;
    daysLeft: number | null;
  };
  highlights: Highlight[];
  weight: {
    daily: { date: string; kg: number }[];
    weekly: { weekStart: string; avgKg: number; weighIns: number }[];
    projection: { date: string; kg: number }[];
    rateChangeMark: { date: string; text: string } | null;
    method: string;
  };
  body: { bodyFat: BodySeries | null; waist: BodySeries | null; bmi: BodySeries | null };
  pace: { weeks: { weekStart: string; expectedKg: number | null; actualKg: number | null }[] };
  otherGoals: OtherGoal[];
}

// ---------------------------------------------------------------- food (contracts 2.2 and 3.1)
export interface MacroTrend {
  firstWeek: number | null;
  thisWeek: number | null;
  target: number | null;
  series: { weekStart: string; value: number }[];
}

/** A food group's share of the plate, by calories (analytics stores no grams; drinks are left out). */
export interface PlateShare {
  group: string;
  kcal: number | null;
  share: number;
}

export interface FoodNutrition {
  mealTimes: { mealType: string; medianMinuteOfDay: number; p25: number | null; p75: number | null; count: number }[];
  topFoods: { foodCatalogItemId: string | null; name: string; foodGroup: string | null; categoryCode: string | null; times: number }[];
  cooks: { count: number; last: { recipeId: string | null; name: string; finishedAt: string | null } | null } | null;
  /** The last 31 days of the period at most, which the lowest nutrients and the habits cover. */
  recentWindow: { from: string; to: string } | null;
  lowestNutrients: { code: string; displayName: string; share: number }[];
  habits: { loggedDays: number | null; fibreMetDays: number | null; waterMetDays: number | null };
}

export interface FoodProgress extends PeriodPair {
  hero: {
    eatenPerDay: Compared<number>;
    proteinPerDay: Compared<number>;
    balancePerDay: { value: number | null; daysLogged: number | null };
    daysLogged: { value: number | null; previous: number | null; days: number | null };
  };
  highlights: Highlight[];
  energy: {
    thisWeek: EnergyWeek | null;
    weeklyBalance: { weekStart: string; balance: number | null; daysLogged: number; current: boolean }[];
  };
  macros: { protein: MacroTrend | null; carbs: MacroTrend | null; fat: MacroTrend | null; summary: SummaryLine[] };
  plate: { basis: string; current: PlateShare[]; previous: PlateShare[]; changes: { group: string; deltaPoints: number }[] };
  meals: { share: { mealType: string; sharePct: number; deltaPoints: number | null; kcalPerDay: number | null }[] };
  /** Fibre and water come from nutrition and cover its recent window; water is null while no goal is known. */
  habits: { waterMetDays: number | null; fibreMetDays: number | null; loggedDays: number | null };
  /** What only nutrition knows; null when that read failed, so its sections say so. */
  nutrition: FoodNutrition | null;
}

// ---------------------------------------------------------------- weekly reviews (contract 4.2)
export type ReviewStatus = 'READY' | 'WRITING' | 'NONE';

export interface WeeklyReview {
  weekStart: string;
  weekEnd: string;
  /** The week still under way, reviewed "so far". */
  current: boolean;
  status: ReviewStatus;
  headline: string;
  body: string;
}
