import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, computed, inject, signal } from '@angular/core';

import { AnalyticsApiService } from '../../core/analytics-api.service';
import { AnalyticsAchievement } from '../../core/analytics.models';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { WorkoutNewRecord, WorkoutSessionDetail } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { EffortBarsComponent } from './effort-bars.component';
import { SegmentStripComponent } from './plan-flow/segments/segment-strip.component';
import { sessionStripRows } from './segments/session-segments';

export interface WorkoutCelebrationSummary {
  completedSets: number;
  totalSets: number;
  elapsedSeconds: number;
  estimatedCalories: number;
  session: WorkoutSessionDetail;
}

/** One line of "Earned today": a new best or a badge. */
export interface EarnedItem {
  kind: 'record' | 'badge';
  title: string;
  line: string;
}

/** Badges are counted by another service from the workout's events, so they are asked for a moment later. */
export const BADGE_DELAY_MS = 1500;

const RECORD_WORDS: Record<string, (value: number) => string> = {
  MAX_WEIGHT_KG: (value) => `${trim(value)} kg`,
  MAX_REPS: (value) => `${trim(value)} reps`,
  MAX_SINGLE_SET_VOLUME_KG: (value) => `${trim(value)} kg in one set`
};

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The new bests of a session, one line for each exercise with what it beat. */
export function recordItems(records: readonly WorkoutNewRecord[] | undefined): EarnedItem[] {
  const byExercise = new Map<string, string[]>();
  for (const record of records ?? []) {
    const word = RECORD_WORDS[record.recordType];
    if (!word) {
      continue;
    }
    byExercise.set(record.exerciseName, [...(byExercise.get(record.exerciseName) ?? []), word(record.value)]);
  }
  return Array.from(byExercise, ([exercise, values]) => ({ kind: 'record' as const, title: 'New best', line: `${exercise} · ${values.join(', ')}` }));
}

/** Badges unlocked since the workout started. */
export function badgeItems(achievements: readonly AnalyticsAchievement[], since: string): EarnedItem[] {
  const start = new Date(since).getTime();
  return achievements
    .filter((badge) => badge.unlocked && badge.unlockedAt && (!Number.isFinite(start) || new Date(badge.unlockedAt).getTime() >= start))
    .map((badge) => ({ kind: 'badge' as const, title: `Badge · ${badge.title}`, line: 'unlocked today' }));
}

/**
 * The end of a completed workout: the result first (time, sets, calories), then what it earned,
 * then how hard it was. The effort the server estimated is already chosen; the person may tap
 * another value, which is saved when they leave. Nothing on it waits for an answer.
 */
@Component({
  selector: 'app-workout-celebration',
  imports: [EffortBarsComponent, SegmentStripComponent],
  templateUrl: './workout-celebration.component.html',
  styleUrl: './workout-celebration.component.scss'
})
export class WorkoutCelebrationComponent implements OnChanges, OnDestroy {
  private readonly dataService = inject(FitSyncDataService);
  private readonly analytics = inject(AnalyticsApiService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) summary: WorkoutCelebrationSummary | null = null;
  @Input() reducedMotion = false;

  @Output() continue = new EventEmitter<void>();

  readonly effort = signal(5);
  readonly effortEstimated = signal(true);
  readonly badges = signal<EarnedItem[]>([]);
  readonly saving = signal(false);

  readonly minutes = computed(() => Math.max(0, Math.round((this.summaryState()?.elapsedSeconds ?? 0) / 60)));
  readonly calories = computed(() => {
    const summary = this.summaryState();
    return summary?.session.caloriesBurned ?? summary?.estimatedCalories ?? 0;
  });
  readonly earned = computed(() => [...recordItems(this.summaryState()?.session.newRecords), ...this.badges()]);
  readonly segmentRows = computed(() => sessionStripRows(this.summaryState()?.session));
  readonly hasEffort = computed(() => this.summaryState()?.session.perceivedExertion != null);

  private readonly summaryState = signal<WorkoutCelebrationSummary | null>(null);
  private badgeTimerId: ReturnType<typeof setTimeout> | null = null;
  private hasVibrated = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['summary']) {
      return;
    }
    const summary = this.summary;
    this.summaryState.set(summary);
    this.effort.set(summary?.session.perceivedExertion ?? 5);
    this.effortEstimated.set(summary?.session.effortEstimated ?? true);
    this.badges.set([]);
    this.clearBadgeTimer();
    if (summary) {
      this.vibrateOnce();
      this.badgeTimerId = setTimeout(() => this.loadBadges(summary.session.startedAt), BADGE_DELAY_MS);
    }
  }

  ngOnDestroy(): void {
    this.clearBadgeTimer();
  }

  /** "Done": a value the person chose is saved on the way out; an untouched estimate is already saved. */
  done(): void {
    const session = this.summaryState()?.session;
    if (!session?.sessionId || this.effortEstimated() || this.saving() || !this.hasEffort()) {
      this.continue.emit();
      return;
    }
    this.saving.set(true);
    this.dataService.updateSessionEffort(session.sessionId, this.effort()).subscribe({
      next: () => this.continue.emit(),
      error: () => {
        this.toast.error('Unable to save how hard it was. The estimate is kept.');
        this.saving.set(false);
        this.continue.emit();
      }
    });
  }

  private loadBadges(since: string): void {
    this.badgeTimerId = null;
    this.analytics.getAchievements().subscribe({
      next: (response) => this.badges.set(badgeItems(response.achievements, since)),
      error: () => this.badges.set([])
    });
  }

  private vibrateOnce(): void {
    if (this.hasVibrated || this.reducedMotion || typeof navigator === 'undefined') {
      return;
    }
    navigator.vibrate?.(35);
    this.hasVibrated = true;
  }

  private clearBadgeTimer(): void {
    if (this.badgeTimerId) {
      clearTimeout(this.badgeTimerId);
      this.badgeTimerId = null;
    }
  }
}
