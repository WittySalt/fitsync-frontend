import { Component, input } from '@angular/core';

/** WHAT THIS CHANGES: a few sentences that follow the choices on the step, each naming a place in the app. */
@Component({
  selector: 'app-onboarding-explain-card',
  template: `
    <aside class="card" aria-live="polite">
      <p class="eyebrow">What this changes</p>
      @for (line of lines(); track line) {
        <p class="line">{{ line }}</p>
      }
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .card {
        display: grid;
        gap: 10px;
        padding: 16px 18px;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--surface-tint);
      }
      p {
        margin: 0;
      }
      .eyebrow {
        color: var(--accent-text);
        font-size: var(--text-xs);
        font-weight: var(--fw-bold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .line {
        color: var(--text-secondary);
        font-size: var(--text-sm);
        line-height: 1.55;
      }
    `
  ]
})
export class OnboardingExplainCardComponent {
  readonly lines = input.required<readonly string[]>();
}
