import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeroStat } from './progress.models';

/**
 * The green hero at the top of a Progress page: a way back, the page's name and title, and four
 * figures, each with what it is compared with. A period control can be projected above it.
 */
@Component({
  selector: 'app-progress-hero',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (back()) {
      <a class="back" [routerLink]="back()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
        {{ backLabel() }}
      </a>
    }
    <ng-content select="[heroPeriod]" />
    <section class="hero" [attr.aria-label]="eyebrow()">
      <div class="titles">
        <span class="eyebrow">{{ eyebrow() }}</span>
        <h1>{{ title() }}</h1>
        @if (sub()) {
          <p>{{ sub() }}</p>
        }
      </div>
      <dl class="stats">
        @for (stat of stats(); track stat.label) {
          <div class="stat">
            <dt>{{ stat.label }}</dt>
            <dd class="value">{{ stat.value }}@if (stat.unit) {<span class="unit"> {{ stat.unit }}</span>}</dd>
            @if (stat.context) {
              <dd class="context">{{ stat.context }}</dd>
            }
          </div>
        }
      </dl>
    </section>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-3); }
    .back { display: inline-flex; align-items: center; gap: 6px; width: fit-content; font-size: var(--text-sm); font-weight: 600; color: var(--accent-text); text-decoration: none; }
    .hero { border-radius: 22px; padding: var(--space-6); background: var(--gradient-hero); color: var(--text-on-hero); display: flex; flex-direction: column; gap: 18px; }
    .titles { display: flex; flex-direction: column; gap: 2px; }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-on-hero-muted); }
    h1 { margin: 0; font: 600 28px/1.2 var(--font-display); color: var(--text-on-hero); }
    p { margin: 0; font-size: 13px; color: var(--text-on-hero-muted); }
    .stats { margin: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
    .stat { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    dt { font-size: var(--text-xs); color: var(--text-on-hero-muted); white-space: nowrap; }
    dd { margin: 0; }
    .value { font: 600 30px/1.1 var(--font-display); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .unit { font: 500 13px var(--font-sans); color: var(--text-on-hero-muted); }
    .context { font-size: var(--text-xs); color: var(--text-on-hero-muted); font-variant-numeric: tabular-nums; }
    @media (max-width: 640px) {
      .hero { padding: 18px; }
      h1 { font-size: 24px; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .value { font-size: 24px; }
    }
  `
})
export class ProgressHeroComponent {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly sub = input('');
  readonly stats = input<readonly HeroStat[]>([]);
  /** Where the back link goes; null hides it. */
  readonly back = input<string | null>('/progress');
  readonly backLabel = input('Progress');
}
