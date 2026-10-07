import { FoodGroup } from '../../../shared/food/food-groups';

export type NutrientGroup = 'FAT_SOLUBLE' | 'WATER_SOLUBLE' | 'MAJOR_MINERAL' | 'TRACE_MINERAL' | 'LIMIT';

/** One day of a nutrient. The share is the day amount over the daily amount; null when unknown. */
export interface NutrientDayValue {
  date: string;
  logged: boolean;
  amount: number | null;
  share: number | null;
}

/** A nutrient as one tile of the table: what was eaten against the daily amount (or limit). */
export interface NutrientTileData {
  code: string;
  displayName: string;
  unit: string;
  groupCode: NutrientGroup;
  symbol: string;
  /** Minerals only. */
  atomicNumber: number | null;
  /** Null when no logged food has data for this nutrient: unknown, not zero. */
  averageAmount: number | null;
  reference: number;
  share: number | null;
  met: boolean;
  upperLimit: number | null;
  aboveUpperLimit: boolean;
  dayValues: NutrientDayValue[];
}

export interface NutrientsOverview {
  daysLogged: number;
  referenceLabel: string | null;
  nutrients: NutrientTileData[];
}

export interface NutrientSource {
  name: string;
  foodGroup: FoodGroup | null;
  categoryCode: string | null;
  amount: number | null;
  share: number | null;
}

export interface AgeBandAmount {
  ageBand: string;
  label: string;
  female: number | null;
  male: number | null;
  upperLimit: number | null;
  /** True for the row that belongs to the person. */
  mine: boolean;
}

export interface RichFood {
  foodId: string;
  name: string;
  foodGroup: FoodGroup | null;
  categoryCode: string | null;
  amountPer100g: number | null;
}

export interface NutrientGuide {
  whatItDoes: string | null;
  tooLittleTooMuch: string | null;
  whoNeedsMore: string | null;
  tips: string[];
  sourceLabel: string | null;
}

export interface NutrientDetail {
  tile: NutrientTileData;
  from: string;
  to: string;
  days: number;
  daysLogged: number;
  referenceLabel: string | null;
  sources: NutrientSource[];
  amounts: AgeBandAmount[];
  richest: RichFood[];
  /** Null when the server has no guide for this nutrient; the page then leaves the guide out. */
  guide: NutrientGuide | null;
}

export type PeriodKey = 'today' | '7d' | '30d' | '90d';
