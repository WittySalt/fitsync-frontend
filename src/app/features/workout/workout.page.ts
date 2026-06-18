import { Component, inject, OnInit, signal } from '@angular/core';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutPlan } from '../../core/fitsync.models';
import { StatePanelComponent } from '../../shared/state-panel.component';

interface TrainingMetric {
  label: string;
  value: string;
  detail: string;
  tone: 'green' | 'blue' | 'orange';
}

interface WorkoutSet {
  exercise: string;
  target: string;
  logged: string;
  status: 'Ready' | 'Active' | 'Done';
}

interface WorkoutHistoryItem {
  name: string;
  type: string;
  completedAt: string;
  duration: string;
  volume: string;
}

interface ExerciseCatalogItem {
  name: string;
  muscles: string;
  equipment: string;
  level: string;
}

@Component({
  selector: 'app-workout-page',
  imports: [StatePanelComponent],
  templateUrl: './workout.page.html',
  styleUrl: './workout.page.scss'
})
export class WorkoutPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);

  readonly plans = signal<WorkoutPlan[]>([]);
  readonly loading = signal(true);
  readonly selectedTab = signal<'overview' | 'plans' | 'history' | 'library'>('overview');

  readonly metrics: TrainingMetric[] = [
    { label: 'Weekly load', value: '18.4k kg', detail: '+12% from last week', tone: 'green' },
    { label: 'Consistency', value: '4 / 5', detail: 'sessions completed', tone: 'blue' },
    { label: 'Recovery', value: 'Ready', detail: 'next hard day allowed', tone: 'orange' }
  ];

  readonly todaySets: WorkoutSet[] = [
    { exercise: 'Barbell bench press', target: '4 x 6 at 62.5 kg', logged: '3 sets logged', status: 'Active' },
    { exercise: 'One-arm row', target: '3 x 10 each side', logged: 'Next exercise', status: 'Ready' },
    { exercise: 'Incline dumbbell press', target: '3 x 8', logged: 'Accessory block', status: 'Ready' },
    { exercise: 'Cable face pull', target: '3 x 15', logged: 'Shoulder health', status: 'Ready' }
  ];

  readonly history: WorkoutHistoryItem[] = [
    { name: 'Lower Body Strength', type: 'Strength', completedAt: 'Yesterday 18:40', duration: '54 min', volume: '7.8k kg' },
    { name: 'Zone 2 Run', type: 'Cardio', completedAt: 'Mon 07:15', duration: '36 min', volume: '5.7 km' },
    { name: 'Upper Body Strength', type: 'Strength', completedAt: 'Sat 10:20', duration: '49 min', volume: '6.9k kg' }
  ];

  readonly catalog: ExerciseCatalogItem[] = [
    { name: 'Back squat', muscles: 'Quads, glutes', equipment: 'Barbell', level: 'Intermediate' },
    { name: 'Romanian deadlift', muscles: 'Hamstrings', equipment: 'Barbell', level: 'Intermediate' },
    { name: 'Lat pulldown', muscles: 'Back', equipment: 'Cable', level: 'Beginner' },
    { name: 'Plank shoulder tap', muscles: 'Core', equipment: 'Bodyweight', level: 'Beginner' }
  ];

  ngOnInit(): void {
    this.dataService.getWorkoutPlans().subscribe((plans) => {
      this.plans.set(plans);
      this.loading.set(false);
    });
  }

  formatLabel(value: string): string {
    return value.replaceAll('_', ' ').toLowerCase();
  }

  planCompletion(plan: WorkoutPlan): number {
    if (plan.status === 'ACTIVE') {
      return 72;
    }

    if (plan.status === 'DRAFT') {
      return 34;
    }

    return 50;
  }
}
