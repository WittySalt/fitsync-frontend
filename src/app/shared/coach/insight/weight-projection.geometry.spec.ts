import { ProgressInsight } from '../../../core/fitsync.models';
import { WEIGHT_PLOT_LEFT, WEIGHT_PLOT_RIGHT, dateLabel, weightProjection } from './weight-projection.geometry';

const insight: ProgressInsight = {
  referenceDate: '2026-10-01',
  weightKg: 71.1,
  measuredOn: '2026-10-01',
  weeklyRateKg: -0.4,
  goalWeightKg: 68,
  goalDate: '2026-11-25',
  projectedDate: '2026-10-25',
  series: [
    { date: '2026-09-13', weightKg: 72.5 },
    { date: '2026-09-20', weightKg: 72 },
    { date: '2026-10-01', weightKg: 71.1 }
  ]
};

function points(line: string): { x: number; y: number }[] {
  return line.split(' ').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
  });
}

describe('weight projection geometry', () => {
  it('draws the series from the left edge, later dates further right and lower weights lower', () => {
    const drawn = points(weightProjection(insight)!.line);
    expect(drawn.length).toBe(3);
    expect(drawn[0].x).toBe(WEIGHT_PLOT_LEFT);
    expect(drawn[1].x).toBeGreaterThan(drawn[0].x);
    expect(drawn[2].x).toBeGreaterThan(drawn[1].x);
    expect(drawn[2].y).toBeGreaterThan(drawn[0].y);
  });

  it('puts the dot and the value on the latest point', () => {
    const chart = weightProjection(insight)!;
    const last = points(chart.line)[2];
    expect(chart.latest.x).toBe(last.x);
    expect(chart.latest.y).toBe(last.y);
    expect(chart.latest.text).toBe('71.1 kg');
    expect(chart.latest.anchor).toBe('start');
  });

  it('pads the data and the goal by half a kilogram', () => {
    const chart = weightProjection(insight)!;
    const drawn = points(chart.line);
    // The range is 67.5 to 73 over 22 to 94, so the goal of 68 sits 0.5 kg above the floor.
    expect(chart.goal!.y).toBe(87.5);
    expect(drawn[0].y).toBe(28.5);
  });

  it('draws the goal as a level line with its label', () => {
    const chart = weightProjection(insight)!;
    expect(chart.goal!.text).toBe('Goal 68 kg');
    expect(chart.goal!.labelY).toBeLessThan(chart.goal!.y);
  });

  it('continues from the latest point to the goal at the projected date', () => {
    const chart = weightProjection(insight)!;
    expect(chart.projection).toEqual({
      x1: chart.latest.x,
      y1: chart.latest.y,
      x2: WEIGHT_PLOT_RIGHT,
      y2: chart.goal!.y,
      arrow: null,
      reachesGoal: true
    });
  });

  it('labels only the first date, the latest date and the projected date', () => {
    const chart = weightProjection(insight)!;
    expect(chart.axisLabels.map((label) => label.text)).toEqual(['13 Sept', '1 Oct', '25 Oct']);
    expect(chart.axisLabels[2].x).toBe(WEIGHT_PLOT_RIGHT);
  });

  it('runs a projection more than 180 days away to the right edge with an arrow head', () => {
    const far = weightProjection({ ...insight, projectedDate: '2027-06-01' })!;
    expect(far.projection!.x2).toBe(WEIGHT_PLOT_RIGHT);
    expect(far.projection!.reachesGoal).toBeFalse();
    expect(far.projection!.arrow).toMatch(/^M [\d.]+ [\d.]+ L 512 [\d.]+ L [\d.]+ [\d.]+$/);
    // The line points at the goal but stops short of the goal line.
    expect(far.projection!.y2).toBeGreaterThan(far.latest.y);
    expect(far.projection!.y2).toBeLessThan(far.goal!.y);
    expect(far.axisLabels.map((label) => label.text)).toContain('1 Jun 2027');
  });

  it('reaches the goal line when the projection is exactly 180 days away', () => {
    const edge = weightProjection({ ...insight, projectedDate: '2027-03-30' })!;
    expect(edge.projection!.reachesGoal).toBeTrue();
    expect(edge.projection!.arrow).toBeNull();
  });

  it('draws no continuation without a goal or a projected date, or when the date is not ahead', () => {
    expect(weightProjection({ ...insight, projectedDate: null })!.projection).toBeNull();
    expect(weightProjection({ ...insight, goalWeightKg: null })!.projection).toBeNull();
    expect(weightProjection({ ...insight, projectedDate: '2026-10-01' })!.projection).toBeNull();
    expect(weightProjection({ ...insight, projectedDate: 'soon' })!.projection).toBeNull();
  });

  it('draws the series alone, ending at the right edge, when there is nothing to continue', () => {
    const chart = weightProjection({ ...insight, goalWeightKg: null, projectedDate: null })!;
    expect(chart.goal).toBeNull();
    expect(chart.latest.x).toBe(WEIGHT_PLOT_RIGHT);
    expect(chart.latest.anchor).toBe('end');
    expect(chart.axisLabels.map((label) => label.text)).toEqual(['13 Sept', '1 Oct']);
  });

  it('draws nothing with fewer than two weights', () => {
    expect(weightProjection({ ...insight, series: [] })).toBeNull();
    expect(weightProjection({ ...insight, series: [{ date: '2026-10-01', weightKg: 71.1 }] })).toBeNull();
    expect(
      weightProjection({ ...insight, series: [{ date: 'yesterday', weightKg: 72 }, { date: '2026-10-01', weightKg: 71 }] })
    ).toBeNull();
  });

  it('keeps a goal below the data under the line and a goal above the data over it', () => {
    const below = weightProjection(insight)!;
    expect(below.goal!.y).toBeGreaterThan(Math.max(...points(below.line).map((point) => point.y)));

    const above = weightProjection({ ...insight, goalWeightKg: 75 })!;
    expect(above.goal!.y).toBeLessThan(Math.min(...points(above.line).map((point) => point.y)));
    expect(above.goal!.labelY).toBeGreaterThan(0);
  });

  it('sorts a series that arrives out of order', () => {
    const chart = weightProjection({ ...insight, series: [...insight.series].reverse() })!;
    expect(points(chart.line)[0].x).toBe(WEIGHT_PLOT_LEFT);
    expect(chart.latest.text).toBe('71.1 kg');
  });

  it('adds the year to a date whose year differs from the reference date', () => {
    const chart = weightProjection({ ...insight, referenceDate: '2026-12-20', series: [{ date: '2026-12-01', weightKg: 72 }, { date: '2026-12-20', weightKg: 71 }], projectedDate: '2027-01-10' })!;
    expect(chart.axisLabels.map((label) => label.text)).toEqual(['1 Dec', '20 Dec', '10 Jan 2027']);
  });

  it('takes the latest weight as the reference when the reference date is missing', () => {
    expect(dateLabel('2026-10-01', '2026')).toBe('1 Oct');
    expect(dateLabel('2027-01-10', '2026')).toBe('10 Jan 2027');
    expect(dateLabel('nonsense', '2026')).toBe('');
    const chart = weightProjection({ ...insight, referenceDate: null })!;
    expect(chart.axisLabels.map((label) => label.text)).toEqual(['13 Sept', '1 Oct', '25 Oct']);
  });

  it('leaves out a date label that would print on top of a more important one', () => {
    const crowded = weightProjection({
      ...insight,
      series: [{ date: '2026-09-30', weightKg: 71.5 }, { date: '2026-10-01', weightKg: 71.1 }],
      projectedDate: '2027-06-01'
    })!;
    // The two weights are a day apart on a range of a month, so the first date would sit under the latest.
    expect(crowded.axisLabels.map((label) => label.text)).toEqual(['1 Oct', '1 Jun 2027']);
  });

  it('states the latest weight, the goal and the projected date in the text alternative', () => {
    const chart = weightProjection(insight)!;
    expect(chart.description).toBe('Latest weight 71.1 kg on 1 Oct. Goal 68 kg. At this pace the goal is reached around 25 Oct.');
    expect(chart.summary).toEqual([
      { label: 'Latest weight', value: '71.1 kg' },
      { label: 'Goal', value: '68 kg' },
      { label: 'Projected', value: '25 Oct' }
    ]);
  });

  it('leaves the goal and the date out of the text alternative when there are none', () => {
    const chart = weightProjection({ ...insight, goalWeightKg: null, projectedDate: null })!;
    expect(chart.description).toBe('Latest weight 71.1 kg on 1 Oct.');
    expect(chart.summary.length).toBe(1);
  });
});
