import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { UserTimezoneService } from '../../core/user-timezone.service';
import { AdminApiService, CoachQuality } from './admin-api.service';
import { barWidthPercent, buildDayBars, chartAltText, chartRangeLabel, largestCount } from './coach-quality.chart';
import {
  PERIOD_OPTIONS,
  PeriodDays,
  formatMilliseconds,
  formatSeconds,
  passedAnswersLine,
  pivotReadings,
  rangeEndingToday,
  readingsNote,
  sharePercent,
  toolCallsNote
} from './coach-quality.format';

type LoadState = { kind: 'loading' } | { kind: 'ready'; quality: CoachQuality } | { kind: 'error'; forbidden: boolean };

interface Tile {
  key: string;
  label: string;
  value: number;
  caption: string;
}

interface RuleRow {
  rule: string;
  count: number;
  widthPercent: number;
}

@Component({
  selector: 'app-coach-quality-page',
  templateUrl: './coach-quality.page.html',
  styleUrls: ['./admin-page.scss', './coach-quality.page.scss']
})
export class CoachQualityPage {
  private readonly api = inject(AdminApiService);
  private readonly userTimezone = inject(UserTimezoneService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<PeriodDays>();

  protected readonly periods = PERIOD_OPTIONS;
  protected readonly skeletonTiles = [1, 2, 3, 4, 5];
  protected readonly days = signal<PeriodDays>(7);
  protected readonly state = signal<LoadState>({ kind: 'loading' });

  protected readonly quality = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.quality : null;
  });

  protected readonly forbidden = computed(() => {
    const state = this.state();
    return state.kind === 'error' && state.forbidden;
  });

  protected readonly tiles = computed<Tile[]>(() => {
    const answers = this.quality()?.answers;
    const total = answers?.total ?? 0;
    const share = (count: number) => `${sharePercent(count, total)}%`;
    return [
      { key: 'total', label: 'Answers', value: total, caption: `in ${this.days()} days` },
      { key: 'passed', label: 'Passed', value: answers?.passed ?? 0, caption: share(answers?.passed ?? 0) },
      { key: 'rejected', label: 'Rejected', value: answers?.rejected ?? 0, caption: share(answers?.rejected ?? 0) },
      { key: 'refused', label: 'Refused', value: answers?.refused ?? 0, caption: share(answers?.refused ?? 0) },
      { key: 'unavailable', label: 'Model unavailable', value: answers?.modelUnavailable ?? 0, caption: share(answers?.modelUnavailable ?? 0) }
    ];
  });

  protected readonly bars = computed(() => buildDayBars(this.quality()?.daily ?? []));
  protected readonly chartAlt = computed(() => chartAltText(this.bars()));
  protected readonly chartRange = computed(() => chartRangeLabel(this.bars()));
  protected readonly hasAnswers = computed(() => (this.quality()?.answers.total ?? 0) > 0);

  protected readonly rejectedRules = computed(() => this.ruleRows(this.quality()?.answers.rejectedByRule ?? []));
  protected readonly refusedRules = computed(() => this.ruleRows(this.quality()?.answers.refusedByRule ?? []));
  protected readonly rulesNote = computed(() => {
    const answers = this.quality()?.answers;
    return `${answers?.rejected ?? 0} rejected, ${answers?.refused ?? 0} refused`;
  });

  protected readonly hasPassed = computed(() => (this.quality()?.answers.passed ?? 0) > 0);
  protected readonly median = computed(() => formatSeconds(this.quality()?.latency.medianMs ?? 0));
  protected readonly p95 = computed(() => formatSeconds(this.quality()?.latency.p95Ms ?? 0));
  protected readonly passedLine = computed(() => passedAnswersLine(this.quality()?.answers.passed ?? 0, this.quality()?.models ?? []));

  protected readonly tools = computed(() => this.quality()?.tools ?? []);
  protected readonly toolsNote = computed(() => toolCallsNote(this.tools()));
  protected readonly readings = computed(() => pivotReadings(this.quality()?.readings ?? []));
  protected readonly readingsNote = computed(() => readingsNote(this.readings()));

  constructor() {
    this.reload$
      .pipe(
        switchMap((days) => {
          const range = rangeEndingToday(days, new Date(), this.userTimezone.zone());
          return this.api.getCoachQuality(range.from, range.to).pipe(
            map((quality): LoadState => ({ kind: 'ready', quality })),
            catchError((error: unknown) => of<LoadState>({ kind: 'error', forbidden: error instanceof HttpErrorResponse && error.status === 403 })),
            startWith<LoadState>({ kind: 'loading' })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((state) => this.state.set(state));

    this.reload$.next(this.days());
  }

  protected selectPeriod(days: PeriodDays): void {
    if (days === this.days() && this.state().kind !== 'error') {
      return;
    }
    this.days.set(days);
    this.reload$.next(days);
  }

  protected retry(): void {
    this.reload$.next(this.days());
  }

  protected toolMedian(milliseconds: number): string {
    return formatMilliseconds(milliseconds);
  }

  private ruleRows(rows: { rule: string; count: number }[]): RuleRow[] {
    const largest = largestCount(rows);
    return [...rows]
      .sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule))
      .map((row) => ({ rule: row.rule, count: row.count, widthPercent: barWidthPercent(row.count, largest) }));
  }
}
