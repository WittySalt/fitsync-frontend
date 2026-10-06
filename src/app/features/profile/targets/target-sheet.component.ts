import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { GoalType, UserGoal } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { WorkoutModalComponent } from '../../workout/workout-modal.component';
import { TargetKind, buildTargetRequest, kindOf, stepValue, targetProblem } from './targets';

/**
 * The edit sheet of one target: a stepper, an until-date for weight, a note. Save is filled green,
 * Remove target is red and outlined, Cancel is quiet. A new target picks its type from the ones not set.
 */
@Component({
  selector: 'app-target-sheet',
  imports: [FormsModule, WorkoutModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './target-sheet.component.html',
  styleUrl: './target-sheet.component.scss'
})
export class TargetSheetComponent implements OnInit {
  private readonly data = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);

  /** The type being edited or added. */
  readonly type = input.required<GoalType>();
  /** The saved target, or null when this adds one. */
  readonly goal = input<UserGoal | null>(null);
  /** The types a new target can be, when the person chooses; empty for a fixed type. */
  readonly choices = input<readonly TargetKind[]>([]);

  readonly saved = output<void>();
  readonly dismissed = output<void>();

  protected readonly picked = signal<GoalType | null>(null);
  protected readonly kind = computed(() => kindOf(this.picked() ?? this.type()));
  protected readonly existing = computed(() => (this.picked() ? null : this.goal()));
  protected readonly value = signal<number | null>(null);
  protected readonly date = signal('');
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly heading = computed(() => (this.existing() ? `${this.kind().label} target` : 'Set a target'));

  ngOnInit(): void {
    const goal = this.goal();
    this.value.set(goal?.targetValue ?? null);
    this.date.set(goal?.targetDate ?? '');
    this.note.set(goal?.notes ?? '');
  }

  protected pick(type: GoalType): void {
    this.picked.set(type);
    this.value.set(null);
    this.date.set('');
    this.note.set('');
    this.problem.set(null);
  }

  protected step(direction: 1 | -1): void {
    this.value.set(stepValue(this.kind(), this.value(), direction));
  }

  protected onValue(raw: unknown): void {
    const parsed = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    this.value.set(parsed !== null && Number.isFinite(parsed) ? parsed : null);
  }

  protected save(): void {
    const kind = this.kind();
    const value = this.value();
    const problem = targetProblem(kind, value, this.note());
    this.problem.set(problem);
    if (problem || this.busy() || value === null) {
      return;
    }
    this.busy.set(true);
    this.data.upsertGoal(kind.type, buildTargetRequest(kind, this.existing(), value, this.date(), this.note())).subscribe({
      next: () => {
        this.toast.success('Target saved.');
        this.busy.set(false);
        this.saved.emit();
      },
      error: () => {
        this.toast.error('Unable to save the target. Please retry.');
        this.busy.set(false);
      }
    });
  }

  protected remove(): void {
    if (this.busy() || !this.existing()) {
      return;
    }
    this.busy.set(true);
    this.data.deleteGoal(this.kind().type).subscribe({
      next: () => {
        this.toast.success('Target removed.');
        this.busy.set(false);
        this.saved.emit();
      },
      error: () => {
        this.toast.error('Unable to remove the target. Please retry.');
        this.busy.set(false);
      }
    });
  }
}
