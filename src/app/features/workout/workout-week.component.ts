import { Component, computed, input, output } from '@angular/core';

import { DayKind, WeeklyTrainingInsight, WorkoutSession } from '../../core/fitsync.models';
import { PlanDayGlyphComponent } from './plan-day-glyph.component';
import { lastLine, lastTitle, weekCount, weekRangeLabel, weekTiles } from './workout-week';

const KINDS: readonly DayKind[] = ['STRENGTH', 'CARDIO', 'MOBILITY', 'SPORT'];

/**
 * The head of the Workout page in one card: the seven days of this week (trained, today, planned),
 * how many sessions this week and in all, and the last session as a row that opens its page.
 */
@Component({
  selector: 'app-workout-week',
  imports: [PlanDayGlyphComponent],
  template: `
    <div class="head">
      <span class="eyebrow">This week</span>
      @if (range()) {
        <span class="range">{{ range() }}</span>
      }
    </div>
    <div class="body">
      @if (tiles().length) {
        <ol class="days" aria-label="This week">
          @for (tile of tiles(); track tile.date) {
            <li class="day" [attr.aria-label]="tile.weekday + ', ' + describe(tile.state, tile.caption)">
              <span class="weekday" [class.now]="tile.state === 'today'">{{ tile.weekday }}</span>
              <span class="tile" [class]="'tile ' + tile.state">
                @if (tile.kind && tile.state !== 'none') {
                  <app-plan-day-glyph [kind]="tile.kind" [size]="18" />
                }
              </span>
              <span class="caption" [class.now]="tile.state === 'today'">{{ tile.caption }}</span>
            </li>
          }
        </ol>
      }
      <div class="figures">
        <div class="figure">
          <strong>{{ count() }}</strong>
          <span>this week</span>
        </div>
        <div class="figure">
          <strong>{{ total() }}</strong>
          <span>all time</span>
        </div>
        @if (last(); as session) {
          <button class="last" type="button" (click)="openSession.emit(session)">
            <span class="last-kind" aria-hidden="true"><app-plan-day-glyph [kind]="kindOf(session)" [size]="16" /></span>
            <span class="last-text">
              <strong>{{ title() }}</strong>
              <span>{{ line() }}</span>
            </span>
            <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6"></path></svg>
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './workout-week.component.scss'
})
export class WorkoutWeekComponent {
  readonly insight = input<WeeklyTrainingInsight | null>(null);
  /** Completed sessions in all. */
  readonly total = input(0);
  readonly last = input<WorkoutSession | null>(null);
  readonly openSession = output<WorkoutSession>();

  protected readonly tiles = computed(() => weekTiles(this.insight()));
  protected readonly count = computed(() => weekCount(this.insight()));
  protected readonly range = computed(() => weekRangeLabel(this.insight()));
  protected readonly title = computed(() => {
    const session = this.last();
    return session ? lastTitle(session) : '';
  });
  protected readonly line = computed(() => {
    const session = this.last();
    return session ? lastLine(session) : '';
  });

  protected kindOf(session: WorkoutSession): DayKind {
    const kind = (session.kind ?? '').toUpperCase() as DayKind;
    return KINDS.includes(kind) ? kind : 'STRENGTH';
  }

  protected describe(state: string, caption: string): string {
    switch (state) {
      case 'done':
        return caption ? `trained, ${caption}` : 'trained';
      case 'today':
        return 'today';
      case 'planned':
        return 'planned';
      default:
        return 'nothing';
    }
  }
}
