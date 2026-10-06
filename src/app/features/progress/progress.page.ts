import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, map, timer } from 'rxjs';

import { CoachApiService } from '../../core/coach/coach-api.service';
import { CoachReading } from '../../core/coach/coach.models';
import { CoachStore } from '../../core/coach/coach.store';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { withoutCitations } from '../../shared/coach/insight/reading-text';
import { lastDays } from '../../shared/progress/progress-format';
import { ContentsNavComponent } from './cards/contents-nav.component';
import { EarlierWeeksSheetComponent } from './cards/earlier-weeks-sheet.component';
import { FoodCardComponent } from './cards/food-card.component';
import { GoalCardComponent } from './cards/goal-card.component';
import { pageState, ruleSentence, verdictFor } from './cards/goal-road';
import { PERIODS, SectionId, eyebrowText, periodOf, weekChips } from './cards/page-head';
import { watchSections } from './cards/section-watch';
import { TrainingCardComponent } from './cards/training-card.component';
import { WeekChipsComponent } from './cards/week-chips.component';
import { GoalProgress, WeeklyReview } from './progress-api.models';
import { SpotlightDirective } from '../../core/guide/spotlight.directive';
import { ProgressApiService } from './progress-api.service';
import { periodRange } from './training/training-period';
import { HowThisWorksComponent } from '../../core/guide/how-this-works.component';

/** The height of the app shell's top bar when it sticks or is fixed; 0 when it scrolls away or is absent. */
export function stickyHeaderHeight(root: Document): number {
  const bar = root.querySelector<HTMLElement>('header.topbar');
  const position = bar && root.defaultView ? root.defaultView.getComputedStyle(bar).position : '';
  return bar && (position === 'sticky' || position === 'fixed') ? Math.round(bar.getBoundingClientRect().height) : 0;
}

export const READING_POLL_MS = 3000;
export const READING_POLL_LIMIT = 8;

/**
 * Progress (spec 1): one page that opens with the answer, a verdict and one sentence, then the week
 * so far and three cards, Goal, Training and Food, each opening its own page. The verdict is rule
 * based from the goal road, so it never waits for the coach's model.
 */
@Component({
  selector: 'app-progress-page',
  imports: [HowThisWorksComponent, 
    ContentsNavComponent,
    EarlierWeeksSheetComponent,
    FoodCardComponent,
    GoalCardComponent,
    RouterLink,
    SpotlightDirective,
    TrainingCardComponent,
    WeekChipsComponent
  ],
  templateUrl: './progress.page.html',
  styleUrl: './progress.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressPage {
  private readonly api = inject(ProgressApiService);
  private readonly coachApi = inject(CoachApiService);
  private readonly coach = inject(CoachStore);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly answer = viewChild<ElementRef<HTMLElement>>('answer');

  protected readonly today = inject(UserTimezoneService).dateKey();
  protected readonly periods = PERIODS;
  private readonly code = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('period'))), { initialValue: null });
  protected readonly period = computed(() => periodOf(this.code()));

  protected readonly eyebrow = computed(() => eyebrowText(this.period(), this.today));
  /** The days Training reads and every Ask sends. */
  protected readonly range = computed(() => periodRange(this.period().key, this.today));
  /** The goal is read for the period itself, so its comparisons have an earlier period to compare with. */
  protected readonly goalWindow = computed(() => lastDays(this.period().days, this.today));
  protected readonly span = computed(() => ({ words: this.period().span, days: this.period().days }));
  /** Food reads the 30 days its page reads, or the whole period when that is longer. */
  protected readonly foodWindow = computed(() => lastDays(Math.max(30, this.period().days), this.today));
  protected readonly foodDays = computed(() => Math.max(30, this.period().days));

  // The goal: one read for the verdict and the card.
  protected readonly goal = signal<GoalProgress | null>(null);
  protected readonly goalLoading = signal(true);
  protected readonly goalFailed = signal(false);
  private goalRead: Subscription | null = null;

  // The coach's reading of the page: the sentence under the verdict and the lines between the cards.
  protected readonly reading = signal<CoachReading | null>(null);
  private attempts = 0;
  private readingRead: Subscription | null = null;

  // This week so far and the earlier weeks.
  protected readonly reviews = signal<WeeklyReview[]>([]);
  protected readonly reviewsLoading = signal(true);
  protected readonly reviewsFailed = signal(false);
  protected readonly sheetOpen = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('weeks') === 'earlier');
  private reviewsRead: Subscription | null = null;
  private current = signal<WeeklyReview | null>(null);

  // Where the reader is.
  protected readonly active = signal<SectionId>('goal');
  protected readonly railed = signal(false);
  /** Where the sticky contents row sticks: under the app's top bar when that bar sticks, else at the top. */
  protected readonly stickyTop = signal(0);

  protected readonly verdict = computed(() => verdictFor(pageState(this.goal(), this.today)));
  protected readonly sentence = computed(() => {
    const reading = this.reading();
    const headline = reading?.status === 'READY' ? withoutCitations(reading.reading?.headline ?? '').trim() : '';
    return headline || ruleSentence(this.goal());
  });
  /** The target of the calorie goal, which the Food card reads its energy line against. */
  protected readonly calorieTarget = computed(() => this.goal()?.otherGoals.find((item) => item.type === 'CALORIES')?.target ?? null);
  protected readonly chips = computed(() => weekChips(this.current()));

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.goalRead?.unsubscribe();
      this.readingRead?.unsubscribe();
      this.reviewsRead?.unsubscribe();
      this.coach.offerReading(null);
    });
    // A new period reads the goal window again.
    effect(() => {
      const { from, to } = this.goalWindow();
      untracked(() => this.loadGoal(from, to));
    });
    this.loadReading();
    this.loadWeek();
    afterNextRender(() => {
      this.stickyTop.set(stickyHeaderHeight(this.document));
      const stop = watchSections(this.document, this.answer()?.nativeElement ?? null, {
        onSection: (id) => this.active.set(id),
        onAnswerOut: (out) => this.railed.set(out)
      });
      this.destroyRef.onDestroy(stop);
    });
  }

  protected loadGoal(from = this.goalWindow().from, to = this.goalWindow().to): void {
    this.goalRead?.unsubscribe();
    this.goalLoading.set(true);
    this.goalFailed.set(false);
    this.goalRead = this.api.getGoal(from, to).subscribe({
      next: (goal) => {
        this.goal.set(goal);
        this.goalLoading.set(false);
      },
      error: () => {
        this.goalFailed.set(true);
        this.goalLoading.set(false);
      }
    });
  }

  private loadReading(): void {
    this.readingRead?.unsubscribe();
    this.readingRead = this.coachApi
      .getReading('PROGRESS')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reading) => this.acceptReading(reading),
        // Without the reading the page still answers, from the rules.
        error: () => this.coach.offerReading(null)
      });
  }

  private acceptReading(reading: CoachReading): void {
    this.attempts += 1;
    this.reading.set(reading);
    this.coach.offerReading(reading.status === 'READY' && reading.reading && reading.facts.length ? reading : null);
    if (reading.status === 'WRITING' && this.attempts < READING_POLL_LIMIT) {
      this.readingRead?.unsubscribe();
      this.readingRead = timer(READING_POLL_MS).subscribe(() => this.loadReading());
    }
  }

  protected loadWeek(): void {
    this.reviewsRead?.unsubscribe();
    this.reviewsLoading.set(true);
    this.reviewsFailed.set(false);
    this.reviewsRead = this.api.getReviews(8).subscribe({
      next: (reviews) => {
        this.reviews.set(reviews);
        this.current.set(reviews.find((review) => review.current) ?? reviews[0] ?? null);
        this.reviewsLoading.set(false);
      },
      error: () => {
        this.reviewsFailed.set(true);
        this.reviewsLoading.set(false);
      }
    });
  }

  /** Smooth scroll to a card, with no smoothing when the reader asked for less motion. */
  protected scrollTo(id: SectionId): void {
    const target = this.document.getElementById(`progress-${id}`);
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    this.active.set(id);
  }

  protected queryFor(key: string): { period: string | null } {
    return { period: key === '4w' ? null : key };
  }
}
