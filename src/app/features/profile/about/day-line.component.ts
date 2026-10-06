import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="line" role="group" [attr.aria-label]="summary()">
      <button type="button" class="band" [class.faint]="empty()" aria-label="Usual training time" (click)="editTime.emit()">
        @if (block(); as training) {
          <span class="training-name" [style.left.%]="training.left">Training</span>
          <span class="training" [style.left.%]="training.left" [style.width.%]="training.width"></span>
        }
      </button>
      <button type="button" class="band meals" [class.faint]="empty()" aria-label="Usual meals" (click)="viewMeals.emit()">
        @for (dot of dots(); track dot.label) {
          <span class="dot" [style.left.%]="dot.left"></span>
          <span class="time" [style.left.%]="dot.left">{{ dot.time }}</span>
        }
      </button>
      @if (empty()) {
        <span class="hint">Add your usual meals and training time</span>
      }
      <div class="axis" aria-hidden="true">
        <span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .line { position: relative; display: grid; gap: 10px; }
    .band { position: relative; display: block; width: 100%; height: 12px; padding: 0; border: 0; border-radius: 6px; background: var(--surface-sunken); cursor: pointer; }
    .band:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 3px; }
    .meals { margin-top: 6px; }
    .faint { opacity: 0.7; }
    .training { position: absolute; top: 0; height: 12px; border-radius: 4px; background: var(--accent); }
    .training-name { position: absolute; top: -17px; transform: translateX(-20%); font-size: var(--pg-eyebrow); font-weight: var(--fw-semibold); color: var(--accent-text); }
    .dot { position: absolute; top: 50%; width: 10px; height: 10px; border-radius: 50%; background: var(--text-primary); border: 2px solid var(--surface); transform: translate(-50%, -50%); box-sizing: content-box; }
    .time { position: absolute; top: 16px; transform: translateX(-50%); font-size: var(--pg-chart); font-weight: var(--fw-semibold); color: var(--text-primary); white-space: nowrap; }
    .hint { position: absolute; inset: 0 0 auto 0; text-align: center; font-size: var(--pg-chart); color: var(--text-primary); line-height: 12px; padding-top: 14px; pointer-events: none; }
    .axis { display: flex; justify-content: space-between; margin-top: 18px; font-size: var(--pg-chart); color: var(--text-muted); }
  `
})
export class DayLineComponent {
  readonly meals = input<readonly DayMark[]>([]);
  /** The usual training start as "HH:mm", or null. */
  readonly training = input<string | null>(null);
  /** The training band was pressed: the person wants to change the usual time. */
  readonly editTime = output<void>();
  /** The meals band was pressed: the usual meals come from the diary and are only shown. */
  readonly viewMeals = output<void>();

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
    return parts.length ? `Your usual day: ${parts.join(', ')}.` : 'No usual meals or training time yet.';
  });
}
