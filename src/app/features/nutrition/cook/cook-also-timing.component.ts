import { Component, computed, input, output } from '@angular/core';

export interface TimingChip {
  step: number;
  label: string;
  time: string;
  /** How much of the time is left, 0 to 1, for the small ring. */
  share: number;
}

const RADIUS = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_CHIPS = 2;

/** "Also timing": the timers of the other steps, soonest first, two at most and "+N" for the rest. */
@Component({
  selector: 'app-cook-also-timing',
  template: `
    <span class="label">Also timing</span>
    @for (chip of shown(); track chip.step) {
      <button type="button" class="chip" [attr.aria-label]="chip.label + ', step ' + (chip.step + 1) + ', ' + chip.time + ' left'" (click)="jumped.emit(chip.step)">
        <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
          <circle cx="14" cy="14" [attr.r]="radius" class="back" />
          <circle cx="14" cy="14" [attr.r]="radius" class="ring" [attr.stroke-dasharray]="dash(chip.share)" transform="rotate(-90 14 14)" />
        </svg>
        <span class="text">
          <span class="what">{{ chip.label }}</span>
          <strong class="when">{{ chip.time }}</strong>
        </span>
      </button>
    }
    @if (extra() > 0) {
      <span class="more">+{{ extra() }}</span>
    }
  `,
  styleUrl: './cook-also-timing.component.scss'
})
export class CookAlsoTimingComponent {
  readonly chips = input.required<TimingChip[]>();
  readonly jumped = output<number>();

  protected readonly radius = RADIUS;
  protected readonly shown = computed(() => this.chips().slice(0, MAX_CHIPS));
  protected readonly extra = computed(() => Math.max(0, this.chips().length - MAX_CHIPS));

  protected dash(share: number): string {
    const clamped = Math.min(1, Math.max(0, share));
    return `${(CIRCUMFERENCE * clamped).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`;
  }
}
