import {
  ActivityCard,
  ActivityProgress,
  ActivitySession,
  BestSet,
  CalendarDay,
  Compared,
  E1rmPoint,
  ExerciseProgress,
  ExerciseSeriesKey,
  FormWord,
  Highlight,
  Lift,
  LoadWeek,
  MuscleGroupSets,
  RecordEntry,
  RelativeStrength,
  StrengthLevel,
  SummaryLine,
  TRAINING_KINDS,
  TrainingKind,
  TrainingProgress,
  Trend,
  WeekValue
} from './training.models';

/**
 * Defensive readers for the progress endpoints. The backend is built alongside these pages, so a
 * missing, renamed or malformed field turns into null or an empty list, never an exception, and the
 * page shows "not enough data yet" for the section it feeds.
 */
type Wire = Record<string, unknown>;

const obj = (value: unknown): Wire => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Wire) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const bool = (value: unknown): boolean => value === true;

export function num(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const zero = (value: unknown): number => num(value) ?? 0;
const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
const day = (value: unknown): string => (isDate(value) ? value.slice(0, 10) : '');

function trend(value: unknown): Trend {
  return value === 'UP' || value === 'DOWN' ? value : 'STEADY';
}

export function kindOf(value: unknown): TrainingKind {
  const raw = text(value).toUpperCase().split(':')[0];
  return (TRAINING_KINDS as string[]).includes(raw) ? (raw as TrainingKind) : 'STRENGTH';
}

function compared(value: unknown): Compared {
  const wire = obj(value);
  return { value: num(wire['value']), previous: num(wire['previous']) };
}

export function mapSummary(value: unknown): SummaryLine[] {
  return list(value)
    .map((entry) => obj(entry))
    .filter((entry) => text(entry['text']).trim() !== '')
    .map((entry) => ({ text: text(entry['text']), trend: trend(entry['trend']) }));
}

function mapHighlight(value: unknown): Highlight | null {
  const wire = obj(value);
  const title = text(wire['title']).trim();
  if (!title) {
    return null;
  }
  return {
    code: text(wire['code']),
    title,
    series: list(wire['series'])
      .map((point) => obj(point))
      .map((point) => ({ label: text(point['label']), value: num(point['value']) }))
      .filter((point): point is { label: string; value: number } => point.value !== null),
    unit: text(wire['unit']),
    context: text(wire['context'])
  };
}

function mapActivity(value: unknown): ActivityCard | null {
  const wire = obj(value);
  const key = text(wire['key']);
  if (!key) {
    return null;
  }
  return {
    key,
    name: text(wire['name'], key),
    kind: kindOf(key),
    sessions: zero(wire['sessions']),
    minutes: zero(wire['minutes']),
    cumulative: list(wire['cumulativeMinutes'])
      .map((point) => obj(point))
      .filter((point) => isDate(point['date']))
      .map((point) => ({ date: day(point['date']), minutes: zero(point['minutes']) })),
    summary: mapSummary(wire['summary']),
    context: text(wire['context'])
  };
}

function weekValues(value: unknown): WeekValue[] {
  return list(value)
    .map((entry) => obj(entry))
    .filter((entry) => isDate(entry['weekStart']) && num(entry['value']) !== null)
    .map((entry) => ({ weekStart: day(entry['weekStart']), value: zero(entry['value']) }));
}

function mapLoadWeek(value: unknown): LoadWeek | null {
  const wire = obj(value);
  if (!isDate(wire['weekStart'])) {
    return null;
  }
  const parts = obj(wire['byKind']);
  const byKind = Object.fromEntries(TRAINING_KINDS.map((kind) => [kind, Math.max(0, zero(parts[kind]))])) as Record<TrainingKind, number>;
  const sum = TRAINING_KINDS.reduce((total, kind) => total + byKind[kind], 0);
  return { weekStart: day(wire['weekStart']), byKind, total: num(wire['total']) ?? sum, estimated: bool(wire['estimated']) };
}

function form(value: unknown): FormWord | null {
  return value === 'TIRED' || value === 'BALANCED' || value === 'FRESH' ? value : null;
}

function mapGroup(value: unknown): MuscleGroupSets | null {
  const wire = obj(value);
  const group = text(wire['group']).toUpperCase();
  if (!group) {
    return null;
  }
  return {
    group,
    setsPerWeek: Math.max(0, zero(wire['setsPerWeek'])),
    sessions: num(wire['sessions']),
    exercises: list(wire['exercises'])
      .map((entry) => obj(entry))
      .filter((entry) => text(entry['name']) !== '')
      .map((entry) => ({ exerciseId: text(entry['exerciseId']), name: text(entry['name']), sets: zero(entry['sets']) }))
  };
}

function points(value: unknown): E1rmPoint[] {
  return list(value)
    .map((entry) => obj(entry))
    .filter((entry) => isDate(entry['date']) && num(entry['value']) !== null)
    .map((entry) => ({ date: day(entry['date']), value: zero(entry['value']), isRecord: bool(entry['isRecord']) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function bestSet(value: unknown): BestSet | null {
  const wire = obj(value);
  const weightKg = num(wire['weightKg']);
  const reps = num(wire['reps']);
  return weightKg !== null && reps !== null ? { weightKg, reps, date: day(wire['date']) } : null;
}

const LEVEL_CODES: StrengthLevel[] = ['BEGINNER', 'NOVICE', 'INTERMEDIATE', 'ADVANCED'];

function level(value: unknown): StrengthLevel | null {
  return LEVEL_CODES.includes(value as StrengthLevel) ? (value as StrengthLevel) : null;
}

function relative(value: unknown): RelativeStrength | null {
  const wire = obj(value);
  const ratio = num(wire['ratio']);
  const current = level(wire['level']);
  if (ratio === null || ratio <= 0 || current === null) {
    return null;
  }
  return { ratio, level: current, nextLevel: level(wire['nextLevel']), nextAtKg: num(wire['nextAtKg']) };
}

function mapLift(value: unknown): Lift | null {
  const wire = obj(value);
  const name = text(wire['name']);
  if (!name) {
    return null;
  }
  const weight = num(wire['bodyWeightKg']);
  return {
    exerciseId: text(wire['exerciseId']),
    name,
    e1rm: points(wire['e1rm']),
    bestSet: bestSet(wire['bestSet']),
    changePct: num(wire['changePct']),
    relative: relative(wire['relative']),
    bodyWeightKg: weight !== null && weight >= 30 && weight <= 300 ? weight : null,
    bestBefore: num(wire['bestBefore'] ?? wire['previousBest'])
  };
}

function mapCalendarDay(value: unknown): CalendarDay | null {
  const wire = obj(value);
  if (!isDate(wire['date'])) {
    return null;
  }
  return { date: day(wire['date']), kind: kindOf(wire['kind']), minutes: zero(wire['minutes']), record: bool(wire['record']), sessionId: text(wire['sessionId']) || null };
}

function mapRecord(value: unknown): RecordEntry | null {
  const wire = obj(value);
  const amount = num(wire['value']);
  if (!isDate(wire['date']) || amount === null || !text(wire['name'])) {
    return null;
  }
  return {
    date: day(wire['date']),
    exerciseId: text(wire['exerciseId']),
    name: text(wire['name']),
    value: amount,
    unit: text(wire['unit'], 'kg'),
    delta: num(wire['delta'])
  };
}

const present = <T>(value: T | null): value is T => value !== null;

function period(value: unknown): { from: string; to: string } | null {
  const wire = obj(value);
  return isDate(wire['from']) && isDate(wire['to']) ? { from: day(wire['from']), to: day(wire['to']) } : null;
}

export function mapTrainingProgress(value: unknown, from: string, to: string): TrainingProgress {
  const wire = obj(value);
  const hero = obj(wire['hero']);
  const load = obj(wire['load']);
  const muscles = obj(wire['muscles']);
  const range = obj(muscles['usualRange']);
  const records = obj(hero['records']);
  const loadFigure = compared(hero['load']);
  return {
    period: period(wire['period']) ?? { from, to },
    previous: period(wire['previous']),
    hero: {
      sessions: compared(hero['sessions']),
      minutes: compared(hero['minutes']),
      load: { ...loadFigure, estimatedShare: num(obj(hero['load'])['estimatedShare']) },
      records: { value: num(records['value']), exercises: list(records['exercises']).filter((name): name is string => typeof name === 'string') }
    },
    highlights: list(wire['highlights']).map(mapHighlight).filter(present).slice(0, 4),
    activities: list(wire['activities']).map(mapActivity).filter(present),
    load: {
      weeks: list(load['weeks']).map(mapLoadWeek).filter(present),
      fitness: weekValues(load['fitness']),
      fatigue: weekValues(load['fatigue']),
      form: form(load['form'])
    },
    muscles: {
      weeksCounted: zero(muscles['weeksCounted']),
      groups: list(muscles['groups']).map(mapGroup).filter(present),
      usualRange: { low: num(range['low']) ?? 10, high: num(range['high']) ?? 20 }
    },
    lifts: list(wire['lifts']).map(mapLift).filter(present).slice(0, 4),
    calendar: list(wire['calendar']).map(mapCalendarDay).filter(present),
    records: list(wire['records']).map(mapRecord).filter(present).sort((a, b) => b.date.localeCompare(a.date))
  };
}

// ---------------------------------------------------------------- one activity

function mapSession(value: unknown): ActivitySession | null {
  const wire = obj(value);
  const sessionId = text(wire['sessionId']);
  if (!sessionId) {
    return null;
  }
  return {
    sessionId,
    startedAt: text(wire['startedAt']),
    minutes: zero(wire['minutes']),
    effort: num(wire['effort']),
    estimatedEffort: bool(wire['estimatedEffort']),
    calories: num(wire['calories']),
    distanceKm: num(wire['distanceKm']),
    paceSecPerKm: num(wire['paceSecPerKm'])
  };
}

export function mapActivityProgress(value: unknown, key: string): ActivityProgress {
  const wire = obj(value);
  const tiles = obj(wire['tiles']);
  const longest = obj(tiles['longestSession']);
  const usual = obj(tiles['usualTime']);
  const effort = obj(tiles['effort']);
  const longestMinutes = num(longest['minutes']);
  const weekday = num(usual['weekday']);
  const hour = num(usual['hour']);
  return {
    key: text(wire['key'], key),
    name: text(wire['name'], key.split(':').pop() ?? key),
    kind: kindOf(wire['kind'] ?? key),
    tiles: {
      minutes: num(tiles['minutes']),
      sessions: num(tiles['sessions']),
      weeksInARow: num(tiles['weeksInARow']),
      longestSession: longestMinutes !== null ? { minutes: longestMinutes, date: day(longest['date']) } : null,
      usualTime: weekday !== null && hour !== null ? { weekday, hour } : null,
      effort: { average: num(effort['average']), first: num(effort['first']), last: num(effort['last']) }
    },
    weekly: list(wire['weekly'])
      .map((entry) => obj(entry))
      .filter((entry) => isDate(entry['weekStart']))
      .map((entry) => ({ weekStart: day(entry['weekStart']), minutes: zero(entry['minutes']), sessions: zero(entry['sessions']), current: bool(entry['current']) })),
    sessions: list(wire['sessions']).map(mapSession).filter(present),
    whenGrid: list(wire['whenGrid'])
      .map((entry) => obj(entry))
      .map((entry) => ({ weekday: num(entry['weekday']), hour: num(entry['hour']), count: zero(entry['count']) }))
      .filter((entry): entry is { weekday: number; hour: number; count: number } => entry.weekday !== null && entry.hour !== null),
    summary: mapSummary(wire['summary']),
    context: text(wire['context'])
  };
}

// ---------------------------------------------------------------- one exercise

const SERIES_KEYS: ExerciseSeriesKey[] = ['e1rm', 'heaviest', 'volume', 'reps'];

export function mapExerciseProgress(value: unknown, exerciseId: string): ExerciseProgress {
  const wire = obj(value);
  const tiles = obj(wire['tiles']);
  const e1rmTile = obj(tiles['e1rm']);
  const volume = obj(tiles['bestVolume']);
  const e1rmValue = num(e1rmTile['value']);
  const volumeKg = num(volume['kg']);
  const series = obj(wire['series']);
  return {
    exerciseId: text(wire['exerciseId'], exerciseId),
    name: text(wire['name'], 'Exercise'),
    primaryGroup: text(wire['primaryGroup']) || null,
    secondaryGroups: list(wire['secondaryGroups']).filter((group): group is string => typeof group === 'string'),
    equipment: text(wire['equipment']) || null,
    firstSeen: day(wire['firstSeen']) || null,
    sessions: num(wire['sessions']),
    tiles: {
      e1rm: e1rmValue !== null ? { value: e1rmValue, changeKg: num(e1rmTile['changeKg']), since: day(e1rmTile['since']) || null } : null,
      heaviestSet: bestSet(tiles['heaviestSet']),
      bestVolume: volumeKg !== null ? { kg: volumeKg, date: day(volume['date']) } : null,
      records: num(tiles['records'])
    },
    series: Object.fromEntries(SERIES_KEYS.map((key) => [key, points(series[key])])) as Record<ExerciseSeriesKey, E1rmPoint[]>,
    history: list(wire['history'])
      .map((entry) => obj(entry))
      .filter((entry) => isDate(entry['date']))
      .map((entry) => ({
        sessionId: text(entry['sessionId']),
        date: day(entry['date']),
        record: bool(entry['record']),
        sets: list(entry['sets'])
          .map((set) => obj(set))
          .map((set) => ({ weightKg: num(set['weightKg']), reps: num(set['reps']) }))
          .filter((set): set is { weightKg: number; reps: number } => set.weightKg !== null && set.reps !== null)
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    summary: mapSummary(wire['summary'])
  };
}
