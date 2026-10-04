import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DraftMove } from './plan-draft';

/**
 * TODO(integrator): replace with `PlanMovesTableComponent` from `../plan-editor/moves/moves-table.component`
 * once that folder lands. It has the same selector and the same `entries` input and `entriesChange`
 * output, so the day editor needs no other change. Until then a day lists its moves read-only and
 * can drop one.
 */
@Component({
  selector: 'app-plan-moves-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    ul { margin: 0; padding: 0; list-style: none; display: grid; }
    li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: var(--pg-text); }
    small { display: block; color: var(--text-secondary); font-size: var(--pg-chart); }
    button { border: 0; background: none; color: var(--danger); font: inherit; font-size: var(--pg-chart); cursor: pointer; }
    p { margin: 0; color: var(--text-secondary); font-size: var(--pg-text); }
  `,
  template: `
    @if (entries().length) {
      <ul>
        @for (move of entries(); track $index) {
          <li>
            <span>{{ move.name }}<small>{{ move.sets ?? 0 }} × {{ move.timed ? (move.durationSeconds ?? 0) + ' s' : (move.reps ?? 0) }}</small></span>
            <button type="button" [attr.aria-label]="'Remove ' + move.name" (click)="remove($index)">Remove</button>
          </li>
        }
      </ul>
    } @else {
      <p>No moves yet.</p>
    }
  `
})
export class PlanMovesTableStubComponent {
  readonly entries = input.required<DraftMove[]>();
  readonly entriesChange = output<DraftMove[]>();

  protected remove(index: number): void {
    this.entriesChange.emit(this.entries().filter((_, at) => at !== index));
  }
}
