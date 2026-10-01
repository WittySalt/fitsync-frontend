import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { WorkoutPlan } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { NoTemplateExercisesError, PlanTemplateActivationService } from '../dashboard/brief/no-plan/plan-template-activation.service';

interface TemplateExercise {
  code?: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  targetDurationSeconds?: number | null;
  restSeconds: number | null;
}

interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  goalFocus: string;
  workoutType: string;
  difficulty: string;
  estimatedDurationMinutes: number;
  exercises: TemplateExercise[];
}

export const WORKOUT_PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'full-body-beginner',
    name: 'Full-body beginner',
    description: 'Three simple strength moves to build a reliable base.',
    goalFocus: 'GENERAL_FITNESS',
    workoutType: 'STRENGTH',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 35,
    exercises: [
      { code: 'GOBLET_SQUAT', name: 'Goblet Squat', targetSets: 3, targetReps: 10, restSeconds: 75 },
      { code: 'BODYWEIGHT_PUSH_UP', name: 'Push-Up', targetSets: 3, targetReps: 8, restSeconds: 75 },
      { code: 'PLANK_HOLD', name: 'Plank Hold', targetSets: 3, targetReps: null, targetDurationSeconds: 30, restSeconds: 60 }
    ]
  },
  {
    id: 'upper-lower-split',
    name: 'Upper-lower split',
    description: 'A simple strength split built from seeded squat, press, and core movements.',
    goalFocus: 'STRENGTH',
    workoutType: 'STRENGTH',
    difficulty: 'INTERMEDIATE',
    estimatedDurationMinutes: 50,
    exercises: [
      { code: 'GOBLET_SQUAT', name: 'Goblet Squat', targetSets: 4, targetReps: 8, restSeconds: 120 },
      { code: 'BODYWEIGHT_PUSH_UP', name: 'Push-Up', targetSets: 4, targetReps: 8, restSeconds: 90 },
      { code: 'PLANK_HOLD', name: 'Plank Hold', targetSets: 3, targetReps: null, targetDurationSeconds: 45, restSeconds: 75 }
    ]
  },
  {
    id: 'hiit-starter',
    name: 'HIIT starter',
    description: 'Short conditioning blocks with bodyweight-friendly movements.',
    goalFocus: 'ENDURANCE',
    workoutType: 'HIIT',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 25,
    exercises: [
      { code: 'BODYWEIGHT_PUSH_UP', name: 'Push-Up', targetSets: 4, targetReps: 10, restSeconds: 45 },
      { code: 'GOBLET_SQUAT', name: 'Goblet Squat', targetSets: 4, targetReps: 12, restSeconds: 45 },
      { code: 'PLANK_HOLD', name: 'Plank Hold', targetSets: 4, targetReps: null, targetDurationSeconds: 30, restSeconds: 45 }
    ]
  },
  {
    id: 'mobility-reset',
    name: 'Mobility reset',
    description: 'Low impact movement for recovery days and desk-weary hips.',
    goalFocus: 'MOBILITY',
    workoutType: 'MOBILITY',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 20,
    exercises: [
      { code: 'PLANK_HOLD', name: 'Plank Hold', targetSets: 2, targetReps: null, targetDurationSeconds: 30, restSeconds: 45 },
      { code: 'GOBLET_SQUAT', name: 'Goblet Squat', targetSets: 2, targetReps: 8, restSeconds: 60 },
      { code: 'BODYWEIGHT_PUSH_UP', name: 'Push-Up', targetSets: 2, targetReps: 6, restSeconds: 60 }
    ]
  }
];

@Component({
  selector: 'app-plan-templates',
  templateUrl: './plan-templates.component.html',
  styleUrl: './plan-templates.component.scss'
})
export class PlanTemplatesComponent {
  private readonly activation = inject(PlanTemplateActivationService);
  private readonly toast = inject(ToastService);

  @Output() planActivated = new EventEmitter<WorkoutPlan>();

  readonly templates = WORKOUT_PLAN_TEMPLATES;
  readonly selectedTemplate = signal<PlanTemplate | null>(WORKOUT_PLAN_TEMPLATES[0] ?? null);
  readonly applyingTemplateId = signal<string | null>(null);

  selectTemplate(template: PlanTemplate): void {
    this.selectedTemplate.set(template);
  }

  useTemplate(template: PlanTemplate): void {
    if (this.applyingTemplateId()) {
      return;
    }

    this.applyingTemplateId.set(template.id);
    this.activation.activate(template).pipe(
      finalize(() => this.applyingTemplateId.set(null))
    ).subscribe({
      next: ({ plan, skipped }) => {
        if (skipped > 0) {
          this.toast.info(`${skipped} template exercise${skipped === 1 ? '' : 's'} unavailable and skipped.`);
        }
        this.toast.success('Template activated for today.');
        this.planActivated.emit(plan);
      },
      error: (error: unknown) => this.toast.error(
        error instanceof NoTemplateExercisesError ? error.message : 'Unable to use this template. Please retry.'
      )
    });
  }

  formatLabel(value: string): string {
    return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
