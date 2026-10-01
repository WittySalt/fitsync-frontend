import { DayInsight, DayKind, WeeklyTrainingInsight, WorkoutSession } from '../../core/fitsync.models';

/** One day of the week card: what it was or will be, and how it is drawn. */
export interface WeekTile {
  date: string;
  weekday: string;
  /** done: trained that day. today: today, not trained yet. planned: a later day with a kind. none: nothing. */
  state: 'done' | 'today' | 'planned' | 'none';
  kind: DayKind | null;
  caption: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TRAINING: readonly DayKind[] = ['STRENGTH', 'CARDIO', 'MOBILITY', 'SPORT'];

function trainingKind(kind: DayKind | string | null | undefined): DayKind | null {
  return kind && TRAINING.includes(kind as DayKind) ? (kind as DayKind) : null;
}

/** The seven days of the insight's week, Monday first, as tiles. Nothing when the insight has no days. */
export function weekTiles(insight: WeeklyTrainingInsight | null): WeekTile[] {
  const days = insight?.days ?? [];
  const today = insight?.today?.date ?? insight?.referenceDate ?? '';
  return [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day: DayInsight, index) => {
      const weekday = WEEKDAYS[(day.dayOfWeek ? day.dayOfWeek - 1 : index) % 7];
      const sessionKind = trainingKind(day.sessions[0]?.kind);
      if (day.sessions.length > 0 || day.source === 'DONE') {
        return {
          date: day.date,
          weekday,
          state: 'done',
          kind: sessionKind ?? trainingKind(day.kind) ?? 'STRENGTH',
          caption: day.minutes ? `${day.minutes} min` : ''
        };
      }
      if (day.date === today) {
        return { date: day.date, weekday, state: 'today', kind: day.kind ?? 'OPEN', caption: 'Today' };
      }
      const plannedKind = trainingKind(day.planned?.kind) ?? (day.date > today ? trainingKind(day.kind) : null);
      if (plannedKind && day.date > today) {
        return { date: day.date, weekday, state: 'planned', kind: plannedKind, caption: '' };
      }
      return { date: day.date, weekday, state: 'none', kind: null, caption: '' };
    });
}

/**
 * "3 of 5": the days trained this week, of the days that were trained or still have a kind ahead
 * (today included when it is a training day). A week with nothing ahead gives the days trained alone.
 */
export function weekCount(insight: WeeklyTrainingInsight | null): string {
  const tiles = weekTiles(insight);
  const done = tiles.filter((tile) => tile.state === 'done').length;
  const ahead = tiles.filter((tile) => tile.state === 'planned' || (tile.state === 'today' && trainingKind(tile.kind))).length;
  if (!tiles.length) {
    return String(insight?.completedSessions ?? 0);
  }
  return ahead > 0 ? `${done} of ${done + ahead}` : String(done);
}

const KIND_LABELS: Record<string, string> = { STRENGTH: 'Strength', CARDIO: 'Cardio', MOBILITY: 'Mobility', SPORT: 'Sport' };

/** "Cardio · Treadmill", or the name alone when it already says the kind. */
export function lastTitle(session: WorkoutSession): string {
  const kind = KIND_LABELS[(session.kind ?? '').toUpperCase()] ?? '';
  // A name such as "Cardio — Treadmill" already starts with the kind; it takes the same dot.
  const name = (session.sportLabel || session.name || '').replace(/\s+[—–-]\s+/g, ' · ');
  const lower = name.toLowerCase();
  if (!kind || lower === kind.toLowerCase() || lower.startsWith(`${kind.toLowerCase()} ·`)) {
    return name || kind;
  }
  return `${kind} · ${name}`;
}

/** "Tue 29 Sept · 35 min". */
export function lastLine(session: WorkoutSession): string {
  const start = new Date(session.completedAt || session.startedAt);
  const day = Number.isNaN(start.getTime())
    ? ''
    : start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const minutes = session.durationMinutes ? `${session.durationMinutes} min` : '';
  return [day, minutes].filter(Boolean).join(' · ');
}

/** "28 Sept to 4 Oct". */
export function weekRangeLabel(insight: WeeklyTrainingInsight | null): string {
  if (!insight?.weekStart || !insight.weekEnd) {
    return '';
  }
  const format = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${format(insight.weekStart)} to ${format(insight.weekEnd)}`;
}
