import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnInit, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ReadingFact } from '../../core/coach/coach.models';
import { CoachStore } from '../../core/coach/coach.store';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { InsightPanelComponent } from '../../shared/coach/insight/insight-panel.component';
import { dateRangeLabel } from '../../shared/date-label';
import { JumpBarComponent } from '../../shared/progress/jump-bar.component';
import { lastDays } from '../../shared/progress/progress-format';
import { JumpItem } from '../../shared/progress/progress.models';
import { FoodCardComponent } from './cards/food-card.component';
import { GoalCardComponent } from './cards/goal-card.component';
import { ReviewsCardComponent } from './cards/reviews-card.component';
import { TrainingCardComponent } from './training/training-card.component';

type SectionId = 'summary' | 'goal' | 'training' | 'food' | 'reviews';
type CitedCard = 'GOAL' | 'TRAINING' | 'FOOD';

export const PROGRESS_SECTIONS: readonly JumpItem[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'goal', label: 'Goal' },
  { id: 'training', label: 'Training' },
  { id: 'food', label: 'Food' },
  { id: 'reviews', label: 'Reviews' }
];

/** How long a card keeps its ring after a fact in the reading pointed at it. */
export const RING_MS = 2400;

function isSection(value: string | null): value is SectionId {
  return PROGRESS_SECTIONS.some((section) => section.id === value);
}

/**
 * Progress: one page that answers "is it working?" for a period. The coach's reading is on top and
 * each of its facts can point at the card it comes from; below are the Goal, Training and Food cards,
 * each opening its own page, and the latest weekly review. The sticky jump bar moves between them
 * and keeps `?section=` in the address so a link can open at a section.
 */
@Component({
  selector: 'app-progress-page',
  imports: [FoodCardComponent, GoalCardComponent, InsightPanelComponent, JumpBarComponent, ReviewsCardComponent, TrainingCardComponent],
  templateUrl: './progress.page.html',
  styleUrl: './progress.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressPage implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly coach = inject(CoachStore);
  private readonly timezone = inject(UserTimezoneService);
  private ringTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly sections = PROGRESS_SECTIONS;
  readonly active = signal<SectionId>('summary');
  readonly ringed = signal<CitedCard | null>(null);

  readonly today = this.timezone.dateKey();
  /** The four weeks the page describes and every Ask sends. */
  readonly fourWeeks = lastDays(28, this.today);
  /** About three months, so the weight chart shows the trend that leads to now. */
  readonly goalPeriod = lastDays(91, this.today);
  /** The last 30 days, the window the Food card and the Food page read. */
  readonly foodPeriod = lastDays(30, this.today);
  readonly periodLabel = `The last 4 weeks · ${dateRangeLabel(this.fourWeeks.from, this.fourWeeks.to)}`;

  /** The number of the first fact in the reading that cites each card. */
  readonly factNumbers = computed(() => {
    const numbers: Partial<Record<CitedCard, number>> = {};
    for (const fact of this.coach.availableReading()?.facts ?? []) {
      if (fact.card && numbers[fact.card] === undefined) {
        numbers[fact.card] = fact.number;
      }
    }
    return numbers;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.ringTimer));
  }

  ngOnInit(): void {
    const section = this.route.snapshot.queryParamMap.get('section');
    if (isSection(section) && section !== 'summary') {
      this.active.set(section);
      afterNextRender(() => this.scrollTo(section), { injector: this.injector });
    }
  }

  jump(id: string): void {
    if (!isSection(id)) {
      return;
    }
    this.active.set(id);
    this.scrollTo(id);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { section: id }, replaceUrl: true });
  }

  /** A fact in the reading was chosen: its card comes into view and keeps a ring for a moment. */
  showCard(fact: ReadingFact): void {
    const card = fact.card;
    if (!card) {
      return;
    }
    const id = card.toLowerCase() as SectionId;
    this.active.set(id);
    this.scrollTo(id);
    this.ringed.set(card);
    clearTimeout(this.ringTimer);
    this.ringTimer = setTimeout(() => this.ringed.set(null), RING_MS);
  }

  private scrollTo(id: SectionId): void {
    const target = document.getElementById(`progress-${id}`);
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  }
}
