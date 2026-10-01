import { MonthMuscleInsight } from '../../../../core/fitsync.models';
import { RADAR_HEIGHT, RADAR_WIDTH, buildMuscleChart, describeMuscles, radarScale, RadarGeometry, BarsGeometry } from './month-radar';

const group = (code: string, label: string, sessions: number): MonthMuscleInsight => ({ group: code, label, sessions });

const SEPTEMBER = [group('CHEST', 'Chest', 8), group('BACK', 'Back', 8), group('CORE', 'Core', 13), group('LEGS', 'Legs', 8), group('CARDIO', 'Cardio', 5)];

describe('month radar', () => {
  it('rounds the scale up to an even number, and never below two', () => {
    expect(radarScale([13, 8, 5])).toBe(14);
    expect(radarScale([8])).toBe(8);
    expect(radarScale([1])).toBe(2);
    expect(radarScale([])).toBe(2);
  });

  it('gives one axis to each group that was trained, in the fixed order', () => {
    const chart = buildMuscleChart(SEPTEMBER) as RadarGeometry;
    expect(chart.mode).toBe('radar');
    expect(chart.labels.map((label) => label.group)).toEqual(['CHEST', 'CORE', 'LEGS', 'BACK', 'CARDIO']);
    expect(chart.labels.map((label) => label.count)).toEqual([8, 13, 8, 8, 5]);
    expect(chart.axes.length).toBe(5);
    expect(chart.dots.length).toBe(5);
    expect(chart.rings.length).toBe(4);
    expect(chart.max).toBe(14);
  });

  it('orders all nine groups and drops those with no session', () => {
    const all = [
      group('FULL_BODY', 'Full body', 1),
      group('CARDIO', 'Cardio', 1),
      group('BACK', 'Back', 1),
      group('GLUTES', 'Glutes', 1),
      group('LEGS', 'Legs', 1),
      group('CORE', 'Core', 1),
      group('ARMS', 'Arms', 1),
      group('SHOULDERS', 'Shoulders', 1),
      group('CHEST', 'Chest', 1),
      group('NECK', 'Neck', 0)
    ];
    const chart = buildMuscleChart(all) as RadarGeometry;
    expect(chart.labels.map((label) => label.group)).toEqual(['CHEST', 'SHOULDERS', 'ARMS', 'CORE', 'LEGS', 'GLUTES', 'BACK', 'CARDIO', 'FULL_BODY']);
  });

  it('puts the first axis straight up and the rest clockwise, with the largest count on the outer ring', () => {
    const chart = buildMuscleChart([group('CHEST', 'Chest', 4), group('CORE', 'Core', 2), group('LEGS', 'Legs', 2)]) as RadarGeometry;
    expect(chart.axes[0].x2).toBeCloseTo(RADAR_WIDTH / 2, 1);
    expect(chart.axes[0].y2).toBeLessThan(chart.axes[0].y1);
    // The second axis lies to the right of the first, the third to the left of the centre line.
    expect(chart.axes[1].x2).toBeGreaterThan(RADAR_WIDTH / 2);
    expect(chart.axes[2].x2).toBeLessThan(RADAR_WIDTH / 2);
    // Four sessions on a scale of four reach the end of the axis.
    expect(chart.dots[0].y).toBeCloseTo(chart.axes[0].y2, 1);
    expect(chart.labels[0].anchor).toBe('middle');
    expect(chart.labels[1].anchor).toBe('start');
    expect(chart.labels[2].anchor).toBe('end');
  });

  it('keeps every label and dot inside the drawing', () => {
    const all = ['CHEST', 'SHOULDERS', 'ARMS', 'CORE', 'LEGS', 'GLUTES', 'BACK', 'CARDIO', 'FULL_BODY'].map((code, index) => group(code, code, index + 1));
    for (let count = 3; count <= all.length; count += 1) {
      const chart = buildMuscleChart(all.slice(0, count)) as RadarGeometry;
      for (const point of [...chart.dots, ...chart.labels]) {
        expect(point.x).toBeGreaterThan(0);
        expect(point.x).toBeLessThan(RADAR_WIDTH);
        expect(point.y).toBeGreaterThan(0);
        expect(point.y).toBeLessThan(RADAR_HEIGHT);
      }
    }
  });

  it('draws bars for fewer than three groups', () => {
    const chart = buildMuscleChart([group('BACK', 'Back', 6), group('CHEST', 'Chest', 3)]) as BarsGeometry;
    expect(chart.mode).toBe('bars');
    expect(chart.rows.map((row) => row.group)).toEqual(['CHEST', 'BACK']);
    expect(chart.rows[1].barWidth).toBeGreaterThan(chart.rows[0].barWidth);
    expect(chart.rows[0].barWidth / chart.rows[1].barWidth).toBeCloseTo(0.5, 1);
  });

  it('draws nothing when no group was trained', () => {
    expect(buildMuscleChart([])).toBeNull();
    expect(buildMuscleChart([group('CHEST', 'Chest', 0)])).toBeNull();
  });

  it('describes the chart in words', () => {
    expect(describeMuscles(SEPTEMBER)).toBe('Sessions by muscle group: Chest 8, Back 8, Core 13, Legs 8, Cardio 5');
  });
});
