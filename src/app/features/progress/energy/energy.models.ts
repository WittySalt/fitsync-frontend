export type EnergyStatus = 'OK' | 'NO_PROFILE' | 'TOO_FEW_DAYS';

/** Per logged day, in kcal. Null where the server sends no figure. */
export interface EnergyAverage {
  eaten: number | null;
  resting: number | null;
  workouts: number | null;
  used: number | null;
  /** Eaten minus used: negative is under, positive is over. */
  balance: number | null;
}

export interface MealSplit {
  breakfast: number | null;
  lunch: number | null;
  dinner: number | null;
  snack: number | null;
  /** Meals logged without a type; shown only when above zero. */
  other: number | null;
}

export interface EnergyDay {
  date: string;
  logged: boolean;
  /** Food was logged but too little to call a full day: drawn lighter, with no balance, and left
   *  out of the running total and every average. Absent on a server from before the field. */
  partlyLogged: boolean;
  /** Null on a day with no food logged, which adds nothing to the week. */
  eaten: number | null;
  resting: number | null;
  workouts: number | null;
  workoutsEstimated: boolean;
  /** Today, still going: eaten and workouts so far, no balance, and left out of every average. */
  today: boolean;
  balance: number | null;
  runningTotal: number | null;
}

/** One of the last eight weeks: kilograms from the food log against kilograms on the scale. */
export interface EnergyWeekPoint {
  weekStart: string;
  expectedKgChange: number | null;
  /** Null for a week without a weigh-in. */
  actualKgChange: number | null;
}

export interface EnergyWeek {
  weekStart: string;
  weekEnd: string;
  status: EnergyStatus;
  daysLogged: number;
  bmrKcal: number | null;
  bmrEstimated: boolean;
  restingFactor: number;
  average: EnergyAverage | null;
  mealSplit: MealSplit | null;
  weeklyKgEquivalent: number | null;
  days: EnergyDay[];
  weeks: EnergyWeekPoint[];
}

export type EnergyView = 'days' | 'total';
