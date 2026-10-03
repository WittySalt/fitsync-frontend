/**
 * The Training pages' view of the workout-service progress reads (contract sections 1.1 to 1.3).
 * Every field the backend may not send yet is nullable or an empty list, so a page can show "not
 * enough data yet" for a section instead of an empty chart.
 */
export type TrainingKind = 'STRENGTH' | 'CARDIO' | 'SPORT' | 'MOBILITY';

export const TRAINING_KINDS: TrainingKind[] = ['STRENGTH', 'CARDIO', 'SPORT', 'MOBILITY'];

export type Trend = 'UP' | 'STEADY' | 'DOWN';

export type FormWord = 'TIRED' | 'BALANCED' | 'FRESH';

export type StrengthLevel = 'BEGINNER' | 'NOVICE' | 'INTERMEDIATE' | 'ADVANCED';

export interface Compared {
  value: number | null;
  previous: number | null;
}

export interface TrainingHero {
  sessions: Compared;
  minutes: Compared;
  load: Compared & { estimatedShare: number | null };
  records: { value: number | null; exercises: string[] };
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface Highlight {
  code: string;
  title: string;
  series: SeriesPoint[];
  unit: string;
  context: string;
}

export interface SummaryLine {
  text: string;
  trend: Trend;
}

export interface ActivityCard {
  key: string;
  name: string;
  kind: TrainingKind;
  sessions: number;
  minutes: number;
  cumulative: { date: string; minutes: number }[];
  summary: SummaryLine[];
  context: string;
}

export interface LoadWeek {
  weekStart: string;
  byKind: Record<TrainingKind, number>;
  total: number;
  estimated: boolean;
}

export interface WeekValue {
  weekStart: string;
  value: number;
}

export interface TrainingLoad {
  weeks: LoadWeek[];
  fitness: WeekValue[];
  fatigue: WeekValue[];
  form: FormWord | null;
}

export interface GroupExercise {
  exerciseId: string;
  name: string;
  sets: number;
}

export interface MuscleGroupSets {
  group: string;
  setsPerWeek: number;
  exercises: GroupExercise[];
  /** Sessions that touched the group, when the backend sends it. */
  sessions: number | null;
}

export interface MuscleSets {
  weeksCounted: number;
  groups: MuscleGroupSets[];
  usualRange: { low: number; high: number };
}

export interface E1rmPoint {
  date: string;
  value: number;
  isRecord: boolean;
}

export interface BestSet {
  weightKg: number;
  reps: number;
  date: string;
}

export interface RelativeStrength {
  ratio: number;
  level: StrengthLevel;
  nextLevel: StrengthLevel | null;
  nextAtKg: number | null;
}

export interface Lift {
  exerciseId: string;
  name: string;
  e1rm: E1rmPoint[];
  bestSet: BestSet | null;
  changePct: number | null;
  relative: RelativeStrength | null;
  bodyWeightKg: number | null;
  /** The best estimated single before the period, drawn as the dashed line; null when unknown. */
  bestBefore: number | null;
}

export interface CalendarDay {
  date: string;
  kind: TrainingKind;
  minutes: number;
  record: boolean;
  /** The day's session when the backend names it; the day then opens that session's page. */
  sessionId: string | null;
}

export interface RecordEntry {
  date: string;
  exerciseId: string;
  name: string;
  value: number;
  unit: string;
  delta: number | null;
}

export interface TrainingProgress {
  period: { from: string; to: string };
  previous: { from: string; to: string } | null;
  hero: TrainingHero;
  highlights: Highlight[];
  activities: ActivityCard[];
  load: TrainingLoad;
  muscles: MuscleSets;
  lifts: Lift[];
  calendar: CalendarDay[];
  records: RecordEntry[];
}

// ---------------------------------------------------------------- one activity (1.2)

export interface ActivitySession {
  sessionId: string;
  startedAt: string;
  minutes: number;
  effort: number | null;
  estimatedEffort: boolean;
  calories: number | null;
  distanceKm: number | null;
  paceSecPerKm: number | null;
}

export interface ActivityProgress {
  key: string;
  name: string;
  kind: TrainingKind;
  tiles: {
    minutes: number | null;
    sessions: number | null;
    weeksInARow: number | null;
    longestSession: { minutes: number; date: string } | null;
    usualTime: { weekday: number; hour: number } | null;
    effort: { average: number | null; first: number | null; last: number | null };
  };
  weekly: { weekStart: string; minutes: number; sessions: number; current: boolean }[];
  sessions: ActivitySession[];
  whenGrid: { weekday: number; hour: number; count: number }[];
  summary: SummaryLine[];
  context: string;
}

// ---------------------------------------------------------------- one exercise (1.3)

export type ExerciseSeriesKey = 'e1rm' | 'heaviest' | 'volume' | 'reps';

export interface ExerciseProgress {
  exerciseId: string;
  name: string;
  primaryGroup: string | null;
  secondaryGroups: string[];
  equipment: string | null;
  firstSeen: string | null;
  sessions: number | null;
  tiles: {
    e1rm: { value: number; changeKg: number | null; since: string | null } | null;
    heaviestSet: BestSet | null;
    bestVolume: { kg: number; date: string } | null;
    records: number | null;
  };
  series: Record<ExerciseSeriesKey, E1rmPoint[]>;
  history: { sessionId: string; date: string; sets: { weightKg: number; reps: number }[]; record: boolean }[];
  summary: SummaryLine[];
}
