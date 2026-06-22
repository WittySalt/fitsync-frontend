import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsActivityCalendarResponse, AnalyticsActivityDay } from '../../core/analytics.models';
import { StatePanelComponent } from '../../shared/state-panel.component';

interface RangePreset {
  label: string;
  days: number;
}

@Component({
  selector: 'app-activity-heatmap',
  imports: [StatePanelComponent],
  templateUrl: './activity-heatmap.component.html',
  styleUrl: './activity-heatmap.component.scss'
})
export class ActivityHeatmapComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);

  readonly rangePresets: RangePreset[] = [
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
    { label: '1Y', days: 365 }
  ];

  readonly data = signal<AnalyticsActivityCalendarResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly startDate = signal(this.isoDaysAgo(90));
  readonly endDate = signal(this.isoToday());

  readonly days = computed<AnalyticsActivityDay[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }

    const byDate = new Map(data.days.map((day) => [day.date, day]));
    return this.eachDate(data.from, data.to).map(
      (date) => byDate.get(date) ?? { date, workoutCount: 0, workoutMinutes: 0 }
    );
  });

  readonly hasDays = computed(() => this.days().length > 0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.analyticsApi.getActivityCalendar(this.startDate(), this.endDate()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load workout activity. Please retry.');
        this.loading.set(false);
      }
    });
  }

  setPreset(days: number): void {
    this.startDate.set(this.isoDaysAgo(days));
    this.endDate.set(this.isoToday());
    this.load();
  }

  updateStartDate(event: Event): void {
    this.startDate.set((event.target as HTMLInputElement).value);
  }

  updateEndDate(event: Event): void {
    this.endDate.set((event.target as HTMLInputElement).value);
  }

  intensity(day: AnalyticsActivityDay): number {
    if (day.workoutCount <= 0 && day.workoutMinutes <= 0) {
      return 0;
    }
    if (day.workoutCount >= 4 || day.workoutMinutes >= 90) {
      return 4;
    }
    if (day.workoutCount >= 3 || day.workoutMinutes >= 60) {
      return 3;
    }
    if (day.workoutCount >= 2 || day.workoutMinutes >= 30) {
      return 2;
    }
    return 1;
  }

  tooltip(day: AnalyticsActivityDay): string {
    if (day.workoutCount <= 0 && day.workoutMinutes <= 0) {
      return `${day.date}: No workouts`;
    }

    const workoutLabel = day.workoutCount === 1 ? '1 workout' : `${day.workoutCount} workouts`;
    return `${day.date}: ${workoutLabel}, ${day.workoutMinutes} min`;
  }

  private eachDate(from: string, to: string): string[] {
    const dates: string[] = [];
    const cursor = this.parseIsoDate(from);
    const end = this.parseIsoDate(to);

    while (cursor <= end) {
      dates.push(this.formatIsoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  private isoToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private isoDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  }

  private parseIsoDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
