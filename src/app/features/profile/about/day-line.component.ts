import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

const START = 6 * 60;
const END = 24 * 60;
const TRAINING_MINUTES = 60;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface DayMark {
  label: string;
  time: string;
}

/** Where a clock time sits on the 06:00 to 24:00 line, as a percentage; null when it is not a time or falls outside. */
export function dayPercent(time: string | null | undefined): number | null {
  const match = typeof time === 'string' ? TIME.exec(time) : null;
  if (!match) {
    return null;
  }
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes < START || minutes > END) {
    return null;
  }
  return ((minutes - START) / (END - START)) * 100;
}

/** The width of the usual training hour on the line, as a percentage, kept inside the line. */
export function trainingBlock(start: string | null | undefined): { left: number; width: number } | null {
  const left = dayPercent(start);
  if (left === null) {
    return null;
  }
  const width = (TRAINING_MINUTES / (END - START)) * 100;
  return { left: Math.min(left, 100 - width), width };
}

/**
 * The person's usual day on one line, 06:00 to 24:00, drawn like the Diary's "When you usually eat":
 * a dot for each usual meal with its time, and a block for the usual training hour above it.
 */
@Component({
  selector: 'app-day-line',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="line" routerLink="/settings" [queryParams]="{ section: 'preferences' }" [attr.aria-label]="summary()">
      <div class="band" [class.faint]="empty()">
        @if (block(); as training) {
          <span class="training-name" [style.left.%]="training.left">Training</span>
          <span class="training" [style.left.%]="training.left" [style.width.%]="training.width"></span>
        }
      </div>
      <div class="band meals" [class.faint]="empty()">
        @for (dot of dots(); track dot.label) {
          <span class="dot" [style.left.%]="dot.left"></span>
          <span class="time" [style.left.%]="dot.left">{{ dot.time }}</span>
        }
      </div>
      @if (empty()) {
        <span class="hint">Add your usual meals and training time</span>
      }
      <div class="axis" aria-hidden="true">
        <span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
      </div>
    </a>
  `,
  styles: `
    :host { display: block; }
    .line { position: relative; display: grid; gap: 10px; color: inherit; text-decoration: none; }
    .band { position: relative; height: 12px; border-radius: 6px; background: var(--surface-sunken); }
    .meals { margin-top: 6px; }
    .faint { opacity: 0.7; }
    .training { position: absolute; top: 0; height: 12px; border-radius: 4px; background: var(--accent); }
    .training-name { position: absolute; top: -17px; transform: translateX(-20%); font-size: var(--pg-eyebrow); font-weight: var(--fw-semibold); color: var(--accent-text); }
    .dot { position: absolute; top: 50%; width: 10px; height: 10px; border-radius: 50%; background: var(--text-primary); border: 2px solid var(--surface); transform: translate(-50%, -50%); box-sizing: content-box; }
    .time { position: absolute; top: 16px; transform: translateX(-50%); font-size: var(--pg-chart); font-weight: var(--fw-semibold); color: var(--text-primary); white-space: nowrap; }
    .hint { position: absolute; inset: 0 0 auto 0; text-align: center; font-size: var(--pg-chart); color: var(--text-primary); line-height: 12px; padding-top: 14px; }
    .axis { display: flex; justify-content: space-between; margin-top: 18px; font-size: var(--pg-chart); color: var(--text-muted); }
  `
})
export class DayLineComponent {
  readonly meals = input<readonly DayMark[]>([]);
  /** The usual training start as "HH:mm", or null. */
  readonly training = input<string | null>(null);

  protected readonly dots = computed(() =>
    this.meals()
      .map((meal) => ({ ...meal, left: dayPercent(meal.time) }))
      .filter((meal): meal is DayMark & { left: number } => meal.left !== null)
  );
  protected readonly block = computed(() => trainingBlock(this.training()));
  protected readonly empty = computed(() => this.dots().length === 0 && this.block() === null);
  protected readonly summary = computed(() => {
    const parts = this.dots().map((dot) => `${dot.label} at ${dot.time}`);
    const start = this.block() ? this.training() : null;
    if (start) {
      parts.push(`training at ${start}`);
    }
    return parts.length ? `Your usual day: ${parts.join(', ')}. Opens your preferences.` : 'No usual meals or training time yet. Opens your preferences.';
  });
}
