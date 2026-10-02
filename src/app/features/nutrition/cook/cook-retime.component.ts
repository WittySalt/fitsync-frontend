import { Component, OnInit, input, output, signal } from '@angular/core';

import { StepperComponent } from '../recipes/stepper.component';
import { CUSTOM_MAX_MINUTES } from './cook-session.service';

/**
 * Changes the time of a timer that is running or paused: a minutes stepper, like the one for a new
 * timer, and Set time. The minutes chosen become the time left.
 */
@Component({
  selector: 'app-cook-retime',
  imports: [StepperComponent],
  template: `
    <app-stepper downLabel="Fewer minutes" upLabel="More minutes" [canDown]="value() > 1" [canUp]="value() < max" (down)="value.set(value() - 1)" (up)="value.set(value() + 1)">
      <span aria-live="polite">{{ value() }} min</span>
    </app-stepper>
    <button type="button" class="set" (click)="applied.emit(value())">Set time</button>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
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

      .set:focus-visible {
        outline: 2px solid var(--accent-text);
        outline-offset: 2px;
      }
    `
  ]
})
export class CookRetimeComponent implements OnInit {
  /** The minutes left now, where the stepper starts. */
  readonly minutes = input.required<number>();
  readonly applied = output<number>();

  protected readonly max = CUSTOM_MAX_MINUTES;
  protected readonly value = signal(1);

  ngOnInit(): void {
    this.value.set(Math.min(this.max, Math.max(1, this.minutes())));
  }
}
