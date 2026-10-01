import { MonthMuscleInsight } from '../../../../core/fitsync.models';

/** The order of the axes, clockwise from the top. Only the groups the month trained get one. */
export const RADAR_ORDER = ['CHEST', 'SHOULDERS', 'ARMS', 'CORE', 'LEGS', 'GLUTES', 'BACK', 'CARDIO', 'FULL_BODY'];

/** A radar needs three axes; with fewer groups the chart is drawn as bars. */
export const RADAR_MIN_AXES = 3;

export const RADAR_WIDTH = 320;
export const RADAR_HEIGHT = 176;
const CENTRE_X = RADAR_WIDTH / 2;
const CENTRE_Y = 88;
const RADIUS = 56;
const LABEL_GAP = 12;
const RINGS = 4;

export interface RadarLabel {
  group: string;
  label: string;
  count: number;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

export interface RadarGeometry {
  mode: 'radar';
  width: number;
  height: number;
  max: number;
  /** The grid rings from the inside out, as polygon points. */
  rings: string[];
  axes: { x1: number; y1: number; x2: number; y2: number }[];
  shape: string;
  dots: { x: number; y: number }[];
  labels: RadarLabel[];
}

export interface BarsGeometry {
  mode: 'bars';
  width: number;
  height: number;
  max: number;
  rows: { group: string; label: string; count: number; y: number; barWidth: number; labelY: number }[];
  barX: number;
  barHeight: number;
}

export type MuscleChart = RadarGeometry | BarsGeometry;

/** The largest count, rounded up to an even number so the rings fall on whole sessions. */
export function radarScale(counts: readonly number[]): number {
  const largest = Math.max(0, ...counts);
  return Math.max(2, largest + (largest % 2));
}

function ordered(muscles: readonly MonthMuscleInsight[]): MonthMuscleInsight[] {
  const trained = muscles.filter((muscle) => muscle.sessions > 0);
  const rank = (group: string): number => {
    const index = RADAR_ORDER.indexOf(group);
    return index === -1 ? RADAR_ORDER.length : index;
  };
  return trained.map((muscle, index) => ({ muscle, index })).sort((a, b) => rank(a.muscle.group) - rank(b.muscle.group) || a.index - b.index).map((entry) => entry.muscle);
}

const round = (value: number): number => Math.round(value * 10) / 10;

function point(angle: number, distance: number): { x: number; y: number } {
  return { x: round(CENTRE_X + Math.sin(angle) * distance), y: round(CENTRE_Y - Math.cos(angle) * distance) };
}

function polygon(points: { x: number; y: number }[]): string {
  return points.map((entry) => `${entry.x},${entry.y}`).join(' ');
}

/** The drawing of the month's muscle groups, or null when no group was trained. */
export function buildMuscleChart(muscles: readonly MonthMuscleInsight[]): MuscleChart | null {
  const groups = ordered(muscles);
  if (groups.length === 0) {
    return null;
  }
  const max = radarScale(groups.map((group) => group.sessions));

  if (groups.length < RADAR_MIN_AXES) {
    const barX = 92;
    // The count sits after the end of the longest bar, so the bar leaves room for it.
    const full = RADAR_WIDTH - 36 - barX;
    return {
      mode: 'bars',
      width: RADAR_WIDTH,
      height: groups.length * 34,
      max,
      barX,
      barHeight: 14,
      rows: groups.map((group, index) => ({
        group: group.group,
        label: group.label,
        count: group.sessions,
        y: index * 34 + 10,
        labelY: index * 34 + 21,
        barWidth: round((group.sessions / max) * full)
      }))
    };
  }

  const angles = groups.map((_, index) => (index / groups.length) * Math.PI * 2);
  const rings = Array.from({ length: RINGS }, (_, ring) => polygon(angles.map((angle) => point(angle, (RADIUS * (ring + 1)) / RINGS))));
  const dots = groups.map((group, index) => point(angles[index], (group.sessions / max) * RADIUS));
  return {
    mode: 'radar',
    width: RADAR_WIDTH,
    height: RADAR_HEIGHT,
    max,
    rings,
    axes: angles.map((angle) => {
      const end = point(angle, RADIUS);
      return { x1: CENTRE_X, y1: CENTRE_Y, x2: end.x, y2: end.y };
    }),
    shape: polygon(dots),
    dots,
    labels: groups.map((group, index) => {
      const spot = point(angles[index], RADIUS + LABEL_GAP);
      const side = Math.sin(angles[index]);
      return {
        group: group.group,
        label: group.label,
        count: group.sessions,
        x: spot.x,
        // Labels above the centre sit on their anchor, those below hang under it.
        y: round(spot.y + (Math.cos(angles[index]) > 0.3 ? -1 : Math.cos(angles[index]) < -0.3 ? 9 : 4)),
        anchor: side > 0.3 ? 'start' : side < -0.3 ? 'end' : 'middle'
      };
    })
  };
}

/** The chart in words, for a screen reader. */
export function describeMuscles(muscles: readonly MonthMuscleInsight[]): string {
  const groups = muscles.filter((muscle) => muscle.sessions > 0);
  return `Sessions by muscle group: ${groups.map((group) => `${group.label} ${group.sessions}`).join(', ')}`;
}
