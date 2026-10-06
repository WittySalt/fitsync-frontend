import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { GoalType, UserGoal } from '../../../core/fitsync.models';
import { SpotlightDirective } from '../../../core/guide/spotlight.directive';
import { TargetKind, TargetRow, missingMacro, targetRows, unsetKinds } from './targets';
import { TargetSheetComponent } from './target-sheet.component';

interface OpenSheet {
  type: GoalType;
  goal: UserGoal | null;
  choices: readonly TargetKind[];
}

/**
 * Targets: one row for each target that is set, "Change" on each opening the edit sheet. No progress
 * figures here, those live on Progress.
 */
@Component({
  selector: 'app-targets-card',
  imports: [RouterLink, TargetSheetComponent, SpotlightDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './targets-card.component.html',
  styleUrl: './targets-card.component.scss'
})
export class TargetsCardComponent {
  readonly goals = input.required<readonly UserGoal[]>();
  /** A target was saved or removed; the page reads them again. */
  readonly changed = output<void>();

  protected readonly rows = computed<TargetRow[]>(() => targetRows(this.goals()));
  protected readonly macro = computed(() => missingMacro(this.goals()));
  protected readonly sheet = signal<OpenSheet | null>(null);

  protected edit(row: TargetRow): void {
    this.sheet.set({ type: row.kind.type, goal: row.goal, choices: [] });
  }

  protected addMacro(kind: TargetKind): void {
    this.sheet.set({ type: kind.type, goal: null, choices: [] });
  }

  protected addAny(): void {
    const choices = unsetKinds(this.goals());
    if (choices.length) {
      this.sheet.set({ type: choices[0].type, goal: null, choices });
    }
  }

  protected onSaved(): void {
    this.sheet.set(null);
    this.changed.emit();
  }
}
