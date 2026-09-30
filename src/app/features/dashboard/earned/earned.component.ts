import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';

import { AnalyticsApiService } from '../../../core/analytics-api.service';
import { AnalyticsAchievement } from '../../../core/analytics.models';
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

  readonly timezone = input<string>('UTC');

  readonly achievements = signal<AnalyticsAchievement[]>([]);
  readonly achievementsLoading = signal(true);
  readonly achievementsFailed = signal(false);
  // The two figures come from the week-over-week comparison. A failed request leaves both null,
  // which the card reads as a week without training rather than as an error of its own.
  readonly weekMinutes = signal<number | null>(null);
  readonly previousWeekMinutes = signal<number | null>(null);
  readonly trainingLoading = signal(true);

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
  readonly trainingComparison = computed(() => comparisonLine(this.weekMinutes(), this.previousWeekMinutes()));

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

  private loadTraining(): void {
    this.trainingLoading.set(true);
    this.analyticsApi.getSummaryCompare('WEEK').subscribe({
      next: (response) => {
        this.weekMinutes.set(response.workout?.totalWorkoutMinutes?.current ?? null);
        this.previousWeekMinutes.set(response.workout?.totalWorkoutMinutes?.previous ?? null);
        this.trainingLoading.set(false);
      },
      error: () => {
        this.weekMinutes.set(null);
        this.previousWeekMinutes.set(null);
        this.trainingLoading.set(false);
      }
    });
  }
}
