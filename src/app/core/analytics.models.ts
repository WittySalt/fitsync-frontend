export type AnalyticsBucket = 'DAY' | 'WEEK' | 'MONTH';
export type AnalyticsComparePeriod = 'WEEK' | 'MONTH';
export type AnalyticsGoalStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface AnalyticsDashboardBody {
  latestWeightKg: number | null;
  latestBodyFatRate: number | null;
  bmi: number | null;
  weightChange30d: number | null;
  /** Day the newest measurement was taken. Absent before the backend fix, which is why the
   *  "Latest body metric" caption used to fall back to the snapshot's generatedAt. */
  measuredOn: string | null;
  /** The newest waist and its day. It can be older than `measuredOn` when a later entry had a
   *  weight only, and both are absent on a backend that does not send them yet. */
  latestWaistCm?: number | null;
  waistMeasuredAt?: string | null;
}

export interface AnalyticsDashboardWorkout {
  todayWorkoutCount: number;
  weekWorkoutCount: number;
  weekWorkoutMinutes: number;
  activeStreakDays: number;
  /** Consecutive days with a session, ending today or yesterday. Absent on an older backend. */
  currentStreakDays?: number | null;
  /** Minutes trained Monday to Sunday this week in the person's zone. Absent on an older backend. */
  minutesThisWeek?: number | null;
}

export interface AnalyticsDashboardNutrition {
  todayCaloriesConsumed: number | null;
  todayCaloriesTarget: number | null;
  todayProteinGrams: number | null;
  todayProteinTargetGrams: number | null;
}

export interface AnalyticsDashboardGoal {
  goalId: string;
  goalType: string;
  targetValue?: number | null;
  targetUnit?: string | null;
  targetDate?: string | null;
  currentValue?: number | null;
  progressRatio: number;
  onTrack: boolean;
  lastEvaluatedAt?: string | null;
}

export interface AnalyticsDashboardResponse {
  generatedAt: string;
  timezone: string;
  body: AnalyticsDashboardBody;
  workout: AnalyticsDashboardWorkout;
  nutrition: AnalyticsDashboardNutrition;
  goals: AnalyticsDashboardGoal[];
}

export interface AnalyticsGoalProgress {
  goalId: string;
  goalType: string;
  goalStatus: AnalyticsGoalStatus;
  targetValue: number;
  targetUnit: string;
  targetDate: string;
  currentValue: number;
  progressRatio: number;
  daysRemaining: number;
  onTrack: boolean;
  /** Derived server-side from targetDate. A goal past its deadline is never on track. */
  expired: boolean;
  lastEvaluatedAt: string;
}

export interface AnalyticsGoalsProgressResponse {
  goals: AnalyticsGoalProgress[];
}

export interface AnalyticsBodyTrendPoint {
  date: string;
  weightKg: number | null;
  bodyFatRate: number | null;
  waistCm: number | null;
  bmi: number | null;
  weightDeltaFromStart: number | null;
  weightDeltaFromPrevious: number | null;
}

export interface AnalyticsBodyTrendsResponse {
  from: string;
  to: string;
  bucket: AnalyticsBucket;
  points: AnalyticsBodyTrendPoint[];
}

export interface AnalyticsWorkoutSeriesPoint {
  date: string;
  completedWorkoutCount: number;
  totalWorkoutMinutes: number;
  totalCaloriesBurned: number;
  totalExerciseCount: number;
}

export interface AnalyticsWorkoutSeriesResponse {
  from: string;
  to: string;
  bucket: AnalyticsBucket;
  points: AnalyticsWorkoutSeriesPoint[];
}

export interface AnalyticsNutritionSeriesPoint {
  date: string;
  totalCaloriesConsumed: number | null;
  totalProteinGrams: number | null;
  totalCarbsGrams: number | null;
  totalFatGrams: number | null;
  calorieTarget: number | null;
  proteinTargetGrams: number | null;
}

export interface AnalyticsNutritionSeriesResponse {
  from: string;
  to: string;
  bucket: AnalyticsBucket;
  points: AnalyticsNutritionSeriesPoint[];
}

export interface AnalyticsWorkoutSummaryResponse {
  from: string;
  to: string;
  totalWorkoutCount: number;
  totalWorkoutMinutes: number;
  totalCaloriesBurned: number;
  totalExerciseCount: number;
  averageDurationMinutes: number;
  activeStreakDays: number;
}

export interface AnalyticsNutritionSummaryResponse {
  from: string;
  to: string;
  totalCaloriesConsumed: number | null;
  totalProteinGrams: number | null;
  totalCarbsGrams: number | null;
  totalFatGrams: number | null;
  calorieTarget: number | null;
  proteinTargetGrams: number | null;
  averageCalorieAdherenceRatio: number | null;
  averageMacroAdherenceScore: number | null;
  daysWithinCalorieTargetBand: number;
}

export interface AnalyticsCompareWindow {
  from: string;
  to: string;
}

export interface AnalyticsMetricComparison {
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
  /** The same figure for a day on which food was logged, so a week with fewer logged days is not
   *  read as eating less. Sent for nutrition metrics only, and absent on an older backend. */
  averagePerLoggedDay?: AnalyticsMetricComparison | null;
}

export interface AnalyticsWorkoutComparison {
  completedWorkoutCount: AnalyticsMetricComparison;
  totalWorkoutMinutes: AnalyticsMetricComparison;
  totalCaloriesBurned: AnalyticsMetricComparison;
  totalExerciseCount: AnalyticsMetricComparison;
}

export interface AnalyticsNutritionComparison {
  totalCaloriesConsumed: AnalyticsMetricComparison;
  totalProteinGrams: AnalyticsMetricComparison;
  totalCarbsGrams: AnalyticsMetricComparison;
  totalFatGrams: AnalyticsMetricComparison;
  /** How many days had food logged in each window; absent on an older backend. */
  daysLogged?: AnalyticsMetricComparison | null;
}

export interface AnalyticsSummaryCompareResponse {
  period: AnalyticsComparePeriod;
  currentWindow: AnalyticsCompareWindow;
  previousWindow: AnalyticsCompareWindow;
  workout: AnalyticsWorkoutComparison;
  nutrition: AnalyticsNutritionComparison;
}

export interface AnalyticsActivityDay {
  date: string;
  workoutCount: number;
  workoutMinutes: number;
}

export interface AnalyticsActivityCalendarResponse {
  from: string;
  to: string;
  days: AnalyticsActivityDay[];
}

export interface AnalyticsAchievement {
  code: string;
  title: string;
  unlocked: boolean;
  /** ISO instant the badge was earned, or null while it is still locked. */
  unlockedAt: string | null;
  /** How close the badge is to unlocking, from 0 to 1. */
  progress: number;
}

export interface AnalyticsAchievementsResponse {
  achievements: AnalyticsAchievement[];
}
