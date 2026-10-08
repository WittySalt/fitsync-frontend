import { CARDIO_PLACES, CardioPlace, DraftDay, DraftMove, DraftPlan, DraftSegment, effortFromValue, emptyDay, emptyWeek, FlowKind, PlanType, SEGMENT_LABELS, SegmentKind, TargetKind } from './plan-draft';
import { CoverageGroup, CoverageNote, PlanCoverage } from './plan-coverage';
import { derivePlanType } from './plan-summary';
import { sportSegments } from './segments/segment-list-math';
import { defaultSegments } from './segments/segment-math';

type Raw = Record<string, unknown>;

/** The backend may be a release behind, so every read here tolerates a missing or odd field. */

function record(value: unknown): Raw | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function strings(value: unknown): string[] {
  return list(value).filter((item): item is string => typeof item === 'string');
}

const SEGMENT_KINDS: readonly SegmentKind[] = ['WARMUP', 'STEADY', 'WORK', 'EASY', 'COOLDOWN'];

export function mapFlowKind(value: unknown): FlowKind {
  const kind = text(value).toUpperCase();
  // The flow has no HIIT kind: a HIIT day is a cardio day whose shape carries the intervals.
  if (kind === 'CARDIO' || kind === 'HIIT') {
    return 'CARDIO';
  }
  if (kind === 'SPORT' || kind === 'MOBILITY' || kind === 'REST') {
    return kind;
  }
  return 'STRENGTH';
}

function mapMove(raw: Raw): DraftMove {
  const duration = num(raw['targetDurationSeconds']);
  const reps = num(raw['targetReps']);
  const timed = duration !== null && duration > 0 && !(reps && reps > 0);
  const meta = [text(raw['primaryMuscleGroup']), text(raw['equipment'])]
    .filter(Boolean)
    .map((part) => part.toLowerCase().replace(/_/g, ' '))
    .join(' · ');
  return {
    exerciseId: text(raw['exerciseId']),
    name: text(raw['exerciseNameSnapshot']) || text(raw['name']) || 'Exercise',
    meta: text(raw['meta']) || meta,
    imageUrl: text(raw['primaryImageUrl']) || null,
    timed,
    sets: num(raw['targetSets']),
    reps: timed ? null : reps,
    durationSeconds: duration,
    weightKg: num(raw['targetWeightKg']),
    restSeconds: num(raw['restSeconds']),
    tempoSeconds: num(raw['tempoSeconds']),
    notes: text(raw['notes']),
    primaryGroups: strings(raw['primaryMuscleGroups']),
    secondaryGroups: strings(raw['secondaryMuscleGroups'])
  };
}

function mapSegment(raw: Raw): DraftSegment | null {
  const kind = text(raw['kind']).toUpperCase() as SegmentKind;
  const seconds = num(raw['plannedSeconds']);
  if (!SEGMENT_KINDS.includes(kind) || seconds === null || seconds <= 0) {
    return null;
  }
  const rounds = num(raw['rounds']);
  return {
    kind,
    label: text(raw['label']) || SEGMENT_LABELS[kind],
    minutes: Math.max(1, Math.round(seconds / 60)),
    rounds: rounds && rounds > 1 ? Math.round(rounds) : null
  };
}

function mapDay(rawDay: Raw): DraftDay | null {
  const dayOfWeek = num(rawDay['dayOfWeek']);
  if (dayOfWeek === null || dayOfWeek < 1 || dayOfWeek > 7) {
    return null;
  }
  const kind = mapFlowKind(rawDay['kind']);
  const entries = list(rawDay['entries']).map(record).filter((entry): entry is Raw => entry !== null);
  // A day saved before entries existed lists its moves under `exercises`; they are read only when `entries` is empty.
  const legacy = list(rawDay['exercises']).map(record).filter((entry): entry is Raw => entry !== null);
  const moves = (entries.length ? entries.filter((entry) => text(entry['entryType'], 'SET') !== 'SEGMENT') : legacy).map(mapMove);
  const segments = entries
    .filter((entry) => text(entry['entryType']) === 'SEGMENT')
    .map(mapSegment)
    .filter((segment): segment is DraftSegment => segment !== null);
  const minutes = num(rawDay['estimatedDurationMinutes']);
  const place = text(rawDay['location']).toUpperCase() as CardioPlace;
  const targetKind = text(rawDay['targetKind']).toUpperCase();
  const withSegments = kind === 'CARDIO' || kind === 'SPORT';
  // A cardio or sport day saved without segments gets the default shape for its minutes, so the strip has something to draw.
  return {
    ...emptyDay(dayOfWeek),
    planDayId: text(rawDay['planDayId']) || null,
    kind,
    title: text(rawDay['title']),
    minutes,
    sportActivity: text(rawDay['sportActivity']),
    targetKind: (['MINUTES', 'DISTANCE', 'PACE'] as TargetKind[]).includes(targetKind as TargetKind) ? (targetKind as TargetKind) : null,
    targetValue: num(rawDay['targetValue']),
    location: CARDIO_PLACES.includes(place) ? place : null,
    effort: effortFromValue(num(rawDay['effortTarget'])),
    segments: withSegments ? (segments.length ? segments : minutes ? (kind === 'SPORT' ? sportSegments(minutes) : defaultSegments(minutes)) : []) : [],
    moves: withSegments ? [] : moves
  };
}

/** The seven days of a week from the server's `days`, rest days filled in where it sent none. */
export function mapDays(rawDays: unknown): DraftDay[] {
  const week = emptyWeek();
  for (const raw of list(rawDays)) {
    const rawDay = record(raw);
    const day = rawDay ? mapDay(rawDay) : null;
    if (day) {
      week[day.dayOfWeek - 1] = day;
    }
  }
  return week;
}

/** Stored workout types the flow can show as a plan type. MIXED is saved as CUSTOM, which is not mapped back. */
const PLAN_TYPES: Record<string, PlanType> = { STRENGTH: 'STRENGTH', CARDIO: 'CARDIO', MOBILITY: 'MOBILITY' };

/** A saved plan, as the edit flow opens it. Null when the answer is not a plan. */
export function draftFromRaw(rawPlan: unknown): DraftPlan | null {
  const raw = record(rawPlan);
  if (!raw) {
    return null;
  }
  const days = mapDays(raw['days']);
  const derived = derivePlanType(days);
  const stored = PLAN_TYPES[text(raw['workoutType']).toUpperCase()];
  // The type follows the days; only a week with no training day falls back to what was stored.
  return {
    planId: text(raw['planId']) || null,
    name: text(raw['name']),
    description: text(raw['description']),
    planType: days.every((day) => day.kind === 'REST') ? (stored ?? 'STRENGTH') : derived,
    nameTyped: true,
    typeTyped: false,
    days
  };
}

/** The server's proposal: the days only, or null when the answer has no training day. */
export function proposalFromRaw(rawProposal: unknown): DraftDay[] | null {
  const raw = record(rawProposal);
  const source = record(raw?.['plan']) ?? raw;
  const days = mapDays(source?.['days']);
  return days.some((day) => day.kind !== 'REST') ? days : null;
}

export function coverageFromRaw(rawCoverage: unknown): PlanCoverage | null {
  const raw = record(rawCoverage);
  if (!raw || !Array.isArray(raw['groups'])) {
    return null;
  }
  const groups: CoverageGroup[] = list(raw['groups'])
    .map(record)
    .filter((entry): entry is Raw => entry !== null && typeof entry['group'] === 'string')
    .map((entry) => ({ group: text(entry['group']).toUpperCase(), setsPerWeek: num(entry['setsPerWeek']) ?? 0 }));
  const notes: CoverageNote[] = list(raw['notes'])
    .map(record)
    .filter((entry): entry is Raw => entry !== null && typeof entry['code'] === 'string')
    .map((entry) => ({ code: text(entry['code']), text: text(entry['text']) }));
  return { groups, notes };
}
