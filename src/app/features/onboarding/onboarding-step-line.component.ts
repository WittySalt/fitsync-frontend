import { Component, input } from '@angular/core';

/** The thin line at the top of the setup: the step names, the current one in green. */
@Component({
  selector: 'app-onboarding-step-line',
  template: `
    <ol class="line" aria-label="Setup steps">
      @for (label of labels(); track label; let index = $index) {
        <li [class.done]="index < current()" [class.current]="index === current()" [attr.aria-current]="index === current() ? 'step' : null">
          {{ label }}
        </li>
      }
    </ol>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .line {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li {
        padding-top: 8px;
        border-top: 3px solid var(--border);
        color: var(--text-muted);
        font-size: var(--text-sm);
        font-weight: var(--fw-semibold);
      }
      li.done {
        border-top-color: var(--accent-subtle);
        color: var(--text-secondary);
      }
      li.current {
        border-top-color: var(--accent);
        color: var(--accent-text);
      }
    `
  ]
})
export class OnboardingStepLineComponent {
  readonly labels = input.required<readonly string[]>();
  readonly current = input.required<number>();
}
