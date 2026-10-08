import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Subscription, map, of, switchMap } from 'rxjs';

import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { DayKind, NutritionSummary } from '../../../../core/fitsync.models';
import { isTrainingDayKind } from '../day-kind-icons';
import { DayLoad, DaySession, buildDayRows, dayHeading } from './month-day';
import { MonthDetailComponent } from './month-detail.component';
import { dateKeyInTimezone } from './month-grid';
import { MonthViewState } from './month-view.state';

const DAY_MS = 24 * 60 * 60 * 1000;

/** What happened on the picked date: the training, a record, the food and a weigh-in. The month's
 *  insight already says which kind of day it was; the sessions and the day's food are asked for
 *  here, once for each date picked, and a request that fails leaves its line out. */
@Component({
  selector: 'app-month-day',
  standalone: true,
  imports: [MonthDetailComponent],
  template: `<app-month-detail
    [heading]="heading()"
    backLabel="Back to the month"
    [rows]="view().rows"
    [quiet]="view().quiet"
    (back)="state.clearSelection(true)"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthDayComponent {
  protected readonly state = inject(MonthViewState);
  private readonly data = inject(FitSyncDataService);

  /** The date picked, as YYYY-MM-DD. */
  readonly date = input.required<string>();

  private readonly sessions = signal<DaySession[]>([]);
  private readonly exercises = signal<string[]>([]);
  private readonly food = signal<NutritionSummary | null>(null);
  private readonly sessionsLoad = signal<DayLoad>('done');
  private readonly foodLoad = signal<DayLoad>('done');
  private requests: Subscription[] = [];

  protected readonly heading = computed(() => dayHeading(this.date()));
  protected readonly view = computed(() => {
    const date = this.date();
    const insight = this.state.insight();
    return buildDayRows({
      dateKey: date,
      timezone: this.state.zone(),
      referenceDate: this.state.referenceDate(),
      firstSessionDate: this.state.firstSessionDate(),
      day: insight?.days.find((entry) => entry.date === date) ?? null,
      sessions: this.sessions(),
      exercises: this.exercises(),
      food: this.food(),
      weightKg: this.state.weightByDate().get(date) ?? null,
      sessionsLoad: this.sessionsLoad(),
      foodLoad: this.foodLoad()
    });
  });

  constructor() {
    effect(() => {
      const date = this.date();
      untracked(() => this.load(date));
    });
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  private cancel(): void {
    this.requests.forEach((request) => request.unsubscribe());
    this.requests = [];
  }

  private load(date: string): void {
    this.cancel();
    this.sessions.set([]);
    this.exercises.set([]);
    this.food.set(null);
    this.sessionsLoad.set('done');
    this.foodLoad.set('done');

    const zone = this.state.zone();
    const day = this.state.insight()?.days.find((entry) => entry.date === date);

    if (day && isTrainingDayKind(day.kind) && day.sessions >= 1) {
      this.sessionsLoad.set('loading');
      // A day either side of the UTC date, so no zone offset can push one of the day's sessions
      // out of the request; the list is then narrowed to the date in the profile's zone.
      const from = new Date(Date.parse(`${date}T00:00:00Z`) - DAY_MS).toISOString();
      const to = new Date(Date.parse(`${date}T00:00:00Z`) + 2 * DAY_MS).toISOString();
      this.requests.push(
        this.data
          .getWorkoutSessionsInRange(from, to)
          .pipe(
            map((list) =>
              list.filter((session) => session.status === 'COMPLETED' && dateKeyInTimezone(session.completedAt || session.startedAt, zone) === date)
            ),
            switchMap((list) =>
              list.length === 1 && list[0].sessionId
                ? this.data.getSession(list[0].sessionId).pipe(map((detail) => ({ list, detail })))
                : of({ list, detail: null })
            )
          )
          .subscribe({
            next: ({ list, detail }) => {
              this.sessions.set(list.map((session) => ({ startedAt: session.startedAt, kind: toDayKind(session.kind) })));
              this.exercises.set(
                [...(detail?.exercises ?? [])].sort((a, b) => a.sequence - b.sequence).map((exercise) => exercise.exerciseNameSnapshot)
              );
              this.sessionsLoad.set('done');
            },
            error: () => this.sessionsLoad.set('done')
          })
      );
    }

    // A date still to come has no food to ask for.
    const reference = this.state.referenceDate();
    if (!reference || date <= reference) {
      this.foodLoad.set('loading');
      // The summary is asked for by a local Date built from the key's parts, so the date the
      // service formats is the picked date whatever the device's zone.
      const [year, month, dayOfMonth] = date.split('-').map(Number);
      this.requests.push(
        this.data.getDailyNutritionSummary(new Date(year, month - 1, dayOfMonth)).subscribe({
          next: (summary) => {
            this.food.set(summary);
            this.foodLoad.set('done');
          },
          error: () => this.foodLoad.set('done')
        })
      );
    }
  }
}

function toDayKind(kind: string | null | undefined): DayKind | null {
  return kind != null && isTrainingDayKind(kind as DayKind) ? (kind as DayKind) : null;
}
