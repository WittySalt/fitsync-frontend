import { Component, EventEmitter, Input, Output } from '@angular/core';

import { WorkoutPlan, WorkoutPlanExercise, WorkoutSession } from '../../core/fitsync.models';
import { PlanTemplatesComponent } from './plan-templates.component';
import { isCompletedSession } from './workout-session.util';

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
  @Output() startExercise = new EventEmitter<WorkoutPlanExercise>();
  @Output() browsePlans = new EventEmitter<void>();
  @Output() templateActivated = new EventEmitter<WorkoutPlan>();


  latestSession(): WorkoutSession | null {
    const sorted = this.sessions
      .filter(isCompletedSession)
      .sort((a, b) => this.timeOf(b) - this.timeOf(a));
    return sorted[0] ?? null;
  }

  sortedExercises(): WorkoutPlanExercise[] {
    return [...(this.activePlan?.exercises ?? [])].sort((a, b) => a.sequence - b.sequence);
  }

  /**
   * The plan carries its own thumbnail now. This used to read a map filled by one
   * GET /exercises/{id} per plan exercise, which pulled each exercise's full detail to use a single
   * field — five requests for a five-move plan, and linear in plan size.
   */
  thumbnailFor(exercise: WorkoutPlanExercise): string | null {
    return exercise.primaryImageUrl ?? null;
  }

  startToday(): void {
    if (this.activePlan?.planId) {
      this.startPlan.emit(this.activePlan);
    }
  }

  startFromExercise(exercise: WorkoutPlanExercise): void {
    if (this.activePlan?.planId) {
      this.startExercise.emit(exercise);
    }
  }

  exerciseKey(exercise: WorkoutPlanExercise): string {
    return exercise.planExerciseId ?? exercise.exerciseId ?? `${exercise.sequence}-${exercise.exerciseNameSnapshot}`;
  }

  exerciseTarget(exercise: WorkoutPlanExercise): string {
    const parts: string[] = [];
    const { targetSets: sets, targetReps: reps, targetDurationSeconds: duration } = exercise;
    if (reps) {
      parts.push(`${sets ?? '-'} x ${reps}`);
      if (duration) {
        parts.push(`${duration} sec`);
      }
    } else if (duration) {
      parts.push(sets ? `${sets} x ${duration} sec hold` : `${duration} sec hold`);
    } else if (sets) {
      parts.push(`${sets} sets`);
    }
    if (exercise.targetWeightKg) {
      parts.push(`${exercise.targetWeightKg} kg`);
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
