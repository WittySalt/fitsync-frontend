import { Component, inject, OnInit, signal } from '@angular/core';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutPlan } from '../../core/fitsync.models';
import { StatePanelComponent } from '../../shared/state-panel.component';

@Component({
  selector: 'app-workout-page',
  imports: [StatePanelComponent],
  templateUrl: './workout.page.html'
})
export class WorkoutPage implements OnInit {
  private readonly dataService = inject(FitSyncDataService);

  readonly plans = signal<WorkoutPlan[]>([]);
  readonly loading = signal(true);
  readonly selectedTab = signal<'plans' | 'sessions' | 'exercises'>('plans');

  ngOnInit(): void {
    this.dataService.getWorkoutPlans().subscribe((plans) => {
      this.plans.set(plans);
      this.loading.set(false);
    });
  }
}

