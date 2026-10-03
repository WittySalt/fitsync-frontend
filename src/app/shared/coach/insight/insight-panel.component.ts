import { ChangeDetectionStrategy, Component, DestroyRef, InjectionToken, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, catchError, of, timer } from 'rxjs';

import { CoachApiService } from '../../../core/coach/coach-api.service';
import { CoachReading, ReadingSurface } from '../../../core/coach/coach.models';
import { CoachStore } from '../../../core/coach/coach.store';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { NutritionInsightsPage, ProgressInsight } from '../../../core/fitsync.models';
import { InsightReadState } from './insight-read-state';
import { readingSegments } from './reading-text';
import { MealBarsComponent } from './meal-bars.component';
import { dateRange, shortDate } from './slope-chart.geometry';
import { SlopeChartComponent } from './slope-chart.component';
import { WeightProjectionComponent } from './weight-projection.component';

/** The clock, as a token, so that tests can fix the time the panel calls "now". */
export const INSIGHT_NOW = new InjectionToken<() => Date>('INSIGHT_NOW', {
  providedIn: 'root',
  factory: () => () => new Date()
});

export const READING_POLL_MS = 3000;
export const READING_POLL_LIMIT = 8;

type PanelView = 'loading' | 'hidden' | 'reading' | 'folded' | 'writing' | 'resting';

/**
 * The insight panel at the top of a page.
 *
 * It shows one reading written by the coach model and the measured facts the reading stands on.
 * The facts are worked out by fixed rules and are shown whether or not the model is available. A
 * reading the user has already read is folded to one line, so the page's own content stays on the
 * first screen. When there is nothing to show, or the request fails, the panel takes no space.
 */
@Component({
  selector: 'app-insight-panel',
  standalone: true,
  imports: [SlopeChartComponent, MealBarsComponent, WeightProjectionComponent],
  templateUrl: './insight-panel.component.html',
  styleUrl: './insight-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InsightPanelComponent implements OnInit, OnDestroy {
  private readonly api = inject(CoachApiService);
  private readonly data = inject(FitSyncDataService);
  private readonly coachStore = inject(CoachStore);
  private readonly readState = inject(InsightReadState);
  private readonly now = inject(INSIGHT_NOW);
  private readonly destroyRef = inject(DestroyRef);

  readonly surface = input.required<ReadingSurface>();

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly result = signal<CoachReading | null>(null);
  readonly folded = signal(false);
  readonly workingShown = signal(false);
  /** The figures behind the Nutrition chart. They come from their own request, and without them the reading has no chart. */
  readonly meals = signal<NutritionInsightsPage | null>(null);
  /** The figures behind the Progress chart, with the same rule. */
  readonly weight = signal<ProgressInsight | null>(null);

  private attempts = 0;
  private request: Subscription | null = null;
  private chartRequest: Subscription | null = null;
  private wait: Subscription | null = null;
  // The reading counts as read once it has been on screen unfolded. It is recorded when the user
  // folds it or leaves the page, so that it stays open for the whole of the first visit.
  private shownUnfolded = false;

  readonly view = computed<PanelView>(() => {
    if (this.loading()) {
      return 'loading';
    }
    const result = this.result();
    if (this.failed() || !result || result.status === 'EMPTY' || !result.facts.length) {
      return 'hidden';
    }
    if (result.status === 'READY' && result.reading) {
      return this.folded() ? 'folded' : 'reading';
    }
    return result.status === 'WRITING' ? 'writing' : 'resting';
  });

  readonly facts = computed(() => this.result()?.facts ?? []);
  readonly lifts = computed(() => this.result()?.lifts ?? []);
  readonly headline = computed(() => this.result()?.reading?.headline ?? '');
  /** The reading names the lunch-and-dinner share, so the meal chart lets those two bars stand out. */
  readonly lunchAndDinnerLed = computed(() => this.facts().some((fact) => fact.key === 'PROTEIN_LUNCH_DINNER'));

  readonly segments = computed(() => {
    const result = this.result();
    return result?.reading ? readingSegments(result.reading.body, result.facts.length) : [];
  });

  /**
   * Who wrote the reading. A reading written by fixed rules says so, because it must never be
   * taken for the model's. Its time is left out, since it is written again on every visit.
   */
  readonly writtenLabel = computed(() => {
    const reading = this.result()?.reading;
    if (!reading || reading.source !== 'MODEL') {
      return 'Fixed rules';
    }
    const age = reading.generatedAt ? ageLabel(reading.generatedAt, this.now()) : '';
    return age ? `Coach model · ${age}` : 'Coach model';
  });

  /** The days the reading describes, shown beside its title, for example "21 to 27 Sept". */
  readonly periodRange = computed(() => dateRange(this.result()?.periodStart ?? null, this.result()?.periodEnd ?? null));

  readonly periodLabel = computed(() => {
    const result = this.result();
    const from = result?.periodStart ? shortDate(result.periodStart) : '';
    const to = result?.periodEnd ? shortDate(result.periodEnd) : '';
    if (!from || !to) {
      return '';
    }
    return from === to ? `Measured on ${from}.` : `Measured from ${from} to ${to}.`;
  });

  readonly headingId = computed(() => `insight-${this.surface().toLowerCase()}-heading`);
  readonly workingId = computed(() => `insight-${this.surface().toLowerCase()}-working`);

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.rememberIfRead();
    this.coachStore.offerReading(null);
  }

  fold(): void {
    this.rememberIfRead();
    this.folded.set(true);
  }

  open(): void {
    this.folded.set(false);
    this.shownUnfolded = true;
  }

  toggleWorking(): void {
    this.workingShown.update((shown) => !shown);
  }

  /**
   * Opens the coach with this reading pinned as the subject. Nothing is sent: the pin is what lets
   * the coach ground its next answer and offer questions that follow from the reading, and the
   * user still decides whether and what to ask.
   */
  askAboutThis(): void {
    const reading = this.result();
    if (!reading) {
      return;
    }
    this.coachStore.askAboutReading(reading);
  }

  private load(): void {
    this.request?.unsubscribe();
    this.request = this.api
      .getReading(this.surface())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reading) => this.accept(reading),
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
          this.coachStore.offerReading(null);
        }
      });
  }

  private accept(reading: CoachReading): void {
    this.attempts += 1;
    const stillWriting = reading.status === 'WRITING';
    // A model that has not answered after the last attempt is shown as resting. The facts are
    // there either way, and the reading will be found on the next visit if it arrives late.
    this.result.set(stillWriting && this.attempts >= READING_POLL_LIMIT ? { ...reading, status: 'RESTING' } : reading);
    this.loading.set(false);

    // The coach panel lists the reading only while this panel has one on show.
    const shown = this.result();
    this.coachStore.offerReading(shown && shown.status === 'READY' && shown.reading && shown.facts.length ? shown : null);

    if (reading.status === 'READY' && reading.reading) {
      this.loadChart();
      const alreadyRead = this.readState.wasRead(reading.surface, readKey(reading));
      this.folded.set(alreadyRead);
      this.shownUnfolded = !alreadyRead;
    }

    if (stillWriting && this.attempts < READING_POLL_LIMIT) {
      this.wait?.unsubscribe();
      this.wait = timer(READING_POLL_MS)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.load());
    }
  }

  /**
   * Loads the figures for the surface's chart. A request that fails leaves the reading as it is
   * without a chart: the chart is an addition to the reading and never a reason to hide it.
   */
  private loadChart(): void {
    const surface = this.surface();
    if (surface === 'WORKOUT' || this.chartRequest) {
      return;
    }
    if (surface === 'NUTRITION') {
      this.chartRequest = this.data
        .getNutritionInsightsPage()
        .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
        .subscribe((page) => this.meals.set(page && page.proteinByMeal.length ? page : null));
    } else {
      this.chartRequest = this.data
        .getProgressInsight()
        .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
        .subscribe((insight) => this.weight.set(insight && insight.series.length >= 2 ? insight : null));
    }
  }

  private rememberIfRead(): void {
    const result = this.result();
    if (this.shownUnfolded && result?.status === 'READY' && result.reading) {
      this.readState.markRead(result.surface, readKey(result));
    }
  }
}

/**
 * What is remembered as read. The writer is part of it, so that a model reading that arrives for
 * facts whose rule-written reading was already read opens unfolded.
 */
function readKey(reading: CoachReading): string | null {
  return reading.readingId && reading.reading ? `${reading.readingId}:${reading.reading.source}` : null;
}

/** "just now", "5 min ago", "3 h ago" or "2 days ago". An unreadable time gives an empty label. */
export function ageLabel(generatedAt: string, now: Date): string {
  const written = new Date(generatedAt).getTime();
  if (Number.isNaN(written)) {
    return '';
  }
  const minutes = Math.max(0, Math.floor((now.getTime() - written) / 60_000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
