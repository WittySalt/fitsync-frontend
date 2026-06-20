import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import {
  GOAL_STATUSES,
  GOAL_TYPES,
  GoalStatus,
  GoalType,
  UpsertGoalRequest,
  UserGoal
} from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';

@Component({
  selector: 'app-goal-lifecycle',
  imports: [ReactiveFormsModule, StatePanelComponent],
  templateUrl: './goal-lifecycle.component.html',
  styleUrl: './goal-lifecycle.component.scss'
})
export class GoalLifecycleComponent implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly goalTypes = GOAL_TYPES;
  readonly statuses = GOAL_STATUSES;
  readonly goals = signal<UserGoal[]>([]);
  readonly loading = signal(true);
  readonly editingGoalType = signal<GoalType | null>(null);
  readonly savingGoalType = signal<GoalType | null>(null);

  readonly form = this.fb.group({
    targetValue: [null as number | null, [Validators.min(0)]],
    targetUnit: ['', [Validators.maxLength(20)]],
    targetDate: [''],
    status: this.fb.nonNullable.control<GoalStatus>('ACTIVE', Validators.required),
    notes: ['', [Validators.maxLength(300)]]
  });

  ngOnInit(): void {
    this.loadGoals();
  }

  loadGoals(): void {
    this.loading.set(true);
    this.dataService.getGoals().subscribe((goals) => {
      this.goals.set(goals);
      this.loading.set(false);
    });
  }

  goalFor(goalType: GoalType): UserGoal | null {
    return this.goals().find((goal) => goal.goalType === goalType) ?? null;
  }

  startEdit(goalType: GoalType): void {
    const goal = this.goalFor(goalType);
    this.editingGoalType.set(goalType);
    this.form.reset({
      targetValue: goal?.targetValue ?? null,
      targetUnit: goal?.targetUnit ?? this.defaultUnit(goalType),
      targetDate: goal?.targetDate ?? '',
      status: goal?.status ?? 'ACTIVE',
      notes: goal?.notes ?? ''
    });
  }

  cancelEdit(): void {
    this.editingGoalType.set(null);
    this.form.reset({
      targetValue: null,
      targetUnit: '',
      targetDate: '',
      status: 'ACTIVE',
      notes: ''
    });
  }

  setStatus(status: GoalStatus): void {
    this.form.controls.status.setValue(status);
  }

  saveGoal(goalType: GoalType): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.savingGoalType()) {
      this.toast.error('Check the goal fields before saving.');
      return;
    }

    const request = this.buildRequest();
    this.savingGoalType.set(goalType);
    this.dataService.upsertGoal(goalType, request).subscribe({
      next: (goal) => {
        this.toast.success('Goal saved.');
        this.upsertLocalGoal(goal);
        this.editingGoalType.set(null);
        this.loadGoals();
      },
      error: () => {
        this.toast.error('Unable to save goal. Please retry.');
        this.savingGoalType.set(null);
      },
      complete: () => this.savingGoalType.set(null)
    });
  }

  label(value: string | null | undefined): string {
    return (value ?? '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatValue(goal: UserGoal): string {
    if (goal.targetValue == null) {
      return '未设置';
    }
    return `${goal.targetValue} ${goal.targetUnit ?? ''}`.trim();
  }

  private buildRequest(): UpsertGoalRequest {
    const raw = this.form.getRawValue();
    return {
      targetValue: this.optionalNumber(raw.targetValue),
      targetUnit: (raw.targetUnit ?? '').trim() || null,
      targetDate: raw.targetDate || null,
      status: raw.status,
      notes: (raw.notes ?? '').trim() || null
    };
  }

  private defaultUnit(goalType: GoalType): string {
    const units: Record<GoalType, string> = {
      WEIGHT: 'kg',
      CALORIES: 'kcal',
      PROTEIN: 'g',
      WORKOUT_FREQUENCY: 'sessions/week'
    };
    return units[goalType];
  }

  private optionalNumber(value: number | null): number | null {
    if (value == null) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private upsertLocalGoal(goal: UserGoal): void {
    this.goals.update((goals) => [goal, ...goals.filter((item) => item.goalType !== goal.goalType)]);
  }
}
