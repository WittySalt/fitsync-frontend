import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatNumber } from './progress-format';
import { LadderRung } from './progress.models';

const WIDTH = 300;

/** The level names the rungs start, from the contract's BEGINNER to ADVANCED, then one past it. */
export const LADDER_LEVELS = ['Novice', 'Intermediate', 'Advanced', 'Elite'];

/**
 * Rungs as ratios of body weight (contract section 1.1), by the lift's name: deadlift, bench press,
 * overhead press, squat or any other. Beginner is below the first rung.
 */
const RUNGS: [RegExp, [number, number, number, number]][] = [
  [/dead ?lift/, [1.0, 1.25, 1.5, 2.0]],
  [/bench/, [0.5, 0.75, 1.0, 1.5]],
  [/overhead|military|shoulder press|\bohp\b/, [0.35, 0.55, 0.75, 1.0]],
  [/squat/, [0.75, 1.0, 1.25, 1.75]]
];
const OTHER: [number, number, number, number] = [0.5, 0.75, 1.0, 1.5];

/** The four rung ratios for a lift by its name. */
export function rungRatios(liftName: string): [number, number, number, number] {
  const name = liftName.toLowerCase();
  return RUNGS.find(([pattern]) => pattern.test(name))?.[1] ?? OTHER;
}

/** The ladder for a lift by its name, each rung named by the level it starts. */
export function ladderRungs(liftName: string): LadderRung[] {
  return rungRatios(liftName).map((ratio, i) => ({ ratio, label: LADDER_LEVELS[i] }));
}

export interface LadderGeometry {
  rungs: { x: number; ratioText: string; label: string }[];
  marker: { x: number; text: string; anchor: 'start' | 'middle' | 'end' };
  fill: number;
  x0: number;
  x1: number;
}

export function ladderGeometry(ratio: number, rungs: readonly LadderRung[]): LadderGeometry | null {
  if (!rungs.length || !Number.isFinite(ratio) || ratio < 0) {
    return null;
  }
  const x0 = 6;
  const x1 = WIDTH - 6;
  const top = Math.max(rungs[rungs.length - 1].ratio * 1.12, ratio * 1.05);
  const x = (r: number) => x0 + ((x1 - x0) * Math.min(r, top)) / top;
  const mx = x(ratio);
  return {
    rungs: rungs.map((rung) => ({ x: x(rung.ratio), ratioText: `${formatNumber(rung.ratio, 2)}×`, label: rung.label })),
    marker: { x: mx, text: `${formatNumber(ratio, 2)} × body weight`, anchor: mx < 60 ? 'start' : mx > WIDTH - 60 ? 'end' : 'middle' },
    fill: mx - x0,
    x0,
    x1
  };
}

/** Where a lift stands on the strength ladder: a track with a tick at each rung and the lift marked. */
@Component({
  selector: 'app-ladder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg viewBox="0 0 300 70" role="img" [attr.aria-label]="summary()">
        <text class="mark-text" [attr.x]="g.marker.x" y="11" [attr.text-anchor]="g.marker.anchor">{{ g.marker.text }}</text>
        <rect class="track" [attr.x]="g.x0" y="22" [attr.width]="g.x1 - g.x0" height="10" rx="5"></rect>
        <rect class="fill" [attr.x]="g.x0" y="24" [attr.width]="g.fill" height="6" rx="3"></rect>
        @for (rung of g.rungs; track $index) {
          <line class="rung" [attr.x1]="rung.x" [attr.x2]="rung.x" y1="18" y2="36"></line>
          <text class="ratio" [attr.x]="rung.x" y="49" text-anchor="middle">{{ rung.ratioText }}</text>
          <text class="level" [attr.x]="rung.x" y="63" text-anchor="middle">{{ rung.label }}</text>
        }
        <circle class="marker" [attr.cx]="g.marker.x" cy="27" r="6"></circle>
      </svg>
    } @else {
      <p class="none">Not enough data yet</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .track { fill: var(--surface-sunken); }
    .fill { fill: var(--accent); }
    .rung { stroke: var(--text-secondary); stroke-width: 1.5; }
    .marker { fill: var(--accent-text); stroke: var(--surface); stroke-width: 2; }
    text { font: 400 10px var(--font-sans); fill: var(--text-secondary); }
    .mark-text { font-size: 11px; font-weight: 700; fill: var(--text-primary); }
    .level { font-weight: 600; }
    .none { margin: 0; font-size: var(--text-xs); color: var(--text-secondary); }
  `
})
export class LadderComponent {
  readonly ratio = input<number | null>(null);
  readonly rungs = input.required<readonly LadderRung[]>();
  readonly label = input('Strength ladder');

  protected readonly geometry = computed(() => {
    const ratio = this.ratio();
    return ratio === null ? null : ladderGeometry(ratio, this.rungs());
  });
  protected readonly summary = computed(() => {
    const ratio = this.ratio();
    const rungs = this.rungs().map((rung) => `${rung.label} from ${formatNumber(rung.ratio, 2)}`).join(', ');
    return ratio === null ? '' : `${this.label()}: ${formatNumber(ratio, 2)} times body weight. ${rungs}.`;
  });
}
