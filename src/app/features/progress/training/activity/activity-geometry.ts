import { ActivitySession } from '../training.models';
import { GridLine, Pt, TextMark } from '../parts/chart-geometry';
import { shortDate } from '../training-format';

const r1 = (value: number): number => Math.round(value * 10) / 10;

function niceTop(max: number, step: number): number {
  return Math.max(step, Math.ceil(max / step) * step);
}

export interface SessionColumn {
  bar: { x: number; y: number; width: number; height: number };
  minutes: TextMark;
  date: TextMark;
  effort: (Pt & { text: string; estimated: boolean }) | null;
}

export interface SessionChart {
  width: number;
  height: number;
  x0: number;
  grid: GridLine[];
  columns: SessionColumn[];
  effortLine: string;
}

/** Minutes as bars on the lower axis and effort as a line in its own band above, every value written (board 17c). */
export function sessionChart(sessions: readonly ActivitySession[], width = 520, height = 200): SessionChart | null {
  const rows = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).slice(-10);
  if (!rows.length) {
    return null;
  }
  const x0 = 40;
  const slot = (width - x0) / rows.length;
  const bandTop = 18;
  const bandBottom = 58;
  const barTop = 72;
  const barBottom = height - 20;
  const efforts = rows.map((row) => row.effort).filter((value): value is number => value !== null);
  const lowEffort = Math.max(0, Math.min(4, ...efforts) - 0);
  const highEffort = Math.min(10, Math.max(lowEffort + 5, ...efforts));
  const top = niceTop(Math.max(...rows.map((row) => row.minutes)), 30);
  const ey = (effort: number): number => bandBottom - ((bandBottom - bandTop) * (effort - lowEffort)) / (highEffort - lowEffort || 1);
  const my = (minutes: number): number => barBottom - ((barBottom - barTop) * minutes) / top;
  const grid = [0, top / 3, (top * 2) / 3, top].map((value, index, all) => ({ y: r1(my(value)), label: index === all.length - 1 ? `${Math.round(value)} min` : String(Math.round(value)) }));
  const columns = rows.map((row, index) => {
    const cx = x0 + slot * index + slot / 2;
    const barWidth = Math.min(34, slot * 0.56);
    return {
      bar: { x: r1(cx - barWidth / 2), y: r1(my(row.minutes)), width: r1(barWidth), height: r1(my(0) - my(row.minutes)) },
      minutes: { x: r1(cx), y: r1(my(row.minutes) + 14), text: String(Math.round(row.minutes)), anchor: 'middle' as const },
      date: { x: r1(cx), y: height - 4, text: shortDate(row.startedAt.slice(0, 10)), anchor: 'middle' as const },
      effort: row.effort === null ? null : { x: r1(cx), y: r1(ey(row.effort)), text: String(Math.round(row.effort)), estimated: row.estimatedEffort }
    };
  });
  const effortLine = columns
    .map((column) => column.effort)
    .filter((point): point is Pt & { text: string; estimated: boolean } => point !== null)
    .map((point) => `${point.x},${point.y}`)
    .join(' ');
  return { width, height, x0, grid, columns, effortLine };
}

/** The when-you-train grid: weekdays by five start hours, a cell darker with more sessions. */
export const GRID_HOURS = [9, 12, 15, 18, 21];

export function whenCells(entries: readonly { weekday: number; hour: number; count: number }[]): number[][] {
  const cells = Array.from({ length: 7 }, () => GRID_HOURS.map(() => 0));
  // The backend counts weekdays as Java does, Monday 1 to Sunday 7; a list holding a 0 counts from Monday 0.
  const shift = entries.some((entry) => entry.weekday === 0) ? 0 : 1;
  for (const raw of entries) {
    const entry = { ...raw, weekday: raw.weekday - shift };
    if (entry.weekday < 0 || entry.weekday > 6) {
      continue;
    }
    let nearest = 0;
    GRID_HOURS.forEach((hour, index) => {
      if (Math.abs(hour - entry.hour) < Math.abs(GRID_HOURS[nearest] - entry.hour)) {
        nearest = index;
      }
    });
    cells[entry.weekday][nearest] += entry.count;
  }
  return cells;
}
