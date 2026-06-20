import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

import { WorkoutPlan, WorkoutPlanExercise, WorkoutSession } from '../../core/fitsync.models';
import { PlanTemplatesComponent } from './plan-templates.component';

@Component({
  selector: 'app-today-overview',
  imports: [PlanTemplatesComponent],
  templateUrl: './today-overview.component.html',
  styleUrl: './today-overview.component.scss'
})
export class TodayOverviewComponent {
  @Input({ required: true }) activePlan: WorkoutPlan | null = null;
  @Input({ required: true }) sessions: WorkoutSession[] = [];
  @Input() starting = false;

  @Output() startPlan = new EventEmitter<WorkoutPlan>();
  @Output() browsePlans = new EventEmitter<void>();
  @Output() templateActivated = new EventEmitter<WorkoutPlan>();

  readonly expandedExerciseId = signal<string | null>(null);

  latestSession(): WorkoutSession | null {
    const sorted = [...this.sessions].sort((a, b) => this.timeOf(b) - this.timeOf(a));
    return sorted[0] ?? null;
  }

  sortedExercises(): WorkoutPlanExercise[] {
    return [...(this.activePlan?.exercises ?? [])].sort((a, b) => a.sequence - b.sequence);
  }

  startToday(): void {
    if (this.activePlan?.planId) {
      this.startPlan.emit(this.activePlan);
    }
  }

  toggleExercise(exercise: WorkoutPlanExercise): void {
    const key = this.exerciseKey(exercise);
    this.expandedExerciseId.update((current) => (current === key ? null : key));
  }

  exerciseKey(exercise: WorkoutPlanExercise): string {
    return exercise.planExerciseId ?? exercise.exerciseId ?? `${exercise.sequence}-${exercise.exerciseNameSnapshot}`;
  }

  exerciseTarget(exercise: WorkoutPlanExercise): string {
    const parts: string[] = [];
    if (exercise.targetSets || exercise.targetReps) {
      parts.push(`${exercise.targetSets ?? '-'} x ${exercise.targetReps ?? '-'}`);
    }
    if (exercise.targetWeightKg) {
      parts.push(`${exercise.targetWeightKg} kg`);
    }
    if (exercise.targetDurationSeconds) {
      parts.push(`${exercise.targetDurationSeconds} sec`);
    }
    if (exercise.restSeconds) {
      parts.push(`${exercise.restSeconds} sec rest`);
    }
    return parts.length ? parts.join(' / ') : 'Guided movement';
  }

  formatLabel(value: string | null | undefined): string {
    return (value ?? '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return new Intl.DateTimeFormat('en-SG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  private timeOf(session: WorkoutSession): number {
    const value = session.completedAt || session.startedAt;
    const time = value ? new Date(value).getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
  }
}
