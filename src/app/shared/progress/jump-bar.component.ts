import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { JumpItem } from './progress.models';

/**
 * The sticky row of section names at the top of a long page. It only says which section was picked;
 * the page scrolls and keeps the address in step.
 */
@Component({
  selector: 'app-jump-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bar" [attr.aria-label]="label()">
      @for (item of items(); track item.id) {
        <button type="button" class="chip" [class.active]="item.id === active()" [attr.aria-current]="item.id === active() ? 'true' : null" (click)="chosen.emit(item.id)">
          {{ item.label }}
        </button>
      }
    </nav>
  `,
  styles: `
    :host { display: block; position: sticky; top: var(--space-2); z-index: var(--z-sticky); }
    .bar { display: flex; gap: 4px; padding: 4px; border-radius: 13px; background: var(--surface-sunken); border: 1px solid var(--border); overflow-x: auto; scrollbar-width: none; }
    .chip { flex: 1 0 auto; height: 32px; padding: 0 14px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--text-secondary); font: inherit; font-size: 13px; font-weight: 700; white-space: nowrap; cursor: pointer; }
    .chip:hover { color: var(--text-primary); }
    .chip.active { background: var(--surface); color: var(--accent-text); border-color: var(--accent-subtle); }
    .chip:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 1px; }
    @media (max-width: 640px) { .chip { padding: 0 8px; flex: 1 1 0; } }
  `
})
export class JumpBarComponent {
  readonly items = input.required<readonly JumpItem[]>();
  readonly active = input<string | null>(null);
  readonly label = input('Sections of this page');
  readonly chosen = output<string>();
}
