import { WHEEL_HEIGHT, WHEEL_LEVELS, WHEEL_WIDTH, cellPath, pointAt, wheelOffset, wheelShapes } from './muscle-wheel.geometry';

function sectors(count: number, sessions = 2, trainedYesterday = false) {
  return Array.from({ length: count }, (_, index) => ({ id: index, sessions, trainedYesterday }));
}

describe('muscle wheel geometry', () => {
  it('measures angles clockwise from twelve o\'clock', () => {
    expect(pointAt(100, 0)).toEqual({ x: 186, y: 56 });
    expect(pointAt(100, 90)).toEqual({ x: 286, y: 156 });
    expect(pointAt(100, 180)).toEqual({ x: 186, y: 256 });
    expect(pointAt(100, 270)).toEqual({ x: 86, y: 156 });
  });

  it('turns an even number of sectors by half a sector and leaves an odd number alone', () => {
    expect(wheelOffset(1)).toBe(0);
    expect(wheelOffset(2)).toBe(90);
    expect(wheelOffset(3)).toBe(0);
    expect(wheelOffset(4)).toBe(45);
    expect(wheelOffset(5)).toBe(0);
    expect(wheelOffset(6)).toBe(30);
  });

  it('returns nothing for an empty wheel', () => {
    expect(wheelShapes([])).toEqual([]);
  });

  it('draws five rings for every sector', () => {
    const shapes = wheelShapes(sectors(5));
    expect(shapes.length).toBe(5);
    shapes.forEach((shape) => expect(shape.cells.length).toBe(WHEEL_LEVELS));
  });

  it('fills one ring for each session, from the centre outwards', () => {
    const [shape] = wheelShapes([{ sessions: 2, trainedYesterday: false }]);
    expect(shape.cells.map((cell) => cell.state)).toEqual(['trained', 'trained', 'open', 'open', 'open']);
  });

  it('marks only the newest ring when the group was trained yesterday', () => {
    const [shape] = wheelShapes([{ sessions: 4, trainedYesterday: true }]);
    expect(shape.cells.map((cell) => cell.state)).toEqual(['trained', 'trained', 'trained', 'yesterday', 'open']);
  });

  it('stops at five rings when there were more sessions', () => {
    const [shape] = wheelShapes([{ sessions: 8, trainedYesterday: true }]);
    expect(shape.cells.map((cell) => cell.state)).toEqual(['trained', 'trained', 'trained', 'trained', 'yesterday']);
  });

  it('treats a negative or fractional count as whole sessions that happened', () => {
    expect(wheelShapes([{ sessions: -1, trainedYesterday: true }])[0].cells.every((cell) => cell.state === 'open')).toBeTrue();
    expect(wheelShapes([{ sessions: 1.9, trainedYesterday: false }])[0].cells.filter((cell) => cell.state === 'trained').length).toBe(1);
  });

  it('uses the long way round for a sector wider than a half turn', () => {
    expect(cellPath(-177, 177, 38, 50)).toContain(' 0 1 1 ');
    expect(cellPath(-33, 33, 38, 50)).toContain(' 0 0 1 ');
  });

  it('keeps every badge and label inside the drawing for one to seven sectors', () => {
    for (let count = 1; count <= 7; count += 1) {
      wheelShapes(sectors(count)).forEach((shape) => {
        expect(shape.badge.x - shape.badge.radius).withContext(`badge left, ${count} sectors`).toBeGreaterThanOrEqual(0);
        expect(shape.badge.x + shape.badge.radius).withContext(`badge right, ${count} sectors`).toBeLessThanOrEqual(WHEEL_WIDTH);
        expect(shape.badge.y - shape.badge.radius).withContext(`badge top, ${count} sectors`).toBeGreaterThanOrEqual(0);
        expect(shape.badge.y + shape.badge.radius).withContext(`badge bottom, ${count} sectors`).toBeLessThanOrEqual(WHEEL_HEIGHT);
        // The name sits on the label's baseline and the count one line of 15 below it.
        expect(shape.label.y - 12).withContext(`label top, ${count} sectors`).toBeGreaterThanOrEqual(0);
        expect(shape.label.y + 15 + 4).withContext(`label bottom, ${count} sectors`).toBeLessThanOrEqual(WHEEL_HEIGHT);
        expect(shape.label.x).toBeGreaterThanOrEqual(0);
        expect(shape.label.x).toBeLessThanOrEqual(WHEEL_WIDTH);
      });
    }
  });

  it('never puts a badge at six o\'clock, where it would fall below the drawing', () => {
    for (let count = 2; count <= 7; count += 1) {
      wheelShapes(sectors(count)).forEach((shape) => expect(shape.centreAngle % 360).not.toBe(180));
    }
  });

  it('hangs side labels on the edge of the drawing', () => {
    const shapes = wheelShapes(sectors(4));
    expect(shapes[0].label).toEqual(jasmine.objectContaining({ x: WHEEL_WIDTH - 2, anchor: 'end' }));
    expect(shapes[3].label).toEqual(jasmine.objectContaining({ x: 2, anchor: 'start' }));
  });

  it('puts a side label under a badge in the upper half and over one in the lower half', () => {
    const shapes = wheelShapes(sectors(4));
    expect(shapes[0].label.y).toBeGreaterThan(shapes[0].badge.y);
    expect(shapes[1].label.y).toBeLessThan(shapes[1].badge.y);
  });
});
