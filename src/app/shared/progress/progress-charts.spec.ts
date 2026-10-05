import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DotStripComponent } from './dot-strip.component';
import { LadderComponent, ladderGeometry, ladderRungs, rungRatios } from './ladder.component';
import { SmallTrendComponent, smallTrendGeometry } from './small-trend.component';
import { StepChartComponent, stepGeometry } from './step-chart.component';
import { WeekBarsComponent, niceStep, weekBarsGeometry } from './week-bars.component';

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

function render<T>(type: Type<T>, inputs: Record<string, unknown>): HTMLElement {
  const fixture = TestBed.createComponent(type);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SmallTrendComponent', () => {
  const points = [
    { label: '2026-08-10', value: 150 },
    { label: '2026-08-17', value: 148 },
    { label: '2026-09-28', value: 136 }
  ];

  it('labels the start and the end values and the first and last dates', () => {
    const el = render(SmallTrendComponent, { points, unit: 'g' });
    expect(text(el.querySelector('.start'))).toBe('150');
    expect(text(el.querySelector('.end'))).toBe('136 g');
    expect(text(el.querySelector('.dates'))).toContain('10 Aug');
    expect(text(el.querySelector('.dates'))).toContain('28 Sept');
    expect(el.querySelector('svg')?.getAttribute('aria-label')).toContain('from 150 on 10 Aug to 136 g on 28 Sept');
  });

  it('draws at the pixel width it is given, so its text is never scaled', () => {
    const el = render(SmallTrendComponent, { points, width: 170, height: 28, showDates: false });
    expect(el.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 170 28');
    expect(el.querySelector('svg')?.hasAttribute('preserveAspectRatio')).toBeFalse();
    expect(el.querySelector('.dates')).toBeNull();
    const g = smallTrendGeometry([1, 2], 28, 'a', 'b', null, '', 170)!;
    expect(g.end.x).toBeLessThan(170);
  });

  it('draws a dashed target with a haloed label inside the scale', () => {
    const el = render(SmallTrendComponent, { points, unit: 'g', target: 140 });
    expect(el.querySelector('line.target')).not.toBeNull();
    expect(text(el.querySelector('.target-text'))).toBe('target 140 g');
    expect(el.querySelector('.target-text')?.classList).toContain('halo');
  });

  it('says not enough data yet for one point, and draws nothing', () => {
    const el = render(SmallTrendComponent, { points: [points[0]] });
    expect(el.querySelector('svg')).toBeNull();
    expect(text(el)).toBe('Not enough data yet');
  });

  it('keeps the target inside the box even when it is far from the values', () => {
    const g = smallTrendGeometry([10, 11], 56, '10', '11', 30, 'target 30')!;
    expect(g.target!.y).toBeGreaterThanOrEqual(0);
    expect(g.start.y).toBeLessThanOrEqual(56);
  });
});

describe('StepChartComponent', () => {
  it('rises at each session and ends with the total', () => {
    const el = render(StepChartComponent, {
      points: [
        { date: '2026-09-08', value: 50 },
        { date: '2026-09-15', value: 95 }
      ],
      from: '2026-09-06',
      to: '2026-10-03'
    });
    expect(text(el.querySelector('.total'))).toBe('1 h 35');
    expect(el.querySelector('path.step')?.getAttribute('d')).toContain('V');
    expect(text(el)).toContain('6 Sept');
    expect(text(el)).toContain('3 Oct');
  });

  it('takes the shade of its kind of training', () => {
    const el = render(StepChartComponent, { points: [{ date: '2026-09-08', value: 50 }], from: '2026-09-06', to: '2026-10-03', kind: 'SPORT' });
    expect(el.querySelector('svg')?.getAttribute('data-kind')).toBe('SPORT');
  });

  it('uses a shared top of the scale', () => {
    const g = stepGeometry([{ date: '2026-09-10', value: 60 }], '2026-09-06', '2026-10-03', 84, 300)!;
    expect(g.ticks.map((t) => t.value)).toEqual([0, 150, 300]);
  });

  it('puts only the first and last dates under the plot, left-aligned and right-aligned to its edges', () => {
    const g = stepGeometry([{ date: '2026-09-10', value: 60 }], '2026-09-06', '2026-10-03', 84, 300, 300, { from: '8 Sept', to: '5 Oct' })!;
    expect(g.fromX).toBe(g.x0);
    expect(g.toX).toBe(g.x1);
  });

  it('moves the last date right, never over the first, when the plot is too narrow for both', () => {
    const g = stepGeometry([{ date: '2026-09-10', value: 60 }], '2026-09-06', '2026-10-03', 84, 300, 120, { from: '8 Sept', to: '5 Oct' })!;
    expect(g.toX - g.fromX).toBeGreaterThanOrEqual(60);
    expect(g.toX).toBeLessThanOrEqual(120);
  });

  it('says not enough data yet without sessions', () => {
    const el = render(StepChartComponent, { points: [], from: '2026-09-06', to: '2026-10-03' });
    expect(text(el)).toBe('Not enough data yet');
  });
});

describe('DotStripComponent', () => {
  const days = [
    { date: '2026-09-04', state: 'MET' },
    { date: '2026-09-05', state: 'MISSED' },
    { date: '2026-09-06', state: 'NOT_LOGGED' },
    { date: '2026-09-07', state: 'MET' }
  ];

  it('draws one dot a day with its state and the first and last dates', () => {
    const el = render(DotStripComponent, { days });
    expect(el.querySelectorAll('.strip .dot').length).toBe(4);
    expect(el.querySelectorAll('.strip .dot[data-state="MET"]').length).toBe(2);
    expect(Array.from(el.querySelectorAll('.dates span')).map((d) => text(d))).toEqual(['4 Sept', '7 Sept']);
    expect(el.querySelector('.strip')?.getAttribute('aria-label')).toContain('met on 2 of 3 logged days');
  });

  it('shows the key when asked', () => {
    const el = render(DotStripComponent, { days, showKey: true });
    expect(Array.from(el.querySelectorAll('.key span')).map((d) => text(d))).toEqual(['met', 'missed', 'not logged']);
  });

  it('says not enough data yet without days', () => {
    expect(text(render(DotStripComponent, { days: [] }))).toBe('Not enough data yet');
  });
});

describe('WeekBarsComponent', () => {
  it('hangs negative weeks below the zero line with signed labels', () => {
    const el = render(WeekBarsComponent, {
      bars: [
        { label: '21 Sept', value: -180 },
        { label: '28 Sept', value: -279, current: true }
      ],
      signed: true
    });
    expect(Array.from(el.querySelectorAll('.value')).map((v) => text(v))).toEqual(['−180', '−279']);
    expect(text(el.querySelector('.key'))).toBe('The lighter bar is this week so far.');
    expect(el.querySelector('rect.current')).not.toBeNull();
    expect(el.querySelector('line.zero')).not.toBeNull();
  });

  it('stacks segments and shows a label in place of the value', () => {
    const el = render(WeekBarsComponent, {
      bars: [{ label: '7 Sept', value: 3, valueLabel: '3 of 4', segments: [{ key: 'STRENGTH', value: 1 }, { key: 'CARDIO', value: 2 }] }]
    });
    expect(el.querySelectorAll('rect').length).toBe(2);
    expect(el.querySelector('rect[data-key="CARDIO"]')).not.toBeNull();
    expect(text(el.querySelector('.value'))).toBe('3 of 4');
  });

  it('thins the week labels out when there are more than six and none are dated', () => {
    const bars = Array.from({ length: 8 }, (_, i) => ({ label: `W${i}`, value: i + 1 }));
    const g = weekBarsGeometry(bars, 160, false, '', 320)!;
    expect(g.labels.length).toBe(4);
    expect(g.labels.at(-1)?.text).toBe('W7');
    expect(niceStep(279)).toBe(100);
  });

  it('names weeks by the period: every week for four, month starts for a year', () => {
    const weeks = (first: string, count: number) =>
      Array.from({ length: count }, (_, k) => {
        const weekStart = new Date(Date.parse(`${first}T00:00:00Z`) + k * 7 * 86_400_000).toISOString().slice(0, 10);
        return { label: weekStart, weekStart, value: k + 1 };
      });
    expect(weekBarsGeometry(weeks('2026-09-07', 4), 160, false, '', 320)!.labels.map((l) => l.text)).toEqual(['7 Sept', '14 Sept', '21 Sept', '28 Sept']);
    const year = weekBarsGeometry(weeks('2025-10-06', 52), 160, false, '', 600)!;
    expect(year.labels.every((l) => !/^d/.test(l.text))).toBeTrue();
    expect(year.labels.map((l) => l.text)).toContain('Jan 2026');
  });

  it('starts the series at the first week that has a figure', () => {
    const bars = [
      { label: 'a', value: null },
      { label: 'b', value: null },
      { label: 'c', value: 5 },
      { label: 'd', value: 7 }
    ];
    expect(weekBarsGeometry(bars, 160, false, '', 320)!.bars.length).toBe(2);
  });

  it('writes the value over the last bar only when the slots are narrow', () => {
    const bars = Array.from({ length: 52 }, (_, i) => ({ label: `W${i}`, value: i + 1 }));
    const g = weekBarsGeometry(bars, 160, false, '', 320)!;
    expect(g.bars.filter((b) => b.showValue).length).toBe(1);
    expect(g.bars[51].showValue).toBeTrue();
  });

  it('says not enough data yet without values', () => {
    expect(text(render(WeekBarsComponent, { bars: [{ label: 'x', value: null }] }))).toBe('Not enough data yet');
  });
});

describe('LadderComponent', () => {
  it('uses the contract rungs by lift name', () => {
    expect(ladderRungs('Back squat').map((r) => r.ratio)).toEqual([0.75, 1.0, 1.25, 1.75]);
    expect(ladderRungs('Deadlift').map((r) => r.ratio)).toEqual([1.0, 1.25, 1.5, 2.0]);
    expect(ladderRungs('Bench press').map((r) => r.ratio)).toEqual([0.5, 0.75, 1.0, 1.5]);
    expect(ladderRungs('Overhead press').map((r) => r.ratio)).toEqual([0.35, 0.55, 0.75, 1.0]);
    expect(ladderRungs('Barbell row').map((r) => r.ratio)).toEqual([0.5, 0.75, 1.0, 1.5]);
    expect(rungRatios('Military press')).toEqual([0.35, 0.55, 0.75, 1.0]);
    expect(rungRatios('Romanian dead lift')).toEqual([1.0, 1.25, 1.5, 2.0]);
  });

  it('marks the lift with its ratio and labels each rung', () => {
    const el = render(LadderComponent, { ratio: 1.12, rungs: ladderRungs('Squat') });
    expect(text(el.querySelector('.mark-text'))).toBe('1.12 × body weight');
    expect(el.querySelectorAll('.rung').length).toBe(4);
    expect(text(el)).toContain('Novice');
    expect(ladderGeometry(1.12, ladderRungs('Squat'), 640)!.rungs.every((rung) => rung.showLabel)).toBeTrue();
  });

  it('keeps the marker on the track past the last rung', () => {
    const g = ladderGeometry(3, ladderRungs('Squat'))!;
    expect(g.marker.x).toBeLessThanOrEqual(g.x1);
    expect(g.marker.anchor).toBe('end');
  });

  it('leaves out a level name that would touch the one before it', () => {
    const g = ladderGeometry(1, ladderRungs('Squat'), 180)!;
    expect(g.rungs.some((rung) => !rung.showLabel)).toBeTrue();
    expect(g.rungs.every((rung) => rung.ratioText.endsWith('×'))).toBeTrue();
  });

  it('says not enough data yet without a ratio', () => {
    expect(text(render(LadderComponent, { ratio: null, rungs: ladderRungs('Squat') }))).toBe('Not enough data yet');
  });
});
