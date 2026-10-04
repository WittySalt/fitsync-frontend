import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

import { WorkoutModalComponent } from '../workout-modal.component';
import { WORKOUT_PLAN_TEMPLATES } from '../plan-templates.component';
import { EntryTarget, entryTarget } from './plan-entry';

/**
 * The sheet that opens from New plan, and again at the end of onboarding: three rows, so nobody
 * meets an empty form. A template row opens the starter list; the coach row goes to Plan Studio;
 * "Build my own" starts from the default week.
 */
@Component({
  selector: 'app-plan-entry-sheet',
  imports: [WorkoutModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-entry-sheet.component.html',
  styleUrl: './plan-entry-sheet.component.scss'
})
export class PlanEntrySheetComponent {
  /** The row was chosen; the owner navigates to the target. */
  readonly chosen = output<EntryTarget>();
  readonly dismissed = output<void>();
  readonly heading = 'New plan';

  protected readonly templatesOpen = signal(false);
  protected readonly templates = WORKOUT_PLAN_TEMPLATES;

  protected pickTemplate(id: string): void {
    this.chosen.emit(entryTarget('template', id));
  }

  protected askCoach(): void {
    this.chosen.emit(entryTarget('coach'));
  }

  protected buildOwn(): void {
    this.chosen.emit(entryTarget('own'));
  }
}
