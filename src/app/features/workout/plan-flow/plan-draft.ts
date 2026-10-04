/** The plan being built in the flow. It is plain data, so every rule on it is a pure function. */

export type FlowKind = 'REST' | 'STRENGTH' | 'CARDIO' | 'SPORT' | 'MOBILITY';

export const FLOW_KINDS: readonly FlowKind[] = ['REST', 'STRENGTH', 'CARDIO', 'SPORT', 'MOBILITY'];

export const FLOW_KIND_LABELS: Record<FlowKind, string> = {
  REST: 'Rest',
  STRENGTH: 'Strength',
  CARDIO: 'Cardio',
  SPORT: 'Sport',
  MOBILITY: 'Mobility'
};

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export type SegmentKind = 'WARMUP' | 'STEADY' | 'WORK' | 'EASY' | 'COOLDOWN';

export const SEGMENT_LABELS: Record<SegmentKind, string> = {
  WARMUP: 'Warm-up',
  STEADY: 'Steady',
  WORK: 'Work',
  EASY: 'Easy',
  COOLDOWN: 'Cool-down'
};

/** One stretch of a cardio or sport day. A segment with rounds repeats: Work and Easy share one count. */
export interface DraftSegment {
  kind: SegmentKind;
  label: string;
  minutes: number;
  rounds: number | null;
}

export type TargetKind = 'MINUTES' | 'DISTANCE' | 'PACE';
export type EffortLevel = 'EASY' | 'MODERATE' | 'HARD';

export const EFFORT_VALUES: Record<EffortLevel, number> = { EASY: 3, MODERATE: 6, HARD: 8 };

export function effortFromValue(value: number | null | undefined): EffortLevel | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value <= 4) {
    return 'EASY';
  }
  return value <= 7 ? 'MODERATE' : 'HARD';
}

export const CARDIO_PLACES = ['TREADMILL', 'OUTDOOR', 'BIKE', 'ROWER', 'OTHER'] as const;
export type CardioPlace = (typeof CARDIO_PLACES)[number];

/** One move of a strength or mobility day, as the moves table edits it. */
export interface DraftMove {
  exerciseId: string;
  name: string;
  /** "chest · arms · dumbbell", shown under the name. */
  meta: string;
  imageUrl: string | null;
  /** A time-based move shows its reps as seconds. */
  timed: boolean;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  weightKg: number | null;
  restSeconds: number | null;
  tempoSeconds: number | null;
  notes: string;
  /** Muscle groups the exercise trains, when the catalogue said so. Used only for the local coverage fallback. */
  primaryGroups?: string[];
  secondaryGroups?: string[];
}

export interface DraftDay {
  /** 1 for Monday through 7 for Sunday. */
  dayOfWeek: number;
  kind: FlowKind;
  title: string;
  minutes: number | null;
  sportActivity: string;
  targetKind: TargetKind | null;
  targetValue: number | null;
  location: CardioPlace | null;
  effort: EffortLevel | null;
  segments: DraftSegment[];
  moves: DraftMove[];
  planDayId: string | null;
}

export type PlanType = 'STRENGTH' | 'CARDIO' | 'MIXED' | 'MOBILITY';

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  STRENGTH: 'Strength',
  CARDIO: 'Cardio',
  MIXED: 'Mixed week',
  MOBILITY: 'Mobility'
};

export interface DraftPlan {
  planId: string | null;
  name: string;
  description: string;
  planType: PlanType;
  /** True once the person edits the name, so a later change to the week leaves it alone. */
  nameTyped: boolean;
  typeTyped: boolean;
  days: DraftDay[];
}

/** What the profile says about the person, as the flow reads it. */
export interface PlanProfile {
  fitnessLevel: string;
  weeklyWorkoutDays: number;
  preferredDurationMinutes: number;
  equipment: string[];
  focusAreas: string[];
}

export const DEFAULT_PROFILE: PlanProfile = {
  fitnessLevel: 'BEGINNER',
  weeklyWorkoutDays: 3,
  preferredDurationMinutes: 45,
  equipment: [],
  focusAreas: []
};

export function emptyDay(dayOfWeek: number): DraftDay {
  return {
    dayOfWeek,
    kind: 'REST',
    title: '',
    minutes: null,
    sportActivity: '',
    targetKind: null,
    targetValue: null,
    location: null,
    effort: null,
    segments: [],
    moves: [],
    planDayId: null
  };
}

export function emptyWeek(): DraftDay[] {
  return Array.from({ length: 7 }, (_, index) => emptyDay(index + 1));
}

export function emptyPlan(): DraftPlan {
  return { planId: null, name: '', description: '', planType: 'STRENGTH', nameTyped: false, typeTyped: false, days: emptyWeek() };
}

export function isTraining(day: DraftDay): boolean {
  return day.kind !== 'REST';
}

export function hasSegments(kind: FlowKind): boolean {
  return kind === 'CARDIO' || kind === 'SPORT';
}

export function hasMoveList(kind: FlowKind): boolean {
  return kind === 'STRENGTH' || kind === 'MOBILITY';
}

/** "45 min", "1 h 30 min", "2 h". */
export function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) {
    return '0 min';
  }
  const hours = Math.floor(total / 60);
  const minutes = Math.round(total % 60);
  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function replaceDay(days: readonly DraftDay[], dayOfWeek: number, change: (day: DraftDay) => DraftDay): DraftDay[] {
  return days.map((day) => (day.dayOfWeek === dayOfWeek ? change(day) : day));
}

/** Moves a day's content to another weekday: the two days swap, and both keep their own weekday number. */
export function swapDays(days: readonly DraftDay[], from: number, to: number): DraftDay[] {
  if (from === to) {
    return [...days];
  }
  const a = days.find((day) => day.dayOfWeek === from);
  const b = days.find((day) => day.dayOfWeek === to);
  if (!a || !b) {
    return [...days];
  }
  return days.map((day) => {
    if (day.dayOfWeek === from) {
      return { ...b, dayOfWeek: from };
    }
    if (day.dayOfWeek === to) {
      return { ...a, dayOfWeek: to };
    }
    return day;
  });
}
