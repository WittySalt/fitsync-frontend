/**
 * Geometry for the muscle wheel, kept free of Angular so every number can be tested.
 *
 * The wheel is drawn on a fixed 372 by 300 grid, which is the inner width of the dark panel. Angles
 * are in degrees, measured clockwise from twelve o'clock.
 */

export const WHEEL_WIDTH = 372;
export const WHEEL_HEIGHT = 300;
export const WHEEL_LEVELS = 5;

const CENTRE_X = 186;
const CENTRE_Y = 156;
const INNER_RADIUS = 38;
const RING_THICKNESS = 12;
const RING_GAP = 3;
const OUTER_RADIUS = INNER_RADIUS + WHEEL_LEVELS * (RING_THICKNESS + RING_GAP) - RING_GAP;
const BADGE_RADIUS = 16;
const BADGE_DISTANCE = OUTER_RADIUS + 24;
const SECTOR_PADDING_DEGREES = 3;
const EDGE_INSET = 2;
const ICON_SCALE = 0.75;
const ICON_GRID = 24;

export type WheelCellState = 'trained' | 'yesterday' | 'open';

export interface WheelCell {
  path: string;
  state: WheelCellState;
}

export interface WheelLabel {
  x: number;
  y: number;
  anchor: 'start' | 'end';
}

export interface WheelSectorShape<T> {
  sector: T;
  centreAngle: number;
  cells: WheelCell[];
  badge: { x: number; y: number; radius: number };
  iconTransform: string;
  label: WheelLabel;
}

export interface WheelSectorInput {
  sessions: number;
  trainedYesterday: boolean;
}

export const WHEEL_CENTRE = { x: CENTRE_X, y: CENTRE_Y };

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function pointAt(radius: number, angle: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return { x: round(CENTRE_X + radius * Math.sin(radians)), y: round(CENTRE_Y - radius * Math.cos(radians)) };
}

export function cellPath(fromAngle: number, toAngle: number, innerRadius: number, outerRadius: number): string {
  const outerStart = pointAt(outerRadius, fromAngle);
  const outerEnd = pointAt(outerRadius, toAngle);
  const innerEnd = pointAt(innerRadius, toAngle);
  const innerStart = pointAt(innerRadius, fromAngle);
  // A single sector spans almost the whole circle, and an arc longer than a half turn needs the flag.
  const largeArc = toAngle - fromAngle > 180 ? 1 : 0;
  return (
    `M${outerStart.x} ${outerStart.y} A${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} ` +
    `L${innerEnd.x} ${innerEnd.y} A${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`
  );
}

/**
 * An even number of sectors is turned by half a sector. Without the turn one badge would sit at six
 * o'clock, where it falls below the drawing.
 */
export function wheelOffset(sectorCount: number): number {
  if (sectorCount <= 1) {
    return 0;
  }
  return sectorCount % 2 === 0 ? 180 / sectorCount : 0;
}

function isSideAngle(angle: number): boolean {
  return (angle >= 40 && angle <= 140) || (angle >= 220 && angle <= 320);
}

function labelFor(angle: number, badge: { x: number; y: number }): WheelLabel {
  const onRight = angle <= 180;
  if (isSideAngle(angle)) {
    // Side labels hang on the panel edge so that a long name cannot run into the rings. They sit
    // under a badge in the upper half and over a badge in the lower half, to stay inside the drawing.
    const upperHalf = badge.y <= CENTRE_Y;
    return {
      x: onRight ? WHEEL_WIDTH - EDGE_INSET : EDGE_INSET,
      y: round(upperHalf ? badge.y + BADGE_RADIUS + 16 : badge.y - BADGE_RADIUS - 23),
      anchor: onRight ? 'end' : 'start'
    };
  }
  return {
    x: round(onRight ? badge.x + BADGE_RADIUS + 8 : badge.x - BADGE_RADIUS - 8),
    y: round(badge.y - 2),
    anchor: onRight ? 'start' : 'end'
  };
}

export function wheelShapes<T extends WheelSectorInput>(sectors: T[]): WheelSectorShape<T>[] {
  if (!sectors.length) {
    return [];
  }
  const span = 360 / sectors.length;
  const offset = wheelOffset(sectors.length);

  return sectors.map((sector, index) => {
    const centreAngle = offset + index * span;
    const fromAngle = centreAngle - span / 2 + SECTOR_PADDING_DEGREES;
    const toAngle = centreAngle + span / 2 - SECTOR_PADDING_DEGREES;
    const filled = Math.min(Math.max(Math.trunc(sector.sessions), 0), WHEEL_LEVELS);

    const cells: WheelCell[] = [];
    for (let level = 0; level < WHEEL_LEVELS; level += 1) {
      const inner = INNER_RADIUS + level * (RING_THICKNESS + RING_GAP);
      let state: WheelCellState = 'open';
      if (level < filled) {
        state = sector.trainedYesterday && level === filled - 1 ? 'yesterday' : 'trained';
      }
      cells.push({ path: cellPath(fromAngle, toAngle, inner, inner + RING_THICKNESS), state });
    }

    const badgeCentre = pointAt(BADGE_DISTANCE, centreAngle);
    const iconHalf = (ICON_GRID * ICON_SCALE) / 2;
    return {
      sector,
      centreAngle,
      cells,
      badge: { ...badgeCentre, radius: BADGE_RADIUS },
      iconTransform: `translate(${round(badgeCentre.x - iconHalf)} ${round(badgeCentre.y - iconHalf)}) scale(${ICON_SCALE})`,
      label: labelFor(centreAngle, badgeCentre)
    };
  });
}
