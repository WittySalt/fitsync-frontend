import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';

import { AnalyticsApiService } from '../../../core/analytics-api.service';
import { AnalyticsAchievement } from '../../../core/analytics.models';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import { formatDuration } from '../brief/brief-duration';
import { BADGE_TOTAL, BadgeView, comparisonLine, toBadgeViews } from './earned-helpers';

const NO_TRAINING_TEXT = 'Nothing yet this week';

@Component({
  selector: 'app-earned',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './earned.component.html',
  styleUrl: './earned.component.scss'
})
export class EarnedComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);

  private readonly timezone = inject(UserTimezoneService).zone;
  /** Minutes trained Monday to Sunday of this week in the person's zone, from the dashboard. It
   *  matches the week strip, and the comparison below is the fallback while it is not sent. */
  readonly minutesThisWeek = input<number | null>(null);
  /** Consecutive training days, from the dashboard. Nothing is said below two. */
  readonly streakDays = input<number | null>(null);

  readonly achievements = signal<AnalyticsAchievement[]>([]);
  readonly achievementsLoading = signal(true);
  readonly achievementsFailed = signal(false);
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

  readonly badges = computed<BadgeView[]>(() => toBadgeViews(this.achievements(), this.timezone()));
  readonly earnedBadges = computed(() => this.badges().filter((badge) => badge.earned));
  readonly latestEarned = computed(() => this.earnedBadges()[0] ?? null);
  readonly badgeTotal = computed(() => this.achievements().length || BADGE_TOTAL);
  readonly badgeHeadline = computed(() => `${this.earnedBadges().length} of ${this.badgeTotal()} earned`);
  readonly latestEarnedLine = computed(() => {
    const latest = this.latestEarned();
    if (!latest) {
      return '';
    }
    return latest.dateLabel ? `${latest.title} · ${latest.dateLabel}` : latest.title;
  });

  readonly trainingHeadline = computed(() => {
    const minutes = this.weekMinutes();
    return minutes !== null && minutes > 0 ? formatDuration(minutes) || NO_TRAINING_TEXT : NO_TRAINING_TEXT;
  });
  // Both sides of the comparison come from the same request, so they cover the same days.
  readonly trainingComparison = computed(() => comparisonLine(this.compareMinutes(), this.previousWeekMinutes()));

  ngOnInit(): void {
    this.loadAchievements();
    this.loadTraining();
  }

  loadAchievements(): void {
    this.achievementsLoading.set(true);
    this.achievementsFailed.set(false);
    this.analyticsApi.getAchievements().subscribe({
      next: (response) => {
        this.achievements.set(response.achievements);
        this.achievementsLoading.set(false);
      },
      error: () => {
        this.achievementsFailed.set(true);
        this.achievementsLoading.set(false);
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
