import { Component, OnInit, input, output, signal } from '@angular/core';

import { CookDurationComponent } from './cook-duration.component';
import { MAX_MINUTES, MIN_MINUTES } from './cook-duration';

/**
 * Changes the time of a timer: the shared hours and minutes control and Set time. For a timer that
 * runs or waits paused the time chosen becomes the time left; before the start it becomes the length.
 */
@Component({
  selector: 'app-cook-retime',
  imports: [CookDurationComponent],
  template: `
    <app-cook-duration [(minutes)]="value" [(valid)]="ok" [reset]="reset()" (submitted)="apply()" />
    <button type="button" class="set" [disabled]="!ok()" (click)="apply()">Set time</button>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px 12px;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
      }

      app-cook-duration {
        flex: 1 1 240px;
      }

      .set {
        height: 38px;
        padding: 0 18px;
        border: 0;
        border-radius: 999px;
        background: var(--accent);
        color: var(--text-on-accent);
        font: inherit;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }

      .set:disabled {
        opacity: 0.5;
        cursor: default;
      }

      .set:focus-visible {
        outline: 2px solid var(--accent-text);
        outline-offset: 2px;
      }
    `
  ]
})
export class CookRetimeComponent implements OnInit {
  /** The minutes now, where the control starts. */
  readonly minutes = input.required<number>();
  /** The recipe's own time in minutes, for Reset. */
  readonly reset = input<number | null>(null);
  readonly applied = output<number>();

  protected readonly value = signal(MIN_MINUTES);
  protected readonly ok = signal(true);

  ngOnInit(): void {
    this.value.set(Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, this.minutes())));
  }

  protected apply(): void {
    if (this.ok()) {
      this.applied.emit(this.value());
    }
  }
}
