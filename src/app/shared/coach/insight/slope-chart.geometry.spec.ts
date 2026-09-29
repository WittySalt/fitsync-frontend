import { LiftProgress } from '../../../core/coach/coach.models';
import { changeText, dateRange, formatKg, shortDate, shortName, slopeChart, spreadLabels } from './slope-chart.geometry';

const lifts: LiftProgress[] = [
  { exerciseName: 'Dumbbell Bench Press', fromKg: 20, fromDate: '2026-09-13', toKg: 22.5, toDate: '2026-09-25' },
  { exerciseName: 'Bent-Over Row', fromKg: 18, fromDate: '2026-09-13', toKg: 20, toDate: '2026-09-25' },
  { exerciseName: 'Goblet Squat', fromKg: 16, fromDate: '2026-09-13', toKg: 18, toDate: '2026-09-25' }
];

describe('slope chart geometry', () => {
  it('writes weights with at most one decimal and no trailing zero', () => {
    expect(formatKg(22.5)).toBe('22.5');
    expect(formatKg(20)).toBe('20');
    expect(formatKg(17.25)).toBe('17.3');
  });

  it('cuts a long exercise name and leaves a short one alone', () => {
    expect(shortName('Goblet Squat')).toBe('Goblet Squat');
    expect(shortName('Bent Over Two-Dumbbell Row With Palms In')).toBe('Bent Over Two-Dumbbel…');
    expect(shortName('Bent Over Two-Dumbbell Row With Palms In').length).toBe(22);
  });

  it('reads a date key as a calendar date', () => {
    expect(shortDate('2026-09-16')).toBe('16 Sept');
    expect(shortDate('2026-10-01')).toBe('1 Oct');
    expect(shortDate('yesterday')).toBe('');
  });

  it('writes a range of days as one phrase', () => {
    expect(dateRange('2026-09-21', '2026-09-27')).toBe('21 to 27 Sept');
    expect(dateRange('2026-09-28', '2026-10-04')).toBe('28 Sept to 4 Oct');
    expect(dateRange('2026-09-28', '2026-09-28')).toBe('28 Sept');
    expect(dateRange(null, '2026-09-28')).toBe('');
    expect(dateRange('soon', '2026-09-28')).toBe('');
  });

  it('describes the change as a percentage of the starting weight', () => {
    expect(changeText(20, 22.5)).toBe('up 12.5%');
    expect(changeText(18, 20)).toBe('up 11.1%');
    expect(changeText(20, 18)).toBe('down 10%');
    expect(changeText(20, 20)).toBe('');
    expect(changeText(0, 20)).toBe('');
  });

  it('keeps labels one line apart and inside the drawing', () => {
    expect(spreadLabels([40, 80, 110])).toEqual([40, 80, 110]);
    expect(spreadLabels([60, 62, 64])).toEqual([60, 75, 90]);
    expect(spreadLabels([116, 116, 116])).toEqual([92, 107, 122]);
    expect(spreadLabels([64, 60, 62])).toEqual([90, 60, 75]);
  });

  it('returns nothing when there is no lift to draw', () => {
    expect(slopeChart([])).toBeNull();
    expect(slopeChart([{ exerciseName: 'Plank', fromKg: 0, fromDate: '', toKg: 0, toDate: '' }])).toBeNull();
  });

  it('puts the heaviest value at the top and the lightest at the bottom', () => {
    const chart = slopeChart(lifts);
    expect(chart?.lines[0].toY).toBe(30);
    expect(chart?.lines[2].fromY).toBe(112);
    chart?.lines.forEach((line) => expect(line.toY).toBeLessThan(line.fromY));
  });

  it('labels each end with the weight and the right end with the change', () => {
    const chart = slopeChart(lifts);
    expect(chart?.lines.map((line) => [line.fromText, line.toText, line.changeText])).toEqual([
      ['20 kg', '22.5 kg', 'up 12.5%'],
      ['18 kg', '20 kg', 'up 11.1%'],
      ['16 kg', '18 kg', 'up 12.5%']
    ]);
  });

  it('uses the dates as headings when every lift shares them', () => {
    const chart = slopeChart(lifts);
    expect(chart?.fromHeading).toBe('13 Sept');
    expect(chart?.toHeading).toBe('25 Sept');
  });

  it('falls back to plain headings when the lifts were done on different days', () => {
    const chart = slopeChart([lifts[0], { ...lifts[1], fromDate: '2026-09-16', toDate: '2026-09-21' }]);
    expect(chart?.fromHeading).toBe('Earlier');
    expect(chart?.toHeading).toBe('Latest');
  });

  it('draws at most three lifts', () => {
    const chart = slopeChart([...lifts, { exerciseName: 'Deadlift', fromKg: 60, fromDate: '2026-09-13', toKg: 70, toDate: '2026-09-25' }]);
    expect(chart?.lines.length).toBe(3);
  });

  it('draws a single level lift in the middle', () => {
    const chart = slopeChart([{ exerciseName: 'Row', fromKg: 20, fromDate: '2026-09-13', toKg: 20, toDate: '2026-09-25' }]);
    expect(chart?.lines[0].fromY).toBe(71);
    expect(chart?.lines[0].toY).toBe(71);
  });

  it('describes the chart in words', () => {
    expect(slopeChart(lifts)?.description).toBe(
      'Top set weight for 3 lifts, 13 Sept against 25 Sept. Dumbbell Bench Press 20 kg to 22.5 kg, Bent-Over Row 18 kg to 20 kg, Goblet Squat 16 kg to 18 kg.'
    );
  });
});
