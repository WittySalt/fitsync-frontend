import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AnalyticsApiService } from '../../../core/analytics-api.service';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { BadgesModel } from '../../../core/me.models';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import { BadgeDiscComponent } from '../../../shared/badges/badge-disc.component';
import { formatDuration } from '../brief/brief-duration';
import { comparisonLine, stripView } from './earned-helpers';

const NO_TRAINING_TEXT = 'Nothing yet this week';

@Component({
  selector: 'app-earned',
  imports: [RouterLink, BadgeDiscComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './earned.component.html',
  styleUrl: './earned.component.scss'
})
export class EarnedComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly data = inject(FitSyncDataService);

  private readonly timezone = inject(UserTimezoneService);
  /** Minutes trained Monday to Sunday of this week in the person's zone, from the dashboard. It
   *  matches the week strip, and the comparison below is the fallback while it is not sent. */
  readonly minutesThisWeek = input<number | null>(null);
  /** Consecutive training days, from the dashboard. Nothing is said below two. */
  readonly streakDays = input<number | null>(null);

  readonly badges = signal<BadgesModel | null>(null);
  readonly badgesLoading = signal(true);
  readonly badgesFailed = signal(false);
  // The two figures come from the week-over-week comparison.
  private readonly compareMinutes = signal<number | null>(null);
  readonly previousWeekMinutes = signal<number | null>(null);
  readonly trainingLoading = signal(true);
  // A failed comparison is said out loud, because "Nothing yet this week" would be untrue.
  readonly trainingFailed = signal(false);

  readonly weekMinutes = computed(() => this.minutesThisWeek() ?? this.compareMinutes());
  readonly streakLine = computed(() => {
    const days = this.streakDays();
    return days !== null && days >= 2 ? `${days} days in a row` : '';
  });

  /** The strip: the newest badge earned this week, or a quiet line when nothing is new. */
  readonly strip = computed(() => {
    const model = this.badges();
    return model ? stripView(model, this.timezone.dateKey()) : null;
  });

  readonly trainingHeadline = computed(() => {
    const minutes = this.weekMinutes();
    return minutes !== null && minutes > 0 ? formatDuration(minutes) || NO_TRAINING_TEXT : NO_TRAINING_TEXT;
  });
  // Both sides of the comparison come from the same request, so they cover the same days.
  readonly trainingComparison = computed(() => comparisonLine(this.compareMinutes(), this.previousWeekMinutes()));

  ngOnInit(): void {
    this.loadBadges();
    this.loadTraining();
  }

  loadBadges(): void {
    this.badgesLoading.set(true);
    this.badgesFailed.set(false);
    this.data.getBadges().subscribe({
      next: (model) => {
        this.badges.set(model);
        this.badgesLoading.set(false);
      },
      error: () => {
        this.badgesFailed.set(true);
        this.badgesLoading.set(false);
      }
    });
  }

  loadTraining(): void {
    this.trainingLoading.set(true);
    this.trainingFailed.set(false);
    this.analyticsApi.getSummaryCompare('WEEK').subscribe({
      next: (response) => {
        this.compareMinutes.set(response.workout?.totalWorkoutMinutes?.current ?? null);
        this.previousWeekMinutes.set(response.workout?.totalWorkoutMinutes?.previous ?? null);
        this.trainingLoading.set(false);
      },
      error: () => {
        this.compareMinutes.set(null);
        this.previousWeekMinutes.set(null);
        // With the dashboard's own figure the headline is still true; only the comparison is lost.
        this.trainingFailed.set(this.minutesThisWeek() === null);
        this.trainingLoading.set(false);
      }
    });
  }
}
