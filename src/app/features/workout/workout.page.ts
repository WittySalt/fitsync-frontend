import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { Exercise, WorkoutPlan, WorkoutSession } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';

interface TrainingMetric {
  label: string;
  value: string;
  detail: string;
  tone: 'green' | 'blue' | 'orange';
}

@Component({
  selector: 'app-workout-page',
  imports: [StatePanelComponent, ReactiveFormsModule],
  templateUrl: './workout.page.html',
  styleUrl: './workout.page.scss'
})
export class WorkoutPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly plans = signal<WorkoutPlan[]>([]);
  readonly sessions = signal<WorkoutSession[]>([]);
  readonly exercises = signal<Exercise[]>([]);
  readonly activePlan = signal<WorkoutPlan | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly logFormOpen = signal(false);
  readonly selectedTab = signal<'overview' | 'plans' | 'history' | 'library'>('overview');

  readonly workoutTypes = ['STRENGTH', 'CARDIO', 'HIIT', 'MOBILITY', 'SPORT', 'OTHER'];

  readonly logForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    workoutType: ['STRENGTH', Validators.required],
    durationMinutes: [45, [Validators.required, Validators.min(1), Validators.max(600)]],
    caloriesBurned: [350, [Validators.required, Validators.min(0), Validators.max(5000)]],
    perceivedExertion: [7, [Validators.min(1), Validators.max(10)]],
    notes: ['', Validators.maxLength(300)]
  });

  readonly latestSession = computed(() => {
    const sorted = [...this.sessions()].sort((a, b) => this.timeOf(b) - this.timeOf(a));
    return sorted[0] ?? null;
  });

  readonly metrics = computed<TrainingMetric[]>(() => {
    const sessions = this.sessions();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const thisWeek = sessions.filter((session) => this.timeOf(session) >= weekAgo).length;
    const latest = this.latestSession();

    return [
      { label: 'Sessions logged', value: String(sessions.length), detail: 'recent history', tone: 'green' },
      { label: 'This week', value: String(thisWeek), detail: 'in the last 7 days', tone: 'blue' },
      {
        label: 'Last session',
        value: latest ? this.formatDate(latest.completedAt || latest.startedAt) : '—',
        detail: latest ? this.formatLabel(latest.workoutType) : 'none yet',
        tone: 'orange'
      }
    ];
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.dataService.getWorkoutPlans().subscribe((plans) => {
      this.plans.set(plans);
      this.loading.set(false);
    });
    this.dataService.getWorkoutSessions().subscribe((sessions) => this.sessions.set(sessions));
    this.dataService.getExercises().subscribe((exercises) => this.exercises.set(exercises));
    this.dataService.getActivePlan().subscribe((plan) => this.activePlan.set(plan));
  }

  toggleLogForm(): void {
    this.logFormOpen.update((open) => !open);
  }

  logWorkout(): void {
    this.logForm.markAllAsTouched();
    if (this.logForm.invalid) {
      return;
    }

    this.submitting.set(true);
    this.dataService.saveWorkoutSession(this.logForm.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.logFormOpen.set(false);
        this.logForm.reset({
          name: '',
          workoutType: 'STRENGTH',
          durationMinutes: 45,
          caloriesBurned: 350,
          perceivedExertion: 7,
          notes: ''
        });
        this.toast.success('Workout logged.');
        this.dataService.getWorkoutSessions().subscribe((sessions) => this.sessions.set(sessions));
      },
      error: () => {
        this.submitting.set(false);
        this.toast.error('Unable to log workout. Check your connection and try again.');
      }
    });
  }

  formatLabel(value: string | null | undefined): string {
    return (value ?? '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
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
